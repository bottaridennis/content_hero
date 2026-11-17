import React from 'react';
import { CalendarClock, CheckCircle2, Circle, Clock3, MessageSquareWarning, Pencil, Trash2, User as UserIcon } from 'lucide-react';
import { useApp } from '../../context';
import { DIFFICULTY_SCORES } from '../../constants';
import { cn, displayName, fmt, fromNow, isTaskOverdue } from '../../lib/utils';
import { Avatar, Button, Modal, Pill } from '../../components/ui';
import { DifficultyBadge, StatusBadge, XPChip } from '../../components/domain';
import { TaskPrimaryAction, canManageTask } from './TaskCard';
import type { Task } from '../../types';

export function TaskDetailModal({ task, onClose, onDelete }: { task: Task | null; onClose: () => void; onDelete: (t: Task) => void }) {
  const { profile, data, userById, openTaskForm } = useApp();
  if (!task) return <Modal open={false} onClose={onClose} />;

  const creator = userById(task.creatorUid);
  const overdue = isTaskOverdue(task);
  const canManage = canManageTask(task, profile.role, profile.uid);
  const base = task.basePoints ?? DIFFICULTY_SCORES[task.difficulty];

  const steps = [
    { label: 'Creato', at: task.logs?.createdAt || task.createdAt },
    { label: 'Avviato', at: task.logs?.acceptedAt },
    { label: 'Consegnato', at: task.logs?.submittedAt },
    { label: 'Validato', at: task.logs?.validatedAt },
  ];

  const allMods = [...data.bonuses, ...data.penalties];
  const appliedMods = task.status === 'Completato'
    ? [...(task.bonuses || []), ...(task.penalties || []), ...(task.autoBonuses || []).filter(id => id !== 'time_bonus')]
        .map(id => allMods.find(m => m.id === id))
        .filter(Boolean)
    : [];

  return (
    <Modal open onClose={onClose} size="lg"
      title={<span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: task.color || 'var(--brand)' }} />{task.title}</span>}
      footer={<>
        {canManage && (
          <div className="flex gap-2 sm:mr-auto">
            <Button variant="ghost" size="sm" onClick={() => { onClose(); openTaskForm(task); }}><Pencil className="h-4 w-4" /> Modifica</Button>
            <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => onDelete(task)}><Trash2 className="h-4 w-4" /> Elimina</Button>
          </div>
        )}
        <TaskPrimaryAction task={task} size="md" />
      </>}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <DifficultyBadge difficulty={task.difficulty} />
          {task.area && <Pill>{task.area}</Pill>}
          {overdue && <Pill tone="danger" dot>In ritardo</Pill>}
          <XPChip value={task.status === 'Completato' ? `+${task.finalScore}` : `${base} base`} size="sm" />
        </div>

        {task.feedback && (
          <div className={cn('flex gap-3 rounded-xl p-3.5 text-sm', task.status === 'Completato' ? 'bg-success-soft' : 'bg-warning-soft')}>
            <MessageSquareWarning className={cn('h-5 w-5 shrink-0', task.status === 'Completato' ? 'text-success' : 'text-warning')} />
            <div><p className="font-semibold text-fg">Feedback del revisore</p><p className="mt-0.5 whitespace-pre-wrap text-muted">{task.feedback}</p></div>
          </div>
        )}

        <div>
          <p className="eyebrow mb-2">Descrizione</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{task.description || <span className="text-subtle">Nessuna descrizione.</span>}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Info icon={<CalendarClock />} label="Scadenza" value={fmt(task.deadline, 'EEE dd MMM, HH:mm')} sub={task.status !== 'Completato' ? fromNow(task.deadline) : undefined} danger={overdue} />
          <Info icon={<Clock3 />} label="Stima" value={task.estimatedHours ? `${task.estimatedHours} h` : '—'} sub={task.estimatedHours && task.assignees.length > 1 ? `${(task.estimatedHours / task.assignees.length).toFixed(1)}h a testa` : undefined} />
          <Info icon={<UserIcon />} label="Creato da" value={creator?.username || 'Sistema'} sub={fmt(task.createdAt, 'dd MMM yyyy')} />
        </div>

        <div>
          <p className="eyebrow mb-3">Assegnatari</p>
          <div className="space-y-2">
            {task.assignees.map(uid => {
              const u = userById(uid);
              const submitted = task.submittedBy?.includes(uid) || task.status === 'Completato';
              const accepted = task.acceptedBy?.includes(uid) || task.status !== 'In attesa';
              return (
                <div key={uid} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <Avatar user={u} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{displayName(u)}</p>
                    <p className="truncate text-xs text-subtle">@{u?.username || 'utente rimosso'}</p>
                  </div>
                  <Pill tone={submitted ? 'success' : accepted ? 'info' : 'neutral'} dot>{submitted ? 'Consegnato' : accepted ? 'Al lavoro' : 'Da accettare'}</Pill>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-3">Avanzamento</p>
          <ol className="relative grid grid-cols-4 gap-2">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex flex-col items-center text-center">
                {i > 0 && <span className={cn('absolute right-1/2 top-3 h-0.5 w-full', s.at ? 'bg-brand' : 'bg-line')} />}
                <span className={cn('relative z-10 flex h-6 w-6 items-center justify-center rounded-full', s.at ? 'bg-brand text-white' : 'bg-surface-3 text-subtle')}>
                  {s.at ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                </span>
                <span className="mt-2 text-xs font-semibold text-fg">{s.label}</span>
                <span className="text-[11px] text-subtle">{s.at ? fmt(s.at, 'dd/MM HH:mm') : '—'}</span>
              </li>
            ))}
          </ol>
        </div>

        {task.status === 'Completato' && (
          <div className="rounded-2xl border border-line p-4">
            <p className="eyebrow mb-3">Punteggio</p>
            <div className="space-y-1.5 text-sm">
              <Row label="Punti base" value={base} />
              {appliedMods.map(m => m && <Row key={m.id} label={m.label} value={m.value} />)}
              {task.autoBonuses?.includes('time_bonus') && <Row label="Bonus velocità" value={null} />}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-semibold">
                <span className="text-fg">Totale</span><XPChip value={`+${task.finalScore}`} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Info({ icon, label, value, sub, danger }: { icon: React.ReactNode; label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs text-subtle [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}{label}</p>
      <p className={cn('mt-1 truncate text-sm font-semibold capitalize', danger ? 'text-danger' : 'text-fg')}>{value}</p>
      {sub && <p className="text-xs text-subtle">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn('font-display font-semibold tabular', value === null ? 'text-brand' : value >= 0 ? 'text-success' : 'text-danger')}>
        {value === null ? 'incluso' : `${value >= 0 ? '+' : ''}${value}`}
      </span>
    </div>
  );
}
