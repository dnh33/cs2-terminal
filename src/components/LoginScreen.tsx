import { useState, useEffect, FormEvent } from 'react'
import { login } from '../lib/api'
import { C } from '../lib/theme'

interface Props {
  onSuccess: () => void
}

/**
 * Full-screen login gate. Renders before the main app when the worker reports
 * auth_required=true and we have no valid token. On submit, hits /auth/login,
 * stores the returned token in localStorage, and unmounts itself.
 */
export function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: C.bg0, color: C.t0 }}
    >
      {/* Scanline atmosphere */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: `repeating-linear-gradient(0deg, transparent 0, transparent 2px, ${C.line} 2px, ${C.line} 3px)`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Terminal frame */}
      <div
        className="relative w-full max-w-md border"
        style={{ background: C.bg1, borderColor: C.line }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b font-mono text-[10px] tracking-[0.2em] uppercase"
          style={{ borderColor: C.line, background: C.bg2 }}
        >
          <span style={{ color: C.cyan }}>CS2 TERMINAL // SECURE ACCESS</span>
          <span style={{ color: C.t2 }}>{now.toISOString().slice(11, 19)} UTC</span>
        </div>

        <form onSubmit={submit} className="p-8 space-y-6">
          <div>
            <h1
              className="text-xl font-bold tracking-[0.15em] uppercase mb-1"
              style={{ color: C.t0 }}
            >
              Authentication Required
            </h1>
            <p className="text-xs" style={{ color: C.t2 }}>
              Enter the shared password to access the market intelligence terminal.
            </p>
          </div>

          <div>
            <label
              htmlFor="pw"
              className="block font-mono text-[10px] tracking-[0.2em] uppercase mb-2"
              style={{ color: C.t2 }}
            >
              Password
            </label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-3 font-mono text-sm outline-none border focus:border-current"
              style={{
                background: C.bg0,
                borderColor: error ? C.red : C.line,
                color: C.t0,
                caretColor: C.cyan,
              }}
            />
          </div>

          {error && (
            <div
              className="text-xs font-mono px-3 py-2 border-l-2"
              style={{
                color: C.red,
                borderColor: C.red,
                background: 'rgba(248, 113, 113, 0.06)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || busy}
            className="w-full py-3 font-mono text-xs tracking-[0.2em] uppercase font-bold transition-colors"
            style={{
              background: busy || !password ? C.bg3 : C.cyan,
              color: busy || !password ? C.t3 : C.bg0,
              cursor: busy || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Verifying…' : 'Authenticate'}
          </button>

          <div
            className="text-[10px] font-mono pt-2 border-t"
            style={{ color: C.t3, borderColor: C.line }}
          >
            <div className="flex justify-between">
              <span>SESSION TTL</span>
              <span>30 DAYS</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>HASH</span>
              <span>PBKDF2 / SHA-256 / 200K</span>
            </div>
          </div>
        </form>
      </div>

      <div
        className="mt-6 font-mono text-[10px] tracking-[0.15em] uppercase"
        style={{ color: C.t3 }}
      >
        unauthorized access prohibited
      </div>
    </div>
  )
}
