import { createClient } from '@supabase/supabase-js'

// IMPORTANTE: usa SERVICE_ROLE_KEY (não a anon key) — só roda no
// servidor. Mesmo padrão de api/create-pix.js e api/webhook.js.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { phone, password, username, refCode, recoveryEmail } = req.body || {}

    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      return res.status(400).json({ error: 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha precisa ter ao menos 6 caracteres.' })
    }
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Nome de usuário precisa ter ao menos 3 caracteres.' })
    }

    const fakeEmail = `tel${digits}@long777.phone`

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true, // nasce confirmada — não existe caixa de entrada real pra confirmar
      user_metadata: {
        username,
        ref_code: refCode || null,
        is_phone_account: true,
        phone_number: digits,
        recovery_email: recoveryEmail || null,
      },
    })

    if (error) {
      const msg = error.message.includes('already registered')
        ? 'Este número de telefone já está cadastrado.'
        : error.message
      return res.status(400).json({ error: msg })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[phone-signup]', err)
    return res.status(500).json({ error: 'Erro interno ao criar conta.' })
  }
}
