-- ═══════════════════════════════════════════════════════════════
--  Patch KYC — nome completo + CPF/CNPJ do titular, coletado UMA VEZ
--  no perfil. Necessário porque a API de transfers do Mercado Pago
--  exige counterpart.name e counterpart.identification, e porque
--  isso trava o destinatário do Pix como sendo o próprio dono da
--  conta (evita saque pra chave/CPF de terceiros).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Novas colunas no perfil ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name       TEXT,
  ADD COLUMN IF NOT EXISTS document_type   TEXT CHECK (document_type IN ('CPF','CNPJ')),
  ADD COLUMN IF NOT EXISTS document_number TEXT;

-- ─── 2. RPC: usuário salva/atualiza seus próprios dados de KYC ──
-- Validação básica de tamanho (11 dígitos CPF / 14 dígitos CNPJ).
-- Isso NÃO substitui uma validação real de dígito verificador —
-- se quiser, dá pra reforçar depois com uma função de checagem de CPF.
CREATE OR REPLACE FUNCTION public.update_kyc_data(
  p_user_id         UUID,
  p_full_name       TEXT,
  p_document_type   TEXT,
  p_document_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_doc TEXT := regexp_replace(p_document_number, '\D', '', 'g');
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_full_name IS NULL OR LENGTH(TRIM(p_full_name)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;

  IF p_document_type NOT IN ('CPF','CNPJ') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_document_type');
  END IF;

  IF (p_document_type = 'CPF' AND LENGTH(v_clean_doc) != 11)
     OR (p_document_type = 'CNPJ' AND LENGTH(v_clean_doc) != 14) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_document_number');
  END IF;

  UPDATE public.profiles
  SET full_name       = TRIM(p_full_name),
      document_type   = p_document_type,
      document_number = v_clean_doc
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── 3. request_withdrawal passa a EXIGIR KYC completo ──────────
-- (recria a função inteira; mesma lógica de antes + checagem no início)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id     UUID,
  p_amount      DECIMAL,
  p_pix_key     TEXT,
  p_pix_key_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance      DECIMAL;
  v_withdrawal_id    UUID;
  v_min_amount       DECIMAL := 20.00;
  v_max_amount       DECIMAL := 2000.00;
  v_full_name        TEXT;
  v_document_number  TEXT;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT full_name, document_number INTO v_full_name, v_document_number
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_full_name IS NULL OR v_document_number IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kyc_incomplete');
  END IF;

  IF p_amount < v_min_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'below_minimum', 'min_amount', v_min_amount);
  END IF;

  IF p_amount > v_max_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'above_maximum', 'max_amount', v_max_amount);
  END IF;

  IF p_pix_key IS NULL OR LENGTH(TRIM(p_pix_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_pix_key');
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'current_balance', v_current_balance);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id = p_user_id AND status IN ('pending','processing')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pending_withdrawal_exists');
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.profiles
  SET balance = v_new_balance
  WHERE id = p_user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount, pix_key, pix_key_type, status)
  VALUES (p_user_id, p_amount, p_pix_key, p_pix_key_type, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'withdrawal', p_amount, v_new_balance, 'Saque solicitado - PIX ' || p_pix_key_type || ' (pendente de processamento)');

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal_id,
    'new_balance', v_new_balance
  );
END;
$$;

-- ─── 4. claim_withdrawal_for_processing agora também devolve ────
--        nome e documento do destinatário (join com profiles)
CREATE OR REPLACE FUNCTION public.claim_withdrawal_for_processing(
  p_withdrawal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.withdrawal_requests;
  v_full_name  TEXT;
  v_doc_type   TEXT;
  v_doc_number TEXT;
BEGIN
  IF NOT (auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acesso restrito ao backend';
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending_or_not_found');
  END IF;

  SELECT full_name, document_type, document_number
  INTO v_full_name, v_doc_type, v_doc_number
  FROM public.profiles
  WHERE id = v_withdrawal.user_id;

  IF v_full_name IS NULL OR v_doc_number IS NULL THEN
    -- Segurança extra: se por algum motivo o KYC sumiu/nunca foi salvo,
    -- não deixa travar o saque em 'processing' sem poder pagar.
    RETURN jsonb_build_object('ok', false, 'reason', 'kyc_incomplete');
  END IF;

  UPDATE public.withdrawal_requests
  SET status = 'processing'
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal.id,
    'user_id', v_withdrawal.user_id,
    'amount', v_withdrawal.amount,
    'pix_key', v_withdrawal.pix_key,
    'pix_key_type', v_withdrawal.pix_key_type,
    'recipient_name', v_full_name,
    'document_type', v_doc_type,
    'document_number', v_doc_number
  );
END;
$$;

SELECT 'Patch KYC aplicado com sucesso!' AS status;
