import React, { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { Check, Gauge, MinusCircle, PlusCircle, Sparkles, Undo2 } from 'lucide-react';
import { useApp } from '../../context';
import { DIFFICULTY_SCORES } from '../../constants';
import { rejectTask, validateTask } from '../../lib/actions';
import { cn } from '../../lib/utils';
import { AvatarStack, Button, Field, Modal, Segmented, Textarea } from '../../components/ui';
import { DifficultyBadge } from '../../components/domain';
import type { BonusPenalty, Task } from '../../types';

export function ValidationModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Modal open={!!task} onClose={onClose} size="xl" icon={<Gauge />} title="Valutazione task" description={task?.title}>
      {task && <ValidationBody task={task} onClose={onClose} />}
    </Modal>
  );
}

const PERFECT_BONUS_ID: Record<string, string> = { Bronzo: 'e_bronze_perf', Argento: 'e_silver_perf', Oro: 'e_gold_perf', Platino: 'e_plat_perf' };

function ToggleRow({ item, selected, onToggle, tone }: { item: BonusPenalty; selected: boolean; onToggle: () => void; tone: 'success' | 'danger' }) {
  return (
    <button type="button" onClick={onToggle}
      className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
        selected ? (tone === 'success' ? 'border-success/50 bg-success-soft' : 'border-danger/50 bg-danger-soft') : 'border-line hover:border-line-strong hover:bg-surface-2')}>
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
        selected ? (tone === 'success' ? 'border-success bg-success text-white' : 'border-danger bg-danger text-white') : 'border-line-strong')}>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1 font-medium text-fg">{item.label}</span>
      <span className={cn('font-display font-bold tabular', tone === 'success' ? 'text-success' : 'text-danger')}>{item.value > 0 ? '+' : ''}{item.value}</span>
    </button>
  );
}

function ValidationBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, userById } = useApp();
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  // Pre-seleziona eventuali penalità già registrate (es. respingimenti precedenti)
  const [selBonuses, setSelBonuses] = useState<string[]>(() => (task.bonuses || []).filter(id => data.bonuses.some(b => b.id === id)));
  const [selPenalties, setSelPenalties] = useState<string[]>(() => (task.penalties || []).filter(id => data.penalties.some(p => p.id === id)));
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const base = task.basePoints ?? DIFFICULTY_SCORES[task.difficulty];
  // Gli id dei bonus "perfetto" sono in inglese (e_gold_perf…): prima il calcolo non li trovava mai.
  const perfectBonus = data.bonuses.find(b => b.id === PERFECT_BONUS_ID[task.difficulty]);
  const isPerfect = selPenalties.length === 0;
  const perfectValue = isPerfect && perfectBonus ? perfectBonus.value : 0;

  const timeBonus = useMemo(() => {
    const submitted = task.logs?.submittedAt ? parseISO(task.logs.submittedAt) : null;
    if (!submitted) return 0;
    const diffH = (parseISO(task.deadline).getTime() - submitted.getTime()) / 36e5;
    if (diffH <= 0) return 0;
    return Math.round(base * Math.min(0.5, (diffH / 24) * 0.1));
  }, [task, base]);

  const bonusTotal = data.bonuses.filter(b => selBonuses.includes(b.id)).reduce((a, b) => a + b.value, 0);
  const penaltyTotal = data.penalties.filter(p => selPenalties.includes(p.id)).reduce((a, p) => a + p.value, 0);
  const modifiers = bonusTotal + penaltyTotal + perfectValue + timeBonus;
  const finalScore = Math.max(0, base + modifiers);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const manualBonuses = data.bonuses.filter(b => !b.id.endsWith('_perf'));

  const approve = async () => {
    setSaving(true);
    const auto = [...(isPerfect && perfectBonus ? [perfectBonus.id] : []), ...(timeBonus > 0 ? ['time_bonus'] : [])];
    const ok = await validateTask({ task, finalScore, bonuses: selBonuses, penalties: selPenalties, autoBonuses: auto, feedback, users: data.users, allTasks: data.tasks, badges: data.badges });
    setSaving(false);
    if (ok) onClose();
  };

  const reject = async () => {
    setSaving(true);
    await rejectTask(task, feedback);
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
        <div className="flex items-center gap-3">
          <AvatarStack users={task.assignees.map(userById)} />
          <div className="text-sm">
            <p className="font-medium text-fg">{task.assignees.map(id => userById(id)?.username || '?').join(', ')}</p>
            <p className="text-xs text-subtle">{task.rejections ? `Respinto ${task.rejections} volt${task.rejections === 1 ? 'a' : 'e'}` : 'Prima consegna'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={task.difficulty} />
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'approve', label: 'Approva' }, { value: 'reject', label: 'Respingi' }]} />
        </div>
      </div>

      {mode === 'approve' ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-danger"><MinusCircle className="h-4 w-4" /> Penalità</h4>
            <div className="max-h-[42vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
              {data.penalties.map(p => <ToggleRow key={p.id} item={p} tone="danger" selected={selPenalties.includes(p.id)} onToggle={() => toggle(selPenalties, setSelPenalties, p.id)} />)}
            </div>
          </section>
          <section className="space-y-5">
            <div>
              <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-success"><PlusCircle className="h-4 w-4" /> Bonus</h4>
              <div className="max-h-[28vh] space-y-1.5 overflow-y-auto scroll-thin pr-1">
                {manualBonuses.map(b => <ToggleRow key={b.id} item={b} tone="success" selected={selBonuses.includes(b.id)} onToggle={() => toggle(selBonuses, setSelBonuses, b.id)} />)}
              </div>
            </div>
            <div>
              <h4 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-brand"><Sparkles className="h-4 w-4" /> Bonus automatici</h4>
              <div className="space-y-1.5">
                {perfectBonus && (
                  <div className={cn('flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5 text-sm', isPerfect ? 'border-xp bg-xp-soft' : 'border-line opacity-60')}>
                    <div><p className="font-medium text-fg">{task.difficulty} perfetto</p><p className="text-xs text-subtle">Nessuna penalità applicata</p></div>
                    <span className="font-display font-bold text-xp">+{perfectBonus.value}</span>
                  </div>
                )}
                <div className={cn('flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5 text-sm', timeBonus > 0 ? 'border-brand bg-brand-soft' : 'border-line opacity-60')}>
                  <div><p className="font-medium text-fg">Bonus velocità</p><p className="text-xs text-subtle">+10% ogni 24h di anticipo (max 50%)</p></div>
                  <span className="font-display font-bold text-brand">+{timeBonus}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-fg">
          <p className="flex items-center gap-2 font-semibold"><Undo2 className="h-4 w-4 text-danger" /> Il task tornerà <em>In corso</em></p>
          <p className="mt-1 text-muted">Verrà applicata la penalità «Task respinto» e il feedback sarà visibile agli assegnatari.</p>
        </div>
      )}

      <Field label={mode === 'reject' ? 'Motivo del respingimento' : 'Feedback (opzionale)'}>
        <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={2} placeholder={mode === 'reject' ? 'Spiega cosa va corretto…' : 'Ottimo lavoro! …'} required={mode === 'reject'} />
      </Field>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col gap-4 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {mode === 'approve' ? (
          <div className="flex items-center gap-6">
            <div><p className="eyebrow">Base</p><p className="font-display text-lg font-bold tabular text-fg">{base}</p></div>
            <div><p className="eyebrow">Modificatori</p><p className={cn('font-display text-lg font-bold tabular', modifiers >= 0 ? 'text-success' : 'text-danger')}>{modifiers >= 0 ? '+' : ''}{modifiers}</p></div>
            <div><p className="eyebrow">Totale</p><p className="font-display text-2xl font-bold tabular text-brand">{finalScore} XP</p></div>
          </div>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
          {mode === 'approve'
            ? <Button onClick={approve} loading={saving} className="flex-1 sm:flex-none">Approva e assegna XP</Button>
            : <Button variant="danger" onClick={reject} loading={saving} disabled={!feedback.trim()} className="flex-1 sm:flex-none">Respingi task</Button>}
        </div>
      </div>
    </div>
  );
}
