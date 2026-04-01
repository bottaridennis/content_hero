export type UserRole = 'Admin' | 'Responsabile' | 'Player';

export interface UserProfile {
  uid: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  score: number;
  responsabileUid?: string;
  isApproved: boolean;
  badges: string[]; // IDs of earned badges
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

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  difficulty: TaskDifficulty;
  status: TaskStatus;
  assignees: string[]; // uids
  creatorUid: string;
  bonuses: string[];
  penalties: string[];
  finalScore: number;
  createdAt: string;
}

export interface BonusPenalty {
  id: string;
  label: string;
  value: number;
  category: 'Bonus' | 'Penalty';
}
