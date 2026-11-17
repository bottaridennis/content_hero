import { arrayUnion, deleteField, doc, increment, setDoc, updateDoc, writeBatch, deleteDoc, collection } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import { OperationType, handleFirestoreError } from './errors';
import { checkAndAwardBadges } from './utils';
import type { Badge, Challenge, Redemption, RedemptionStatus, Reward, Task, UserProfile } from '../types';

const now = () => new Date().toISOString();

// ---------- Task lifecycle (player) ----------

export async function acceptTask(task: Task, uid: string) {
  try {
    const acceptedBy = Array.from(new Set([...(task.acceptedBy || []), uid])).filter(id => task.assignees.includes(id));
    const everyone = task.assignees.every(a => acceptedBy.includes(a));
    const updates: Record<string, unknown> = { acceptedBy };
    if (everyone) {
      updates.status = 'In corso';
      updates['logs.acceptedAt'] = now();
    }
    await updateDoc(doc(db, 'tasks', task.id), updates);
    toast.success(everyone ? 'Task avviato! Buon lavoro 💪' : `Hai accettato il task (${acceptedBy.length}/${task.assignees.length})`);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
  }
}

export async function submitTask(task: Task, uid: string) {
  try {
    const submittedBy = Array.from(new Set([...(task.submittedBy || []), uid])).filter(id => task.assignees.includes(id));
    const everyone = task.assignees.every(a => submittedBy.includes(a));
    const updates: Record<string, unknown> = { submittedBy };
    if (everyone) {
      updates.status = 'In Revisione';
      updates['logs.submittedAt'] = now();
    }
    await updateDoc(doc(db, 'tasks', task.id), updates);
    toast.success(everyone ? 'Consegnato! Il task è ora in revisione.' : `Hai consegnato la tua parte (${submittedBy.length}/${task.assignees.length})`);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
  }
}

export async function withdrawSubmission(task: Task, uid: string) {
  try {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: 'In corso',
      submittedBy: (task.submittedBy || []).filter(id => id !== uid),
      'logs.submittedAt': deleteField(),
    });
    toast('Consegna ritirata.');
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
  }
}

// ---------- Task lifecycle (manager) ----------

export async function rejectTask(task: Task, feedback: string) {
  try {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: 'In corso',
      submittedBy: [],
      penalties: arrayUnion('o_rejection'),
      feedback: feedback.trim() || deleteField(),
      rejections: increment(1),
      'logs.submittedAt': deleteField(),
    });
    toast.warning('Task respinto: penalità applicata e feedback inviato.');
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `tasks/${task.id}`);
  }
}

export async function deleteTask(task: Task) {
  try {
    await deleteDoc(doc(db, 'tasks', task.id));
    toast.success('Task eliminato.');
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `tasks/${task.id}`);
    return false;
  }
}

/**
 * Chiude il task assegnando XP a tutti gli assegnatari e verificando i badge.
 * Usa i dati già sincronizzati in tempo reale (niente query aggiuntive / indici composti).
 */
export async function validateTask(params: {
  task: Task;
  finalScore: number;
  bonuses: string[];
  penalties: string[];
  autoBonuses: string[];
  feedback?: string;
  users: UserProfile[];
  allTasks: Task[];
  badges: Badge[];
}) {
  const { task, finalScore, bonuses, penalties, autoBonuses, feedback, users, allTasks, badges } = params;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tasks', task.id), {
      status: 'Completato',
      bonuses,
      penalties,
      autoBonuses,
      finalScore,
      feedback: feedback?.trim() || deleteField(),
      'logs.validatedAt': now(),
    });

    const awarded: string[] = [];
    for (const uid of task.assignees) {
      const user = users.find(u => u.uid === uid);
      if (!user) continue;
      const newScore = (user.score || 0) + finalScore;
      const completed = [
        ...allTasks.filter(t => t.status === 'Completato' && t.id !== task.id && t.assignees.includes(uid)),
        { ...task, status: 'Completato' as const },
      ];
      const newBadges = checkAndAwardBadges({ ...user, score: newScore }, completed, badges);
      batch.update(doc(db, 'users', uid), newBadges.length
        ? { score: increment(finalScore), badges: arrayUnion(...newBadges) }
        : { score: increment(finalScore) });
      newBadges.forEach(id => {
        const b = badges.find(x => x.id === id);
        if (b) awarded.push(`${user.username}: ${b.name}`);
      });
    }

    await batch.commit();
    toast.success(`Task validato · +${finalScore} XP assegnati`);
    awarded.forEach(a => toast(`🏆 Nuovo badge — ${a}`));
    return true;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `tasks/${task.id}`);
    return false;
  }
}

// ---------- Users ----------

export async function updateUser(uid: string, updates: Partial<UserProfile> | Record<string, unknown>, ctx?: { users: UserProfile[]; tasks: Task[]; badges: Badge[] }) {
  try {
    const payload: Record<string, unknown> = { ...updates };
    if (typeof payload.score === 'number' && ctx) {
      const user = ctx.users.find(u => u.uid === uid);
      if (user) {
        const completed = ctx.tasks.filter(t => t.status === 'Completato' && t.assignees.includes(uid));
        const newBadges = checkAndAwardBadges({ ...user, score: payload.score as number }, completed, ctx.badges);
        if (newBadges.length) {
          payload.badges = arrayUnion(...newBadges);
          newBadges.forEach(id => {
            const b = ctx.badges.find(x => x.id === id);
            if (b) toast(`🏆 Nuovo badge per ${user.username}: ${b.name}`);
          });
        }
      }
    }
    await setDoc(doc(db, 'users', uid), payload, { merge: true });
    toast.success('Utente aggiornato');
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${uid}`);
  }
}

// ---------- Challenges ----------

export async function claimChallenge(challenge: Challenge, uid: string) {
  try {
    await updateDoc(doc(db, 'challenges', challenge.id), { pendingBy: arrayUnion(uid) });
    toast.success('Completamento segnalato! In attesa di verifica.');
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `challenges/${challenge.id}`);
  }
}

export async function reviewChallengeClaim(challenge: Challenge, uid: string, approve: boolean) {
  try {
    const batch = writeBatch(db);
    const pendingBy = (challenge.pendingBy || []).filter(id => id !== uid);
    if (approve) {
      batch.update(doc(db, 'challenges', challenge.id), { pendingBy, completedBy: arrayUnion(uid) });
      batch.update(doc(db, 'users', uid), { score: increment(challenge.bonusXP) });
    } else {
      batch.update(doc(db, 'challenges', challenge.id), { pendingBy });
    }
    await batch.commit();
    toast.success(approve ? `Sfida approvata · +${challenge.bonusXP} XP` : 'Richiesta respinta');
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `challenges/${challenge.id}`);
  }
}

// ---------- Rewards ----------

export async function requestReward(reward: Reward, uid: string) {
  try {
    const ref = doc(collection(db, 'redemptions'));
    const data: Redemption = {
      id: ref.id,
      uid,
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
      status: 'Richiesto',
      createdAt: now(),
    };
    await setDoc(ref, data);
    toast.success(`Richiesta inviata: ${reward.name} 🎁`, { description: 'Un responsabile la confermerà a breve.' });
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, 'redemptions');
  }
}

export async function setRedemptionStatus(r: Redemption, status: RedemptionStatus, handlerUid: string) {
  try {
    await updateDoc(doc(db, 'redemptions', r.id), { status, handledAt: now(), handledBy: handlerUid });
    toast.success(status === 'Consegnato' ? 'Premio segnato come consegnato' : 'Richiesta rifiutata, XP restituiti');
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `redemptions/${r.id}`);
  }
}

// ---------- Metadata ----------

export async function saveMetadata(id: string, list: unknown[]) {
  try {
    await setDoc(doc(db, 'metadata', id), { list });
    toast.success('Configurazione salvata');
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `metadata/${id}`);
  }
}
