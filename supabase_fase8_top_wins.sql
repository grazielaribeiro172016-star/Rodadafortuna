-- ═══════════════════════════════════════════════════════════════
--  FASE 8 — Destaques de vitórias reais (marketing honesto)
--  Rode este script no SQL Editor do Supabase.
--  Só leitura agregada — não cria coluna nova, não mexe em saldo,
--  não mexe em RTP. Zero risco pra matemática do jogo.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_top_wins(p_limit INT DEFAULT 5)
RETURNS TABLE(username TEXT, game TEXT, result DECIMAL, multiplier DECIMAL, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.username, gh.game, gh.result, gh.multiplier, gh.created_at
  FROM public.game_history gh
  JOIN public.profiles p ON p.id = gh.user_id
  WHERE gh.won = true
  ORDER BY gh.result DESC
  LIMIT p_limit;
END;
$$;

-- Público mesmo pra quem não está logado (modo demo) — só expõe
-- username, jogo, valor e data. Nada sensível (sem email, sem saldo total).
GRANT EXECUTE ON FUNCTION public.get_top_wins(INT) TO anon, authenticated;
