import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Crown, Medal, Trophy } from 'lucide-react';
import { useApp } from '../../context';
import { cn, displayName, getLevel } from '../../lib/utils';
import { Avatar, Card, EmptyState, Segmented } from '../../components/ui';
import { DynamicIcon, XPChip } from '../../components/domain';

export function Leaderboard({ limit, compact, area }: { limit?: number; compact?: boolean; area?: string }) {
  const { data, profile, selectedArea } = useApp();
  const scope = area ?? selectedArea;
  const ranking = useMemo(() => data.users
    .filter(u => u.role !== 'Admin' && u.isApproved)
    .filter(u => scope === 'Tutte' || u.area === scope)
    .sort((a, b) => b.score - a.score), [data.users, scope]);

  const rows = limit ? ranking.slice(0, limit) : ranking;
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-subtle">Nessun giocatore in classifica</p>;

  return (
    <ol className="space-y-1">
      {rows.map((u, i) => {
        const me = u.uid === profile.uid;
        return (
          <li key={u.uid} className={cn('flex items-center gap-3 rounded-xl px-2 py-2 transition-colors', me ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold tabular',
              i === 0 ? 'bg-xp-soft text-xp' : i === 1 ? 'bg-surface-3 text-muted' : i === 2 ? 'bg-[#fbe5d6] text-[#c2410c] dark:bg-[#3a2212]' : 'text-subtle')}>
              {i + 1}
            </span>
            <Avatar user={u} size={compact ? 30 : 36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{u.username}{me && <span className="font-normal text-subtle"> · tu</span>}</p>
              {!compact && <p className="truncate text-xs text-subtle">Lv {getLevel(u.score).level} · {u.area || u.role}</p>}
            </div>
            <XPChip value={u.score} size="sm" />
          </li>
        );
      })}
    </ol>
  );
}

export function LeaderboardPage() {
  const { data, profile } = useApp();
  const [area, setArea] = useState<string>('Tutte');
  const ranking = data.users
    .filter(u => u.role !== 'Admin' && u.isApproved)
    .filter(u => area === 'Tutte' || u.area === area)
    .sort((a, b) => b.score - a.score);
  const podium = ranking.slice(0, 3);
  const order = [1, 0, 2];

  return (
    <div className="space-y-6">
      <Segmented value={area} onChange={setArea} options={[{ value: 'Tutte', label: 'Tutti' }, ...data.areas.map(a => ({ value: a, label: a }))]} />

      {ranking.length === 0 ? <EmptyState icon={<Trophy />} title="Classifica vuota" description="Nessun giocatore in quest'area." /> : (
        <>
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
            {order.map(idx => {
              const u = podium[idx];
              if (!u) return <div key={idx} />;
              const heights = ['h-36 sm:h-44', 'h-28 sm:h-36', 'h-24 sm:h-28'];
              const colors = ['from-[#ffe27a] to-[#f59e0b]', 'from-[#e2e8f0] to-[#94a3b8]', 'from-[#f6a26b] to-[#c2410c]'];
              return (
                <motion.div key={u.uid} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * (idx + 1) }} className="flex flex-col items-center">
                  {idx === 0 && <Crown className="mb-1 h-6 w-6 fill-xp text-xp" />}
                  <Avatar user={u} size={idx === 0 ? 72 : 56} className={cn('ring-4', u.uid === profile.uid ? 'ring-brand' : 'ring-surface')} />
                  <p className="mt-2 max-w-full truncate text-sm font-semibold text-fg">{u.username}</p>
                  <XPChip value={u.score} size="sm" className="mt-1" />
                  <div className={cn('mt-3 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-3 font-display text-3xl font-bold text-white/90 shadow-card', heights[idx], colors[idx])}>
                    {idx + 1}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Card className="divide-y divide-line">
            {ranking.map((u, i) => {
              const lvl = getLevel(u.score);
              return (
                <div key={u.uid} className={cn('flex items-center gap-3 px-4 py-3 sm:gap-4', u.uid === profile.uid && 'bg-brand-soft/60')}>
                  <span className="w-6 text-center font-display font-bold tabular text-subtle">{i + 1}</span>
                  <Avatar user={u} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-fg">{displayName(u)}</p>
                    <p className="truncate text-xs text-subtle">@{u.username} · Lv {lvl.level} {lvl.title}{u.area ? ` · ${u.area}` : ''}</p>
                  </div>
                  <div className="hidden items-center gap-1 md:flex">
                    {(u.badges || []).slice(0, 5).map(id => {
                      const b = data.badges.find(x => x.id === id);
                      return b ? <span key={id} title={b.name} className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2"><DynamicIcon name={b.icon} className={cn('h-4 w-4', b.color)} /></span> : null;
                    })}
                    {(u.badges?.length || 0) > 5 && <span className="text-xs text-subtle">+{(u.badges?.length || 0) - 5}</span>}
                    {(u.badges?.length || 0) === 0 && <Medal className="h-4 w-4 text-line-strong" />}
                  </div>
                  <XPChip value={u.score} />
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
