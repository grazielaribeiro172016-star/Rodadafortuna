-- ═══════════════════════════════════════════════════════════════
--  RODADAFORTUNA — Sistema de indicação com bônus real
--  (Fase 10 — substitui/complementa o supabase_referrals.sql,
--  que só pagava demo_balance no 1º giro. Este aqui paga SALDO
--  REAL, uma única vez, sobre o 1º depósito PIX confirmado do
--  indicado — e é o que alimenta o painel/calculadora do front.)
--
--  Execute no SQL Editor do Supabase, DEPOIS de todos os patches
--  anteriores (precisa de: supabase_fase2.sql, supabase_fase5.sql,
--  supabase_lock_profile_writes.sql, supabase_referrals.sql).
--  Idempotente — pode rodar de novo sem quebrar nada.
--
--  O QUE ESTE ARQUIVO FAZ:
--  1) Adiciona referral_code, referred_by_user_id e
--     first_deposit_reward_generated em profiles.
--  2) Cria a tabela referral_rewards (1 linha por indicado, nunca
--     mais que uma — trava por UNIQUE(referred_user_id)).
--  3) Atualiza handle_new_user() pra gerar o referral_code de cada
--     novo usuário e gravar quem indicou (imutável depois disso —
--     não existe nenhuma RPC que altere referred_by_user_id).
--  4) Cria process_referral_reward() — função idempotente chamada
--     automaticamente por confirm_pix_payment() sempre que um
--     depósito é confirmado.
--  5) Cria reverse_referral_reward() — chamada quando um depósito
--     que já gerou bônus é cancelado/estornado/chargeback depois.
--  6) Substitui confirm_pix_payment() para acionar as duas acima,
--     mantendo 100% do comportamento anterior de crédito de saldo.
--  7) RLS: cada usuário só lê os PRÓPRIOS registros. Nenhuma
--     escrita direta do client — tudo via RPC SECURITY DEFINER.
--  8) RPC get_referral_program_stats() — tudo que o painel precisa
--     numa chamada só (link, contadores, nível, lista de indicados).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colunas novas em profiles ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS first_deposit_reward_generated BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by    ON public.profiles(referred_by_user_id);

-- ─── 2. Gerador de código único (8 chars, sem caracteres ambíguos) ─
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I
  v_code     TEXT;
  v_exists   BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::INT, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Preenche referral_code de quem já existe e ainda não tem
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE id = r.id;
  END LOOP;
END $$;

-- ─── 3. Tabela referral_rewards ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_id        UUID NOT NULL REFERENCES public.pix_payments(id),
  deposit_amount    DECIMAL(12,2) NOT NULL,
  reward_amount     DECIMAL(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','reversed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  CONSTRAINT no_self_referral_reward CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_deposit  ON public.referral_rewards(deposit_id);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_rewards_select_own" ON public.referral_rewards;
CREATE POLICY "referral_rewards_select_own"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Nenhuma escrita direta do client — só pelas funções SECURITY DEFINER abaixo.
REVOKE INSERT, UPDATE, DELETE ON public.referral_rewards FROM authenticated, anon;

-- ─── 4. Novos tipos de transação (bônus e estorno de bônus) ────
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','withdrawal','game_win','game_loss','referral_bonus','referral_reversal'));

-- ─── 5. handle_new_user() — agora também gera referral_code e ──
-- grava referred_by_user_id (uma única vez, na criação da conta;
-- não existe caminho de código que altere essa coluna depois).
-- Aceita ref_code batendo tanto com referral_code (novo, formato
-- /r/{code}) quanto com username (compatibilidade com links antigos
-- ?ref=username já compartilhados antes desta fase).
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
  v_new_code    TEXT;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) || '_' || FLOOR(RANDOM() * 9000 + 1000)::TEXT
  );

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || '_' || FLOOR(RANDOM() * 100)::TEXT;
  END LOOP;

  v_new_code := public.generate_referral_code();

  -- Resolve o indicador ANTES do insert (não pode autoindicar: o próprio
  -- registro ainda não existe, então só valida se achou alguém diferente).
  v_ref_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'ref_code', '')), '');
  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = UPPER(v_ref_code) OR username = v_ref_code
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, username, balance, referral_code, referred_by_user_id)
  VALUES (NEW.id, NEW.email, v_username, 0.00, v_new_code, v_referrer_id)
  ON CONFLICT (id) DO NOTHING;

  -- Mantém o sistema antigo de bônus demo (Fase 9), pago no 1º giro —
  -- continua funcionando em paralelo ao bônus real pago por depósito.
  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, status)
    VALUES (v_referrer_id, NEW.id, 'pending')
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 6. process_referral_reward() — idempotente, chamada pelo ──
-- confirm_pix_payment() sempre que um depósito é confirmado.
-- Paga o bônus SOMENTE no primeiro depósito aprovado do indicado,
-- respeitando as faixas de valor. Protegida contra corrida por
-- FOR UPDATE + UNIQUE(referred_user_id) com ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.process_referral_reward(
  p_deposit_id        UUID,
  p_referred_user_id  UUID,
  p_deposit_amount    DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id             UUID;
  v_already_rewarded        BOOLEAN;
  v_approved_deposits_count INT;
  v_reward                  DECIMAL;
  v_new_balance              DECIMAL;
  v_inserted                 INT;
BEGIN
  -- Lock na linha do indicado: serializa chamadas concorrentes pro
  -- mesmo usuário (ex: webhook duplicado chegando quase junto).
  SELECT referred_by_user_id, first_deposit_reward_generated
  INTO v_referrer_id, v_already_rewarded
  FROM public.profiles
  WHERE id = p_referred_user_id
  FOR UPDATE;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_referrer');
  END IF;

  IF v_already_rewarded THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_rewarded');
  END IF;

  IF p_deposit_amount < 20 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'below_minimum');
  END IF;

  -- Confirma que este é o PRIMEIRO depósito aprovado do indicado
  -- (não apenas "não tinha bônus ainda" — precisa ser o 1º mesmo,
  -- olhando pix_payments diretamente, fonte da verdade).
  SELECT COUNT(*) INTO v_approved_deposits_count
  FROM public.pix_payments
  WHERE user_id = p_referred_user_id AND status = 'approved' AND credited = TRUE;

  IF v_approved_deposits_count <> 1 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'not_first_deposit');
  END IF;

  v_reward := CASE
    WHEN p_deposit_amount >= 100 THEN 25.00
    WHEN p_deposit_amount >= 35  THEN 10.00
    WHEN p_deposit_amount >= 20  THEN 5.00
    ELSE 0
  END;

  IF v_reward <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'zero_reward');
  END IF;

  -- Trava final e definitiva contra duplicidade (2ª camada de defesa,
  -- além do FOR UPDATE acima e do first_deposit_reward_generated).
  INSERT INTO public.referral_rewards
    (referrer_user_id, referred_user_id, deposit_id, deposit_amount, reward_amount, status, paid_at)
  VALUES
    (v_referrer_id, p_referred_user_id, p_deposit_id, p_deposit_amount, v_reward, 'paid', NOW())
  ON CONFLICT (referred_user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_rewarded_race');
  END IF;

  UPDATE public.profiles SET first_deposit_reward_generated = TRUE WHERE id = p_referred_user_id;

  UPDATE public.profiles SET balance = balance + v_reward
  WHERE id = v_referrer_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
  VALUES (
    v_referrer_id, 'referral_bonus', v_reward, v_new_balance,
    'Bônus de indicação — 1º depósito confirmado (R$ ' || p_deposit_amount || ')'
  );

  RETURN jsonb_build_object('ok', true, 'reason', 'rewarded', 'amount', v_reward, 'referrer_id', v_referrer_id);
END;
$$;

-- ─── 7. reverse_referral_reward() — chamada quando o depósito ──
-- que originou o bônus é cancelado/estornado/chargeback DEPOIS de
-- já ter sido aprovado. Nunca apaga o histórico: cria uma transação
-- de reversão e marca o registro original como 'reversed'.
CREATE OR REPLACE FUNCTION public.reverse_referral_reward(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward      public.referral_rewards%ROWTYPE;
  v_new_balance DECIMAL;
BEGIN
  SELECT * INTO v_reward
  FROM public.referral_rewards
  WHERE deposit_id = p_deposit_id AND status = 'paid'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_reward_to_reverse');
  END IF;

  UPDATE public.referral_rewards SET status = 'reversed' WHERE id = v_reward.id;

  UPDATE public.profiles SET balance = balance - v_reward.reward_amount
  WHERE id = v_reward.referrer_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description)
  VALUES (
    v_reward.referrer_user_id, 'referral_reversal', v_reward.reward_amount, v_new_balance,
    'Estorno de bônus de indicação — depósito de origem cancelado/estornado'
  );

  RETURN jsonb_build_object('ok', true, 'reason', 'reversed', 'amount', v_reward.reward_amount);
END;
$$;

-- ─── 8. confirm_pix_payment() — agora também aciona o bônus de ─
-- indicação (no crédito) e a reversão (se o status mudar pra algo
-- ruim DEPOIS de já ter creditado). Mantém 100% do comportamento
-- anterior pro crédito do depósito em si — nada muda pro fluxo de
-- PIX que já funcionava.
CREATE OR REPLACE FUNCTION public.confirm_pix_payment(
  p_mp_payment_id TEXT,
  p_status        TEXT,
  p_raw_webhook   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment      public.pix_payments;
  v_new_balance  DECIMAL;
BEGIN
  SELECT * INTO v_payment
  FROM public.pix_payments
  WHERE mp_payment_id = p_mp_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payment_not_found');
  END IF;

  UPDATE public.pix_payments
  SET status = p_status, raw_webhook = p_raw_webhook
  WHERE id = v_payment.id;

  -- Já creditado antes? Não credita de novo (idempotência) — mas se o
  -- status novo indicar problema, tenta reverter o bônus de indicação.
  IF v_payment.credited THEN
    IF p_status IN ('rejected', 'cancelled', 'refunded', 'charged_back') THEN
      PERFORM public.reverse_referral_reward(v_payment.id);
    END IF;
    RETURN jsonb_build_object('ok', true, 'reason', 'already_credited', 'payment_id', v_payment.id);
  END IF;

  IF p_status != 'approved' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'not_approved_yet', 'status', p_status);
  END IF;

  UPDATE public.profiles
  SET balance = balance + v_payment.amount
  WHERE id = v_payment.user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.pix_payments
  SET credited = TRUE, credited_at = NOW()
  WHERE id = v_payment.id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, description, pix_id)
  VALUES (
    v_payment.user_id,
    'deposit',
    v_payment.amount,
    v_new_balance,
    'Depósito via PIX confirmado',
    p_mp_payment_id
  );

  -- Bônus de indicação (idempotente, só paga se houver indicador e
  -- este for o primeiro depósito aprovado do indicado).
  PERFORM public.process_referral_reward(v_payment.id, v_payment.user_id, v_payment.amount);

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'credited',
    'payment_id', v_payment.id,
    'new_balance', v_new_balance
  );
END;
$$;

-- ─── 9. RPC get_referral_program_stats() — tudo que o painel ───
-- precisa numa chamada só: link, código, contadores, nível de
-- gamificação e a lista de indicações com status.
CREATE OR REPLACE FUNCTION public.get_referral_program_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code            TEXT;
  v_total_indicados INT;
  v_qualificados    INT;
  v_total_bonus     DECIMAL;
  v_pendentes       INT;
  v_level           TEXT;
  v_list            JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT referral_code INTO v_code FROM public.profiles WHERE id = auth.uid();

  SELECT COUNT(*) INTO v_total_indicados
  FROM public.profiles WHERE referred_by_user_id = auth.uid();

  SELECT COUNT(*) INTO v_qualificados
  FROM public.referral_rewards WHERE referrer_user_id = auth.uid() AND status = 'paid';

  SELECT COALESCE(SUM(reward_amount), 0) INTO v_total_bonus
  FROM public.referral_rewards WHERE referrer_user_id = auth.uid() AND status = 'paid';

  v_pendentes := v_total_indicados - v_qualificados;

  v_level := CASE
    WHEN v_qualificados >= 25 THEN 'Embaixador'
    WHEN v_qualificados >= 10 THEN 'Líder'
    WHEN v_qualificados >= 3  THEN 'Multiplicador'
    WHEN v_qualificados >= 1  THEN 'Conector'
    ELSE 'Iniciante'
  END;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_list
  FROM (
    SELECT
      p.username,
      p.created_at,
      COALESCE(rr.status, 'pending') AS reward_status,
      rr.reward_amount,
      rr.deposit_amount
    FROM public.profiles p
    LEFT JOIN public.referral_rewards rr ON rr.referred_user_id = p.id
    WHERE p.referred_by_user_id = auth.uid()
    LIMIT 100
  ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'referral_code', v_code,
    'total_indicados', v_total_indicados,
    'qualificados', v_qualificados,
    'pendentes', GREATEST(v_pendentes, 0),
    'total_bonus_recebido', v_total_bonus,
    'nivel', v_level,
    'indicacoes', v_list
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_program_stats() TO authenticated;

-- ─── 10. Reforço de segurança — Postgres concede EXECUTE em novas ─
-- funções pra PUBLIC por padrão, o que inclui anon/authenticated no
-- Supabase. Isso significa que, sem este REVOKE, qualquer usuário
-- logado poderia chamar supabase.rpc('confirm_pix_payment', {...})
-- direto do navegador com um mp_payment_id qualquer — bypassando
-- completamente a validação contra a API do Mercado Pago que o
-- /api/webhook.js faz. Essa brecha já existia antes desta fase (o
-- confirm_pix_payment original nunca teve REVOKE); fica corrigida
-- aqui porque agora essa função também dispara bônus em dinheiro
-- real pra terceiros, então a superfície de risco aumentou.
-- Só o backend (service_role, que roda nas Vercel Functions) e o
-- dono das funções continuam podendo chamá-las.
REVOKE EXECUTE ON FUNCTION public.confirm_pix_payment(TEXT, TEXT, JSONB)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_reward(UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_referral_reward(UUID)                FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_pix_payment(TEXT, TEXT, JSONB)       TO service_role;
GRANT  EXECUTE ON FUNCTION public.process_referral_reward(UUID, UUID, DECIMAL) TO service_role;
GRANT  EXECUTE ON FUNCTION public.reverse_referral_reward(UUID)                TO service_role;

-- ─── Verificação ──────────────────────────────────────────────
SELECT 'Sistema de indicação com bônus real instalado — pago sobre 1º depósito PIX confirmado, faixas R$5/R$10/R$25.' AS status;
