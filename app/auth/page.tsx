'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { clearDatabase } from '@/lib/utils/database';
import type { AuthUser } from '@/lib/types/auth';

const AUTH_USER_STORAGE_KEY = 'vc-auth-user-id';

type AuthMode = 'login' | 'register' | 'recovery' | 'reset';

async function syncClientUser(user: AuthUser) {
  const previousUserId = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (previousUserId && previousUserId !== user.id) {
    await clearDatabase();
  }
  localStorage.setItem(AUTH_USER_STORAGE_KEY, user.id);
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const token = searchParams.get('token') || '';
  const initialMode = (searchParams.get('mode') as AuthMode | null) || 'login';
  const modeFromQuery: AuthMode = token ? 'reset' : initialMode;

  const [mode, setMode] = useState<AuthMode>(modeFromQuery);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [recoveryForm, setRecoveryForm] = useState({ email: '' });
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' });
  const [resetUrl, setResetUrl] = useState('');

  const title = useMemo(() => {
    if (mode === 'reset') return 'Nuova password';
    if (mode === 'recovery') return 'Recupero password';
    return 'Accesso area riservata';
  }, [mode]);

  const description = useMemo(() => {
    if (mode === 'reset') return 'Imposta una nuova password per continuare.';
    if (mode === 'recovery') return 'Genera un link di recupero per il tuo account.';
    return 'Login o registrazione obbligatori prima di usare la piattaforma.';
  }, [mode]);

  const handleAuthSuccess = async (user: AuthUser) => {
    await syncClientUser(user);
    router.replace(redirectTo);
    router.refresh();
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Login non riuscito');
      }
      await handleAuthSuccess(data.user as AuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login non riuscito');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Registrazione non riuscita');
      }
      await handleAuthSuccess(data.user as AuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');
    setResetUrl('');

    try {
      const response = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recoveryForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Recupero password non riuscito');
      }
      setInfo(data.message || 'Controllare il link di recupero.');
      if (data.resetUrl) {
        setResetUrl(data.resetUrl as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recupero password non riuscito');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      if (resetForm.password !== resetForm.confirmPassword) {
        throw new Error('Le password non coincidono');
      }
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: resetForm.password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Reset password non riuscito');
      }
      await handleAuthSuccess(data.user as AuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset password non riuscito');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(to_bottom,_rgb(248,250,252),_rgb(226,232,240))] dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_30%),linear-gradient(to_bottom,_rgb(2,6,23),_rgb(15,23,42))] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-white/40 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 shadow-2xl">
        <CardHeader className="space-y-3">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="pt-1">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode !== 'reset' ? (
            <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Registrati</TabsTrigger>
                <TabsTrigger value="recovery">Recupera</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        className="pl-9"
                        value={loginForm.email}
                        onChange={(event) =>
                          setLoginForm((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        className="pl-9"
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm((current) => ({ ...current, password: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Accesso in corso...' : 'Entra'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-name"
                        className="pl-9"
                        value={registerForm.name}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, name: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        className="pl-9"
                        value={registerForm.email}
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        className="pl-9"
                        value={registerForm.password}
                        onChange={(event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimo 8 caratteri.</p>
                  </div>
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Creazione account...' : 'Crea account'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="recovery" className="mt-4">
                <form className="space-y-4" onSubmit={handleRecovery}>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="recovery-email"
                        type="email"
                        className="pl-9"
                        value={recoveryForm.email}
                        onChange={(event) =>
                          setRecoveryForm((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <Button className="w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Generazione link...' : 'Genera link di recupero'}
                  </Button>
                  {resetUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(resetUrl)}
                    >
                      Apri il link di recupero
                    </Button>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form className="space-y-4" onSubmit={handleReset}>
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nuova password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetForm.password}
                  onChange={(event) =>
                    setResetForm((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-password-confirm">Conferma password</Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  value={resetForm.confirmPassword}
                  onChange={(event) =>
                    setResetForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={submitting || !token}>
                {submitting ? 'Aggiornamento password...' : 'Salva e continua'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('login')}>
                Torna al login
              </Button>
            </form>
          )}

          {(error || info) && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                error
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {error || info}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
