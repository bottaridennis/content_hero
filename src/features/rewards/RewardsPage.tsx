import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Gift, Lock, Medal, Sparkles, Wallet } from 'lucide-react';
import { useApp } from '../../context';
import { requestReward } from '../../lib/actions';
import { cn, fmt, getLevel, spentXP } from '../../lib/utils';
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, Pill, ProgressBar, ProgressRing } from '../../components/ui';
import { DynamicIcon, XPChip } from '../../components/domain';
import type { Badge, Reward, Task, UserProfile } from '../../types';

function badgeProgress(badge: Badge, profile: UserProfile, completed: Task[]) {
  const r = badge.requirement;
  const current = r.type === 'score' ? profile.score
    : r.type === 'tasks_completed' ? completed.length
    : completed.filter(t => t.difficulty === r.difficulty).length;
  return { current: Math.min(current, r.value), target: r.value };
}

export function RewardsPage() {
  const { profile, data, isSimulating } = useApp();
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);

  const completed = data.tasks.filter(t => t.status === 'Completato' && t.assignees.includes(profile.uid));
  const spent = spentXP(profile.uid, data.redemptions);
  const wallet = Math.max(0, profile.score - spent);
  const level = getLevel(profile.score);
  const myRequests = data.redemptions.filter(r => r.uid === profile.uid);
  const earned = data.badges.filter(b => profile.badges?.includes(b.id));

  const redeem = async () => {
    if (!confirm) return;
    setBusy(true);
    await requestReward(confirm, profile.uid);
    setBusy(false);
    setConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <ProgressRing value={level.progress} size={64} stroke={6}>
            <span className="font-display text-lg font-bold text-fg">{level.level}</span>
          </ProgressRing>
          <div>
            <p className="text-sm text-muted">Livello</p>
            <p className="font-display text-xl font-bold text-fg">{level.title}</p>
            <p className="text-xs text-subtle tabular">{level.current}/{level.needed} XP</p>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-sm text-muted">Saldo spendibile</p><Wallet className="h-4 w-4 text-subtle" /></div>
          <p className="mt-2 font-display text-3xl font-bold tabular text-fg">{wallet} <span className="text-base text-xp">XP</span></p>
          <p className="text-xs text-subtle">{profile.score} guadagnati · {spent} spesi</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><p className="text-sm text-muted">Badge sbloccati</p><Medal className="h-4 w-4 text-subtle" /></div>
          <p className="mt-2 font-display text-3xl font-bold tabular text-fg">{earned.length}<span className="text-base text-subtle">/{data.badges.length}</span></p>
          <ProgressBar value={data.badges.length ? earned.length / data.badges.length : 0} tone="xp" className="mt-2" />
        </Card>
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-fg">Badge</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {data.badges.map((b, i) => {
            const got = profile.badges?.includes(b.id);
            const p = badgeProgress(b, profile, completed);
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={cn('relative flex flex-col items-center rounded-2xl border p-4 text-center', got ? 'border-line bg-surface shadow-card' : 'border-dashed border-line-strong bg-surface/40')}>
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', got ? 'bg-surface-2' : 'bg-surface-2/60')}>
                  {got ? <DynamicIcon name={b.icon} className={cn('h-7 w-7', b.color)} /> : <Lock className="h-5 w-5 text-subtle" />}
                </div>
                <p className={cn('mt-3 text-sm font-semibold', got ? 'text-fg' : 'text-muted')}>{b.name}</p>
                <p className="mt-0.5 text-xs text-subtle">{b.description}</p>
                {!got && (
                  <div className="mt-3 w-full">
                    <ProgressBar value={p.current / p.target} />
                    <p className="mt-1 text-[11px] tabular text-subtle">{p.current}/{p.target}</p>
                  </div>
                )}
                {got && <Sparkles className="absolute right-2.5 top-2.5 h-4 w-4 text-xp" />}
              </motion.div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-fg">Premi</h3>
        {data.rewards.length === 0 ? <EmptyState icon={<Gift />} title="Nessun premio configurato" /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.rewards.map(r => {
              const affordable = wallet >= r.cost;
              return (
                <Card key={r.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2"><DynamicIcon name={r.icon} className={cn('h-6 w-6', r.color)} /></div>
                    <XPChip value={r.cost} />
                  </div>
                  <p className="mt-4 font-semibold text-fg">{r.name}</p>
                  {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                  {!affordable && (
                    <div className="mt-3">
                      <ProgressBar value={wallet / r.cost} tone="xp" />
                      <p className="mt-1 text-xs text-subtle">Mancano {r.cost - wallet} XP</p>
                    </div>
                  )}
                  <div className="flex-1" />
                  <Button className="mt-4" variant={affordable ? 'primary' : 'outline'} disabled={!affordable || isSimulating} onClick={() => setConfirm(r)}>
                    <Gift className="h-4 w-4" /> {affordable ? 'Riscatta' : 'XP insufficienti'}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {myRequests.length > 0 && (
        <Card className="p-5">
          <CardHeader icon={<Gift />} title="Le mie richieste" />
          <ul className="mt-4 divide-y divide-line">
            {myRequests.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-fg">{r.rewardName}</p><p className="text-xs text-subtle">{fmt(r.createdAt, 'dd MMM yyyy, HH:mm')}</p></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular text-subtle">-{r.cost} XP</span>
                  <Pill tone={r.status === 'Consegnato' ? 'success' : r.status === 'Rifiutato' ? 'danger' : 'warning'} dot>{r.status}</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={redeem} loading={busy} tone="primary" icon={<Gift />}
        title={`Riscattare «${confirm?.name}»?`} confirmLabel="Conferma richiesta"
        message={<>Verranno riservati <strong className="text-fg">{confirm?.cost} XP</strong> dal tuo saldo spendibile. I tuoi XP in classifica non cambiano. Un responsabile confermerà la consegna.</>} />
    </div>
  );
}
