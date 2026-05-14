'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../../lib/supabase'

export default function AdminDashboard() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/admin/login')
        return
      }

      const { data: adminProfile } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!adminProfile) {
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      setAuthorized(true)
      setChecking(false)
    }

    checkAdmin()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-8">
        Checking admin access...
      </main>
    )
  }

  if (!authorized) {
    return null
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            Crested Critters Admin
          </h1>

          <p className="text-slate-400">
            Authorized admin access confirmed.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-500 px-4 py-2 font-bold text-white"
        >
          Logout
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          'Shop',
          'Isopedia',
          'Randomizer',
          'IsoTracker',
          'Facebook Agent',
        ].map((item) => (
          <div
            key={item}
            className="rounded-xl bg-slate-900 p-5"
          >
            {item}
          </div>
        ))}
      </div>
    </main>
  )
}