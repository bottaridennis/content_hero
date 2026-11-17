import React, { useState } from 'react';
import { Check, ClipboardCheck, Gift, Inbox, Swords, X } from 'lucide-react';
import { useApp } from '../../context';
import { reviewChallengeClaim, setRedemptionStatus } from '../../lib/actions';
import { displayName, fmt, fromNow, spentXP } from '../../lib/utils';
import { Avatar, Button, Card, CardHeader, EmptyState, Pill } from '../../components/ui';
import { DifficultyBadge, XPChip } from '../../components/domain';

/** Elementi in attesa di revisione visibili al manager attivo. */
export function useReviewItems() {
  const { data, profile, userById, visibleTasks } = useApp();
  // Il Responsabile vede le consegne dei suoi player o dei task che ha creato; l'Admin vede tutto.
  const scoped = (uid: string) => profile.role === 'Admin' || !!userById(uid)?.responsabileUids?.includes(profile.uid) || uid === profile.uid;
  const tasks = visibleTasks.filter(t => t.status === 'In Revisione' && (profile.role === 'Admin' || t.creatorUid === profile.uid || t.assignees.some(scoped)));
  const claims = data.challenges.flatMap(c => (c.pendingBy || []).filter(scoped).map(uid => ({ c, uid })));
  const requests = data.redemptions.filter(r => r.status === 'Richiesto' && scoped(r.uid));
  return { tasks, claims, requests, total: tasks.length + claims.length + requests.length };
}

export function ReviewPage() {
  const { data, realProfile, userById, openTask, openValidation } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const { tasks, claims, requests } = useReviewItems();

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); await fn(); setBusy(null); };

  if (tasks.length + claims.length + requests.length === 0) {
    return <EmptyState icon={<Inbox />} title="Nessuna revisione in sospeso" description="Quando i player consegneranno task, sfide o richiederanno premi li troverai qui." />;
  }

  return (
    <div className="space-y-6">
      {tasks.length > 0 && (
        <Card className="p-5">
          <CardHeader icon={<ClipboardCheck />} title="Task da valutare" subtitle={`${tasks.length} in revisione`} />
          <ul className="mt-4 divide-y divide-line">
            {tasks.map(t => (
              <li key={t.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <button type="button" onClick={() => openTask(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: t.color || 'var(--brand)' }} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg hover:underline">{t.title}</p>
                    <p className="text-xs text-subtle">{t.assignees.map(id => userById(id)?.username).join(', ')} · consegnato {t.logs?.submittedAt ? fromNow(t.logs.submittedAt) : ''}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 pl-4 sm:pl-0">
                  <DifficultyBadge difficulty={t.difficulty} />
                  {t.rejections ? <Pill tone="danger">Respinto {t.rejections}×</Pill> : null}
                  <Button size="sm" onClick={() => openValidation(t)}>Valuta</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {claims.length > 0 && (
        <Card className="p-5">
          <CardHeader icon={<Swords />} title="Sfide da verificare" subtitle={`${claims.length} richieste`} />
          <ul className="mt-4 divide-y divide-line">
            {claims.map(({ c, uid }) => {
              const u = userById(uid);
              const key = `${c.id}-${uid}`;
              return (
                <li key={key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar user={u} size={34} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg">{displayName(u)}</p>
                      <p className="truncate text-xs text-subtle">{c.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-11 sm:pl-0">
                    <XPChip value={`+${c.bonusXP}`} size="sm" />
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(key + 'n', () => reviewChallengeClaim(c, uid, false))}><X className="h-4 w-4" /> Rifiuta</Button>
                    <Button size="sm" variant="success" loading={busy === key + 'y'} disabled={!!busy} onClick={() => run(key + 'y', () => reviewChallengeClaim(c, uid, true))}><Check className="h-4 w-4" /> Approva</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {requests.length > 0 && (
        <Card className="p-5">
          <CardHeader icon={<Gift />} title="Premi richiesti" subtitle={`${requests.length} da consegnare`} />
          <ul className="mt-4 divide-y divide-line">
            {requests.map(r => {
              const u = userById(r.uid);
              const balance = (u?.score || 0) - spentXP(r.uid, data.redemptions);
              return (
                <li key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar user={u} size={34} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg">{r.rewardName}</p>
                      <p className="truncate text-xs text-subtle">{displayName(u)} · {fmt(r.createdAt, 'dd MMM, HH:mm')}{balance < 0 ? ' · ⚠ saldo negativo' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-11 sm:pl-0">
                    <XPChip value={r.cost} size="sm" />
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(r.id + 'n', () => setRedemptionStatus(r, 'Rifiutato', realProfile.uid))}><X className="h-4 w-4" /> Rifiuta</Button>
                    <Button size="sm" variant="success" loading={busy === r.id + 'y'} disabled={!!busy} onClick={() => run(r.id + 'y', () => setRedemptionStatus(r, 'Consegnato', realProfile.uid))}><Check className="h-4 w-4" /> Consegnato</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
