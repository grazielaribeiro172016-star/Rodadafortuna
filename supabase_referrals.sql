-- ═══════════════════════════════════════════════════════════════
--  Sistema de indicação (viralização) — Fase 9
--  Rode no SQL Editor do Supabase, depois de todos os patches
--  anteriores (inclusive supabase_lock_profile_writes.sql).
--
--  Importante: o bônus de indicação é creditado em demo_balance
--  (saldo de simulação, nova coluna, separado de balance/saldo real).
--  NÃO toca em balance, NÃO toca em nada do fluxo de PIX/saque real.
--  Toda escrita acontece via RPC SECURITY DEFINER — mesmo padrão de
--  segurança do restante do projeto, nada de update direto do client.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Nova coluna: saldo demo persistido (só decorativo/inicial) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_balance DECIMAL(12,2) NOT NULL DEFAULT 100.00;

-- ─── 2. Tabela de indicações ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id   UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','credited')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at   TIMESTAMPTZ,
  CONSTRAINT no_self_referral CHECK (referrer_id <> referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Cada um só vê as indicações onde é indicador ou indicado.
DROP POLICY IF EXISTS "referrals_select_own" ON public.referrals;
CREATE POLICY "referrals_select_own"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Nenhuma escrita direta do client — só pelas RPCs abaixo (mesmo
-- princípio do patch de profiles: nada de INSERT/UPDATE/DELETE direto).
REVOKE INSERT, UPDATE, DELETE ON public.referrals FROM authenticated, anon;

-- ─── 3. Trigger de cadastro passa a registrar a indicação também ──
-- Recebe o código do indicador via user_metadata (ref_code), setado
-- no options.data do supabase.auth.signUp() no front. Roda como
-- SECURITY DEFINER, então funciona mesmo antes de haver sessão
-- (ex: com confirmação de e-mail pendente).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username    TEXT;
  v_ref_code    TEXT;
  v_referrer_id UUID;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 9000 + 1000)::TEXT
  );

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || '_' || FLOOR(RANDOM() * 100)::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, email, username, balance)
  VALUES (NEW.id, NEW.email, v_username, 0.00)
  ON CONFLICT (id) DO NOTHING;

  -- Registra a indicação, se veio um ?ref=username válido no cadastro.
  v_ref_code := NEW.raw_user_meta_data->>'ref_code';
  IF v_ref_code IS NOT NULL AND TRIM(v_ref_code) <> '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles WHERE username = v_ref_code;
    IF v_referrer_id IS NOT NULL AND v_referrer_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, status)
      VALUES (v_referrer_id, NEW.id, 'pending')
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- (o trigger on_auth_user_created já existe e aponta pra essa função —
--  não precisa recriar o trigger em si, só a função, que foi substituída acima)

-- ─── 4. RPC: credita o bônus (chamada pelo front após a 1ª rodada
--         do indicado, em qualquer modo). Valor fixo no servidor —
--         o client NUNCA controla o valor do bônus.
CREATE OR REPLACE FUNCTION public.credit_referral_bonus()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus DECIMAL := 5.00; -- valor fixo, definido no servidor
  v_row   public.referrals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_row FROM public.referrals
  WHERE referred_id = auth.uid() AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_referral');
  END IF;

  UPDATE public.referrals SET status = 'credited', credited_at = NOW()
  WHERE id = v_row.id;

  UPDATE public.profiles SET demo_balance = demo_balance + v_bonus
  WHERE id = v_row.referrer_id;

  UPDATE public.profiles SET demo_balance = demo_balance + v_bonus
  WHERE id = v_row.referred_id;

  RETURN jsonb_build_object('ok', true, 'amount', v_bonus);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_referral_bonus() TO authenticated;

-- ─── 5. RPC: estatísticas de indicação (pro painel de perfil) ────
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credited INT;
  v_pending  INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('credited', 0, 'pending', 0);
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'credited'),
         COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_credited, v_pending
  FROM public.referrals
  WHERE referrer_id = auth.uid();

  RETURN jsonb_build_object('credited', v_credited, 'pending', v_pending);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;

-- ─── Verificação ──────────────────────────────────────────────
SELECT 'Sistema de indicação instalado — bônus só em demo_balance, PIX/saque intocados.' AS status;
