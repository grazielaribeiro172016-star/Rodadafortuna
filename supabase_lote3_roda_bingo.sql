-- ═══════════════════════════════════════════════════════════════
--  LOTE 3 (final) — RODA DA SORTE + BINGO RELÂMPAGO
--  Execute no SQL Editor do Supabase (depois de fase2 e fases3_4)
--
--  Os dois são instantâneos (mesmo padrão do play_bau/play_pesca):
--  resultado fechado no servidor antes de qualquer resposta, sem
--  relógio, sem estado pendente.
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. RODA DA SORTE — RTP ~92% ──────────────────────────────
-- Pesos: 0x 40% | 0.3x 22% | 0.8x 16% | 1.2x 12% | 2.5x 6% | 6x 3% | 25x 1%
CREATE OR REPLACE FUNCTION public.play_roda(
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
    WHEN v_roll < 0.40 THEN 0
    WHEN v_roll < 0.62 THEN 0.3
    WHEN v_roll < 0.78 THEN 0.8
    WHEN v_roll < 0.90 THEN 1.2
    WHEN v_roll < 0.96 THEN 2.5
    WHEN v_roll < 0.99 THEN 6
    ELSE 25
  END;

  v_won   := (v_mult > 0);
  v_prize := ROUND(p_bet * v_mult, 2);
  v_delta := v_prize - p_bet;

  v_new_balance := public.update_balance_safe(
    p_user_id, v_delta, 'roda', p_bet, v_prize, v_won
  );

  RETURN QUERY SELECT v_mult, v_won, v_prize, v_new_balance;
END;
$$;


-- ─── 2. BINGO RELÂMPAGO — RTP ≈90.1% ──────────────────────────
-- Diferente dos outros: aqui a probabilidade NÃO é um peso arbitrário,
-- é calculada de verdade (hipergeométrica: 5 números do jogador,
-- 20 sorteados de 50, sem reposição). Calibrado com Python antes
-- de escrever este SQL:
--   0-2 acertos: 0x   (93.27% dos casos)
--   3 acertos:   1.5x (23.41%)
--   4 acertos:   3.75x (6.86%)
--   5 acertos:   40x   (0.73% — cartela cheia)
-- RTP real = 0.234052×1.5 + 0.068601×3.75 + 0.007317×40 ≈ 0.901
CREATE OR REPLACE FUNCTION public.play_bingo(
  p_user_id UUID,
  p_bet     DECIMAL,
  p_numeros INT[]   -- exatamente 5 números distintos, 1 a 50
)
RETURNS TABLE(sorteados INT[], acertos INT, multiplicador DECIMAL, won BOOLEAN, prize DECIMAL, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance      DECIMAL;
  v_sorteados         INT[];
  v_acertos            INT;
  v_mult                DECIMAL;
  v_won                 BOOLEAN;
  v_prize               DECIMAL;
  v_delta               DECIMAL;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_bet IS NULL OR p_bet <= 0 THEN
    RAISE EXCEPTION 'Aposta inválida';
  END IF;

  IF p_numeros IS NULL OR array_length(p_numeros,1) != 5 THEN
    RAISE EXCEPTION 'Escolha exatamente 5 números';
  END IF;

  IF (SELECT COUNT(DISTINCT n) FROM unnest(p_numeros) n) != 5 THEN
    RAISE EXCEPTION 'Os números devem ser distintos';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_numeros) n WHERE n < 1 OR n > 50) THEN
    RAISE EXCEPTION 'Números devem estar entre 1 e 50';
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF v_current_balance < p_bet THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Sorteia 20 números distintos de 1 a 50, sem reposição
  SELECT array_agg(n) INTO v_sorteados
  FROM (SELECT n FROM generate_series(1,50) n ORDER BY random() LIMIT 20) s;

  SELECT COUNT(*) INTO v_acertos
  FROM unnest(p_numeros) num
  WHERE num = ANY(v_sorteados);

  v_mult := CASE v_acertos
    WHEN 5 THEN 40
    WHEN 4 THEN 3.75
    WHEN 3 THEN 1.5
    ELSE 0
  END;

  v_won   := (v_mult > 0);
  v_prize := ROUND(p_bet * v_mult, 2);
  v_delta := v_prize - p_bet;

  v_new_balance := public.update_balance_safe(
    p_user_id, v_delta, 'bingo', p_bet, v_prize, v_won
  );

  RETURN QUERY SELECT v_sorteados, v_acertos, v_mult, v_won, v_prize, v_new_balance;
END;
$$;
