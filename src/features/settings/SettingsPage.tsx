import React, { useState } from 'react';
import { toast } from 'sonner';
import { Gift, Layers, Medal, MinusCircle, Plus, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../context';
import { saveMetadata } from '../../lib/actions';
import { cn } from '../../lib/utils';
import { BADGES, BONUSES, PENALTIES } from '../../constants';
import { AREAS, type Badge, type BonusPenalty, type Reward, type TaskDifficulty } from '../../types';
import { DEFAULT_REWARDS } from '../../hooks/useAppData';
import { Button, Card, CardHeader, ConfirmDialog, Field, Input, Modal, Segmented, Select } from '../../components/ui';
import { DIFFICULTIES, DynamicIcon, ICON_COLORS, ICON_NAMES, XPChip } from '../../components/domain';

type Section = 'areas' | 'scoring' | 'badges' | 'rewards';

export function SettingsPage() {
  const [section, setSection] = useState<Section>('scoring');
  return (
    <div className="space-y-5">
      <Segmented value={section} onChange={setSection} options={[
        { value: 'scoring', label: <><PlusCircle className="h-4 w-4" /> Bonus & Malus</> },
        { value: 'badges', label: <><Medal className="h-4 w-4" /> Badge</> },
        { value: 'rewards', label: <><Gift className="h-4 w-4" /> Premi</> },
        { value: 'areas', label: <><Layers className="h-4 w-4" /> Aree</> },
      ]} />
      {section === 'areas' && <AreasSettings />}
      {section === 'scoring' && <ScoringSettings />}
      {section === 'badges' && <BadgesSettings />}
      {section === 'rewards' && <RewardsSettings />}
    </div>
  );
}

function ResetButton({ onReset, what }: { onReset: () => void; what: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><RotateCcw className="h-4 w-4" /> Ripristina</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => { onReset(); setOpen(false); }} icon={<RotateCcw />} title={`Ripristinare ${what}?`}
        message="La configurazione tornerà ai valori predefiniti." confirmLabel="Ripristina" />
    </>
  );
}

function AreasSettings() {
  const { data } = useApp();
  const [value, setValue] = useState('');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    if (data.areas.some(a => a.toLowerCase() === v.toLowerCase())) return toast.error('Area già esistente');
    saveMetadata('areas', [...data.areas, v]);
    setValue('');
  };
  return (
    <Card className="max-w-2xl p-5">
      <CardHeader icon={<Layers />} title="Aree aziendali" subtitle="Usate per filtrare task, persone e classifiche" action={<ResetButton what="le aree" onReset={() => saveMetadata('areas', AREAS)} />} />
      <form onSubmit={add} className="mt-5 flex gap-2">
        <div className="flex-1"><Input value={value} onChange={e => setValue(e.target.value)} placeholder="Nuova area…" /></div>
        <Button type="submit" size="icon" aria-label="Aggiungi"><Plus className="h-4 w-4" /></Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {data.areas.map(a => {
          const users = data.users.filter(u => u.area === a).length;
          return (
            <span key={a} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm font-medium text-fg">
              {a}<span className="text-xs text-subtle">{users}</span>
              <button type="button" onClick={() => saveMetadata('areas', data.areas.filter(x => x !== a))} className="flex h-6 w-6 items-center justify-center rounded-full text-subtle hover:bg-danger-soft hover:text-danger" aria-label={`Rimuovi ${a}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function ModifierList({ kind }: { kind: 'Bonus' | 'Penalty' }) {
  const { data } = useApp();
  const list = kind === 'Bonus' ? data.bonuses : data.penalties;
  const key = kind === 'Bonus' ? 'bonuses' : 'penalties';
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.abs(parseInt(value, 10));
    if (!label.trim() || !n) return toast.error('Inserisci etichetta e valore');
    const item: BonusPenalty = { id: `${kind === 'Bonus' ? 'b' : 'p'}_${Date.now()}`, label: label.trim(), value: kind === 'Bonus' ? n : -n, category: kind };
    saveMetadata(key, [...list, item]);
    setLabel(''); setValue('');
  };

  const isBonus = kind === 'Bonus';
  return (
    <Card className="p-5">
      <CardHeader icon={isBonus ? <PlusCircle /> : <MinusCircle />} title={isBonus ? 'Bonus' : 'Malus'} subtitle={`${list.length} voci`}
        action={<ResetButton what={isBonus ? 'i bonus' : 'i malus'} onReset={() => saveMetadata(key, isBonus ? BONUSES : PENALTIES)} />} />
      <form onSubmit={add} className="mt-5 flex gap-2">
        <div className="flex-1"><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Descrizione…" /></div>
        <div className="w-24"><Input type="number" min="1" value={value} onChange={e => setValue(e.target.value)} placeholder="XP" /></div>
        <Button type="submit" size="icon" variant={isBonus ? 'success' : 'danger'} aria-label="Aggiungi"><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="mt-4 max-h-[420px] space-y-1.5 overflow-y-auto scroll-thin pr-1">
        {list.map(item => (
          <li key={item.id} className="group flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <span className="min-w-0 truncate text-sm text-fg">{item.label}{item.id.endsWith('_perf') && <span className="ml-2 text-xs text-subtle">(automatico)</span>}</span>
            <div className="flex items-center gap-1">
              <span className={cn('font-display text-sm font-bold tabular', item.value >= 0 ? 'text-success' : 'text-danger')}>{item.value > 0 ? '+' : ''}{item.value}</span>
              <Button variant="ghost" size="icon-sm" className="hover:text-danger" onClick={() => saveMetadata(key, list.filter(x => x.id !== item.id))} aria-label="Rimuovi"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ScoringSettings() {
  return <div className="grid gap-5 lg:grid-cols-2"><ModifierList kind="Bonus" /><ModifierList kind="Penalty" /></div>;
}

function IconColorPicker({ icon, color, onIcon, onColor }: { icon: string; color: string; onIcon: (v: string) => void; onColor: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Icona">
        <div className="flex flex-wrap gap-1.5">
          {ICON_NAMES.map(n => (
            <button key={n} type="button" onClick={() => onIcon(n)} aria-label={n}
              className={cn('flex h-9 w-9 items-center justify-center rounded-lg border transition-colors', icon === n ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2')}>
              <DynamicIcon name={n} className={cn('h-4 w-4', color)} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colore">
        <div className="flex flex-wrap gap-1.5">
          {ICON_COLORS.map(c => (
            <button key={c} type="button" onClick={() => onColor(c)} aria-label={c}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full border', color === c ? 'border-fg' : 'border-transparent')}>
              <span className={cn('h-5 w-5 rounded-full bg-current', c)} />
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function BadgesSettings() {
  const { data } = useApp();
  const [editing, setEditing] = useState<Badge | 'new' | null>(null);
  return (
    <Card className="p-5">
      <CardHeader icon={<Medal />} title="Badge" subtitle="Assegnati automaticamente al raggiungimento dei requisiti"
        action={<div className="flex gap-1"><ResetButton what="i badge" onReset={() => saveMetadata('badges', BADGES)} /><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Nuovo</Button></div>} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.badges.map(b => {
          const owners = data.users.filter(u => u.badges?.includes(b.id)).length;
          return (
            <button key={b.id} type="button" onClick={() => setEditing(b)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2/50">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2"><DynamicIcon name={b.icon} className={cn('h-5 w-5', b.color)} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{b.name}</p>
                <p className="truncate text-xs text-subtle">{b.description}</p>
              </div>
              <span className="text-xs tabular text-subtle">{owners} 👤</span>
            </button>
          );
        })}
      </div>
      <BadgeEditor badge={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function BadgeEditor({ badge, onClose }: { badge: Badge | 'new' | null; onClose: () => void }) {
  return (
    <Modal open={!!badge} onClose={onClose} icon={<Medal />} title={badge === 'new' ? 'Nuovo badge' : 'Modifica badge'}>
      {badge && <BadgeForm badge={badge === 'new' ? undefined : badge} onClose={onClose} />}
    </Modal>
  );
}

function BadgeForm({ badge, onClose }: { badge?: Badge; onClose: () => void }) {
  const { data } = useApp();
  const [name, setName] = useState(badge?.name || '');
  const [description, setDescription] = useState(badge?.description || '');
  const [icon, setIcon] = useState(badge?.icon || 'Star');
  const [color, setColor] = useState(badge?.color || 'text-indigo-500');
  const [type, setType] = useState<Badge['requirement']['type']>(badge?.requirement.type || 'tasks_completed');
  const [value, setValue] = useState(String(badge?.requirement.value ?? 5));
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(badge?.requirement.difficulty || 'Oro');

  const save = () => {
    const v = parseInt(value, 10);
    if (!name.trim() || !v || v < 1) return toast.error('Compila nome e requisito');
    const next: Badge = {
      id: badge?.id || `b_${Date.now()}`, name: name.trim(), description: description.trim(), icon, color,
      requirement: { type, value: v, ...(type === 'difficulty_completed' ? { difficulty } : {}) },
    };
    saveMetadata('badges', badge ? data.badges.map(b => b.id === badge.id ? next : b) : [...data.badges, next]);
    onClose();
  };
  const remove = () => { if (badge) saveMetadata('badges', data.badges.filter(b => b.id !== badge.id)); onClose(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface"><DynamicIcon name={icon} className={cn('h-7 w-7', color)} /></div>
        <div className="min-w-0"><p className="font-semibold text-fg">{name || 'Nome badge'}</p><p className="text-sm text-muted">{description || 'Descrizione'}</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Descrizione"><Input value={description} onChange={e => setDescription(e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Requisito" className="sm:col-span-1">
          <Select value={type} onChange={e => setType(e.target.value as Badge['requirement']['type'])}>
            <option value="tasks_completed">Task completati</option>
            <option value="difficulty_completed">Task per difficoltà</option>
            <option value="score">XP raggiunti</option>
          </Select>
        </Field>
        {type === 'difficulty_completed' && (
          <Field label="Difficoltà">
            <Select value={difficulty} onChange={e => setDifficulty(e.target.value as TaskDifficulty)}>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}</Select>
          </Field>
        )}
        <Field label={type === 'score' ? 'XP' : 'Quantità'}><Input type="number" min="1" value={value} onChange={e => setValue(e.target.value)} /></Field>
      </div>
      <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {badge && <Button variant="ghost" className="hover:text-danger sm:mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Elimina</Button>}
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={save}>Salva badge</Button>
      </div>
    </div>
  );
}

function RewardsSettings() {
  const { data } = useApp();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  return (
    <Card className="p-5">
      <CardHeader icon={<Gift />} title="Catalogo premi" subtitle="Riscattabili con gli XP spendibili"
        action={<div className="flex gap-1"><ResetButton what="i premi" onReset={() => saveMetadata('rewards', DEFAULT_REWARDS)} /><Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Nuovo</Button></div>} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.rewards.map(r => (
          <button key={r.id} type="button" onClick={() => setEditing(r)} className="flex items-center gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2/50">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2"><DynamicIcon name={r.icon} className={cn('h-5 w-5', r.color)} /></div>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{r.name}</p>
            <XPChip value={r.cost} size="sm" />
          </button>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} icon={<Gift />} title={editing === 'new' ? 'Nuovo premio' : 'Modifica premio'}>
        {editing && <RewardForm reward={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function RewardForm({ reward, onClose }: { reward?: Reward; onClose: () => void }) {
  const { data } = useApp();
  const [name, setName] = useState(reward?.name || '');
  const [description, setDescription] = useState(reward?.description || '');
  const [cost, setCost] = useState(String(reward?.cost ?? 500));
  const [icon, setIcon] = useState(reward?.icon || 'Gift');
  const [color, setColor] = useState(reward?.color || 'text-rose-500');

  const save = () => {
    const c = parseInt(cost, 10);
    if (!name.trim() || !c || c < 1) return toast.error('Inserisci nome e costo validi');
    const next: Reward = { id: reward?.id || `r_${Date.now()}`, name: name.trim(), description: description.trim() || undefined, cost: c, icon, color };
    if (!next.description) delete next.description;
    saveMetadata('rewards', reward ? data.rewards.map(r => r.id === reward.id ? next : r) : [...data.rewards, next]);
    onClose();
  };
  const remove = () => { if (reward) saveMetadata('rewards', data.rewards.filter(r => r.id !== reward.id)); onClose(); };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Nome"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Costo XP"><Input type="number" min="1" value={cost} onChange={e => setCost(e.target.value)} /></Field>
      </div>
      <Field label="Descrizione (opzionale)"><Input value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {reward && <Button variant="ghost" className="hover:text-danger sm:mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /> Elimina</Button>}
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={save}>Salva premio</Button>
      </div>
    </div>
  );
}
