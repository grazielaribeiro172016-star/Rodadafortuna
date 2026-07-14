// ═══════════════════════════════════════════════════════════════
//  lib/mercadopago-transfer.js
//  Wrapper pra chamada de PIX-out (envio) ao Mercado Pago.
//
//  ⚠️ AVISO IMPORTANTE:
//  Diferente do /v1/payments (receber), o Mercado Pago NÃO documenta
//  publicamente um endpoint de "enviar PIX pra chave de terceiro"
//  pra contas comerciais comuns. Este código tenta o endpoint mais
//  plausível, mas é ESPERADO que ele possa falhar com 404 até você
//  confirmar com o suporte/comercial do Mercado Pago se esse recurso
//  está disponível pra sua conta (às vezes chamado de "Payouts API"
//  ou exige adesão como conta de Marketplace).
// ═══════════════════════════════════════════════════════════════

export async function sendPixTransfer({
  accessToken,
  amount,
  pixKey,
  pixKeyType,
  recipientName,
  documentType,   // 'CPF' ou 'CNPJ'
  documentNumber, // apenas dígitos
  idempotencyKey,
}) {
  try {
    const payload = {
      amount,
      description: 'Saque via Plataforma',
      payment_method_id: 'pix',
      counterpart: {
        type: documentType === 'CNPJ' ? 'corporation' : 'individual',
        name: recipientName,
        identification: {
          type: documentType,
          number: documentNumber,
        },
        account: {
          type: pixKeyType,
          id: pixKey,
        },
      },
    }

    const response = await fetch('https://api.mercadopago.com/v1/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 404) {
      return {
        ok: false,
        notSupported: true,
        reason: 'endpoint_not_available',
        message: 'API de transferência não disponível para esta conta. Contate o suporte comercial do Mercado Pago.',
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: 'mp_rejected',
        message: data.message || 'Mercado Pago recusou a transferência',
        detail: data,
      }
    }

    return {
      ok: true,
      // status pode vir 'approved' (concluído na hora) ou 'pending'/'in_process'
      // (assíncrono — considerar tratar via webhook futuramente)
      mpStatus: data.status,
      mpTransferId: data.id ? String(data.id) : null,
      raw: data,
    }

  } catch (err) {
    return {
      ok: false,
      reason: 'exception',
      message: err.message,
    }
  }
}
