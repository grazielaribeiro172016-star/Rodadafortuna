-- ═══════════════════════════════════════════════════════════════
--  LOTE 1 — TURFE RELÂMPAGO + BAÚ MISTERIOSO
--  Execute no SQL Editor do Supabase (depois de supabase_fase2.sql
--  e supabase_fases3_4.sql, pois ambos dependem de update_balance_safe)
--
--  Padrão de segurança (igual a play_moeda / play_baccarat / etc.):
--  - SECURITY DEFINER + auth.uid() = p_user_id
--  - SELECT ... FOR UPDATE trava a linha do usuário antes de checar saldo
--  - Resultado sorteado com random() DENTRO da transação, antes de
--    qualquer retorno — não existe estado "em aberto" nem relógio,
--    diferente do Crash. Cliente só recebe o resultado já fechado.
--  - Retorna TABLE (mesmo formato de play_moeda: data[0].campo)
--  - update_balance_safe cuida do crédito/débito e da auditoria em
--    transactions + game_history
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. TURFE RELÂMPAGO — 5 cavalos, RTP ~93% ────────────────
-- Multiplicadores calibrados: 0.93 / probabilidade do cavalo
-- Pesos:  Favorito 35% | 25% | 20% | 12% | Zebra 8%
CREATE OR REPLACE FUNCTION public.play_turfe(
  p_user_id UUID,
  p_bet     DECIMAL,
  p_cavalo  INT       -- 0 a 4
)
RETURNS TABLE(vencedor INT, won BOOLEAN, prize DECIMAL, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance      DECIMAL;
  v_roll              DECIMAL;
  v_winner             INT;
  v_won                BOOLEAN;
  v_prize              DECIMAL;
  v_delta              DECIMAL;
  v_multiplicadores DECIMAL[] := ARRAY[2.66, 3.72, 4.65, 7.75, 11.63];
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_cavalo IS NULL OR p_cavalo < 0 OR p_cavalo > 4 THEN
    RAISE EXCEPTION 'Cavalo inválido';
  END IF;

  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Aposta inválida';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_roll := random();
  v_winner := CASE
    WHEN v_roll < 0.35 THEN 0
    WHEN v_roll < 0.60 THEN 1
    WHEN v_roll < 0.80 THEN 2
    WHEN v_roll < 0.92 THEN 3
    ELSE 4
  END;

  v_won := (p_cavalo = v_winner);

  IF v_won THEN
    v_prize := ROUND(p_bet * v_multiplicadores[p_cavalo + 1], 2);
    v_delta := v_prize - p_bet;
  ELSE
    v_prize := 0;
    v_delta := -p_bet;
  END IF;

  v_new_balance := public.update_balance_safe(
    p_user_id, v_delta, 'turfe', p_bet, v_prize, v_won
  );

  RETURN QUERY SELECT v_winner, v_won, v_prize, v_new_balance;
END;
$$;


-- ─── 2. BAÚ MISTERIOSO — 9 baús, todos com a mesma distribuição ──
-- (não é jogo de "evitar bomba" — é sorte pura por clique, tipo
-- caixa-surpresa; qual baú o jogador clica é só estética/imersão)
-- RTP calibrado em exatamente 91%:
--   0x    50%  |  0.5x  20%  |  1x  12%  |  1.5x  8%
--   3x     6%  |  6x     3%  |  21x  1%
CREATE OR REPLACE FUNCTION public.play_bau(
  p_user_id      UUID,
  p_bet          DECIMAL,
  p_bau_escolhido INT      -- 0 a 8 — só usado pra registrar/exibir, não afeta o resultado
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

  IF p_bau_escolhido IS NULL OR p_bau_escolhido < 0 OR p_bau_escolhido > 8 THEN
    RAISE EXCEPTION 'Baú inválido';
  END IF;

  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Aposta inválida';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_roll := random();
  v_mult := CASE
    WHEN v_roll < 0.50 THEN 0
    WHEN v_roll < 0.70 THEN 0.5
    WHEN v_roll < 0.82 THEN 1
    WHEN v_roll < 0.90 THEN 1.5
    WHEN v_roll < 0.96 THEN 3
    WHEN v_roll < 0.99 THEN 6
    ELSE 21
  END;

  v_won   := (v_mult > 0);
  v_prize := ROUND(p_bet * v_mult, 2);
  v_delta := v_prize - p_bet;

  v_new_balance := public.update_balance_safe(
    p_user_id, v_delta, 'bau', p_bet, v_prize, v_won
  );

  RETURN QUERY SELECT v_mult, v_won, v_prize, v_new_balance;
END;
$$;

-- ─── Conferência rápida de RTP (rode à parte, opcional) ──────────
-- SELECT ROUND(AVG(m)*100,2) AS rtp_pct FROM (
--   SELECT (CASE
--     WHEN r < 0.50 THEN 0 WHEN r < 0.70 THEN 0.5
--     WHEN r < 0.82 THEN 1 WHEN r < 0.90 THEN 1.5
--     WHEN r < 0.96 THEN 3 WHEN r < 0.99 THEN 6
--     ELSE 21 END) AS m
--   FROM (SELECT random() AS r FROM generate_series(1,200000)) s
-- ) t;
