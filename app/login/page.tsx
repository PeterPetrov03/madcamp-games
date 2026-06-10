'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, login } from '../../lib/auth'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isLoggedIn()) router.replace('/admin')
  }, [router])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    const ok = login(username, password)
    if (!ok) {
      setError('Грешно потребителско име или парола.')
      return
    }

    router.replace('/admin')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="w-full max-w-md mad-card p-6 space-y-6">
        <div className="space-y-2 text-center">
          <p className="mad-kicker">MAD CAMP</p>
          <h1 className="text-3xl font-black">Admin Login</h1>
          <p className="mad-muted">Вход само за администратори и лидери.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="mad-input"
            placeholder="User name"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="mad-input"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className="mad-btn w-full" type="submit">Вход</button>
        </form>

        <Link href="/" className="block text-center text-sm mad-muted hover:text-white">Към публичната класация</Link>
      </section>
    </main>
  )
}
