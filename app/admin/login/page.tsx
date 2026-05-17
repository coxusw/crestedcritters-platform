'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../../lib/supabase'

export default function AdminLogin() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin() {
    setMessage('Logging in...')

    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Login successful.')

    const isAdminSubdomain =
      typeof window !== 'undefined' &&
      window.location.hostname === 'admin.crestedcritters.com'

    router.push(isAdminSubdomain ? '/' : '/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#08110d] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-black/40">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
          Crested Critters
        </p>
        <h1 className="text-3xl font-bold mb-2">Admin Login</h1>
        <p className="mb-6 text-sm leading-6 text-slate-300">
          Sign in with an account that exists in the admin profile table.
        </p>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 rounded-md border border-white/10 bg-slate-900 p-3 outline-none ring-emerald-400/30 focus:ring-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 rounded-md border border-white/10 bg-slate-900 p-3 outline-none ring-emerald-400/30 focus:ring-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full rounded-md bg-emerald-400 py-3 font-black text-slate-950 hover:bg-emerald-300"
        >
          Login
        </button>

        {message && (
          <p className="text-sm text-slate-300 mt-4">{message}</p>
        )}
      </div>
    </main>
  )
}
