import React, { createContext, useContext } from 'react';
import type { AppData } from './hooks/useAppData';
import type { Area, Task, UserProfile } from './types';

export type PageId =
  | 'dashboard'
  | 'tasks'
  | 'challenges'
  | 'rewards'
  | 'planning'
  | 'leaderboard'
  | 'review'
  | 'people'
  | 'logs'
  | 'settings';

export interface AppContextValue {
  data: AppData;
  /** Profilo attivo (eventualmente simulato dall'admin). */
  profile: UserProfile;
  /** Profilo reale dell'utente autenticato. */
  realProfile: UserProfile;
  isSimulating: boolean;
  selectedArea: Area | 'Tutte';
  setSelectedArea: (a: Area | 'Tutte') => void;
  /** Task visibili al profilo attivo (Player: solo i propri). */
  visibleTasks: Task[];
  navigate: (page: PageId) => void;
  openTask: (task: Task) => void;
  openTaskForm: (task?: Task) => void;
  openValidation: (task: Task) => void;
  userById: (uid: string) => UserProfile | undefined;
}

const Ctx = createContext<AppContextValue | null>(null);

export const AppProvider = ({ value, children }: { value: AppContextValue; children: React.ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp deve essere usato dentro AppProvider');
  return v;
}
