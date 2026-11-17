import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { parseISO } from 'date-fns';
import { ClipboardList, Columns3, LayoutGrid, Plus, Search, SearchX } from 'lucide-react';
import { useApp } from '../../context';
import { cn, isManager } from '../../lib/utils';
import { Button, EmptyState, Input, Segmented, Select } from '../../components/ui';
import { DIFFICULTY_META, STATUSES, STATUS_META } from '../../components/domain';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../../types';

type StatusFilter = 'active' | TaskStatus;
type Sort = 'deadline' | 'recent' | 'difficulty' | 'xp';

const VIEW_KEY = 'ch-task-view';

export function TasksPage({ onDelete }: { onDelete: (t: Task) => void }) {
  const { profile, visibleTasks, selectedArea, openTaskForm } = useApp();
  const [status, setStatus] = useState<StatusFilter>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('deadline');
  const [mineOnly, setMineOnly] = useState(false);
  const [view, setView] = useState<'grid' | 'board'>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as 'grid' | 'board') || 'grid'; } catch { return 'grid'; }
  });
  const changeView = (v: 'grid' | 'board') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleTasks
      .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
      .filter(t => !mineOnly || t.assignees.includes(profile.uid) || t.creatorUid === profile.uid)
      .filter(t => !q || t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [visibleTasks, selectedArea, mineOnly, profile.uid, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { active: 0 };
    STATUSES.forEach(s => (c[s] = 0));
    base.forEach(t => { c[t.status]++; if (t.status !== 'Completato') c.active++; });
    return c;
  }, [base]);

  const sorter = (a: Task, b: Task) => {
    switch (sort) {
      case 'recent': return parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime();
      case 'difficulty': return DIFFICULTY_META[b.difficulty].rank - DIFFICULTY_META[a.difficulty].rank;
      case 'xp': return (b.basePoints || 0) - (a.basePoints || 0);
      default:
        if (status === 'Completato') return parseISO(b.logs?.validatedAt || b.deadline).getTime() - parseISO(a.logs?.validatedAt || a.deadline).getTime();
        return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
    }
  };

  const list = base.filter(t => status === 'active' ? t.status !== 'Completato' : t.status === status).sort(sorter);
  const boardStatuses: TaskStatus[] = status === 'active' ? ['In attesa', 'In corso', 'In Revisione'] : [status as TaskStatus];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Attivi', count: counts.active },
            ...STATUSES.map(s => ({ value: s as StatusFilter, label: s === 'Completato' ? 'Archivio' : STATUS_META[s].label, count: counts[s] })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:w-60 sm:flex-none">
            <Input icon={<Search />} value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca task…" className="h-10" />
          </div>
          <div className="w-40">
            <Select value={sort} onChange={e => setSort(e.target.value as Sort)} className="h-10" aria-label="Ordina">
              <option value="deadline">{status === 'Completato' ? 'Più recenti' : 'Scadenza'}</option>
              <option value="recent">Creati di recente</option>
              <option value="difficulty">Difficoltà</option>
              <option value="xp">Punti base</option>
            </Select>
          </div>
          {isManager(profile.role) && (
            <button type="button" onClick={() => setMineOnly(m => !m)}
              className={cn('h-10 rounded-xl border px-3 text-sm font-semibold transition-colors', mineOnly ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-fg')}>
              Solo i miei
            </button>
          )}
          <div className="hidden rounded-xl border border-line bg-surface-2 p-1 sm:flex">
            {([['grid', LayoutGrid], ['board', Columns3]] as const).map(([v, Icon]) => (
              <button key={v} type="button" onClick={() => changeView(v)} aria-label={v === 'grid' ? 'Vista griglia' : 'Vista kanban'}
                className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', view === v ? 'bg-surface text-fg shadow-card' : 'text-subtle hover:text-fg')}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        base.length === 0 && !query ? (
          <EmptyState icon={<ClipboardList />}
            title={isManager(profile.role) ? 'Ancora nessun task' : 'Nessun task assegnato'}
            description={isManager(profile.role) ? 'Crea il primo task e assegnalo al tuo team.' : 'Quando un responsabile ti assegnerà un task lo troverai qui.'}
            action={isManager(profile.role) ? <Button onClick={() => openTaskForm()}><Plus className="h-4 w-4" /> Nuovo task</Button> : undefined} />
        ) : (
          <EmptyState icon={<SearchX />} title="Nessun risultato" description="Prova a cambiare filtri o ricerca." />
        )
      ) : view === 'board' ? (
        <div className={cn('grid gap-4', boardStatuses.length === 3 ? 'md:grid-cols-3' : 'grid-cols-1')}>
          {boardStatuses.map(s => {
            const col = list.filter(t => t.status === s);
            const Icon = STATUS_META[s].icon;
            return (
              <div key={s} className="flex min-h-[200px] flex-col rounded-2xl bg-surface-2/70 p-2.5">
                <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Icon className="h-4 w-4" style={{ color: STATUS_META[s].color }} />{STATUS_META[s].label}
                  </span>
                  <span className="rounded-md bg-surface px-1.5 text-xs font-semibold tabular text-muted">{col.length}</span>
                </div>
                <div className={cn('space-y-2.5', boardStatuses.length === 1 && 'grid gap-2.5 space-y-0 sm:grid-cols-2 xl:grid-cols-3')}>
                  <AnimatePresence mode="popLayout">
                    {col.map(t => <TaskCard key={t.id} task={t} onDelete={onDelete} compact />)}
                  </AnimatePresence>
                  {col.length === 0 && <p className="py-8 text-center text-xs text-subtle">Vuoto</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map(t => <TaskCard key={t.id} task={t} onDelete={onDelete} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
