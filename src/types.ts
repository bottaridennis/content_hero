export type UserRole = 'Admin' | 'Responsabile' | 'Player';
// Le aree sono configurabili dall'Admin (metadata/areas), quindi sono stringhe libere.
export type Area = string;

export const AREAS: Area[] = ['Contenuti', 'Tecnologie', 'EGS', 'Commerciali', 'Direzione'];

export interface UserProfile {
  uid: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  area?: Area | null;
  score: number;
  responsabileUids?: string[];
  isApproved: boolean;
  badges: string[]; // IDs of earned badges
  mustChangePassword?: boolean;
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string;
  color: string;
  description?: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  bonusXP: number;
  expiresAt: string;
  area?: Area | null;
  completedBy: string[]; // uids approvati (XP assegnati)
  pendingBy?: string[]; // uids che hanno dichiarato il completamento, in attesa di verifica
  createdBy?: string;
  createdAt: string;
}

export type RedemptionStatus = 'Richiesto' | 'Consegnato' | 'Rifiutato';

export interface Redemption {
  id: string;
  uid: string;
  rewardId: string;
  rewardName: string;
  cost: number;
  status: RedemptionStatus;
  createdAt: string;
  handledAt?: string;
  handledBy?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  color: string; // Tailwind color class
  requirement: {
    type: 'score' | 'tasks_completed' | 'difficulty_completed';
    value: number;
    difficulty?: TaskDifficulty;
  };
}

export type TaskDifficulty = 'Rame' | 'Bronzo' | 'Argento' | 'Oro' | 'Platino';
export type TaskStatus = 'In attesa' | 'In corso' | 'In Revisione' | 'Completato';

export interface TaskLog {
  createdAt: string;
  assignedAt?: string;
  acceptedAt?: string;
  submittedAt?: string; // Quando passa a 'In Revisione'
  validatedAt?: string; // Quando passa a 'Completato'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  difficulty: TaskDifficulty;
  status: TaskStatus;
  assignees: string[]; // uids
  acceptedBy?: string[]; // uids of users who accepted
  submittedBy?: string[]; // uids of users who submitted
  creatorUid: string;
  area?: Area | null;
  bonuses: string[];
  penalties: string[];
  autoBonuses?: string[];
  finalScore: number;
  basePoints?: number;
  logs: TaskLog;
  createdAt: string;
  estimatedHours?: number;
  color?: string; // Unique color for the task
  feedback?: string; // Ultimo feedback del revisore (es. motivo del respingimento)
  rejections?: number; // Numero di volte in cui il task è stato respinto
}

export interface BonusPenalty {
  id: string;
  label: string;
  value: number;
  category: 'Bonus' | 'Penalty';
}
