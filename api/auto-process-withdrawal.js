// ═══════════════════════════════════════════════════════════════
//  /api/auto-process-withdrawal
//  Chamado automaticamente pelo frontend logo após request_withdrawal,
//  SE o valor estiver dentro do limite automático.
//  O limite é validado aqui no servidor (nunca confia no frontend).
// ═══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { sendPixTransfer } from '../lib/mercadopago-transfer.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const AUTO_THRESHOLD = Number(process.env.AUTO_WITHDRAWAL_THRESHOLD || 50)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Não autenticado' })

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const { withdrawalId } = req.body
    if (!withdrawalId) return res.status(400).json({ error: 'withdrawalId obrigatório' })

    // ── Confirma que o saque é do próprio usuário ───────────────
    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('id, user_id, amount, status')
      .eq('id', withdrawalId)
      .single()

    if (fetchError || !withdrawal) {
      return res.status(404).json({ error: 'Saque não encontrado' })
    }
    if (withdrawal.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    // ── Valor acima do limite → fica pendente pra aprovação manual ──
    if (Number(withdrawal.amount) > AUTO_THRESHOLD) {
      return res.status(200).json({ ok: true, auto: false, reason: 'above_auto_threshold' })
    }

    // ── Trava e processa automaticamente ────────────────────────
    const { data: claim, error: claimError } = await supabaseAdmin
      .rpc('claim_withdrawal_for_processing', { p_withdrawal_id: withdrawalId })

    if (claimError || !claim?.ok) {
      // já foi pego por outra chamada, ou não está mais pendente — tudo bem, não é erro fatal
      return res.status(200).json({ ok: true, auto: false, reason: 'already_claimed' })
    }

    const result = await sendPixTransfer({
      accessToken: MP_ACCESS_TOKEN,
      amount: claim.amount,
      pixKey: claim.pix_key,
      pixKeyType: claim.pix_key_type,
      recipientName: claim.recipient_name,
      documentType: claim.document_type,
      documentNumber: claim.document_number,
      idempotencyKey: `withdrawal-${withdrawalId}`,
    })

    if (result.ok) {
      await supabaseAdmin.rpc('admin_process_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_new_status: 'completed',
        p_mp_payment_id: result.mpTransferId,
      })
      return res.status(200).json({ ok: true, auto: true, completed: true })
    }

    await supabaseAdmin.rpc('admin_process_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_new_status: 'rejected',
      p_rejection_reason: result.message,
    })

    return res.status(200).json({ ok: true, auto: true, completed: false, error: result.message })

  } catch (err) {
    console.error('[auto-process-withdrawal] exceção:', err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
