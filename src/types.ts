export type UserRole = 'Admin' | 'Responsabile' | 'Player';
export type Area = 'Contenuti' | 'Tecnologie' | 'EGS' | 'Commerciali' | 'Direzione';

export const AREAS: Area[] = ['Contenuti', 'Tecnologie', 'EGS', 'Commerciali', 'Direzione'];

export interface UserProfile {
  uid: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  area?: Area;
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
  area?: Area;
  completedBy: string[]; // uids
  createdAt: string;
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
  area?: Area;
  bonuses: string[];
  penalties: string[];
  autoBonuses?: string[];
  finalScore: number;
  basePoints?: number;
  logs: TaskLog;
  createdAt: string;
  estimatedHours?: number;
  color?: string; // Unique color for the task
}

export interface BonusPenalty {
  id: string;
  label: string;
  value: number;
  category: 'Bonus' | 'Penalty';
}
