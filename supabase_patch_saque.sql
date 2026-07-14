-- ═══════════════════════════════════════════════════════════════
--  PATCH — Automação de saque (híbrido: auto até limite + manual)
--  Rode no SQL Editor do Supabase, DEPOIS do supabase_saque.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Corrige admin_process_withdrawal para aceitar chamadas do backend ──
-- (service_role, usado pelas Vercel Functions) além do admin logado
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(
  p_withdrawal_id UUID,
  p_new_status    TEXT,
  p_mp_payment_id TEXT DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.withdrawal_requests;
  v_new_balance DECIMAL;
BEGIN
  -- Permite: (a) chamada do backend com service_role KEY, ou
  --          (b) usuário logado com role admin
  IF NOT (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_withdrawal.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed', 'status', v_withdrawal.status);
  END IF;

  IF p_new_status = 'rejected' THEN
    UPDATE public.profiles
    SET balance = balance + v_withdrawal.amount
    WHERE id = v_withdrawal.user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
    VALUES (v_withdrawal.user_id, 'deposit', v_withdrawal.amount, v_new_balance, 'Saque rejeitado - saldo devolvido: ' || COALESCE(p_rejection_reason, 'sem motivo informado'));
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_new_status,
      mp_payment_id = COALESCE(p_mp_payment_id, mp_payment_id),
      rejection_reason = p_rejection_reason,
      processed_at = NOW()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── 2. RPC: marca saque como "processing" (trava contra double-click / double-trigger) ──
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

  UPDATE public.withdrawal_requests
  SET status = 'processing'
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal.id,
    'user_id', v_withdrawal.user_id,
    'amount', v_withdrawal.amount,
    'pix_key', v_withdrawal.pix_key,
    'pix_key_type', v_withdrawal.pix_key_type
  );
END;
$$;

-- ─── 3. Permite admin ver TODOS os saques pendentes no painel ──────
DROP POLICY IF EXISTS "withdrawal_select_admin_all" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_select_admin_all"
  ON public.withdrawal_requests FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

SELECT 'Patch de automação de saque aplicado com sucesso!' AS status;
