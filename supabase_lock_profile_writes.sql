-- ═══════════════════════════════════════════════════════════════
--  Patch — bloquear escrita direta na tabela profiles
--  Rode no SQL Editor do Supabase. Idempotente, pode rodar de novo.
--
--  Problema que isso resolve:
--  A policy "profiles_update_own" permitia UPDATE de QUALQUER coluna
--  (incluindo balance, streak, wins, etc) contanto que auth.uid()=id.
--  Ou seja, qualquer usuário logado podia abrir o console do navegador
--  e rodar supabase.from('profiles').update({balance: 999999}) e o
--  Postgres aceitava — nada no RLS impedia isso, apesar do comentário
--  antigo dizer "campos não-financeiros".
--
--  Solução: revogar o privilégio de UPDATE/INSERT/DELETE na tabela pra
--  quem loga como authenticated/anon. Daqui pra frente, TODA mutação
--  em profiles só acontece através das RPCs SECURITY DEFINER já
--  existentes (update_balance_safe, update_kyc_data, claim_daily_reward,
--  request_withdrawal, claim_withdrawal_for_processing,
--  admin_process_withdrawal, handle_new_user). Essas RPCs continuam
--  funcionando normalmente porque rodam com o privilégio de quem
--  CRIOU a função (o dono/postgres), não do usuário que chamou —
--  então esse REVOKE não afeta nenhuma delas.
-- ═══════════════════════════════════════════════════════════════

-- 1. Revoga o privilégio de escrita direta na tabela.
--    SELECT continua liberado (a policy profiles_select_own cuida disso).
REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM authenticated, anon;

-- 2. Remove a policy antiga que dava a falsa sensação de estar restrita
--    a "campos não-financeiros" — ela nunca impôs isso de verdade.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 3. A policy de INSERT também não é mais necessária (o REVOKE acima já
--    bloqueia insert direto do client; a criação de perfil continua
--    acontecendo só pelo trigger handle_new_user, que é SECURITY DEFINER).
DROP POLICY IF EXISTS "profiles_insert_trigger" ON public.profiles;

-- ─── Verificação rápida (rode depois, só leitura) ────────────────
-- Deve retornar 'false' pras 3 colunas abaixo — confirma que o
-- privilégio de UPDATE não existe mais pro role authenticated.
--
-- SELECT has_column_privilege('authenticated', 'public.profiles', 'balance', 'UPDATE');
-- SELECT has_column_privilege('authenticated', 'public.profiles', 'streak',  'UPDATE');
-- SELECT has_table_privilege('authenticated', 'public.profiles', 'INSERT');

SELECT 'Escrita direta em profiles bloqueada. Só RPCs SECURITY DEFINER podem escrever.' AS status;
