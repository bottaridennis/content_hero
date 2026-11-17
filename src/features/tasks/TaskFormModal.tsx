import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Check, ClipboardList, Search } from 'lucide-react';
import { db } from '../../firebase';
import { useApp } from '../../context';
import { DIFFICULTY_SCORES } from '../../constants';
import { OperationType, handleFirestoreError } from '../../lib/errors';
import { cn, displayName, randomTaskColor } from '../../lib/utils';
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { DIFFICULTIES, DIFFICULTY_META } from '../../components/domain';
import type { Task, TaskDifficulty } from '../../types';

const toLocalInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");

export function TaskFormModal({ open, onClose, task }: { open: boolean; onClose: () => void; task?: Task }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={<ClipboardList />} title={task ? 'Modifica task' : 'Nuovo task'} description={task ? task.title : 'Definisci obiettivo, difficoltà e chi se ne occupa.'}>
      {open && <TaskForm task={task} onClose={onClose} />}
    </Modal>
  );
}

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { data, realProfile } = useApp();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [deadline, setDeadline] = useState(() => {
    if (task) return toLocalInput(task.deadline);
    const d = addDays(new Date(), 1);
    d.setHours(18, 0, 0, 0);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  });
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(task?.difficulty || 'Bronzo');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours?.toString() || '');
  const [basePoints, setBasePoints] = useState(task?.basePoints?.toString() ?? DIFFICULTY_SCORES[task?.difficulty || 'Bronzo'].toString());
  const [pointsTouched, setPointsTouched] = useState(!!task);
  const [assignees, setAssignees] = useState<string[]>(task?.assignees || []);
  const [area, setArea] = useState(task?.area || '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => data.users.filter(u =>
    u.isApproved && (
      realProfile.role === 'Admin' ||
      u.uid === realProfile.uid ||
      (u.role === 'Player' && u.responsabileUids?.includes(realProfile.uid)) ||
      u.role === 'Responsabile'
    ),
  ).sort((a, b) => a.username.localeCompare(b.username)), [data.users, realProfile]);

  const filtered = candidates.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.username.toLowerCase().includes(q) || displayName(u).toLowerCase().includes(q) || (u.area || '').toLowerCase().includes(q);
  });

  const toggle = (uid: string) => setAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  const changeDifficulty = (d: TaskDifficulty) => {
    setDifficulty(d);
    if (!pointsTouched) setBasePoints(DIFFICULTY_SCORES[d].toString());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Inserisci un titolo');
    if (assignees.length === 0) return toast.error('Seleziona almeno un assegnatario');
    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0) return toast.error('Inserisci un numero di ore valido');
    const points = parseInt(basePoints, 10);
    if (isNaN(points) || points < 0) return toast.error('Inserisci un punteggio base valido');
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) return toast.error('Scadenza non valida');

    setSaving(true);
    try {
      if (task) {
        // Mantiene coerenti accettazioni/consegne se cambiano gli assegnatari
        const acceptedBy = (task.acceptedBy || []).filter(id => assignees.includes(id));
        const submittedBy = (task.submittedBy || []).filter(id => assignees.includes(id));
        const updates: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineDate.toISOString(),
          difficulty,
          estimatedHours: hours,
          basePoints: points,
          assignees,
          acceptedBy,
          submittedBy,
          area: area || null,
          color: task.color || randomTaskColor(),
        };
        if (task.status === 'In attesa' && assignees.every(a => acceptedBy.includes(a))) {
          updates.status = 'In corso';
          updates['logs.acceptedAt'] = new Date().toISOString();
        }
        await updateDoc(doc(db, 'tasks', task.id), updates);
        toast.success('Task aggiornato');
      } else {
        const ref = doc(collection(db, 'tasks'));
        const now = new Date().toISOString();
        const newTask: Task = {
          id: ref.id,
          title: title.trim(),
          description: description.trim(),
          deadline: deadlineDate.toISOString(),
          difficulty,
          estimatedHours: hours,
          basePoints: points,
          status: 'In attesa',
          assignees,
          acceptedBy: [],
          submittedBy: [],
          creatorUid: realProfile.uid,
          area: area || null,
          bonuses: [],
          penalties: [],
          finalScore: 0,
          createdAt: now,
          color: randomTaskColor(),
          logs: { createdAt: now, assignedAt: now },
        };
        await setDoc(ref, newTask);
        toast.success('Task creato e assegnato');
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, task ? `tasks/${task.id}` : 'tasks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Titolo">
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="es. Storyboard modulo 3" required maxLength={120} />
      </Field>
      <Field label="Descrizione">
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Cosa va fatto, criteri di accettazione, link utili…" rows={3} />
      </Field>

      <Field label="Difficoltà">
        <div className="grid grid-cols-5 gap-1.5">
          {DIFFICULTIES.map(d => (
            <button key={d} type="button" onClick={() => changeDifficulty(d)}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-semibold transition-all',
                difficulty === d ? 'border-brand bg-brand-soft text-fg ring-4 ring-[var(--ring)]' : 'border-line text-muted hover:border-line-strong')}>
              <span className="h-5 w-5 rounded-full shadow-inner" style={{ background: DIFFICULTY_META[d].gradient }} />
              {d}
              <span className="text-[10px] font-medium text-subtle">{DIFFICULTY_SCORES[d]} XP</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Scadenza" className="col-span-2">
          <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required />
        </Field>
        <Field label="Ore stimate">
          <Input type="number" min="0.5" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} placeholder="8" required />
        </Field>
        <Field label="Punti base">
          <Input type="number" min="0" value={basePoints} onChange={e => { setBasePoints(e.target.value); setPointsTouched(true); }} required />
        </Field>
      </div>

      <Field label="Area">
        <Select value={area} onChange={e => setArea(e.target.value)}>
          <option value="">Nessuna area</option>
          {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
        </Select>
      </Field>

      <Field label={`Assegnatari${assignees.length ? ` · ${assignees.length} selezionati` : ''}`} hint={assignees.length > 1 && estimatedHours ? `Le ore vengono divise: ${(parseFloat(estimatedHours) / assignees.length || 0).toFixed(1)}h a testa.` : undefined}>
        <div className="rounded-xl border border-line">
          <div className="border-b border-line p-2">
            <Input icon={<Search />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca persone…" className="h-9 border-0 shadow-none focus:ring-0" />
          </div>
          <div className="max-h-52 overflow-y-auto scroll-thin p-1.5">
            {filtered.length === 0 && <p className="p-3 text-center text-sm text-subtle">Nessuna persona trovata</p>}
            {filtered.map(u => {
              const selected = assignees.includes(u.uid);
              return (
                <button key={u.uid} type="button" onClick={() => toggle(u.uid)}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', selected ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
                  <Avatar user={u} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{u.username}{u.uid === realProfile.uid && <span className="text-subtle"> (tu)</span>}</p>
                    <p className="truncate text-xs text-subtle">{u.role}{u.area ? ` · ${u.area}` : ''}</p>
                  </div>
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-md border transition-colors', selected ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button type="submit" loading={saving}>{task ? 'Salva modifiche' : 'Crea task'}</Button>
      </div>
    </form>
  );
}
