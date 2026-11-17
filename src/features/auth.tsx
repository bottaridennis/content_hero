import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  createUserWithEmailAndPassword, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential,
  signInWithEmailAndPassword, signInWithPopup, signOut, updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Clock, Eye, EyeOff, KeyRound, Lock, LogOut, ShieldAlert, Sparkles, Trophy, User, Users, Zap } from 'lucide-react';
import { auth, db } from '../firebase';
import { ADMIN_EMAIL, cn, sanitizeUsername, usernameToEmail } from '../lib/utils';
import { authErrorMessage } from '../lib/errors';
import { Button, Card, Field, Input } from '../components/ui';
import { Logo } from '../components/domain';
import type { UserProfile, UserRole } from '../types';

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      icon={<Lock />}
      trailing={
        <button type="button" onClick={() => setShow(s => !s)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg" aria-label={show ? 'Nascondi password' : 'Mostra password'}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export function AuthScreen({ onProfileCreated }: { onProfileCreated: (p: UserProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Player');
  const [loading, setLoading] = useState<'form' | 'google' | null>(null);
  const [providerDisabled, setProviderDisabled] = useState(false);
  const isLogin = mode === 'login';

  const handleGoogle = async () => {
    setLoading('google');
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const isOwner = user.email === ADMIN_EMAIL;
        const finalRole: UserRole = isOwner ? 'Admin' : isLogin ? 'Player' : role;
        const profile: UserProfile = {
          uid: user.uid,
          username: user.displayName || `user_${user.uid.slice(0, 5)}`,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          role: finalRole,
          score: 0,
          isApproved: isOwner || finalRole === 'Player',
          badges: [],
        };
        await setDoc(ref, profile);
        onProfileCreated(profile);
      }
      toast.success('Accesso effettuato');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/operation-not-allowed') setProviderDisabled(true);
      else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') toast.error(authErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitizeUsername(username)) return toast.error('Lo username deve contenere almeno una lettera o un numero.');
    if (!isLogin) {
      if (password.length < 6) return toast.error('La password deve avere almeno 6 caratteri.');
      if (password !== confirmPassword) return toast.error('Le password non coincidono.');
    }
    setLoading('form');
    const email = usernameToEmail(username);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Bentornato!');
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const profile: UserProfile = {
          uid: user.uid,
          username: username.trim(),
          firstName: '',
          lastName: '',
          role,
          score: 0,
          isApproved: role === 'Player',
          badges: [],
        };
        await setDoc(doc(db, 'users', user.uid), profile);
        onProfileCreated(profile);
        toast.success('Account creato! Benvenuto in Content Hero.');
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/operation-not-allowed') setProviderDisabled(true);
      else toast.error(authErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="hero-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex items-center gap-3">
          <Logo size={40} className="bg-white/15 shadow-none" />
          <span className="font-display text-xl font-bold">Content Hero</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-5xl font-bold leading-[1.05]">Trasforma il lavoro del team in un gioco.</h1>
          <p className="mt-5 text-lg text-white/80">Task con difficoltà, XP, badge, sfide a tempo e premi reali. Tutto sincronizzato in tempo reale.</p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[
              { icon: Zap, t: 'XP e livelli', d: 'Ogni task vale punti' },
              { icon: Trophy, t: 'Classifica', d: 'Sana competizione' },
              { icon: Sparkles, t: 'Badge', d: 'Traguardi da sbloccare' },
              { icon: Users, t: 'Team', d: 'Ruoli e revisioni' },
            ].map(f => (
              <div key={f.t} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <f.icon className="h-5 w-5" />
                <p className="mt-3 font-semibold">{f.t}</p>
                <p className="text-sm text-white/70">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} Content Hero</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-canvas p-5 sm:p-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="font-display text-xl font-bold">Content Hero</span>
          </div>
          <h2 className="text-3xl font-bold text-fg">{isLogin ? 'Bentornato 👋' : 'Crea il tuo account'}</h2>
          <p className="mt-2 text-muted">{isLogin ? 'Accedi per continuare la tua scalata in classifica.' : 'Unisciti al team e inizia a guadagnare XP.'}</p>

          <div className="mt-8 grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1">
            {(['login', 'register'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn('h-9 rounded-lg text-sm font-semibold transition-colors', mode === m ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg')}>
                {m === 'login' ? 'Accedi' : 'Registrati'}
              </button>
            ))}
          </div>

          {providerDisabled && (
            <div className="mt-6 flex gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 text-danger" />
              <div>
                <p className="font-semibold text-fg">Metodo di accesso non abilitato</p>
                <p className="mt-1 text-muted">Abilita il provider nella console Firebase (Authentication → Sign-in method).</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Username" htmlFor="auth-username">
              <Input id="auth-username" autoComplete="username" icon={<User />} value={username} onChange={e => setUsername(e.target.value)} placeholder="es. mario.rossi" required />
            </Field>
            <Field label="Password" htmlFor="auth-password">
              <PasswordInput id="auth-password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
            {!isLogin && (
              <>
                <Field label="Conferma password" htmlFor="auth-confirm">
                  <PasswordInput id="auth-confirm" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                </Field>
                <Field label="Ruolo" hint={role === 'Responsabile' ? "L'account Responsabile richiede l'approvazione di un amministratore." : undefined}>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Player', 'Responsabile'] as const).map(r => (
                      <button key={r} type="button" onClick={() => setRole(r)}
                        className={cn('rounded-xl border px-3 py-3 text-left transition-all', role === r ? 'border-brand bg-brand-soft ring-4 ring-[var(--ring)]' : 'border-line bg-surface hover:border-line-strong')}>
                        <p className="text-sm font-semibold text-fg">{r}</p>
                        <p className="text-xs text-muted">{r === 'Player' ? 'Completa task' : 'Crea e valida'}</p>
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            <Button type="submit" size="lg" className="w-full" loading={loading === 'form'} disabled={!!loading}>
              {isLogin ? 'Accedi' : 'Crea account'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
          </div>

          <Button variant="outline" size="lg" className="w-full" onClick={handleGoogle} loading={loading === 'google'} disabled={!!loading}>
            {loading !== 'google' && <GoogleIcon />} Continua con Google
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-grid flex min-h-dvh items-center justify-center bg-canvas p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="p-7 shadow-pop sm:p-9">{children}</Card>
      </motion.div>
    </div>
  );
}

export function PendingApproval({ profile }: { profile: UserProfile }) {
  return (
    <CenteredCard>
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Clock className="h-7 w-7" /></div>
        <h2 className="mt-5 text-2xl font-bold text-fg">In attesa di approvazione</h2>
        <p className="mt-2 text-muted">
          Ciao <strong className="text-fg">{profile.username}</strong>, il tuo account <strong className="text-fg">{profile.role}</strong> deve essere confermato da un amministratore. La pagina si aggiornerà automaticamente.
        </p>
        <Button variant="outline" className="mt-7 w-full" onClick={() => signOut(auth)}><LogOut className="h-4 w-4" /> Esci</Button>
      </div>
    </CenteredCard>
  );
}

export function ForcePasswordChange({ profile, onDone }: { profile: UserProfile; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return toast.error('La password deve avere almeno 6 caratteri.');
    if (next !== confirm) return toast.error('Le password non coincidono.');
    if (next === current) return toast.error('La nuova password deve essere diversa da quella attuale.');
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Utente non autenticato');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      await setDoc(doc(db, 'users', profile.uid), { mustChangePassword: false }, { merge: true });
      toast.success('Password aggiornata. Benvenuto!');
      onDone();
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredCard>
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><KeyRound className="h-7 w-7" /></div>
        <h2 className="mt-5 text-2xl font-bold text-fg">Imposta la tua password</h2>
        <p className="mt-2 text-muted">Per sicurezza devi sostituire la password temporanea ricevuta.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Password temporanea"><PasswordInput value={current} onChange={e => setCurrent(e.target.value)} placeholder="Nome123" autoComplete="current-password" required /></Field>
        <Field label="Nuova password" hint="Minimo 6 caratteri"><PasswordInput value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" required /></Field>
        <Field label="Conferma nuova password"><PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Aggiorna password</Button>
        <Button variant="ghost" className="w-full" onClick={() => signOut(auth)}>Esci</Button>
      </form>
    </CenteredCard>
  );
}

export { PasswordInput };
