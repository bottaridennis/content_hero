import React, { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { Download, History, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context';
import { deleteTask } from '../../lib/actions';
import { fmt } from '../../lib/utils';
import { AvatarStack, Button, Card, ConfirmDialog, EmptyState, Input } from '../../components/ui';
import { DifficultyBadge, StatusBadge } from '../../components/domain';
import type { Task } from '../../types';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function LogsPage() {
  const { visibleTasks, selectedArea, userById, realProfile, openTask } = useApp();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdmin = realProfile.role === 'Admin';

  const rows = useMemo(() => visibleTasks
    .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
    .filter(t => !query.trim() || t.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()), [visibleTasks, selectedArea, query]);

  const exportCsv = () => {
    const header = ['Task', 'Area', 'Difficoltà', 'Stato', 'Creatore', 'Assegnatari', 'Ore stimate', 'Scadenza', 'Creato', 'Avviato', 'Consegnato', 'Validato', 'XP finali'];
    const lines = rows.map(t => [
      t.title, t.area || '', t.difficulty, t.status, userById(t.creatorUid)?.username || '',
      t.assignees.map(id => userById(id)?.username || id).join('; '), t.estimatedHours ?? '',
      fmt(t.deadline, 'yyyy-MM-dd HH:mm'), fmt(t.logs?.createdAt, 'yyyy-MM-dd HH:mm'), fmt(t.logs?.acceptedAt, 'yyyy-MM-dd HH:mm'),
      fmt(t.logs?.submittedAt, 'yyyy-MM-dd HH:mm'), fmt(t.logs?.validatedAt, 'yyyy-MM-dd HH:mm'), t.status === 'Completato' ? t.finalScore : '',
    ].map(csvCell).join(','));
    const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-hero-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!toDelete) return;
    setLoading(true);
    await deleteTask(toDelete);
    setLoading(false);
    setToDelete(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-72"><Input icon={<Search />} value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtra per titolo…" className="h-10" /></div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" /> Esporta CSV</Button>
      </div>

      {rows.length === 0 ? <EmptyState icon={<History />} title="Nessuna attività registrata" /> : (
        <Card className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-surface-2/60 text-xs font-semibold text-subtle">
              <tr>
                {['Task', 'Stato', 'Persone', 'Creato', 'Avviato', 'Consegnato', 'Validato', 'XP'].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(t => (
                <tr key={t.id} className="cursor-pointer transition-colors hover:bg-surface-2/50" onClick={() => openTask(t)}>
                  <td className="max-w-[260px] px-4 py-3">
                    <p className="truncate font-semibold text-fg">{t.title}</p>
                    <div className="mt-1 flex items-center gap-1.5"><DifficultyBadge difficulty={t.difficulty} compact /><span className="text-xs text-subtle">{t.area || 'Nessuna area'}</span></div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><AvatarStack users={t.assignees.map(userById)} size={24} max={3} /></td>
                  {[t.logs?.createdAt || t.createdAt, t.logs?.acceptedAt, t.logs?.submittedAt, t.logs?.validatedAt].map((d, i) => (
                    <td key={i} className="whitespace-nowrap px-4 py-3 tabular text-muted">{fmt(d, 'dd/MM HH:mm')}</td>
                  ))}
                  <td className="px-4 py-3 font-display font-semibold tabular text-fg">{t.status === 'Completato' ? `+${t.finalScore}` : '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => setToDelete(t)} aria-label="Elimina"><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} loading={loading} icon={<Trash2 />} title="Eliminare il task?" confirmLabel="Elimina"
        message={<>Il task <strong className="text-fg">{toDelete?.title}</strong> e il suo storico verranno eliminati. Gli XP già assegnati non vengono rimossi.</>} />
    </div>
  );
}
