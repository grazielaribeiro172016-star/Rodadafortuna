-- ═══════════════════════════════════════════════════════════════
--  LOGIN POR TELEFONE — telefone vira e-mail interno no Supabase
--  (tel<digitos>@long777.phone), zero custo de SMS.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_phone_account BOOLEAN DEFAULT FALSE;

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

  INSERT INTO public.profiles (id, email, username, balance, phone_number, recovery_email, is_phone_account)
  VALUES (
    NEW.id, NEW.email, v_username, 0.00,
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'recovery_email',
    COALESCE((NEW.raw_user_meta_data->>'is_phone_account')::BOOLEAN, FALSE)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

SELECT 'Login por telefone instalado — colunas novas em profiles + trigger atualizado.' AS status;
