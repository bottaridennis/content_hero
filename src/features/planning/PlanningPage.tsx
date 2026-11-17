import React, { useMemo, useState } from 'react';
import {
  addDays, addMonths, differenceInMinutes, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, startOfDay, startOfMonth, startOfWeek, subMonths, differenceInCalendarDays, isBefore, isAfter, parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, GanttChartSquare, Info } from 'lucide-react';
import { useApp } from '../../context';
import { calculateSequentialTimeline, cn, isNonWorkingDay, isItalianHoliday, WORKING_HOURS_PER_DAY, type TimelineTask } from '../../lib/utils';
import { Avatar, Button, Card, EmptyState, Segmented } from '../../components/ui';

export function PlanningPage() {
  const [view, setView] = useState<'gantt' | 'calendar'>('gantt');
  return (
    <div className="space-y-5">
      <Segmented value={view} onChange={setView} options={[
        { value: 'gantt', label: <><GanttChartSquare className="h-4 w-4" /> Gantt</> },
        { value: 'calendar', label: <><CalendarDays className="h-4 w-4" /> Calendario</> },
      ]} />
      {view === 'gantt' ? <GanttView /> : <CalendarView />}
      <div className="flex gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
        <Info className="h-5 w-5 shrink-0 text-brand" />
        <p>
          La pianificazione usa una giornata lavorativa di <strong className="text-fg">{WORKING_HOURS_PER_DAY} ore (09:00–18:00)</strong>, esclude weekend e festività italiane
          e mette in sequenza i task di ogni persona a partire dall'accettazione. Se un task ha più assegnatari, le ore vengono divise tra loro.
        </p>
      </div>
    </div>
  );
}

function useTimeline() {
  const { visibleTasks, data, selectedArea } = useApp();
  return useMemo(() => {
    const tasks = visibleTasks.filter(t => selectedArea === 'Tutte' || t.area === selectedArea);
    return calculateSequentialTimeline(tasks, data.users);
  }, [visibleTasks, data.users, selectedArea]);
}

// ---------- Gantt ----------

const DAY_W = 44;

function GanttView() {
  const { profile, data, selectedArea, openTask } = useApp();
  const timeline = useTimeline();

  const people = data.users.filter(u => {
    if (selectedArea !== 'Tutte' && u.area !== selectedArea) return false;
    if (profile.role === 'Admin') return u.role !== 'Admin' || timeline.some(t => t.assignees.includes(u.uid));
    if (profile.role === 'Responsabile') return u.uid === profile.uid || (u.role === 'Player' && u.responsabileUids?.includes(profile.uid));
    return u.uid === profile.uid;
  });

  const start = startOfDay(addDays(timeline.length ? new Date(Math.min(Date.now(), ...timeline.map(t => t.calculatedStartDate.getTime()))) : new Date(), -1));
  const endRaw = timeline.length ? new Date(Math.max(...timeline.map(t => Math.max(t.calculatedEndDate.getTime(), parseISO(t.deadline).getTime())))) : addDays(new Date(), 14);
  const end = endOfDay(addDays(endRaw, 2));
  const days = eachDayOfInterval({ start, end: addDays(start, Math.max(27, differenceInCalendarDays(end, start))) });
  const totalMin = days.length * 24 * 60;
  const width = days.length * DAY_W;
  const todayLeft = (differenceInMinutes(new Date(), start) / totalMin) * width;

  if (people.length === 0) return <EmptyState icon={<GanttChartSquare />} title="Nessuna persona da mostrare" />;

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {/* People column */}
        <div className="w-40 shrink-0 border-r border-line bg-surface sm:w-56">
          <div className="flex h-14 items-end border-b border-line px-4 pb-2 text-xs font-semibold text-subtle">Persona</div>
          {people.map(u => {
            const items = timeline.filter(t => t.assignees.includes(u.uid));
            const hours = items.reduce((a, t) => a + (t.estimatedHours || 0) / t.assignees.length, 0);
            return (
              <div key={u.uid} className="flex h-16 items-center gap-2.5 border-b border-line px-3 sm:px-4">
                <Avatar user={u} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{u.username}</p>
                  <p className="text-xs text-subtle tabular">{hours.toFixed(1)}h · {items.length} task</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto scroll-thin">
          <div className="relative" style={{ width }}>
            <div className="flex h-14 border-b border-line">
              {days.map(d => (
                <div key={d.toISOString()} className={cn('flex shrink-0 flex-col items-center justify-end pb-2 text-[11px]', isNonWorkingDay(d) && 'bg-surface-2', isToday(d) && 'text-brand')} style={{ width: DAY_W }}>
                  <span className="uppercase text-subtle">{format(d, 'EEEEE', { locale: it })}</span>
                  <span className={cn('font-semibold tabular', isToday(d) ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white' : 'text-fg')}>{format(d, 'd')}</span>
                </div>
              ))}
            </div>
            {people.map(u => (
              <div key={u.uid} className="relative h-16 border-b border-line">
                <div className="absolute inset-0 flex">
                  {days.map(d => <div key={d.toISOString()} className={cn('h-full shrink-0 border-r border-line/50', isNonWorkingDay(d) && 'bg-surface-2/80')} style={{ width: DAY_W }} />)}
                </div>
                {timeline.filter(t => t.assignees.includes(u.uid)).map(t => {
                  const left = (differenceInMinutes(t.calculatedStartDate, start) / totalMin) * width;
                  const w = Math.max(18, (differenceInMinutes(t.calculatedEndDate, t.calculatedStartDate) / totalMin) * width);
                  const late = isAfter(t.calculatedEndDate, parseISO(t.deadline));
                  return (
                    <button key={t.id} type="button" onClick={() => openTask(t)}
                      title={`${t.title}\n${format(t.calculatedStartDate, 'dd/MM HH:mm')} → ${format(t.calculatedEndDate, 'dd/MM HH:mm')}${late ? '\n⚠ Fine stimata oltre la scadenza' : ''}`}
                      className={cn('absolute top-3 flex h-10 items-center overflow-hidden rounded-lg px-2.5 text-left text-xs font-semibold text-white shadow-card transition-transform hover:z-10 hover:scale-y-110', late && 'ring-2 ring-danger ring-offset-1 ring-offset-surface')}
                      style={{ left, width: w, background: t.color || 'var(--brand)' }}>
                      <span className="truncate drop-shadow-sm">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="pointer-events-none absolute bottom-0 top-14 w-0.5 bg-brand/70" style={{ left: todayLeft }}>
              <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Calendar ----------

const MAX_LANES = 3;

function CalendarView() {
  const { openTask } = useApp();
  const timeline = useTimeline();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });

  // Assegna a ogni task una "corsia" stabile così le barre restano allineate tra i giorni
  const lanes = useMemo(() => {
    const occupied: Record<string, boolean[]> = {};
    const res: Record<string, number> = {};
    [...timeline].sort((a, b) => a.calculatedStartDate.getTime() - b.calculatedStartDate.getTime()).forEach(t => {
      const span = eachDayOfInterval({ start: startOfDay(t.calculatedStartDate), end: startOfDay(t.calculatedEndDate) }).filter(d => !isNonWorkingDay(d));
      let lane = 0;
      while (span.some(d => occupied[d.toDateString()]?.[lane])) lane++;
      span.forEach(d => { (occupied[d.toDateString()] ||= [])[lane] = true; });
      res[t.id] = lane;
    });
    return res;
  }, [timeline]);

  const tasksOn = (d: Date): TimelineTask[] => isNonWorkingDay(d) ? [] : timeline.filter(t =>
    !isBefore(d, startOfDay(t.calculatedStartDate)) && !isAfter(d, endOfDay(t.calculatedEndDate)));
  const deadlinesOn = (d: Date) => timeline.filter(t => isSameDay(parseISO(t.deadline), d));

  const selectedTasks = tasksOn(selected);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold capitalize text-fg">{format(month, 'MMMM yyyy', { locale: it })}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setMonth(m => subMonths(m, 1))} aria-label="Mese precedente"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="xs" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>Oggi</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setMonth(m => addMonths(m, 1))} aria-label="Mese successivo"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
            <div key={d} className="border-b border-line bg-surface-2 py-2 text-center text-xs font-semibold text-subtle">{d}</div>
          ))}
          {days.map((d, i) => {
            const items = tasksOn(d);
            const deadlines = deadlinesOn(d);
            const off = isNonWorkingDay(d);
            const isSel = isSameDay(d, selected);
            return (
              <button key={d.toISOString()} type="button" onClick={() => setSelected(d)}
                className={cn('relative flex min-h-[76px] flex-col gap-0.5 border-line p-1 text-left transition-colors sm:min-h-[104px]',
                  i % 7 !== 6 && 'border-r', i < days.length - 7 && 'border-b',
                  !isSameMonth(d, month) && 'opacity-40', off ? 'bg-surface-2/70' : 'hover:bg-surface-2/50', isSel && 'bg-brand-soft/60')}>
                <div className="flex items-center justify-between px-0.5">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular', isToday(d) ? 'bg-brand text-white' : 'text-muted')}>{format(d, 'd')}</span>
                  {isItalianHoliday(d) ? <span className="text-[10px] font-semibold text-danger">Festivo</span>
                    : deadlines.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger" title={`${deadlines.length} scadenze`} />}
                </div>
                {Array.from({ length: MAX_LANES }).map((_, lane) => {
                  const t = items.find(x => lanes[x.id] === lane);
                  if (!t) return <div key={lane} className="h-4" />;
                  const first = isSameDay(d, t.calculatedStartDate) || d.getDay() === 1;
                  const last = isSameDay(d, t.calculatedEndDate) || d.getDay() === 5;
                  return (
                    <div key={t.id} className={cn('flex h-4 items-center truncate px-1 text-[10px] font-semibold text-white', first ? 'ml-0 rounded-l' : '-ml-1', last ? 'mr-0 rounded-r' : '-mr-1')}
                      style={{ background: t.color || 'var(--brand)' }} title={t.title}>
                      {first && <span className="hidden truncate sm:inline">{t.title}</span>}
                    </div>
                  );
                })}
                {items.length > MAX_LANES && <span className="px-1 text-[10px] font-semibold text-subtle">+{items.length - MAX_LANES}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <p className="eyebrow">Giorno selezionato</p>
        <h4 className="mt-1 text-lg font-semibold capitalize text-fg">{format(selected, 'EEEE d MMMM', { locale: it })}</h4>
        <div className="mt-4 space-y-2">
          {isNonWorkingDay(selected) && <p className="text-sm text-subtle">Giorno non lavorativo.</p>}
          {!isNonWorkingDay(selected) && selectedTasks.length === 0 && <p className="text-sm text-subtle">Nessun task pianificato.</p>}
          {selectedTasks.map(t => (
            <button key={t.id} type="button" onClick={() => openTask(t)} className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left hover:border-line-strong hover:bg-surface-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color || 'var(--brand)' }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{t.title}</p>
                <p className="text-xs text-subtle">{format(t.calculatedStartDate, 'dd/MM HH:mm')} → {format(t.calculatedEndDate, 'dd/MM HH:mm')}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
