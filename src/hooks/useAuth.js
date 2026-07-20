import { useState, useEffect, useCallback } from 'react'
import { supabase, hasSupabase } from '../lib/supabase'

function phoneToFakeEmail(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return `tel${digits}@long777.phone`
}

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
    if (!hasSupabase) {
      setLoading(false)
      return
    }

    let initialCheckDone = false
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

  async function signInPhone(phone, password) {
    return signIn(phoneToFakeEmail(phone), password)
  }

  async function signUp(email, password, username, refCode = null) {
    if (!hasSupabase) { setAuthError('Supabase não configurado.'); return false }
    setAuthError(null)
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) { setAuthError('Este nome de usuário já está em uso.'); return false }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username, ref_code: refCode || null } },
    })
    if (error) { setAuthError(translateError(error.message)); return false }
    return true
  }

  async function signUpPhone(phone, password, username, refCode = null, recoveryEmail = null) {
    if (!hasSupabase) { setAuthError('Supabase não configurado.'); return false }
    setAuthError(null)
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) { setAuthError('Este nome de usuário já está em uso.'); return false }

    try {
      const res = await fetch('/api/phone-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, username, refCode, recoveryEmail }),
      })
      const json = await res.json()
      if (!res.ok) { setAuthError(json.error || 'Erro ao criar conta.'); return false }
    } catch (err) {
      setAuthError('Erro ao criar conta. Tente novamente.')
      return false
    }

    // A conta já nasce confirmada — loga direto, sem precisar de "verifique seu email"
    return signInPhone(phone, password)
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

  return {
    user, profile, loading, authError, setAuthError,
    signIn, signInPhone, signUp, signUpPhone, signOut, resetPassword, fetchProfile,
  }
}

function translateError(msg) {
  if (msg.includes('Invalid login credentials')) return 'Email/telefone ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.'
  if (msg.includes('User already registered')) return 'Este email já está cadastrado.'
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.'
  return msg
}
