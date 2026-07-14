// ═══════════════════════════════════════════════════════════════
//  AdminPanel — Painel oculto de teste
//  Acesso: /admin?key=SUA_CHAVE_SECRETA
//  Permite creditar/debitar saldo SEM passar pelo Mercado Pago,
//  útil para testar o sistema completo antes/depois de ligar PIX real.
//
//  Segurança: a chave é comparada no frontend só para esconder a UI;
//  a real proteção está no backend (RPC admin_add_balance verifica
//  raw_app_meta_data->>'role' = 'admin' no Supabase Auth).
//  Configure isso manualmente no Supabase Dashboard:
//  Authentication → Users → seu usuário → User Metadata → role: admin
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { supabase, hasSupabase } from '../../lib/supabase'

const QUICK_VALUES = [10, 50, 100, 1000]
const QUICK_NEGATIVE = [-10, -50, -100]

export function AdminPanel({ user }) {
  const [targetEmail, setTargetEmail] = useState('')
  const [targetUser, setTargetUser] = useState(null)
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')
  const [customAmount, setCustomAmount] = useState('')

  // ── Saques pendentes ──────────────────────────────────────────
  const [pendingWithdrawals, setPendingWithdrawals] = useState([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  useEffect(() => { loadPendingWithdrawals() }, [])

  async function loadPendingWithdrawals() {
    setLoadingWithdrawals(true)
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('id, user_id, amount, pix_key, pix_key_type, status, created_at, profiles(email, username)')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })

    if (!error) setPendingWithdrawals(data || [])
    setLoadingWithdrawals(false)
  }

  async function approveWithdrawal(withdrawalId) {
    setProcessingId(withdrawalId)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    try {
      const res = await fetch('/api/process-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ withdrawalId }),
      })
      const result = await res.json()

      if (!res.ok) {
        setMsg(`Erro no saque: ${result.error}`)
        setMsgType('error')
      } else {
        setMsg('✅ Saque processado com sucesso!')
        setMsgType('success')
      }
    } catch (err) {
      setMsg('Erro de conexão ao processar saque.')
      setMsgType('error')
    }
    setProcessingId(null)
    loadPendingWithdrawals()
  }

  async function rejectWithdrawal(withdrawalId) {
    if (!confirm('Rejeitar este saque? O saldo será devolvido ao jogador.')) return
    setProcessingId(withdrawalId)
    const { error } = await supabase.rpc('admin_process_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_new_status: 'rejected',
      p_rejection_reason: 'Rejeitado manualmente pelo admin',
    })
    if (error) {
      setMsg(`Erro ao rejeitar: ${error.message}`)
      setMsgType('error')
    } else {
      setMsg('Saque rejeitado, saldo devolvido.')
      setMsgType('success')
    }
    setProcessingId(null)
    loadPendingWithdrawals()
  }

  async function searchUser() {
    if (!targetEmail) return
    setSearching(true)
    setMsg('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, username, balance, rounds, wins')
      .ilike('email', targetEmail.trim())
      .maybeSingle()

    if (error || !data) {
      setMsg('Usuário não encontrado.')
      setMsgType('error')
      setTargetUser(null)
    } else {
      setTargetUser(data)
      setMsg('')
    }
    setSearching(false)
  }

  async function applyAmount(amount) {
    if (!targetUser) return
    setMsg('')
    const { data, error } = await supabase.rpc('admin_add_balance', {
      p_user_id: targetUser.id,
      p_amount: amount,
    })

    if (error) {
      setMsg(`Erro: ${error.message}`)
      setMsgType('error')
      return
    }

    setTargetUser(prev => ({ ...prev, balance: data }))
    setMsg(`✅ Saldo atualizado: R$ ${Number(data).toFixed(2).replace('.', ',')}`)
    setMsgType('success')
  }

  async function zeroBalance() {
    if (!targetUser) return
    if (!confirm(`Zerar saldo de ${targetUser.email}?`)) return
    const delta = -Number(targetUser.balance)
    await applyAmount(delta)
  }

  if (!hasSupabase) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ff3d5a' }}>Supabase não configurado.</div>
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: 'rgba(10,15,30,.9)', border: '1px solid rgba(255,61,90,.3)', borderRadius: 16 }}>
      <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 21, color: '#ff3d5a', marginBottom: 4, textAlign: 'center' }}>
        🔧 PAINEL ADMIN — MODO TESTE
      </div>
      <div style={{ fontSize: 15, color: '#6a7a9a', textAlign: 'center', marginBottom: 24 }}>
        Crédito/débito manual sem envolver Mercado Pago real
      </div>

      {/* Busca usuário */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          placeholder="Email do usuário"
          value={targetEmail}
          onChange={e => setTargetEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchUser()}
          style={{ flex: 1, padding: '10px 12px', background: 'rgba(5,7,15,.9)', border: '1px solid rgba(255,200,80,.2)', borderRadius: 8, color: '#eeeaf0', fontSize: 17 }}
        />
        <button onClick={searchUser} disabled={searching} style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: '#4da6ff', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
          {searching ? '...' : 'BUSCAR'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 16, marginBottom: 16, background: msgType === 'error' ? 'rgba(255,61,90,.1)' : 'rgba(45,222,152,.1)', color: msgType === 'error' ? '#ff3d5a' : '#2dde98' }}>
          {msg}
        </div>
      )}

      {targetUser && (
        <>
          <div style={{ background: 'rgba(245,200,66,.05)', border: '1px solid rgba(245,200,66,.15)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 17, color: '#f5c842', fontWeight: 700 }}>{targetUser.username}</div>
            <div style={{ fontSize: 15, color: '#6a7a9a', marginBottom: 8 }}>{targetUser.email}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 26, fontWeight: 700, color: '#fff' }}>
              R$ {Number(targetUser.balance).toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div style={{ fontSize: 14, color: '#6a7a9a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Adicionar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
            {QUICK_VALUES.map(v => (
              <button key={v} onClick={() => applyAmount(v)} style={{ padding: '10px 0', borderRadius: 8, border: '1px solid rgba(45,222,152,.3)', background: 'rgba(45,222,152,.08)', color: '#2dde98', fontWeight: 700, cursor: 'pointer', fontSize: 17 }}>
                +{v}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 14, color: '#6a7a9a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Remover</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 16 }}>
            {QUICK_NEGATIVE.map(v => (
              <button key={v} onClick={() => applyAmount(v)} style={{ padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,61,90,.3)', background: 'rgba(255,61,90,.08)', color: '#ff3d5a', fontWeight: 700, cursor: 'pointer', fontSize: 17 }}>
                {v}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="number"
              placeholder="Valor customizado"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              style={{ flex: 1, padding: '9px 12px', background: 'rgba(5,7,15,.9)', border: '1px solid rgba(255,200,80,.2)', borderRadius: 8, color: '#eeeaf0', fontSize: 17 }}
            />
            <button onClick={() => { applyAmount(Number(customAmount)); setCustomAmount(''); }} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: '#f5c842', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
              APLICAR
            </button>
          </div>

          <button onClick={zeroBalance} style={{ width: '100%', padding: '10px', border: '1px solid rgba(255,61,90,.4)', borderRadius: 8, background: 'transparent', color: '#ff3d5a', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>
            🗑️ ZERAR SALDO
          </button>
        </>
      )}

      {/* ── Saques pendentes ────────────────────────────────────── */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 18, color: '#00e5b0' }}>
            🏦 Saques pendentes {pendingWithdrawals.length > 0 && `(${pendingWithdrawals.length})`}
          </div>
          <button onClick={loadPendingWithdrawals} style={{ background: 'none', border: 'none', color: '#6a7a9a', cursor: 'pointer', fontSize: 14 }}>
            ↻ atualizar
          </button>
        </div>

        {loadingWithdrawals && <div style={{ color: '#6a7a9a', fontSize: 15 }}>Carregando...</div>}

        {!loadingWithdrawals && pendingWithdrawals.length === 0 && (
          <div style={{ color: '#6a7a9a', fontSize: 15 }}>Nenhum saque pendente. 🎉</div>
        )}

        {pendingWithdrawals.map(w => (
          <div key={w.id} style={{ background: 'rgba(0,229,176,.05)', border: '1px solid rgba(0,229,176,.15)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 15, color: '#eeeaf0' }}>{w.profiles?.username || w.profiles?.email || w.user_id}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#f5c842' }}>R$ {Number(w.amount).toFixed(2).replace('.', ',')}</div>
            </div>
            <div style={{ fontSize: 14, color: '#6a7a9a', marginBottom: 10 }}>
              PIX ({w.pix_key_type}): {w.pix_key} · status: {w.status}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => approveWithdrawal(w.id)}
                disabled={processingId === w.id}
                style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#00e5b0,#00b88a)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
              >
                {processingId === w.id ? '...' : '✅ Aprovar'}
              </button>
              <button
                onClick={() => rejectWithdrawal(w.id)}
                disabled={processingId === w.id}
                style={{ flex: 1, padding: '8px', border: '1px solid rgba(255,61,90,.4)', borderRadius: 8, background: 'transparent', color: '#ff3d5a', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
              >
                ❌ Rejeitar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
