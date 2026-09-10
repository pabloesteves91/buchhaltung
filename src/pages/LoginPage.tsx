import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/auth'

export function LoginPage() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch {
      setError('Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div>
          <p className="text-xl font-bold text-foreground">nipponnites</p>
          <p className="text-sm text-muted-foreground">Buchhaltung – Anmeldung</p>
        </div>
        <Field label="E-Mail">
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Passwort">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy} loading={busy}>
          Anmelden
        </Button>
      </form>
    </div>
  )
}
