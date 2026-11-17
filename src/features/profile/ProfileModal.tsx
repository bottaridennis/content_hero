import React, { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { KeyRound, Monitor, Moon, Sun, UserCircle } from 'lucide-react';
import { auth, db } from '../../firebase';
import { OperationType, authErrorMessage, handleFirestoreError } from '../../lib/errors';
import { cn, getLevel, ROLE_LABEL } from '../../lib/utils';
import { Avatar, Button, Field, Input, Modal, ProgressBar, Segmented } from '../../components/ui';
import { PasswordInput } from '../auth';
import type { Theme } from '../../hooks/useTheme';
import type { UserProfile } from '../../types';

export function ProfileModal({ open, onClose, profile, theme, setTheme }: { open: boolean; onClose: () => void; profile: UserProfile; theme: Theme; setTheme: (t: Theme) => void }) {
  const [tab, setTab] = useState<'profile' | 'security' | 'prefs'>('profile');
  const isPasswordUser = !!auth.currentUser?.providerData.some(p => p.providerId === 'password');
  const lvl = getLevel(profile.score);

  return (
    <Modal open={open} onClose={onClose} icon={<UserCircle />} title="Il mio account">
      <div className="mb-5 flex items-center gap-4">
        <Avatar user={profile} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-fg">{profile.username}</p>
          <p className="text-sm text-muted">{ROLE_LABEL[profile.role]}{profile.area ? ` · ${profile.area}` : ''}</p>
          <div className="mt-2 flex items-center gap-2"><ProgressBar value={lvl.progress} /><span className="whitespace-nowrap text-xs font-semibold text-muted">Lv {lvl.level}</span></div>
        </div>
      </div>
      <Segmented className="mb-5 w-full" value={tab} onChange={setTab} options={[
        { value: 'profile', label: 'Profilo' },
        ...(isPasswordUser ? [{ value: 'security' as const, label: 'Password' }] : []),
        { value: 'prefs', label: 'Aspetto' },
      ]} />
      {tab === 'profile' && <ProfileForm profile={profile} />}
      {tab === 'security' && <PasswordForm />}
      {tab === 'prefs' && (
        <div className="grid grid-cols-3 gap-2">
          {([['light', Sun, 'Chiaro'], ['dark', Moon, 'Scuro'], ['system', Monitor, 'Sistema']] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" onClick={() => setTheme(v)}
              className={cn('flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-all', theme === v ? 'border-brand bg-brand-soft text-fg ring-4 ring-[var(--ring)]' : 'border-line text-muted hover:border-line-strong')}>
              <Icon className="h-5 w-5" />{label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const [username, setUsername] = useState(profile.username || '');
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return toast.error('Lo username è obbligatorio');
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', profile.uid), { username: username.trim(), firstName: firstName.trim(), lastName: lastName.trim() }, { merge: true });
      toast.success('Profilo aggiornato');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Nome visualizzato" hint="Lo username di accesso non cambia: modifichi solo come appari agli altri.">
        <Input value={username} onChange={e => setUsername(e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></Field>
        <Field label="Cognome"><Input value={lastName} onChange={e => setLastName(e.target.value)} /></Field>
      </div>
      <Button type="submit" className="w-full" loading={saving}>Salva modifiche</Button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return toast.error('La password deve avere almeno 6 caratteri');
    if (next !== confirm) return toast.error('Le password non coincidono');
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) throw new Error('Utente non autenticato');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      toast.success('Password aggiornata');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Password attuale"><PasswordInput value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required /></Field>
      <Field label="Nuova password"><PasswordInput value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" required /></Field>
      <Field label="Conferma nuova password"><PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></Field>
      <Button type="submit" className="w-full" loading={saving}><KeyRound className="h-4 w-4" /> Aggiorna password</Button>
    </form>
  );
}
