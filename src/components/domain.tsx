import React from 'react';
import {
  Award, Coffee, Crown, Flame, Gem, Gift, Heart, Medal, Rocket, Shield, Sparkles, Star, Target, Trophy, User, Utensils, Zap, Plane, Clock, Hourglass, Eye, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { TaskDifficulty, TaskStatus } from '../types';

export const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Star, Shield, Crown, Trophy, Zap, Target, Flame, Medal, Award, Gem, Rocket, Sparkles, Heart, Gift, Coffee, Utensils, Plane,
  UserIcon: User,
};

export const ICON_NAMES = Object.keys(ICONS).filter(n => n !== 'UserIcon');

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] || Medal;
  return <Icon className={className} />;
}

// Tailwind safelist-friendly colour palette for badges / rewards
export const ICON_COLORS = [
  'text-slate-400', 'text-amber-500', 'text-yellow-500', 'text-orange-500', 'text-rose-500', 'text-pink-500',
  'text-purple-500', 'text-indigo-500', 'text-blue-500', 'text-cyan-500', 'text-emerald-500', 'text-lime-500',
];

export const DIFFICULTY_META: Record<TaskDifficulty, { color: string; gradient: string; rank: number }> = {
  Rame: { color: '#c2410c', gradient: 'linear-gradient(135deg,#f6a26b,#b8501f)', rank: 1 },
  Bronzo: { color: '#b45309', gradient: 'linear-gradient(135deg,#e7b16b,#9a5b1c)', rank: 2 },
  Argento: { color: '#64748b', gradient: 'linear-gradient(135deg,#e2e8f0,#8b97ab)', rank: 3 },
  Oro: { color: '#ca8a04', gradient: 'linear-gradient(135deg,#ffe27a,#d29b0b)', rank: 4 },
  Platino: { color: '#6d4aff', gradient: 'linear-gradient(135deg,#b9f3ff,#8b6dff 60%,#ff8fd1)', rank: 5 },
};

export const DIFFICULTIES: TaskDifficulty[] = ['Rame', 'Bronzo', 'Argento', 'Oro', 'Platino'];

export function DifficultyBadge({ difficulty, className, compact }: { difficulty: TaskDifficulty; className?: string; compact?: boolean }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-fg', className)}>
      <span className="h-3 w-3 rounded-full shadow-inner" style={{ background: meta.gradient }} />
      {!compact && difficulty}
    </span>
  );
}

export const STATUS_META: Record<TaskStatus, { tone: 'neutral' | 'info' | 'warning' | 'success'; icon: LucideIcon; label: string; color: string }> = {
  'In attesa': { tone: 'neutral', icon: Hourglass, label: 'In attesa', color: '#94a3b8' },
  'In corso': { tone: 'info', icon: Clock, label: 'In corso', color: '#3b82f6' },
  'In Revisione': { tone: 'warning', icon: Eye, label: 'In revisione', color: '#f59e0b' },
  'Completato': { tone: 'success', icon: CheckCircle2, label: 'Completato', color: '#10b981' },
};

export const STATUSES: TaskStatus[] = ['In attesa', 'In corso', 'In Revisione', 'Completato'];

const STATUS_CLASSES = {
  neutral: 'bg-surface-2 text-muted',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_CLASSES[meta.tone], className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function XPChip({ value, className, size = 'md' }: { value: number | string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-xp-soft font-display font-bold tabular text-xp', size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm', className)}>
      <Zap className={cn('fill-current', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {value}
    </span>
  );
}

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <div className={cn('relative flex items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-8px_#6d4aff]', className)}
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#8b6dff 0%,#5a36f0 55%,#ff6fb5 130%)' }}>
      <svg viewBox="0 0 24 24" fill="none" style={{ width: size * 0.56, height: size * 0.56 }}>
        <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6L12 2.5Z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m13 6.5-4 6.2h3.2l-1.2 4.8 4-6.2h-3.2L13 6.5Z" fill="currentColor" />
      </svg>
    </div>
  );
}
