import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, MessageSquareWarning, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context';
import { cn, fmt, fromNow, hoursUntil, isManager, isTaskOverdue, taskTimeProgress } from '../../lib/utils';
import { AvatarStack, Button, ProgressBar } from '../../components/ui';
import { DifficultyBadge, StatusBadge, XPChip } from '../../components/domain';
import { DIFFICULTY_SCORES } from '../../constants';
import { useTaskActions } from './useTaskActions';
import type { Task } from '../../types';

export function canManageTask(task: Task, role: string, uid: string) {
  return role === 'Admin' || (role === 'Responsabile' && (task.creatorUid === uid || task.assignees.includes(uid)));
}

export function TaskCard({ task, onDelete, compact }: { task: Task; onDelete?: (t: Task) => void; compact?: boolean }) {
  const { profile, userById, openTask, openTaskForm } = useApp();
  const overdue = isTaskOverdue(task);
  const dueSoon = !overdue && task.status !== 'Completato' && hoursUntil(task.deadline) < 24;
  const progress = taskTimeProgress(task);
  const canManage = canManageTask(task, profile.role, profile.uid);
  const xp = task.status === 'Completato' ? task.finalScore : task.basePoints ?? DIFFICULTY_SCORES[task.difficulty];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      onClick={() => openTask(task)}
      onKeyDown={e => { if (e.key === 'Enter') openTask(task); }}
      tabIndex={0}
      role="button"
      aria-label={`Apri task ${task.title}`}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop focus-visible:outline-2',
        overdue ? 'border-danger/40' : 'border-line',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: task.color || 'var(--brand)' }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={task.difficulty} />
          {!compact && <StatusBadge status={task.status} />}
          {task.area && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">{task.area}</span>}
        </div>
        {canManage && (
          <div className="-mr-1 -mt-1 flex opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" onClick={() => openTaskForm(task)} aria-label="Modifica"><Pencil className="h-3.5 w-3.5" /></Button>
            {onDelete && <Button variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => onDelete(task)} aria-label="Elimina"><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        )}
      </div>

      <h3 className={cn('mt-3 font-sans font-semibold leading-snug text-fg', compact ? 'text-[15px]' : 'text-base')}>{task.title}</h3>
      {!compact && task.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{task.description}</p>}

      {task.feedback && task.status !== 'Completato' && (
        <div className="mt-3 flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-fg">
          <MessageSquareWarning className="h-4 w-4 shrink-0 text-warning" />
          <span className="line-clamp-2">{task.feedback}</span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={cn('inline-flex items-center gap-1.5 font-medium', overdue ? 'text-danger' : dueSoon ? 'text-warning' : 'text-muted')}>
            {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : task.status === 'Completato' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
            {task.status === 'Completato' ? `Chiuso ${fmt(task.logs?.validatedAt, 'dd MMM')}` : overdue ? `Scaduto ${fromNow(task.deadline)}` : `Scade ${fromNow(task.deadline)}`}
          </span>
          {task.estimatedHours ? <span className="inline-flex items-center gap-1 text-subtle"><Clock3 className="h-3 w-3" />{task.estimatedHours}h</span> : null}
        </div>
        {task.status !== 'Completato' && <ProgressBar value={progress} tone={overdue ? 'danger' : dueSoon ? 'warning' : 'brand'} />}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
        <div className="flex items-center gap-2">
          <AvatarStack users={task.assignees.map(userById)} size={26} />
          {task.assignees.length > 1 && task.status !== 'Completato' && (
            <span className="text-xs text-subtle tabular">
              {task.status === 'In attesa' ? `${task.acceptedBy?.length || 0}/${task.assignees.length}` : task.status === 'In corso' ? `${task.submittedBy?.length || 0}/${task.assignees.length}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <TaskPrimaryAction task={task} />
          {!(isManager(profile.role) && task.status === 'In Revisione') && <XPChip value={task.status === 'Completato' ? `+${xp}` : xp} size="sm" />}
        </div>
      </div>
    </motion.article>
  );
}

/** Il pulsante principale contestuale per il task (accetta / consegna / valida...). */
export function TaskPrimaryAction({ task, size = 'xs' }: { task: Task; size?: 'xs' | 'sm' | 'md' }) {
  const { profile, openValidation } = useApp();
  const { accept, submit, withdraw, busy } = useTaskActions();
  const uid = profile.uid;
  const isAssigned = task.assignees.includes(uid);
  const hasAccepted = task.acceptedBy?.includes(uid);
  const hasSubmitted = task.submittedBy?.includes(uid);

  if (isManager(profile.role) && task.status === 'In Revisione') {
    return <Button size={size} onClick={() => openValidation(task)}>Valuta</Button>;
  }
  if (!isAssigned) return null;
  if (task.status === 'In attesa') {
    return hasAccepted
      ? <span className="text-xs font-medium text-muted">In attesa degli altri</span>
      : <Button size={size} loading={busy === task.id} onClick={() => accept(task)}>Accetta</Button>;
  }
  if (task.status === 'In corso') {
    return hasSubmitted
      ? <span className="text-xs font-medium text-success">Consegnato ✓</span>
      : <Button size={size} variant="success" loading={busy === task.id} onClick={() => submit(task)}>Consegna</Button>;
  }
  if (task.status === 'In Revisione' && hasSubmitted) {
    return <Button size={size} variant="ghost" loading={busy === task.id} onClick={() => withdraw(task)}>Ritira</Button>;
  }
  return null;
}
