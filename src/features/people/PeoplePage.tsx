import React, { useMemo, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { deleteDoc, deleteField, doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Check, Copy, Eye, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { db, firebaseConfig } from '../../firebase';
import { useApp } from '../../context';
import { updateUser } from '../../lib/actions';
import { OperationType, handleFirestoreError, authErrorMessage } from '../../lib/errors';
import { cn, displayName, getLevel, ROLE_LABEL, sanitizeUsername, usernameToEmail } from '../../lib/utils';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Pill, Segmented, Select, Switch } from '../../components/ui';
import { XPChip } from '../../components/domain';
import type { UserProfile, UserRole } from '../../types';

export function PeoplePage({ onSimulate }: { onSimulate: (u: UserProfile) => void }) {
  const { data, realProfile, selectedArea } = useApp();
  const isAdmin = realProfile.role === 'Admin';
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole | 'pending'>('all');
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState<UserProfile | null>(null);
  const [creating, setCreating] = useState(false);

  const scoped = useMemo(() => data.users.filter(u => {
    if (selectedArea !== 'Tutte' && u.area !== selectedArea) return false;
    if (isAdmin) return true;
    return u.role === 'Player' && u.responsabileUids?.includes(realProfile.uid);
  }), [data.users, selectedArea, isAdmin, realProfile.uid]);

  const pendingCount = scoped.filter(u => !u.isApproved).length;
  const list = scoped
    .filter(u => roleFilter === 'all' || (roleFilter === 'pending' ? !u.isApproved : u.role === roleFilter))
    .filter(u => {
      const q = query.trim().toLowerCase();
      return !q || u.username.toLowerCase().includes(q) || displayName(u).toLowerCase().includes(q);
    })
    .sort((a, b) => Number(a.isApproved) - Number(b.isApproved) || a.username.localeCompare(b.username));

  const supervisors = (u: UserProfile) => (u.responsabileUids || []).map(id => data.users.find(x => x.uid === id)).filter(Boolean) as UserProfile[];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {isAdmin ? (
          <Segmented value={roleFilter} onChange={setRoleFilter} options={[
            { value: 'all', label: 'Tutti', count: scoped.length },
            { value: 'Player', label: 'Player' },
            { value: 'Responsabile', label: 'Responsabili' },
            { value: 'Admin', label: 'Admin' },
            ...(pendingCount ? [{ value: 'pending' as const, label: 'Da approvare', count: pendingCount }] : []),
          ]} />
        ) : <p className="text-sm text-muted">I player assegnati a te come responsabile.</p>}
        <div className="flex gap-2">
          <div className="flex-1 sm:w-64"><Input icon={<Search />} value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca persone…" className="h-10" /></div>
          {isAdmin && <Button onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Nuovo profilo</span></Button>}
        </div>
      </div>

      {list.length === 0 ? <EmptyState icon={<Users />} title="Nessuna persona" description={isAdmin ? 'Nessun utente corrisponde ai filtri.' : "Non hai ancora player assegnati. Chiedi a un amministratore di collegarli a te."} /> : (
        <Card className="divide-y divide-line overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_96px_176px] items-center gap-4 bg-surface-2/60 px-5 py-2.5 text-xs font-semibold text-subtle lg:grid">
            <span>Persona</span><span>Ruolo · Area</span><span>Responsabili</span><span>XP</span><span className="text-right">Azioni</span>
          </div>
          {list.map(u => {
            const lvl = getLevel(u.score);
            const sups = supervisors(u);
            return (
              <div key={u.uid} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_96px_176px]', !u.isApproved && 'bg-warning-soft/40')}>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar user={u} size={38} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold text-fg">{displayName(u)}{!u.isApproved && <Pill tone="warning">In attesa</Pill>}</p>
                    <p className="truncate text-xs text-subtle">@{u.username} · Lv {lvl.level}</p>
                  </div>
                </div>
                <div className="order-last col-span-2 flex flex-wrap items-center gap-1.5 lg:order-none lg:col-span-1">
                  <Pill tone={u.role === 'Admin' ? 'danger' : u.role === 'Responsabile' ? 'brand' : 'neutral'}>{ROLE_LABEL[u.role]}</Pill>
                  {u.area && <Pill>{u.area}</Pill>}
                  <span className="lg:hidden"><XPChip value={u.score} size="sm" /></span>
                </div>
                <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
                  {u.role !== 'Player' ? <span className="text-sm text-subtle">—</span> : sups.length === 0 ? <span className="text-sm text-subtle">Nessuno</span> :
                    sups.slice(0, 3).map(s => <span key={s.uid} className="flex items-center gap-1.5 truncate rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs font-medium text-fg"><Avatar user={s} size={20} />{s.username}</span>)}
                </div>
                <div className="hidden lg:block"><XPChip value={u.score} size="sm" /></div>
                <div className="flex items-center justify-end gap-1">
                  {isAdmin && !u.isApproved && <Button size="xs" variant="success" onClick={() => updateUser(u.uid, { isApproved: true })}><ShieldCheck className="h-3.5 w-3.5" /> Approva</Button>}
                  {isAdmin && u.uid !== realProfile.uid && <Button variant="ghost" size="icon-sm" title="Simula profilo" onClick={() => onSimulate(u)}><Eye className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon-sm" title="Modifica" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></Button>
                  {isAdmin && u.uid !== realProfile.uid && <Button variant="ghost" size="icon-sm" className="hover:text-danger" title="Elimina" onClick={() => setDeleting(u)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <EditUserModal user={editing} onClose={() => setEditing(null)} />
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function EditUserModal({ user, onClose }: { user: UserProfile | null; onClose: () => void }) {
  return (
    <Modal open={!!user} onClose={onClose} icon={<Pencil />} title="Modifica profilo" description={user ? `@${user.username}` : undefined}>
      {user && <EditUserForm user={user} onClose={onClose} />}
    </Modal>
  );
}

function EditUserForm({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { data, realProfile } = useApp();
  const isAdmin = realProfile.role === 'Admin';
  const [role, setRole] = useState<UserRole>(user.role);
  const [area, setArea] = useState(user.area || '');
  const [approved, setApproved] = useState(user.isApproved);
  const [score, setScore] = useState(String(user.score));
  const [sups, setSups] = useState<string[]>(user.responsabileUids || []);
  const [saving, setSaving] = useState(false);
  const managers = data.users.filter(u => (u.role === 'Responsabile' || u.role === 'Admin') && u.uid !== user.uid);

  const save = async () => {
    const s = parseInt(score, 10);
    if (isNaN(s) || s < 0) return toast.error('Punteggio non valido');
    setSaving(true);
    const updates: Record<string, unknown> = {};
    if (s !== user.score) updates.score = s;
    if (isAdmin) {
      if (role !== user.role) updates.role = role;
      if (area !== (user.area || '')) updates.area = area || deleteField();
      if (approved !== user.isApproved) updates.isApproved = approved;
      const prev = user.responsabileUids || [];
      if (role === 'Player' && (sups.length !== prev.length || sups.some(x => !prev.includes(x)))) updates.responsabileUids = sups;
    }
    if (Object.keys(updates).length) await updateUser(user.uid, updates, { users: data.users, tasks: data.tasks, badges: data.badges });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <Avatar user={user} size={44} />
        <div className="min-w-0"><p className="truncate font-semibold text-fg">{displayName(user)}</p><p className="text-xs text-subtle">Lv {getLevel(user.score).level} · {user.badges?.length || 0} badge</p></div>
      </div>
      {isAdmin && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ruolo">
              <Select value={role} onChange={e => setRole(e.target.value as UserRole)} disabled={user.uid === realProfile.uid}>
                <option value="Player">Player</option><option value="Responsabile">Responsabile</option><option value="Admin">Admin</option>
              </Select>
            </Field>
            <Field label="Area">
              <Select value={area} onChange={e => setArea(e.target.value)}>
                <option value="">Nessuna</option>
                {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
            <div><p className="text-sm font-semibold text-fg">Account approvato</p><p className="text-xs text-subtle">Gli account non approvati non possono accedere</p></div>
            <Switch checked={approved} onChange={setApproved} label="Approvato" disabled={user.uid === realProfile.uid} />
          </div>
          {role === 'Player' && (
            <Field label="Responsabili" hint="Chi può assegnare task e validare il lavoro di questo player">
              <div className="flex flex-wrap gap-2">
                {managers.length === 0 && <p className="text-sm text-subtle">Nessun responsabile disponibile</p>}
                {managers.map(m => {
                  const on = sups.includes(m.uid);
                  return (
                    <button key={m.uid} type="button" onClick={() => setSups(p => on ? p.filter(x => x !== m.uid) : [...p, m.uid])}
                      className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition-colors', on ? 'border-brand bg-brand-soft text-fg' : 'border-line text-muted hover:border-line-strong')}>
                      <Avatar user={m} size={24} />{m.username}{on && <Check className="h-3.5 w-3.5 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </>
      )}
      <Field label="Punteggio XP" hint="Modifica manuale: i badge di punteggio vengono ricalcolati.">
        <Input type="number" min="0" value={score} onChange={e => setScore(e.target.value)} />
      </Field>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={save} loading={saving}>Salva</Button>
      </div>
    </div>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useApp();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('Player');
  const [area, setArea] = useState('');
  const [sups, setSups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const managers = data.users.filter(u => u.role === 'Responsabile' || u.role === 'Admin');

  const reset = () => { setUsername(''); setFirstName(''); setLastName(''); setRole('Player'); setArea(''); setSups([]); setCreated(null); };
  const close = () => { reset(); onClose(); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitizeUsername(username)) return toast.error('Username non valido');
    if (!firstName.trim()) return toast.error('Il nome è obbligatorio');
    const password = `${firstName.trim()}123`;
    if (password.length < 6) return toast.error('Il nome è troppo corto per generare una password valida (min. 3 caratteri).');
    setSaving(true);
    const secondary = initializeApp(firebaseConfig, `create_${Date.now()}`);
    try {
      const { user } = await createUserWithEmailAndPassword(getAuth(secondary), usernameToEmail(username), password);
      const profile: UserProfile = {
        uid: user.uid,
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        score: 0,
        isApproved: true,
        badges: [],
        mustChangePassword: true,
        ...(area ? { area } : {}),
        ...(role === 'Player' && sups.length ? { responsabileUids: sups } : {}),
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      setCreated({ username: username.trim(), password });
      toast.success('Profilo creato');
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code?.startsWith('auth/')) toast.error(authErrorMessage(error));
      else handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      await deleteApp(secondary).catch(() => undefined);
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={close} icon={<UserPlus />} title="Nuovo profilo" description="L'utente dovrà cambiare la password al primo accesso.">
      {created ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success"><Check className="h-7 w-7" /></div>
          <div><p className="text-lg font-semibold text-fg">Profilo pronto!</p><p className="text-sm text-muted">Condividi queste credenziali temporanee con l'utente.</p></div>
          <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-left font-mono text-sm">
            <p><span className="text-subtle">username:</span> <span className="font-semibold text-fg">{created.username}</span></p>
            <p><span className="text-subtle">password:</span> <span className="font-semibold text-fg">{created.password}</span></p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(`Username: ${created.username}\nPassword: ${created.password}`).then(() => toast.success('Copiato negli appunti')); }}><Copy className="h-4 w-4" /> Copia</Button>
            <Button variant="outline" onClick={reset}>Crea un altro</Button>
            <Button onClick={close}>Fatto</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Username"><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="es. mario.rossi" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={firstName} onChange={e => setFirstName(e.target.value)} required /></Field>
            <Field label="Cognome"><Input value={lastName} onChange={e => setLastName(e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ruolo">
              <Select value={role} onChange={e => setRole(e.target.value as UserRole)}>
                <option value="Player">Player</option><option value="Responsabile">Responsabile</option><option value="Admin">Admin</option>
              </Select>
            </Field>
            <Field label="Area">
              <Select value={area} onChange={e => setArea(e.target.value)}>
                <option value="">Nessuna</option>
                {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Field>
          </div>
          {role === 'Player' && managers.length > 0 && (
            <Field label="Responsabili">
              <div className="flex flex-wrap gap-2">
                {managers.map(m => {
                  const on = sups.includes(m.uid);
                  return (
                    <button key={m.uid} type="button" onClick={() => setSups(p => on ? p.filter(x => x !== m.uid) : [...p, m.uid])}
                      className={cn('rounded-full border px-3 py-1 text-sm font-medium transition-colors', on ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:border-line-strong')}>
                      {m.username}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          <div className="rounded-xl bg-info-soft px-4 py-3 text-sm text-fg">
            Password temporanea: <strong className="font-mono">{(firstName.trim() || 'Nome')}123</strong>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close}>Annulla</Button>
            <Button type="submit" loading={saving}>Crea profilo</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DeleteUserDialog({ user, onClose }: { user: UserProfile | null; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => { setTyped(''); onClose(); };

  const confirm = async () => {
    if (!user) return;
    setLoading(true);
    // Best effort: rimuove anche l'account Auth se l'utente ha ancora la password temporanea.
    if (user.firstName) {
      const secondary = initializeApp(firebaseConfig, `delete_${Date.now()}`);
      try {
        const cred = await signInWithEmailAndPassword(getAuth(secondary), usernameToEmail(user.username), `${user.firstName || ''}123`);
        await deleteUser(cred.user);
      } catch {
        console.warn('Account Auth non rimosso (password già cambiata o account Google). Rimuoverlo dalla console Firebase se necessario.');
      } finally {
        await deleteApp(secondary).catch(() => undefined);
      }
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      toast.success(`${user.username} eliminato`);
      close();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog open={!!user} onClose={close} onConfirm={confirm} loading={loading} icon={<Trash2 />} title="Eliminare l'utente?" confirmLabel="Elimina definitivamente"
      confirmDisabled={typed !== user?.username}
      message={<>Il profilo di <strong className="text-fg">{user?.username}</strong> e i suoi punti verranno rimossi. L'azione è irreversibile.</>}>
      <Field label={`Digita «${user?.username}» per confermare`}>
        <Input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" className="text-center font-mono" />
      </Field>
    </ConfirmDialog>
  );
}
