-- ═══════════════════════════════════════════════════════════════
--  FASE 6 — Recompensa de login diário (Nível 2)
--  Rode este script no SQL Editor do Supabase.
--  Não altera nenhuma coluna/função existente — só adiciona.
-- ═══════════════════════════════════════════════════════════════

-- 1. Coluna de controle: última data (fuso de Brasília) em que o
--    usuário reivindicou o bônus diário.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_daily_reward DATE;

-- 2. RPC segura de reivindicação.
--    - Só o próprio usuário autenticado pode chamar pra si mesmo.
--    - Lock de linha (FOR UPDATE) evita reivindicar 2x em cliques rápidos.
--    - Valor fixo e transparente (sem aleatoriedade, sem "caixa surpresa").
CREATE OR REPLACE FUNCTION public.claim_daily_reward(
  p_user_id UUID
)
RETURNS TABLE(claimed BOOLEAN, new_balance DECIMAL, amount DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_claim  DATE;
  v_current_bal DECIMAL;
  v_new_bal     DECIMAL;
  v_amount      CONSTANT DECIMAL := 1.00; -- valor fixo do bônus diário
  v_today       DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT balance, last_daily_reward INTO v_current_bal, v_last_claim
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- Já reivindicado hoje (fuso de Brasília) — não credita de novo
  IF v_last_claim IS NOT NULL AND v_last_claim = v_today THEN
    RETURN QUERY SELECT FALSE, v_current_bal, 0.00::DECIMAL;
    RETURN;
  END IF;

  v_new_bal := v_current_bal + v_amount;

  UPDATE public.profiles
  SET balance = v_new_bal,
      last_daily_reward = v_today
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_new_bal, v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_reward(UUID) TO authenticated;
