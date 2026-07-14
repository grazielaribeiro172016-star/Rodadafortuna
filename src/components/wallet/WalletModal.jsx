// ═══════════════════════════════════════════════════════════════
//  WalletModal — Tela de depósito via PIX
//  Fluxo: escolhe valor → gera QR → aguarda confirmação → fecha
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'
import { supabase, hasSupabase } from '../../lib/supabase'

const QUICK_AMOUNTS = [20, 50, 100, 200]

const DOCUMENT_TYPES = [
  { id: 'CPF', label: 'CPF' },
  { id: 'CNPJ', label: 'CNPJ' },
]

export function WalletModal({ user, profile, onClose, onDeposited, onKycSaved }) {
  const kycComplete = !!(profile?.full_name && profile?.document_number)

  const [amount, setAmount] = useState(50)
  const [customAmount, setCustomAmount] = useState('')
  const [step, setStep] = useState('choose') // choose | generating | waiting | success | error
  const [pixData, setPixData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef(null)
  const pixRecordIdRef = useRef(null)

  // ── Nudge de cadastro (nome/CPF), oferecido após o depósito ────
  // Momento escolhido de propósito: é quando o usuário está mais
  // confiante (acabou de colocar dinheiro de verdade), então pedir
  // 2 campos a mais pra "deixar tudo pronto pro saque" tem muito
  // menos atrito do que no cadastro inicial ou na hora do saque.
  const [showKycNudge, setShowKycNudge] = useState(false)
  const [kycName, setKycName] = useState('')
  const [kycDocType, setKycDocType] = useState('CPF')
  const [kycDocNumber, setKycDocNumber] = useState('')
  const [kycSaving, setKycSaving] = useState(false)
  const [kycMsg, setKycMsg] = useState('')

  async function saveKycFromNudge() {
    setKycMsg('')
    if (kycName.trim().length < 5) { setKycMsg('Informe seu nome completo.'); return }
    const expectedLen = kycDocType === 'CNPJ' ? 14 : 11
    if (kycDocNumber.length !== expectedLen) { setKycMsg(`${kycDocType} deve ter ${expectedLen} dígitos.`); return }

    setKycSaving(true)
    try {
      const { data, error } = await supabase.rpc('update_kyc_data', {
        p_user_id: user.id,
        p_full_name: kycName.trim(),
        p_document_type: kycDocType,
        p_document_number: kycDocNumber,
      })
      if (error || !data?.ok) {
        setKycMsg('Não foi possível salvar. Você pode completar depois, na tela de saque.')
        setKycSaving(false)
        return
      }
      onKycSaved?.()
      setShowKycNudge(false)
    } catch (err) {
      console.error(err)
      setKycMsg('Erro de conexão. Você pode completar depois, na tela de saque.')
    } finally {
      setKycSaving(false)
    }
  }

  useEffect(() => () => clearInterval(pollRef.current), [])


  function pickAmount(v) {
    setAmount(v)
    setCustomAmount('')
  }

  function handleCustomChange(v) {
    const clean = v.replace(/[^0-9]/g, '')
    setCustomAmount(clean)
    if (clean) setAmount(Number(clean))
  }

  async function generatePix() {
    if (amount < 5) { setErrorMsg('Valor mínimo: R$ 5,00'); return }
    if (amount > 5000) { setErrorMsg('Valor máximo: R$ 5.000,00'); return }
    setStep('generating')
    setErrorMsg('')

    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userId: user.id, userEmail: user.email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao gerar PIX')
        setStep('choose')
        return
      }

      setPixData(data)
      pixRecordIdRef.current = data.pixRecordId
      setStep('waiting')
      startPolling(data.pixRecordId)

    } catch (err) {
      console.error(err)
      setErrorMsg('Erro de conexão. Tente novamente.')
      setStep('choose')
    }
  }

  function startPolling(pixRecordId) {
    // Verifica no Supabase a cada 3s se o pagamento foi confirmado
    pollRef.current = setInterval(async () => {
      if (!hasSupabase) return
      const { data, error } = await supabase
        .from('pix_payments')
        .select('status, credited')
        .eq('id', pixRecordId)
        .single()

      if (error) return

      if (data.credited) {
        clearInterval(pollRef.current)
        setStep('success')
        setShowKycNudge(!kycComplete)
        onDeposited?.()
      } else if (data.status === 'rejected' || data.status === 'cancelled') {
        clearInterval(pollRef.current)
        setErrorMsg('Pagamento não foi aprovado.')
        setStep('error')
      }
    }, 3000)

    // Timeout de 30 minutos (expira junto com o PIX)
    setTimeout(() => {
      clearInterval(pollRef.current)
      if (step === 'waiting') {
        setErrorMsg('Tempo esgotado. Gere um novo QR Code.')
        setStep('error')
      }
    }, 30 * 60 * 1000)
  }

  function copyPixCode() {
    if (!pixData?.qrCode) return
    navigator.clipboard.writeText(pixData.qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    clearInterval(pollRef.current)
    setStep('choose')
    setPixData(null)
    setErrorMsg('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(5,7,15,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'rgba(10,15,30,.98)', border: '1px solid rgba(245,200,66,.2)', borderRadius: 20, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 21, fontWeight: 700, color: '#f5c842' }}>💰 Depositar via PIX</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6a7a9a', fontSize: 26, cursor: 'pointer' }}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(255,61,90,.1)', border: '1px solid rgba(255,61,90,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 17, color: '#ff3d5a', marginBottom: 16 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* ── STEP: Escolher valor ── */}
        {step === 'choose' && (
          <>
            <div style={{ fontSize: 16, color: '#6a7a9a', marginBottom: 12 }}>Escolha o valor do depósito:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
              {QUICK_AMOUNTS.map(v => (
                <button key={v} onClick={() => pickAmount(v)} style={{
                  padding: '12px 0', borderRadius: 10,
                  border: `2px solid ${amount === v && !customAmount ? '#f5c842' : 'rgba(255,200,80,.2)'}`,
                  background: amount === v && !customAmount ? 'rgba(245,200,66,.12)' : 'transparent',
                  color: amount === v && !customAmount ? '#f5c842' : '#6a7a9a',
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 17, fontWeight: 700, cursor: 'pointer',
                }}>R$ {v}</button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ou digite outro valor"
              value={customAmount}
              onChange={e => handleCustomChange(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,7,15,.9)', border: '1px solid rgba(255,200,80,.2)', borderRadius: 10, color: '#eeeaf0', fontFamily: "'Rajdhani',sans-serif", fontSize: 18, outline: 'none', marginBottom: 20 }}
            />
            <button onClick={generatePix} style={{ width: '100%', padding: '13px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#f5c842,#e8a020)', color: '#000', fontFamily: "'Cinzel Decorative',serif", fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
              GERAR PIX — R$ {amount.toFixed(2).replace('.', ',')}
            </button>
          </>
        )}

        {/* ── STEP: Gerando ── */}
        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 47, marginBottom: 16 }}>⏳</div>
            <div style={{ color: '#6a7a9a', fontSize: 17 }}>Gerando seu PIX...</div>
          </div>
        )}

        {/* ── STEP: Aguardando pagamento ── */}
        {step === 'waiting' && pixData && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, color: '#6a7a9a', marginBottom: 16 }}>
              Escaneie o QR Code ou copie o código abaixo
            </div>
            {pixData.qrCodeBase64 && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, display: 'inline-block' }}>
                <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" style={{ width: 200, height: 200 }} />
              </div>
            )}
            <button onClick={copyPixCode} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(245,200,66,.3)', background: 'rgba(245,200,66,.08)', color: '#f5c842', fontFamily: "'Rajdhani',sans-serif", fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
              {copied ? '✅ Copiado!' : '📋 Copiar código PIX'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, color: '#00e5b0' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e5b0', animation: 'bp 1.5s infinite' }} />
              Aguardando confirmação do pagamento...
            </div>
            <div style={{ fontSize: 15, color: '#6a7a9a', marginTop: 12 }}>
              O saldo será creditado automaticamente após o pagamento.
            </div>
          </div>
        )}

        {/* ── STEP: Sucesso ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 63, marginBottom: 16 }}>🎉</div>
            <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 21, color: '#2dde98', marginBottom: 8 }}>Depósito confirmado!</div>
            <div style={{ fontSize: 17, color: '#6a7a9a', marginBottom: 20 }}>R$ {amount.toFixed(2).replace('.', ',')} já está disponível no seu saldo.</div>

            {showKycNudge && (
              <div style={{ textAlign: 'left', background: 'rgba(0,229,176,.06)', border: '1px solid rgba(0,229,176,.2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 16, color: '#00e5b0', fontWeight: 700, marginBottom: 6 }}>🏦 Deixe seu saque pronto pra depois</div>
                <div style={{ fontSize: 15, color: '#6a7a9a', marginBottom: 14, lineHeight: 1.5 }}>
                  Confirme seu nome e CPF agora (leva 10 segundos) e não precisa mais fazer isso quando for sacar.
                </div>

                {kycMsg && <div style={{ fontSize: 14, color: '#ff3d5a', marginBottom: 10 }}>⚠️ {kycMsg}</div>}

                <input
                  type="text"
                  placeholder="Nome completo"
                  value={kycName}
                  onChange={e => { setKycName(e.target.value); setKycMsg(''); }}
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(5,7,15,.9)', border: '1px solid rgba(0,229,176,.2)', borderRadius: 10, color: '#eeeaf0', fontFamily: "'Rajdhani',sans-serif", fontSize: 16, outline: 'none', marginBottom: 10 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 10 }}>
                  {DOCUMENT_TYPES.map(t => (
                    <button key={t.id} onClick={() => { setKycDocType(t.id); setKycDocNumber(''); setKycMsg(''); }} style={{
                      padding: '8px 0', borderRadius: 8,
                      border: `1.5px solid ${kycDocType === t.id ? '#00e5b0' : 'rgba(0,229,176,.2)'}`,
                      background: kycDocType === t.id ? 'rgba(0,229,176,.12)' : 'transparent',
                      color: kycDocType === t.id ? '#00e5b0' : '#6a7a9a',
                      fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    }}>{t.label}</button>
                  ))}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={kycDocType === 'CNPJ' ? 'CNPJ (somente números)' : 'CPF (somente números)'}
                  value={kycDocNumber}
                  onChange={e => { setKycDocNumber(e.target.value.replace(/\D/g, '').slice(0, kycDocType === 'CNPJ' ? 14 : 11)); setKycMsg(''); }}
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(5,7,15,.9)', border: '1px solid rgba(0,229,176,.2)', borderRadius: 10, color: '#eeeaf0', fontFamily: "'Rajdhani',sans-serif", fontSize: 16, outline: 'none', marginBottom: 14 }}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowKycNudge(false)} style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,200,80,.2)', borderRadius: 10, background: 'transparent', color: '#6a7a9a', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    AGORA NÃO
                  </button>
                  <button onClick={saveKycFromNudge} disabled={kycSaving} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#00e5b0,#00b88a)', color: '#000', fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 700, cursor: kycSaving ? 'default' : 'pointer', opacity: kycSaving ? 0.7 : 1 }}>
                    {kycSaving ? 'SALVANDO...' : 'CONFIRMAR'}
                  </button>
                </div>
              </div>
            )}

            <button onClick={onClose} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#2dde98,#1ab578)', color: '#000', fontFamily: "'Cinzel Decorative',serif", fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
              FECHAR
            </button>
          </div>
        )}

        {/* ── STEP: Erro ── */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 63, marginBottom: 16 }}>😔</div>
            <button onClick={reset} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#f5c842,#e8a020)', color: '#000', fontFamily: "'Cinzel Decorative',serif", fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
              TENTAR NOVAMENTE
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
