-- ═══════════════════════════════════════════════════════════════
--  LOTE 2 — SOBE OU DESCE CONTÍNUO + PESCA DA FORTUNA
--  Execute no SQL Editor do Supabase (depois de fase2 e fases3_4)
--
--  SOBE OU DESCE é progressivo (várias jogadas por rodada, tipo a
--  Torre) — mas cada passo é uma chamada isolada e discreta ao
--  servidor, com resultado fechado na hora. Não existe relógio
--  correndo nem janela de "sacar antes do próximo tick" — por isso
--  é seguro, ao contrário do Crash.
--
--  PESCA DA FORTUNA é instantâneo, mesmo padrão do play_bau.
-- ═══════════════════════════════════════════════════════════════


-- ─── Tabela de estado das rodadas do Sobe ou Desce ───────────────
-- Cada usuário só pode ter 1 rodada 'active' por vez (checado nas
-- funções abaixo) — evita múltiplas apostas simultâneas na mesma
-- rodada e mantém o estado sempre auditável.
CREATE TABLE IF NOT EXISTS public.sobedesce_rounds (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.profiles(id),
  bet          DECIMAL NOT NULL,
  current_card INT NOT NULL,           -- 1 a 13 (A a K, sem naipe)
  multiplier   DECIMAL NOT NULL DEFAULT 1,
  streak       INT NOT NULL DEFAULT 0, -- nº de acertos seguidos (limite de segurança)
  status       TEXT NOT NULL DEFAULT 'active', -- active | cashed | lost | abandoned
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sobedesce_user_active
  ON public.sobedesce_rounds(user_id) WHERE status = 'active';

ALTER TABLE public.sobedesce_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sobedesce_own_rows" ON public.sobedesce_rounds;
CREATE POLICY "sobedesce_own_rows" ON public.sobedesce_rounds
  FOR SELECT USING (auth.uid() = user_id);
-- Sem policy de INSERT/UPDATE direta: só as funções SECURITY DEFINER
-- abaixo podem escrever nessa tabela, o client nunca escreve direto.


-- ─── 1a. sobedesce_start — inicia a rodada, deduz a aposta ───────
CREATE OR REPLACE FUNCTION public.sobedesce_start(
  p_user_id UUID,
  p_bet     DECIMAL
)
RETURNS TABLE(round_id BIGINT, card INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_round_id          BIGINT;
  v_card               INT;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Aposta inválida';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sobedesce_rounds WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Rodada anterior em andamento';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_card := FLOOR(random() * 13)::INT + 1; -- carta inicial: 1(A) a 13(K)

  INSERT INTO public.sobedesce_rounds(user_id, bet, current_card, multiplier, streak, status)
  VALUES (p_user_id, p_bet, v_card, 1, 0, 'active')
  RETURNING id INTO v_round_id;

  -- Deduz a aposta agora (mesmo padrão do torremini_start).
  -- Se a rodada acabar em vitória, o crédito acontece no cashout;
  -- se acabar em derrota, nenhum crédito extra é necessário.
  PERFORM public.update_balance_safe(p_user_id, -p_bet, 'sobedesce', p_bet, 0, false);

  RETURN QUERY SELECT v_round_id, v_card;
END;
$$;


-- ─── 1b. sobedesce_step — vira a próxima carta ───────────────────
-- Probabilidade calculada pela carta atual (baralho uniforme 1-13,
-- com reposição). Multiplicador do passo = RTP-alvo(92%) / probabilidade,
-- capado em 8x por passo pra evitar crescimento absurdo, e limitado
-- a 10 acertos seguidos (auto-finaliza, força saque) — trava de segurança,
-- não afeta o RTP médio, só limita quantas chamadas por rodada.
CREATE OR REPLACE FUNCTION public.sobedesce_step(
  p_user_id  UUID,
  p_round_id BIGINT,
  p_guess    TEXT   -- 'sobe' ou 'desce'
)
RETURNS TABLE(card INT, correct BOOLEAN, finished BOOLEAN, multiplier DECIMAL, prize DECIMAL, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round        RECORD;
  v_next_card    INT;
  v_prob         DECIMAL;
  v_correct      BOOLEAN;
  v_step_mult    DECIMAL;
  v_new_mult     DECIMAL;
  v_new_streak   INT;
  v_finished     BOOLEAN := false;
  v_prize        DECIMAL := 0;
  v_new_balance  DECIMAL;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_guess NOT IN ('sobe','desce') THEN
    RAISE EXCEPTION 'Jogada inválida';
  END IF;

  SELECT * INTO v_round
  FROM public.sobedesce_rounds
  WHERE id = p_round_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_round.status != 'active' THEN
    RAISE EXCEPTION 'Rodada não encontrada ou já finalizada';
  END IF;

  v_prob := CASE
    WHEN p_guess = 'sobe'  THEN (13 - v_round.current_card) / 13.0
    ELSE (v_round.current_card - 1) / 13.0
  END;

  IF v_prob = 0 THEN
    RAISE EXCEPTION 'Jogada impossível nesta carta';
  END IF;

  v_next_card := FLOOR(random() * 13)::INT + 1;
  v_correct := CASE
    WHEN p_guess = 'sobe'  THEN v_next_card > v_round.current_card
    ELSE v_next_card < v_round.current_card
  END;

  IF NOT v_correct THEN
    UPDATE public.sobedesce_rounds SET status = 'lost', current_card = v_next_card WHERE id = p_round_id;
    -- Bet já foi deduzida no start; nenhum crédito adicional necessário.
    RETURN QUERY SELECT v_next_card, false, true, v_round.multiplier, 0::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;

  v_step_mult  := LEAST(ROUND(0.92 / v_prob, 4), 8);
  v_new_mult   := ROUND(v_round.multiplier * v_step_mult, 4);
  v_new_streak := v_round.streak + 1;

  IF v_new_streak >= 10 THEN
    -- Limite de segurança: 10 acertos seguidos finaliza e credita automaticamente
    v_finished := true;
    v_prize := ROUND(v_round.bet * v_new_mult, 2);
    v_new_balance := public.update_balance_safe(p_user_id, v_prize, 'sobedesce', v_round.bet, v_prize, true);
    UPDATE public.sobedesce_rounds SET status = 'cashed', current_card = v_next_card, multiplier = v_new_mult, streak = v_new_streak WHERE id = p_round_id;
  ELSE
    UPDATE public.sobedesce_rounds SET current_card = v_next_card, multiplier = v_new_mult, streak = v_new_streak WHERE id = p_round_id;
  END IF;

  RETURN QUERY SELECT v_next_card, true, v_finished, v_new_mult, v_prize, v_new_balance;
END;
$$;


-- ─── 1c. sobedesce_cashout — encerra e credita o acumulado ───────
CREATE OR REPLACE FUNCTION public.sobedesce_cashout(
  p_user_id  UUID,
  p_round_id BIGINT
)
RETURNS TABLE(prize DECIMAL, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round       RECORD;
  v_prize        DECIMAL;
  v_new_balance  DECIMAL;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_round
  FROM public.sobedesce_rounds
  WHERE id = p_round_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_round.status != 'active' THEN
    RAISE EXCEPTION 'Rodada não encontrada ou já finalizada';
  END IF;

  IF v_round.streak = 0 THEN
    RAISE EXCEPTION 'Nenhum acerto ainda — não há o que sacar';
  END IF;

  v_prize := ROUND(v_round.bet * v_round.multiplier, 2);
  v_new_balance := public.update_balance_safe(p_user_id, v_prize, 'sobedesce', v_round.bet, v_prize, true);

  UPDATE public.sobedesce_rounds SET status = 'cashed' WHERE id = p_round_id;

  RETURN QUERY SELECT v_prize, v_new_balance;
END;
$$;


-- ─── 1d. sobedesce_abandon — destrava rodada presa (sem reembolso, ─
--          igual ao abandon_new_round dos outros jogos progressivos)
CREATE OR REPLACE FUNCTION public.sobedesce_abandon(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.sobedesce_rounds
  SET status = 'abandoned'
  WHERE user_id = p_user_id AND status = 'active';
END;
$$;


-- ─── 2. PESCA DA FORTUNA — instantâneo, RTP ~91% ─────────────────
-- Mesmo padrão do play_bau, skin diferente (peixes em vez de baús).
-- Pesos: 0x 50% | 0.4x 22% | 1x 14% | 2x 8% | 5x 4.5% | 20x 1.5%
CREATE OR REPLACE FUNCTION public.play_pesca(
  p_user_id UUID,
  p_bet     DECIMAL
)
RETURNS TABLE(multiplicador DECIMAL, won BOOLEAN, prize DECIMAL, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance      DECIMAL;
  v_roll              DECIMAL;
  v_mult               DECIMAL;
  v_won                BOOLEAN;
  v_prize              DECIMAL;
  v_delta              DECIMAL;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Aposta inválida';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_roll := random();
  v_mult := CASE
    WHEN v_roll < 0.50  THEN 0
    WHEN v_roll < 0.72  THEN 0.4
    WHEN v_roll < 0.86  THEN 1
    WHEN v_roll < 0.94  THEN 2
    WHEN v_roll < 0.985 THEN 5
    ELSE 20
  END;

  v_won   := (v_mult > 0);
  v_prize := ROUND(p_bet * v_mult, 2);
  v_delta := v_prize - p_bet;

  v_new_balance := public.update_balance_safe(
    p_user_id, v_delta, 'pesca', p_bet, v_prize, v_won
  );

  RETURN QUERY SELECT v_mult, v_won, v_prize, v_new_balance;
END;
$$;
