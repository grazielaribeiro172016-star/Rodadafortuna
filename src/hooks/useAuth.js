import { useState, useEffect, useCallback } from 'react'
import { supabase, hasSupabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const fetchProfile = useCallback(async (userId) => {
    if (!hasSupabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) setProfile(data)
    return data
  }, [])

  useEffect(() => {
    // Sem Supabase configurado: vai direto para modo guest
    if (!hasSupabase) {
      setLoading(false)
      return
    }

    let initialCheckDone = false

    // Timeout de segurança: nunca deixa a tela de carregamento travada
    // por mais de 4s, mesmo se a rede estiver lenta ou o Supabase não responder
    const safetyTimer = setTimeout(() => setLoading(false), 4000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialCheckDone = true
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          setLoading(false)
          clearTimeout(safetyTimer)
        })
      } else {
        setLoading(false)
        clearTimeout(safetyTimer)
      }
    }).catch(() => {
      initialCheckDone = true
      setLoading(false)
      clearTimeout(safetyTimer)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Ignora o disparo inicial duplicado do onAuthStateChange — getSession() já cuida disso
      if (!initialCheckDone) return
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      else setProfile(null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [fetchProfile])

  async function signIn(email, password) {
    if (!hasSupabase) { setAuthError('Supabase não configurado.'); return false }
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthError(translateError(error.message)); return false }
    return true
  }

  async function signUp(email, password, username, refCode = null) {
    if (!hasSupabase) { setAuthError('Supabase não configurado.'); return false }
    setAuthError(null)
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) { setAuthError('Este nome de usuário já está em uso.'); return false }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      // ref_code viaja como metadata e é lido pelo trigger handle_new_user
      // no banco (SECURITY DEFINER) — o front nunca grava a indicação direto.
      options: { data: { username, ref_code: refCode || null } },
    })
    if (error) { setAuthError(translateError(error.message)); return false }

    // O profile é criado automaticamente pelo trigger handle_new_user
    // (SECURITY DEFINER, roda no banco ao inserir em auth.users) — com
    // username e balance corretos. onAuthStateChange já chama fetchProfile
    // logo em seguida. Não escrevemos em public.profiles direto do front
    // aqui — e depois do REVOKE em supabase_lock_profile_writes.sql isso
    // nem seria permitido de qualquer forma.
    return true
  }

  async function signOut() {
    if (!hasSupabase) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  async function resetPassword(email) {
    if (!hasSupabase) { setAuthError('Supabase não configurado.'); return false }
    setAuthError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setAuthError(translateError(error.message)); return false }
    return true
  }

  // OBS: existia aqui uma função syncGameState() que fazia update()
  // direto em public.profiles (incluindo balance). Nunca era chamada
  // (nem desestruturada em App.jsx) — código morto removido. Depois do
  // REVOKE em supabase_lock_profile_writes.sql ela passaria a falhar
  // de qualquer forma.

  return {
    user, profile, loading, authError, setAuthError,
    signIn, signUp, signOut, resetPassword, fetchProfile,
  }
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.'
  if (msg.includes('User already registered')) return 'Este email já está cadastrado.'
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.'
  return msg
}
