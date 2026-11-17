import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, format, isAfter, isSameDay, isWeekend, parseISO, formatDistanceToNowStrict } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Badge, Redemption, Task, UserProfile, UserRole } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- Auth helpers ----------

export const ADMIN_EMAIL = 'dennisbottari@gmail.com';
export const VIRTUAL_EMAIL_DOMAIN = 'gamified-tasks.local';

export const sanitizeUsername = (username: string) =>
  username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

export const usernameToEmail = (username: string) =>
  `${sanitizeUsername(username)}@${VIRTUAL_EMAIL_DOMAIN}`;

export const isManager = (role?: UserRole) => role === 'Admin' || role === 'Responsabile';

export const ROLE_LABEL: Record<UserRole, string> = {
  Admin: 'Amministratore',
  Responsabile: 'Responsabile',
  Player: 'Player',
};

// ---------- Formatting ----------

export const fmt = (iso: string | Date | undefined | null, pattern = 'dd MMM, HH:mm') => {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  if (isNaN(d.getTime())) return '—';
  return format(d, pattern, { locale: it });
};

export const fromNow = (iso: string | Date) => {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  if (isNaN(d.getTime())) return '';
  return formatDistanceToNowStrict(d, { locale: it, addSuffix: true });
};

export const initials = (u?: Pick<UserProfile, 'username' | 'firstName' | 'lastName'> | null) => {
  if (!u) return '?';
  if (u.firstName && u.lastName) return (u.firstName[0] + u.lastName[0]).toUpperCase();
  return (u.username || '?').substring(0, 2).toUpperCase();
};

export const displayName = (u?: Pick<UserProfile, 'username' | 'firstName' | 'lastName'> | null) => {
  if (!u) return 'Utente';
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.username;
};

const AVATAR_HUES = [262, 210, 330, 160, 25, 190, 290, 120, 0, 45];
export const avatarHue = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
};

export const randomTaskColor = () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`;

// ---------- Levels ----------

const LEVEL_TITLES = ['Novizio', 'Apprendista', 'Esploratore', 'Esperto', 'Veterano', 'Maestro', 'Campione', 'Leggenda', 'Eroe', 'Mito'];

/** XP totali necessari per raggiungere il livello `level` (livello 1 = 0 XP). */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export const getLevel = (score: number) => {
  const xp = Math.max(0, score || 0);
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    current: xp - floor,
    needed: next - floor,
    progress: (xp - floor) / (next - floor),
    nextAt: next,
  };
};

// ---------- XP wallet ----------

/** XP spesi in premi (richieste non rifiutate). */
export const spentXP = (uid: string, redemptions: Redemption[]) =>
  redemptions
    .filter(r => r.uid === uid && r.status !== 'Rifiutato')
    .reduce((acc, r) => acc + (r.cost || 0), 0);

// ---------- Badges ----------

export function checkAndAwardBadges(profile: UserProfile, completedTasks: Task[], badges: Badge[]): string[] {
  const owned = new Set(profile.badges || []);
  return badges
    .filter(badge => {
      if (owned.has(badge.id)) return false;
      const { requirement } = badge;
      switch (requirement.type) {
        case 'score':
          return profile.score >= requirement.value;
        case 'tasks_completed':
          return completedTasks.length >= requirement.value;
        case 'difficulty_completed':
          return completedTasks.filter(t => t.difficulty === requirement.difficulty).length >= (requirement.value || 0);
        default:
          return false;
      }
    })
    .map(b => b.id);
}

// ---------- Task helpers ----------

export const isTaskOverdue = (task: Task) =>
  task.status !== 'Completato' && isAfter(new Date(), parseISO(task.deadline));

/** Percentuale di tempo trascorso tra creazione e scadenza (0-1). */
export const taskTimeProgress = (task: Task) => {
  const start = parseISO(task.createdAt).getTime();
  const end = parseISO(task.deadline).getTime();
  const now = task.logs?.validatedAt ? parseISO(task.logs.validatedAt).getTime() : Date.now();
  if (!isFinite(start) || !isFinite(end) || end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
};

export const hoursUntil = (iso: string) => (parseISO(iso).getTime() - Date.now()) / 36e5;

// ---------- Working calendar (Italia) ----------

const easterCache = new Map<number, Date>();
const getEaster = (y: number) => {
  const cached = easterCache.get(y);
  if (cached) return cached;
  const f = Math.floor;
  const G = y % 19;
  const C = f(y / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (y + f(y / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const m = 3 + f((L + 40) / 44);
  const d = L + 28 - 31 * f(m / 4);
  const easter = new Date(y, m - 1, d);
  easterCache.set(y, easter);
  return easter;
};

const FIXED_HOLIDAYS = new Set(['1-1', '1-6', '4-25', '5-1', '6-2', '8-15', '11-1', '12-8', '12-25', '12-26']);

export const isItalianHoliday = (date: Date) => {
  if (FIXED_HOLIDAYS.has(`${date.getMonth() + 1}-${date.getDate()}`)) return true;
  return isSameDay(date, addDays(getEaster(date.getFullYear()), 1));
};

export const isNonWorkingDay = (date: Date) => isWeekend(date) || isItalianHoliday(date);

export const WORK_START = 9;
export const WORK_END = 18;
export const WORKING_HOURS_PER_DAY = WORK_END - WORK_START;

const nextWorkingStart = (d: Date) => {
  const n = addDays(d, 1);
  n.setHours(WORK_START, 0, 0, 0);
  return n;
};

/** Sposta una data al primo istante lavorativo utile (09-18, no weekend/festivi). */
export const alignToWorkingTime = (date: Date) => {
  let current = new Date(date);
  if (current.getHours() < WORK_START) current.setHours(WORK_START, 0, 0, 0);
  if (current.getHours() >= WORK_END) current = nextWorkingStart(current);
  while (isNonWorkingDay(current)) current = nextWorkingStart(current);
  return current;
};

/** Somma `durationHours` di lavoro effettivo a partire da `startDate` (09-18, no weekend/festivi). */
export const calculateEndDate = (startDate: Date, durationHours: number) => {
  let remaining = durationHours;
  let current = alignToWorkingTime(startDate);

  let guard = 0;
  while (remaining > 0 && guard++ < 2000) {
    if (isNonWorkingDay(current)) {
      current = nextWorkingStart(current);
      continue;
    }
    const hoursLeftInDay = Math.max(0, WORK_END - (current.getHours() + current.getMinutes() / 60));
    const take = Math.min(remaining, hoursLeftInDay);
    remaining -= take;
    if (remaining > 0) {
      current = nextWorkingStart(current);
    } else {
      current = new Date(current.getTime() + take * 36e5);
    }
  }
  return current;
};

export type TimelineTask = Task & { calculatedStartDate: Date; calculatedEndDate: Date };

/** Pianifica i task attivi in sequenza per ogni utente, dividendo le ore fra gli assegnatari. */
export const calculateSequentialTimeline = (tasks: Task[], users: UserProfile[]): TimelineTask[] => {
  const activeTasks = tasks.filter(t => t.estimatedHours && t.status !== 'Completato' && t.assignees.length > 0);
  const slots: Record<string, { start: Date; end: Date }[]> = {};

  const anchor = (t: Task) => parseISO(t.logs?.acceptedAt || t.createdAt);

  users.forEach(u => {
    const userTasks = activeTasks
      .filter(t => t.assignees.includes(u.uid))
      .sort((a, b) => anchor(a).getTime() - anchor(b).getTime());

    let pointer: Date | null = null;
    userTasks.forEach(task => {
      const perPerson = task.estimatedHours! / task.assignees.length;
      const accepted = anchor(task);
      const start = alignToWorkingTime(pointer && isAfter(pointer, accepted) ? pointer : accepted);
      const end = calculateEndDate(start, perPerson);
      (slots[task.id] ||= []).push({ start, end });
      pointer = end;
    });
  });

  return activeTasks.map(task => {
    const s = slots[task.id];
    if (!s || s.length === 0) {
      const start = alignToWorkingTime(parseISO(task.createdAt));
      return { ...task, calculatedStartDate: start, calculatedEndDate: calculateEndDate(start, task.estimatedHours! / task.assignees.length) };
    }
    return {
      ...task,
      calculatedStartDate: new Date(Math.min(...s.map(x => x.start.getTime()))),
      calculatedEndDate: new Date(Math.max(...s.map(x => x.end.getTime()))),
    };
  });
};
