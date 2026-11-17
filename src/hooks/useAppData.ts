import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../firebase';
import { OperationType, handleFirestoreError } from '../lib/errors';
import { AREAS, type Area, type Badge, type BonusPenalty, type Challenge, type Redemption, type Reward, type Task, type UserProfile } from '../types';
import { BADGES, BONUSES, PENALTIES } from '../constants';

export const DEFAULT_REWARDS: Reward[] = [
  { id: 'coffee', name: 'Caffè offerto', cost: 500, icon: 'Coffee', color: 'text-amber-500' },
  { id: 'lunch', name: 'Pranzo offerto', cost: 2000, icon: 'Utensils', color: 'text-indigo-500' },
  { id: 'dayoff', name: 'Mezza giornata off', cost: 5000, icon: 'Plane', color: 'text-rose-500' },
];

export interface AppData {
  tasks: Task[];
  users: UserProfile[];
  challenges: Challenge[];
  redemptions: Redemption[];
  areas: Area[];
  badges: Badge[];
  bonuses: BonusPenalty[];
  penalties: BonusPenalty[];
  rewards: Reward[];
  ready: boolean;
}

export function useAppData(user: FirebaseUser | null): AppData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [areas, setAreas] = useState<Area[]>(AREAS);
  const [badges, setBadges] = useState<Badge[]>(BADGES);
  const [bonuses, setBonuses] = useState<BonusPenalty[]>(BONUSES);
  const [penalties, setPenalties] = useState<BonusPenalty[]>(PENALTIES);
  const [rewards, setRewards] = useState<Reward[]>(DEFAULT_REWARDS);
  const [loaded, setLoaded] = useState({ tasks: false, users: false });

  useEffect(() => {
    if (!user) {
      setTasks([]); setUsers([]); setChallenges([]); setRedemptions([]);
      setLoaded({ tasks: false, users: false });
      return;
    }

    const unsubs = [
      onSnapshot(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')), snap => {
        setTasks(snap.docs.map(d => normalizeTask({ id: d.id, ...d.data() } as Task)));
        setLoaded(l => ({ ...l, tasks: true }));
      }, err => { handleFirestoreError(err, OperationType.LIST, 'tasks'); setLoaded(l => ({ ...l, tasks: true })); }),

      onSnapshot(query(collection(db, 'users'), orderBy('score', 'desc')), snap => {
        setUsers(snap.docs.map(d => ({ ...(d.data() as UserProfile), uid: d.id, badges: d.data().badges || [] })));
        setLoaded(l => ({ ...l, users: true }));
      }, err => { handleFirestoreError(err, OperationType.LIST, 'users'); setLoaded(l => ({ ...l, users: true })); }),

      onSnapshot(query(collection(db, 'challenges'), orderBy('createdAt', 'desc')), snap => {
        setChallenges(snap.docs.map(d => ({ completedBy: [], pendingBy: [], ...d.data(), id: d.id } as Challenge)));
      }, err => handleFirestoreError(err, OperationType.LIST, 'challenges')),

      onSnapshot(query(collection(db, 'redemptions'), orderBy('createdAt', 'desc')), snap => {
        setRedemptions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Redemption)));
      }, err => {
        // La collezione è nuova: se le regole non sono ancora state pubblicate non blocchiamo l'app.
        console.warn('redemptions listener:', err);
      }),

      onSnapshot(collection(db, 'metadata'), snap => {
        snap.docs.forEach(d => {
          const list = d.data().list;
          if (!Array.isArray(list)) return;
          switch (d.id) {
            case 'areas': setAreas(list); break;
            case 'badges': setBadges(list); break;
            case 'bonuses': setBonuses(list); break;
            case 'penalties': setPenalties(list); break;
            case 'rewards': setRewards(list); break;
          }
        });
      }, err => handleFirestoreError(err, OperationType.LIST, 'metadata')),
    ];

    return () => unsubs.forEach(u => u());
  }, [user]);

  return { tasks, users, challenges, redemptions, areas, badges, bonuses, penalties, rewards, ready: loaded.tasks && loaded.users };
}

/** Rende robusti i documenti legacy a cui mancano campi. */
function normalizeTask(t: Task): Task {
  return {
    ...t,
    assignees: t.assignees || [],
    acceptedBy: t.acceptedBy || [],
    submittedBy: t.submittedBy || [],
    bonuses: t.bonuses || [],
    penalties: t.penalties || [],
    logs: t.logs || { createdAt: t.createdAt },
    finalScore: t.finalScore || 0,
  };
}
