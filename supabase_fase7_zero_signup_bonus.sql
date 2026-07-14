-- ═══════════════════════════════════════════════════════════════
--  FASE 7 — Zerar bônus de saldo ao criar conta real
--  Rode este script no SQL Editor do Supabase.
--  Não afeta contas já existentes — só novos cadastros a partir de agora.
-- ═══════════════════════════════════════════════════════════════

-- 1. Muda o valor padrão da coluna (usado como fallback)
ALTER TABLE public.profiles
  ALTER COLUMN balance SET DEFAULT 0.00;

-- 2. Recria a função do trigger que roda quando um usuário se cadastra
--    (auth.users -> public.profiles), agora com saldo inicial 0.00
--    em vez de 100.00. Mesma lógica de geração de username, só muda o valor.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
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

  RETURN NEW;
END;
$$;
