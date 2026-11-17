import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ClipboardCheck, ClipboardList, Eye, Gift, History, LayoutDashboard, LogOut, Menu, Moon, Plus, Settings2, Sun, Swords, Trophy, Users, CalendarRange, X, ChevronDown,
} from 'lucide-react';
import { useApp, type PageId } from '../../context';
import { cn, getLevel, isManager, ROLE_LABEL } from '../../lib/utils';
import { Avatar, Button, ProgressBar } from '../ui';
import { Logo, XPChip } from '../domain';

export interface NavItem { id: PageId; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number; group: 'main' | 'manage' }

export const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Il punto della situazione' },
  tasks: { title: 'Task', subtitle: 'Missioni attive e archivio' },
  challenges: { title: 'Sfide', subtitle: 'Obiettivi a tempo per XP extra' },
  rewards: { title: 'Traguardi', subtitle: 'Livelli, badge e premi' },
  planning: { title: 'Pianificazione', subtitle: 'Gantt e calendario del carico di lavoro' },
  leaderboard: { title: 'Classifica', subtitle: 'Chi sta scalando la vetta' },
  review: { title: 'Revisioni', subtitle: 'Task, sfide e premi in attesa' },
  people: { title: 'Persone', subtitle: 'Profili, ruoli e responsabili' },
  logs: { title: 'Log attività', subtitle: 'Cronologia completa dei task' },
  settings: { title: 'Configurazione', subtitle: 'Regole di gioco, badge e premi' },
};

export function useNavItems(reviewCount: number): NavItem[] {
  const { profile, realProfile } = useApp();
  const manager = isManager(profile.role);
  return [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
    { id: 'tasks', label: 'Task', icon: ClipboardList, group: 'main' },
    { id: 'challenges', label: 'Sfide', icon: Swords, group: 'main' },
    { id: 'rewards', label: 'Traguardi', icon: Gift, group: 'main' },
    { id: 'leaderboard', label: 'Classifica', icon: Trophy, group: 'main' },
    { id: 'planning', label: 'Pianificazione', icon: CalendarRange, group: 'main' },
    ...(manager ? [
      { id: 'review' as const, label: 'Revisioni', icon: ClipboardCheck, badge: reviewCount, group: 'manage' as const },
      { id: 'people' as const, label: 'Persone', icon: Users, group: 'manage' as const },
      { id: 'logs' as const, label: 'Log', icon: History, group: 'manage' as const },
    ] : []),
    ...(realProfile.role === 'Admin' && profile.role === 'Admin' ? [{ id: 'settings' as const, label: 'Configurazione', icon: Settings2, group: 'manage' as const }] : []),
  ];
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      className={cn('group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
        active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
      {active && <motion.span layoutId="nav-active" className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand" />}
      <Icon className="h-[18px] w-[18px]" />
      <span className="flex-1 text-left">{item.label}</span>
      {!!item.badge && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-bold leading-none text-white tabular">{item.badge}</span>}
    </button>
  );
}

export function AppShell({ page, items, onLogout, onOpenProfile, onExitSimulation, isDark, toggleTheme, children }: {
  page: PageId;
  items: NavItem[];
  onLogout: () => void;
  onOpenProfile: () => void;
  onExitSimulation: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  children: React.ReactNode;
}) {
  const { profile, isSimulating, navigate, openTaskForm, selectedArea, setSelectedArea, data } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lvl = getLevel(profile.score);
  const meta = PAGE_META[page];
  const manager = isManager(profile.role);

  const go = (id: PageId) => { navigate(id); setMobileOpen(false); };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Logo size={36} />
        <div className="leading-tight">
          <p className="font-display text-lg font-bold text-fg">Content Hero</p>
          <p className="text-xs text-subtle">Gamified workspace</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto scroll-thin px-3" aria-label="Navigazione principale">
        <div className="space-y-0.5">
          {items.filter(i => i.group === 'main').map(i => <NavButton key={i.id} item={i} active={page === i.id} onClick={() => go(i.id)} />)}
        </div>
        {items.some(i => i.group === 'manage') && (
          <div className="space-y-0.5">
            <p className="eyebrow px-3 pb-2">Gestione</p>
            {items.filter(i => i.group === 'manage').map(i => <NavButton key={i.id} item={i} active={page === i.id} onClick={() => go(i.id)} />)}
          </div>
        )}
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-surface-2/60 p-3">
        <button type="button" onClick={() => { onOpenProfile(); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-surface-2">
          <Avatar user={profile} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{profile.username}</p>
            <p className="truncate text-xs text-subtle">{ROLE_LABEL[profile.role]} · Lv {lvl.level}</p>
          </div>
        </button>
        <div className="mt-3 flex items-center gap-2 px-1">
          <ProgressBar value={lvl.progress} tone="xp" />
          <span className="whitespace-nowrap text-[11px] font-semibold tabular text-muted">{lvl.current}/{lvl.needed}</span>
        </div>
        <div className="mt-3 flex gap-1">
          <Button variant="ghost" size="sm" className="flex-1" onClick={toggleTheme} aria-label="Cambia tema">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="sm" className="flex-1 hover:text-danger" onClick={onLogout} aria-label="Esci"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface shadow-pop"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
              <Button variant="ghost" size="icon-sm" className="absolute right-3 top-6" onClick={() => setMobileOpen(false)} aria-label="Chiudi menu"><X className="h-4 w-4" /></Button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[264px]">
        {isSimulating && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-danger px-4 py-2 text-sm font-semibold text-white">
            <Eye className="h-4 w-4" /> Stai visualizzando l'app come <span className="underline underline-offset-2">{profile.username}</span>
            <button type="button" onClick={onExitSimulation} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs hover:bg-white/30">Esci</button>
          </div>
        )}

        {/* Top bar */}
        <header className={cn('sticky z-30 border-b border-line bg-canvas/80 backdrop-blur-xl', isSimulating ? 'top-9' : 'top-0')}>
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Apri menu"><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-bold text-fg sm:text-xl">{meta.title}</h1>
              <p className="hidden truncate text-xs text-subtle sm:block">{meta.subtitle}</p>
            </div>
            <div className="relative hidden sm:block">
              <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} aria-label="Filtra per area"
                className="h-10 cursor-pointer appearance-none rounded-xl border border-line bg-surface pl-3.5 pr-9 text-sm font-medium text-fg hover:border-line-strong focus:outline-none focus:ring-4 focus:ring-[var(--ring)]">
                <option value="Tutte">Tutte le aree</option>
                {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            </div>
            <XPChip value={profile.score} className="hidden xs:inline-flex" />
            {manager && !isSimulating && (
              <Button onClick={() => openTaskForm()} className="hidden md:inline-flex"><Plus className="h-4 w-4" /> Nuovo task</Button>
            )}
          </div>
          {/* Area filter on small screens */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3 sm:hidden">
            {['Tutte', ...data.areas].map(a => (
              <button key={a} type="button" onClick={() => setSelectedArea(a)}
                className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-semibold', selectedArea === a ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted')}>
                {a === 'Tutte' ? 'Tutte le aree' : a}
              </button>
            ))}
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navigazione rapida">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
            {(['dashboard', 'tasks', manager ? 'review' : 'challenges', 'rewards'] as PageId[]).map(id => {
              const item = items.find(i => i.id === id);
              if (!item) return null;
              const Icon = item.icon;
              const active = page === id;
              return (
                <button key={id} type="button" onClick={() => go(id)} className={cn('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', active ? 'text-brand' : 'text-subtle')}>
                  <Icon className="h-5 w-5" />{item.label}
                  {!!item.badge && <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{item.badge}</span>}
                </button>
              );
            })}
            {manager && !isSimulating && (
              <button type="button" onClick={() => openTaskForm()} className="flex flex-1 flex-col items-center justify-center" aria-label="Nuovo task">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_8px_20px_-6px_var(--brand)]"><Plus className="h-5 w-5" /></span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
