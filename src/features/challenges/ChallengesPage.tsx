import React, { useState } from 'react';
import { addDays, format, isAfter, parseISO } from 'date-fns';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { CheckCircle2, Hourglass, Plus, Swords, Timer, Trash2, Zap } from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context';
import { claimChallenge } from '../../lib/actions';
import { OperationType, handleFirestoreError } from '../../lib/errors';
import { cn, fromNow, isManager } from '../../lib/utils';
import { AvatarStack, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Pill, Segmented, Select, Textarea } from '../../components/ui';
import { XPChip } from '../../components/domain';
import type { Challenge } from '../../types';

export function ChallengesPage() {
  const { profile, data, selectedArea, userById, isSimulating } = useApp();
  const manager = isManager(profile.role);
  const [filter, setFilter] = useState<'active' | 'done' | 'expired'>('active');
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const list = data.challenges.filter(c => selectedArea === 'Tutte' || !c.area || c.area === selectedArea);
  const expired = (c: Challenge) => isAfter(new Date(), parseISO(c.expiresAt));
  const mine = (c: Challenge) => c.completedBy.includes(profile.uid);
  const groups = {
    active: list.filter(c => !expired(c) && !mine(c)),
    done: list.filter(mine),
    expired: list.filter(c => expired(c) && !mine(c)),
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteDoc(doc(db, 'challenges', toDelete.id));
      toast.success('Sfida eliminata');
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `challenges/${toDelete.id}`);
    }
    setToDelete(null);
  };

  const claim = async (c: Challenge) => {
    setBusy(c.id);
    await claimChallenge(c, profile.uid);
    setBusy(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: 'active', label: 'Attive', count: groups.active.length },
          { value: 'done', label: 'Completate', count: groups.done.length },
          { value: 'expired', label: 'Scadute', count: groups.expired.length },
        ]} />
        {manager && !isSimulating && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Nuova sfida</Button>}
      </div>

      {groups[filter].length === 0 ? (
        <EmptyState icon={<Swords />} title={filter === 'active' ? 'Nessuna sfida attiva' : filter === 'done' ? 'Nessuna sfida completata' : 'Nessuna sfida scaduta'}
          description={filter === 'active' ? 'Le sfide a tempo danno XP bonus: torna presto!' : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups[filter].map(c => {
            const isExpired = expired(c);
            const done = mine(c);
            const pending = c.pendingBy?.includes(profile.uid);
            const hoursLeft = (parseISO(c.expiresAt).getTime() - Date.now()) / 36e5;
            return (
              <Card key={c.id} className={cn('relative flex flex-col overflow-hidden p-5', isExpired && !done && 'opacity-70')}>
                {!isExpired && !done && <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-xp/15 blur-2xl" />}
                <div className="relative flex items-start justify-between gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', done ? 'bg-success-soft text-success' : 'bg-xp-soft text-xp')}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5 fill-current" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <XPChip value={`+${c.bonusXP}`} />
                    {manager && !isSimulating && <Button variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => setToDelete(c)} aria-label="Elimina"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
                <h3 className="relative mt-4 font-sans text-base font-semibold text-fg">{c.title}</h3>
                <p className="relative mt-1 line-clamp-3 flex-1 text-sm text-muted">{c.description}</p>
                <div className="relative mt-4 flex flex-wrap items-center gap-2">
                  {c.area && <Pill>{c.area}</Pill>}
                  <Pill tone={isExpired ? 'neutral' : hoursLeft < 24 ? 'danger' : 'warning'}>
                    <Timer className="h-3 w-3" />{isExpired ? 'Scaduta' : `Scade ${fromNow(c.expiresAt)}`}
                  </Pill>
                </div>
                <div className="relative mt-4 flex items-center justify-between border-t border-line pt-4">
                  {c.completedBy.length > 0
                    ? <div className="flex items-center gap-2"><AvatarStack users={c.completedBy.map(userById)} size={24} /><span className="text-xs text-subtle">{c.completedBy.length} completat{c.completedBy.length === 1 ? 'a' : 'e'}</span></div>
                    : <span className="text-xs text-subtle">Nessuno l'ha ancora completata</span>}
                  {done ? <Pill tone="success">Completata</Pill>
                    : pending ? <Pill tone="warning"><Hourglass className="h-3 w-3" />In verifica</Pill>
                    : !isExpired && <Button size="sm" variant="soft" loading={busy === c.id} onClick={() => claim(c)}>Ho completato</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ChallengeFormModal open={showForm} onClose={() => setShowForm(false)} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} icon={<Trash2 />} title="Eliminare la sfida?"
        message={<>La sfida <strong className="text-fg">{toDelete?.title}</strong> verrà rimossa. Gli XP già assegnati restano.</>} confirmLabel="Elimina" />
    </div>
  );
}

function ChallengeFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, realProfile } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bonusXP, setBonusXP] = useState('50');
  const [area, setArea] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => format(addDays(new Date(), 3), "yyyy-MM-dd'T'18:00"));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const xp = parseInt(bonusXP, 10);
    if (isNaN(xp) || xp <= 0) return toast.error('Inserisci un bonus XP valido');
    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime()) || exp.getTime() < Date.now()) return toast.error('La scadenza deve essere nel futuro');
    setSaving(true);
    try {
      const ref = doc(collection(db, 'challenges'));
      const c: Challenge = {
        id: ref.id, title: title.trim(), description: description.trim(), bonusXP: xp, expiresAt: exp.toISOString(),
        area: area || null, completedBy: [], pendingBy: [], createdBy: realProfile.uid, createdAt: new Date().toISOString(),
      };
      await setDoc(ref, c);
      toast.success('Sfida pubblicata ⚡');
      setTitle(''); setDescription(''); setArea('');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'challenges');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} icon={<Swords />} title="Nuova sfida a tempo" description="I player segnalano il completamento, tu lo verifichi in Revisioni.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titolo"><Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="es. Zero errori ortografici questa settimana" /></Field>
        <Field label="Descrizione"><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bonus XP"><Input type="number" min="1" value={bonusXP} onChange={e => setBonusXP(e.target.value)} required /></Field>
          <Field label="Scadenza"><Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required /></Field>
        </div>
        <Field label="Area" hint="Lascia vuoto per renderla visibile a tutti">
          <Select value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Tutte le aree</option>
            {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" loading={saving}>Pubblica sfida</Button>
        </div>
      </form>
    </Modal>
  );
}
