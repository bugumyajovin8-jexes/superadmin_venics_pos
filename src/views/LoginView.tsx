import * as React from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'
import { Button } from '@/src/components/ui/Button'
import { Input } from '@/src/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/Card'
import { Store, AlertCircle } from 'lucide-react'

interface LoginViewProps {
  externalError?: string | null
}

export function LoginView({ externalError }: LoginViewProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (externalError) {
      setError(externalError)
    }
  }, [externalError])

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConfigured) {
      setError("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment secrets.")
      return
    }

    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // If successful, App.tsx will handle the role check and redirect or show error
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200/60">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center mb-2">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-md shadow-indigo-200">
              <Store className="h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</CardTitle>
          <CardDescription className="text-base">Enter your credentials to access the superadmin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {!isConfigured && (
            <div className="mb-6 flex items-start gap-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p>
                <strong>Missing Configuration:</strong> Please add your Supabase URL and Anon Key to the environment secrets to enable login.
              </p>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <Input 
                type="email" 
                placeholder="admin@example.com"
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
              </div>
              <Input 
                type="password" 
                placeholder="••••••••"
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="h-11"
              />
            </div>
            
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading || !isConfigured}>
              {loading ? 'Signing in...' : 'Sign in to Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
