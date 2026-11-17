import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Flame, Inbox, ListTodo, Medal, Trophy, Zap } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useApp } from '../../context';
import { cn, displayName, getLevel, isManager, isTaskOverdue, spentXP } from '../../lib/utils';
import { Avatar, Button, Card, CardHeader, EmptyState, ProgressRing, Stat } from '../../components/ui';
import { DIFFICULTIES, DIFFICULTY_META, DynamicIcon, STATUSES, STATUS_META, XPChip } from '../../components/domain';
import { TaskCard } from '../tasks/TaskCard';
import { Leaderboard } from './Leaderboard';
import { useReviewItems } from '../review/ReviewPage';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
};

export function DashboardPage() {
  const { profile, data, visibleTasks, selectedArea, navigate } = useApp();
  const manager = isManager(profile.role);

  const tasks = useMemo(() => visibleTasks.filter(t => selectedArea === 'Tutte' || t.area === selectedArea), [visibleTasks, selectedArea]);
  const myTasks = tasks.filter(t => t.assignees.includes(profile.uid));
  const myActive = myTasks.filter(t => t.status !== 'Completato').sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime());
  const myCompleted = myTasks.filter(t => t.status === 'Completato');
  const toReview = tasks.filter(t => t.status === 'In Revisione');
  const overdue = tasks.filter(isTaskOverdue);
  const level = getLevel(profile.score);
  const wallet = profile.score - spentXP(profile.uid, data.redemptions);

  const ranking = data.users.filter(u => u.role !== 'Admin' && u.isApproved).sort((a, b) => b.score - a.score);
  const myRank = ranking.findIndex(u => u.uid === profile.uid) + 1;

  const statusData = STATUSES.map(s => ({ name: STATUS_META[s].label, value: tasks.filter(t => t.status === s).length, color: STATUS_META[s].color })).filter(d => d.value > 0);
  const difficultyData = DIFFICULTIES.map(d => ({ name: d, value: tasks.filter(t => t.difficulty === d).length, color: DIFFICULTY_META[d].color }));

  const review = useReviewItems();
  const reviewCount = manager ? review.total : 0;

  const nextBadges = data.badges.filter(b => !profile.badges?.includes(b.id)).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-pop sm:p-8">
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <ProgressRing value={level.progress} size={84} stroke={7} color="#fff" track="rgba(255,255,255,.2)">
              <div className="text-center leading-none">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Lv</p>
                <p className="font-display text-2xl font-bold">{level.level}</p>
              </div>
            </ProgressRing>
            <div>
              <p className="text-sm text-white/75">{greeting()},</p>
              <h2 className="text-2xl font-bold sm:text-3xl">{displayName(profile)}</h2>
              <p className="mt-1 text-sm text-white/80">
                <span className="font-semibold text-white">{level.title}</span> · {level.needed - level.current} XP al livello {level.level + 1}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'XP totali', value: profile.score },
              { label: 'Spendibili', value: wallet },
              { label: 'Classifica', value: myRank ? `#${myRank}` : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-white/12 px-3 py-3 text-center backdrop-blur sm:px-5">
                <p className="font-display text-xl font-bold tabular sm:text-2xl">{s.value}</p>
                <p className="text-[11px] text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {manager ? (
          <>
            <Stat label="Task attivi" value={tasks.filter(t => t.status !== 'Completato').length} icon={<ListTodo />} tone="brand" />
            <Stat label="Da revisionare" value={toReview.length} icon={<ClipboardCheck />} tone="warning" />
            <Stat label="In ritardo" value={overdue.length} icon={<AlertTriangle />} tone="danger" />
            <Stat label="Completati" value={tasks.filter(t => t.status === 'Completato').length} icon={<CheckCircle2 />} tone="success" hint={`${tasks.filter(t => t.status === 'Completato').reduce((a, t) => a + (t.finalScore || 0), 0)} XP distribuiti`} />
          </>
        ) : (
          <>
            <Stat label="Task attivi" value={myActive.length} icon={<ListTodo />} tone="brand" />
            <Stat label="Completati" value={myCompleted.length} icon={<CheckCircle2 />} tone="success" />
            <Stat label="Badge" value={`${profile.badges?.length || 0}/${data.badges.length}`} icon={<Medal />} tone="xp" />
            <Stat label="XP da task" value={myCompleted.reduce((a, t) => a + (t.finalScore || 0), 0)} icon={<Zap />} tone="info" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {manager && reviewCount > 0 && (
            <Card className="flex flex-col gap-4 border-warning/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning"><Inbox className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-fg">{reviewCount} element{reviewCount === 1 ? 'o' : 'i'} in attesa di revisione</p>
                  <p className="text-sm text-muted">{review.tasks.length} task · {review.claims.length} sfide · {review.requests.length} premi</p>
                </div>
              </div>
              <Button variant="soft" onClick={() => navigate('review')}>Apri revisioni <ArrowRight className="h-4 w-4" /></Button>
            </Card>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg">{manager ? 'I miei task in corso' : 'Le tue prossime missioni'}</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('tasks')}>Vedi tutti <ArrowRight className="h-4 w-4" /></Button>
            </div>
            {myActive.length === 0 ? (
              <EmptyState icon={<Flame />} title="Tutto in pari!" description={manager ? 'Non hai task assegnati a te in questo momento.' : 'Nessun task attivo. Ottimo momento per tentare una sfida.'}
                action={!manager ? <Button variant="soft" onClick={() => navigate('challenges')}>Vai alle sfide</Button> : undefined} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myActive.slice(0, 4).map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </section>

          {manager && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <CardHeader title="Stato dei task" subtitle={selectedArea === 'Tutte' ? 'Tutte le aree' : selectedArea} />
                {statusData.length === 0 ? <p className="py-16 text-center text-sm text-subtle">Nessun dato</p> : (
                  <div className="mt-2 flex items-center gap-4">
                    <div className="h-48 w-48 shrink-0">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={statusData} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none" cornerRadius={4}>
                            {statusData.map(d => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--fg)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="flex-1 space-y-2">
                      {statusData.map(d => (
                        <li key={d.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                          <span className="font-semibold tabular text-fg">{d.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
              <Card className="p-5">
                <CardHeader title="Difficoltà" subtitle="Numero di task per livello" />
                <div className="mt-4 h-48">
                  <ResponsiveContainer>
                    <BarChart data={difficultyData} margin={{ left: -24, right: 4, top: 4 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--subtle)' }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--subtle)' }} />
                      <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={tooltipStyle} itemStyle={{ color: 'var(--fg)' }} />
                      <Bar dataKey="value" name="Task" radius={[6, 6, 0, 0]} maxBarSize={36}>
                        {difficultyData.map(d => <Cell key={d.name} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <CardHeader icon={<Trophy />} title="Classifica" subtitle="Top 5 per XP" action={<Button variant="ghost" size="xs" onClick={() => navigate('leaderboard')}>Tutta</Button>} />
            <div className="mt-4"><Leaderboard limit={5} compact /></div>
          </Card>

          {!manager && nextBadges.length > 0 && (
            <Card className="p-5">
              <CardHeader icon={<Medal />} title="Prossimi badge" action={<Button variant="ghost" size="xs" onClick={() => navigate('rewards')}>Tutti</Button>} />
              <ul className="mt-4 space-y-3">
                {nextBadges.map(b => (
                  <li key={b.id} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2"><DynamicIcon name={b.icon} className={cn('h-5 w-5', b.color)} /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{b.name}</p>
                      <p className="truncate text-xs text-subtle">{b.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {manager && overdue.length > 0 && (
            <Card className="p-5">
              <CardHeader icon={<AlertTriangle />} title="In ritardo" subtitle={`${overdue.length} task oltre la scadenza`} />
              <ul className="mt-4 space-y-2">
                {overdue.slice(0, 5).map(t => (
                  <OverdueRow key={t.id} taskId={t.id} />
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function OverdueRow({ taskId }: { taskId: string }) {
  const { data, openTask, userById } = useApp();
  const t = data.tasks.find(x => x.id === taskId);
  if (!t) return null;
  return (
    <li>
      <button type="button" onClick={() => openTask(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
        <Avatar user={userById(t.assignees[0])} size={28} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{t.title}</span>
        <XPChip value={t.basePoints ?? 0} size="sm" />
      </button>
    </li>
  );
}

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-pop)',
  fontSize: 12,
  color: 'var(--fg)',
};
