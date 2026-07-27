-- ═══════════════════════════════════════════════════════════════
--  TESTES AUTOMATIZADOS — Sistema de indicação com bônus real
--
--  Como rodar: cole este arquivo inteiro no SQL Editor do Supabase
--  e clique em Run, DEPOIS de já ter rodado supabase_referral_rewards.sql
--  no projeto. Rode em um projeto de TESTE, não em produção — mesmo
--  fazendo ROLLBACK no final, é mais seguro.
--
--  O script inteiro roda dentro de UMA transação e termina com
--  ROLLBACK, então nenhum usuário/depósito fake fica gravado no
--  banco, não importa o resultado. Cada cenário aparece no painel
--  "Messages" do SQL Editor como '✅ PASSOU: ...' ou '❌ FALHOU: ...'.
--  Se algum '❌' aparecer, é bug — me avise.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── Fixtures: cria usuários fake direto em auth.users + profiles ─
-- (bypassa o fluxo de cadastro real só pra isolar o teste do resto
-- do sistema de auth; os dados nunca são commitados, ver ROLLBACK)
CREATE OR REPLACE FUNCTION pg_temp.mk_user(p_username TEXT, p_referrer UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
          p_username || '@teste.rodadafortuna.local',
          '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW());

  INSERT INTO public.profiles (id, email, username, balance, referral_code, referred_by_user_id)
  VALUES (v_id, p_username || '@teste.rodadafortuna.local', p_username, 0.00,
          public.generate_referral_code(), p_referrer);

  RETURN v_id;
END; $$;

-- Simula um depósito PIX confirmado (equivalente ao que o webhook faz
-- depois de validar com a API do Mercado Pago) e retorna o resultado.
CREATE OR REPLACE FUNCTION pg_temp.mk_deposit(p_user UUID, p_amount DECIMAL, p_status TEXT DEFAULT 'approved')
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_mp_id TEXT := 'mp_test_' || gen_random_uuid()::TEXT;
BEGIN
  INSERT INTO public.pix_payments (user_id, mp_payment_id, amount, status)
  VALUES (p_user, v_mp_id, p_amount, 'pending');

  RETURN public.confirm_pix_payment(v_mp_id, p_status, '{}'::jsonb) || jsonb_build_object('mp_payment_id', v_mp_id);
END; $$;

CREATE OR REPLACE FUNCTION pg_temp.reward_for(p_referred UUID)
RETURNS DECIMAL LANGUAGE sql AS $$
  SELECT reward_amount FROM public.referral_rewards WHERE referred_user_id = p_referred AND status = 'paid';
$$;

-- ─── 1-7: Faixas de valor do bônus ──────────────────────────────
DO $$
DECLARE
  v_referrer UUID; v_referred UUID; v_reward DECIMAL;
  v_case RECORD;
BEGIN
  FOR v_case IN SELECT * FROM (VALUES
    (19.99, NULL::DECIMAL, '19,99 → nenhum bônus'),
    (20.00, 5.00,  '20,00 → R$5'),
    (34.99, 5.00,  '34,99 → R$5'),
    (35.00, 10.00, '35,00 → R$10'),
    (99.99, 10.00, '99,99 → R$10'),
    (100.00, 25.00,'100,00 → R$25'),
    (500.00, 25.00,'500,00 → R$25')
  ) AS t(amount, expected, label) LOOP
    BEGIN
      v_referrer := pg_temp.mk_user('ref_' || replace(v_case.label,' ',''));
      v_referred := pg_temp.mk_user('ind_' || replace(v_case.label,' ',''), v_referrer);
      PERFORM pg_temp.mk_deposit(v_referred, v_case.amount);
      v_reward := pg_temp.reward_for(v_referred);

      IF (v_case.expected IS NULL AND v_reward IS NULL) OR (v_reward = v_case.expected) THEN
        RAISE NOTICE '✅ PASSOU: primeiro depósito %', v_case.label;
      ELSE
        RAISE NOTICE '❌ FALHOU: primeiro depósito % — esperado %, obtido %', v_case.label, v_case.expected, v_reward;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ FALHOU (erro): primeiro depósito % — %', v_case.label, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─── 8: Segundo depósito não gera novo bônus ────────────────────
DO $$
DECLARE v_referrer UUID; v_referred UUID; v_reward1 DECIMAL; v_count INT;
BEGIN
  BEGIN
    v_referrer := pg_temp.mk_user('ref_segundo');
    v_referred := pg_temp.mk_user('ind_segundo', v_referrer);
    PERFORM pg_temp.mk_deposit(v_referred, 100.00); -- 1º depósito, gera R$25
    PERFORM pg_temp.mk_deposit(v_referred, 500.00); -- 2º depósito, não deve gerar nada
    SELECT COUNT(*) INTO v_count FROM public.referral_rewards WHERE referred_user_id = v_referred;
    IF v_count = 1 THEN
      RAISE NOTICE '✅ PASSOU: segundo depósito não gera novo bônus (só 1 registro em referral_rewards)';
    ELSE
      RAISE NOTICE '❌ FALHOU: segundo depósito gerou % registros de bônus (esperado 1)', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): segundo depósito — %', SQLERRM;
  END;
END $$;

-- ─── 9: Webhook duplicado → apenas um bônus ─────────────────────
DO $$
DECLARE v_referrer UUID; v_referred UUID; v_mp_id TEXT; v_count INT; v_balance_before DECIMAL; v_balance_after DECIMAL;
BEGIN
  BEGIN
    v_referrer := pg_temp.mk_user('ref_dup');
    v_referred := pg_temp.mk_user('ind_dup', v_referrer);
    v_mp_id := 'mp_test_dup_' || gen_random_uuid()::TEXT;

    INSERT INTO public.pix_payments (user_id, mp_payment_id, amount, status)
    VALUES (v_referred, v_mp_id, 50.00, 'pending');

    PERFORM public.confirm_pix_payment(v_mp_id, 'approved', '{}'::jsonb);
    SELECT balance INTO v_balance_before FROM public.profiles WHERE id = v_referrer;

    -- Webhook do Mercado Pago reenviando a mesma notificação (comum e esperado)
    PERFORM public.confirm_pix_payment(v_mp_id, 'approved', '{}'::jsonb);
    PERFORM public.confirm_pix_payment(v_mp_id, 'approved', '{}'::jsonb);

    SELECT balance INTO v_balance_after FROM public.profiles WHERE id = v_referrer;
    SELECT COUNT(*) INTO v_count FROM public.referral_rewards WHERE referred_user_id = v_referred;

    IF v_count = 1 AND v_balance_after = v_balance_before THEN
      RAISE NOTICE '✅ PASSOU: webhook duplicado credita o bônus só 1 vez';
    ELSE
      RAISE NOTICE '❌ FALHOU: webhook duplicado — % registros, saldo mudou de % pra %', v_count, v_balance_before, v_balance_after;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): webhook duplicado — %', SQLERRM;
  END;
END $$;

-- ─── 10: Usuário sem indicador → nenhum bônus ───────────────────
DO $$
DECLARE v_solo UUID; v_count INT;
BEGIN
  BEGIN
    v_solo := pg_temp.mk_user('sem_indicador'); -- sem referrer
    PERFORM pg_temp.mk_deposit(v_solo, 200.00);
    SELECT COUNT(*) INTO v_count FROM public.referral_rewards WHERE referred_user_id = v_solo;
    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASSOU: usuário sem indicador não gera bônus';
    ELSE
      RAISE NOTICE '❌ FALHOU: usuário sem indicador gerou % bônus', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): usuário sem indicador — %', SQLERRM;
  END;
END $$;

-- ─── 11: Depósito cancelado → nenhum bônus ──────────────────────
DO $$
DECLARE v_referrer UUID; v_referred UUID; v_count INT;
BEGIN
  BEGIN
    v_referrer := pg_temp.mk_user('ref_cancel');
    v_referred := pg_temp.mk_user('ind_cancel', v_referrer);
    PERFORM pg_temp.mk_deposit(v_referred, 200.00, 'cancelled');
    SELECT COUNT(*) INTO v_count FROM public.referral_rewards WHERE referred_user_id = v_referred;
    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASSOU: depósito cancelado não gera bônus';
    ELSE
      RAISE NOTICE '❌ FALHOU: depósito cancelado gerou % bônus', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): depósito cancelado — %', SQLERRM;
  END;
END $$;

-- ─── 12: Depósito estornado DEPOIS de aprovado → reversão ───────
DO $$
DECLARE v_referrer UUID; v_referred UUID; v_mp_id TEXT; v_status TEXT; v_balance_before DECIMAL; v_balance_after DECIMAL;
BEGIN
  BEGIN
    v_referrer := pg_temp.mk_user('ref_estorno');
    v_referred := pg_temp.mk_user('ind_estorno', v_referrer);
    v_mp_id := 'mp_test_estorno_' || gen_random_uuid()::TEXT;

    INSERT INTO public.pix_payments (user_id, mp_payment_id, amount, status)
    VALUES (v_referred, v_mp_id, 100.00, 'pending');

    PERFORM public.confirm_pix_payment(v_mp_id, 'approved', '{}'::jsonb); -- gera R$25 de bônus
    SELECT balance INTO v_balance_before FROM public.profiles WHERE id = v_referrer;

    PERFORM public.confirm_pix_payment(v_mp_id, 'refunded', '{}'::jsonb); -- estorno chega depois

    SELECT balance, status INTO v_balance_after, v_status FROM public.profiles p
      JOIN public.referral_rewards rr ON rr.referrer_user_id = p.id
      WHERE rr.referred_user_id = v_referred;
    SELECT status INTO v_status FROM public.referral_rewards WHERE referred_user_id = v_referred;

    IF v_status = 'reversed' AND v_balance_after = v_balance_before - 25.00 THEN
      RAISE NOTICE '✅ PASSOU: depósito estornado reverte o bônus (registro mantido como reversed, não apagado)';
    ELSE
      RAISE NOTICE '❌ FALHOU: estorno — status=%, saldo foi de % pra %', v_status, v_balance_before, v_balance_after;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): estorno — %', SQLERRM;
  END;
END $$;

-- ─── 13: Tentativa de autoindicação → rejeitada ─────────────────
DO $$
DECLARE v_user UUID; v_deposit UUID; v_failed BOOLEAN := FALSE;
BEGIN
  BEGIN
    v_user := pg_temp.mk_user('auto_indicacao');
    INSERT INTO public.pix_payments (id, user_id, amount, status, credited)
    VALUES (gen_random_uuid(), v_user, 50.00, 'approved', TRUE) RETURNING id INTO v_deposit;

    BEGIN
      INSERT INTO public.referral_rewards (referrer_user_id, referred_user_id, deposit_id, deposit_amount, reward_amount)
      VALUES (v_user, v_user, v_deposit, 50.00, 5.00);
    EXCEPTION WHEN check_violation THEN
      v_failed := TRUE;
    END;

    IF v_failed THEN
      RAISE NOTICE '✅ PASSOU: autoindicação rejeitada pela constraint no_self_referral_reward';
    ELSE
      RAISE NOTICE '❌ FALHOU: autoindicação foi aceita (constraint não bloqueou)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FALHOU (erro): autoindicação — %', SQLERRM;
  END;
END $$;

-- ─── 14: Alterar indicador após cadastro → rejeitada ────────────
DO $$
DECLARE v_can_update BOOLEAN;
BEGIN
  SELECT has_column_privilege('authenticated', 'public.profiles', 'referred_by_user_id', 'UPDATE') INTO v_can_update;
  IF NOT v_can_update THEN
    RAISE NOTICE '✅ PASSOU: role "authenticated" não tem permissão de UPDATE em referred_by_user_id (só RPC SECURITY DEFINER pode escrever, e nenhuma existe pra essa coluna)';
  ELSE
    RAISE NOTICE '❌ FALHOU: role "authenticated" ainda consegue fazer UPDATE direto em referred_by_user_id';
  END IF;
END $$;

-- ─── Limpeza: desfaz TUDO, nenhum dado de teste fica no banco ───
ROLLBACK;
