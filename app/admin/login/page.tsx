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

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-8">
        <h1 className="text-3xl font-bold mb-4">Admin Login</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-3 rounded bg-slate-800"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-3 rounded bg-slate-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-emerald-500 text-black font-bold py-3 rounded"
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