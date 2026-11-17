import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Toaster } from 'sonner';
import { LogOut, Trash2, UserX } from 'lucide-react';
import { auth, db } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, type AppContextValue, type PageId } from './context';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';
import { deleteTask } from './lib/actions';
import { ADMIN_EMAIL, isManager, VIRTUAL_EMAIL_DOMAIN } from './lib/utils';
import { Button, Card, ConfirmDialog } from './components/ui';
import { Logo } from './components/domain';
import { AppShell, useNavItems } from './components/layout/AppShell';
import { AuthScreen, ForcePasswordChange, PendingApproval } from './features/auth';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LeaderboardPage } from './features/dashboard/Leaderboard';
import { TasksPage } from './features/tasks/TasksPage';
import { TaskFormModal } from './features/tasks/TaskFormModal';
import { TaskDetailModal } from './features/tasks/TaskDetailModal';
import { ValidationModal } from './features/tasks/ValidationModal';
import { ChallengesPage } from './features/challenges/ChallengesPage';
import { RewardsPage } from './features/rewards/RewardsPage';
import { PlanningPage } from './features/planning/PlanningPage';
import { ReviewPage, useReviewItems } from './features/review/ReviewPage';
import { PeoplePage } from './features/people/PeoplePage';
import { LogsPage } from './features/logs/LogsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ProfileModal } from './features/profile/ProfileModal';
import type { Task, UserProfile, UserRole } from './types';

const PAGES: PageId[] = ['dashboard', 'tasks', 'challenges', 'rewards', 'planning', 'leaderboard', 'review', 'people', 'logs', 'settings'];
const MANAGER_PAGES: PageId[] = ['review', 'people', 'logs'];

const readHash = (): PageId => {
  const h = window.location.hash.replace(/^#\/?/, '') as PageId;
  return PAGES.includes(h) ? h : 'dashboard';
};

function Splash({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas">
      <Logo size={56} className="animate-pulse" />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}

export default function App() {
  const themeCtl = useTheme();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileState, setProfileState] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setAuthReady(true);
    if (!u) { setProfile(null); setProfileState('idle'); setPasswordChanged(false); }
  }), []);

  useEffect(() => {
    if (!user) return;
    setProfileState('loading');
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      if (!snap.exists()) { setProfile(null); setProfileState('missing'); return; }
      const data = { ...(snap.data() as UserProfile), uid: snap.id, badges: snap.data().badges || [] };
      // Il proprietario dell'app è sempre Admin approvato
      if (user.email === ADMIN_EMAIL && (data.role !== 'Admin' || !data.isApproved)) {
        setDoc(snap.ref, { role: 'Admin', isApproved: true }, { merge: true }).catch(console.error);
        data.role = 'Admin';
        data.isApproved = true;
      }
      setProfile(data);
      setProfileState('ready');
    }, err => {
      console.error('Profile sync error:', err);
      setProfileState('missing');
    });
  }, [user]);

  const data = useAppData(profile?.isApproved ? user : null);

  const content = (() => {
    if (!authReady) return <Splash />;
    if (!user) return <AuthScreen onProfileCreated={p => { setProfile(p); setProfileState('ready'); }} />;
    if (profileState === 'loading' || profileState === 'idle') return <Splash label="Caricamento profilo…" />;
    if (profileState === 'missing' || !profile) return <MissingProfile user={user} />;
    if (profile.mustChangePassword && !passwordChanged) return <ForcePasswordChange profile={profile} onDone={() => setPasswordChanged(true)} />;
    if (!profile.isApproved) return <PendingApproval profile={profile} />;
    if (!data.ready) return <Splash label="Sincronizzazione dati…" />;
    return <MainApp realProfile={profile} data={data} themeCtl={themeCtl} />;
  })();

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors closeButton theme={themeCtl.isDark ? 'dark' : 'light'} toastOptions={{ style: { borderRadius: 14 } }} />
      {content}
    </ErrorBoundary>
  );
}

/** Account autenticato ma senza documento profilo (es. registrazione interrotta). */
function MissingProfile({ user }: { user: FirebaseUser }) {
  const [loading, setLoading] = useState(false);
  const create = async () => {
    setLoading(true);
    const fromEmail = user.email?.endsWith(`@${VIRTUAL_EMAIL_DOMAIN}`) ? user.email.split('@')[0] : null;
    const role: UserRole = 'Player';
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      username: fromEmail || user.displayName || `user_${user.uid.slice(0, 5)}`,
      firstName: '', lastName: '', role, score: 0, isApproved: true, badges: [],
    } satisfies UserProfile).catch(err => console.error(err));
    setLoading(false);
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-md p-8 text-center shadow-pop">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning"><UserX className="h-7 w-7" /></div>
        <h2 className="mt-5 text-2xl font-bold text-fg">Profilo non trovato</h2>
        <p className="mt-2 text-muted">Il tuo account esiste ma il profilo di gioco non è stato completato. Puoi crearlo ora come Player.</p>
        <div className="mt-7 flex flex-col gap-2">
          <Button onClick={create} loading={loading}>Crea il mio profilo</Button>
          <Button variant="ghost" onClick={() => signOut(auth)}><LogOut className="h-4 w-4" /> Esci</Button>
        </div>
      </Card>
    </div>
  );
}

export function MainApp({ realProfile, data, themeCtl }: { realProfile: UserProfile; data: ReturnType<typeof useAppData>; themeCtl: ReturnType<typeof useTheme> }) {
  const [page, setPage] = useState<PageId>(readHash);
  const [selectedArea, setSelectedArea] = useState<string>('Tutte');
  const [simulatedUid, setSimulatedUid] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ open: boolean; task?: Task }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Il profilo simulato è sempre letto dai dati live, così riflette subito punteggi e badge aggiornati
  const simulated = simulatedUid ? data.users.find(u => u.uid === simulatedUid) || null : null;
  const profile = simulated || realProfile;

  const navigate = useCallback((p: PageId) => {
    setPage(p);
    if (window.location.hash !== `#/${p}`) window.history.pushState(null, '', `#/${p}`);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setPage(readHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Protegge le pagine riservate se il ruolo (o la simulazione) non le consente
  useEffect(() => {
    if ((MANAGER_PAGES.includes(page) && !isManager(profile.role)) || (page === 'settings' && (realProfile.role !== 'Admin' || simulated))) {
      navigate('dashboard');
    }
  }, [page, profile.role, realProfile.role, simulated, navigate]);

  const visibleTasks = useMemo(
    () => profile.role === 'Player' ? data.tasks.filter(t => t.assignees.includes(profile.uid)) : data.tasks,
    [data.tasks, profile],
  );

  const userMap = useMemo(() => new Map(data.users.map(u => [u.uid, u])), [data.users]);

  const ctx: AppContextValue = {
    data,
    profile,
    realProfile,
    isSimulating: !!simulated,
    selectedArea,
    setSelectedArea,
    visibleTasks,
    navigate,
    openTask: t => setDetailId(t.id),
    openTaskForm: t => setTaskForm({ open: true, task: t }),
    openValidation: t => { setDetailId(null); setValidationId(t.id); },
    userById: uid => userMap.get(uid),
  };

  const detailTask = detailId ? data.tasks.find(t => t.id === detailId) || null : null;
  const validationTask = validationId ? data.tasks.find(t => t.id === validationId && t.status === 'In Revisione') || null : null;

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const ok = await deleteTask(toDelete);
    setDeleting(false);
    if (ok) {
      if (detailId === toDelete.id) setDetailId(null);
      setToDelete(null);
    }
  };

  return (
    <AppProvider value={ctx}>
      <Shell page={page} themeCtl={themeCtl} onOpenProfile={() => setProfileOpen(true)} onExitSimulation={() => { setSimulatedUid(null); navigate('people'); }}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'tasks' && <TasksPage onDelete={setToDelete} />}
        {page === 'challenges' && <ChallengesPage />}
        {page === 'rewards' && <RewardsPage />}
        {page === 'planning' && <PlanningPage />}
        {page === 'leaderboard' && <LeaderboardPage />}
        {page === 'review' && <ReviewPage />}
        {page === 'people' && <PeoplePage onSimulate={u => { setSimulatedUid(u.uid); navigate('dashboard'); }} />}
        {page === 'logs' && <LogsPage />}
        {page === 'settings' && <SettingsPage />}
      </Shell>

      <TaskFormModal open={taskForm.open} task={taskForm.task} onClose={() => setTaskForm({ open: false })} />
      <TaskDetailModal task={detailTask} onClose={() => setDetailId(null)} onDelete={setToDelete} />
      <ValidationModal task={validationTask} onClose={() => setValidationId(null)} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} profile={realProfile} theme={themeCtl.theme} setTheme={themeCtl.setTheme} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} loading={deleting} icon={<Trash2 />}
        title="Eliminare il task?" confirmLabel="Elimina"
        message={<>Il task <strong className="text-fg">{toDelete?.title}</strong> verrà eliminato definitivamente.</>} />
    </AppProvider>
  );
}

function Shell({ page, themeCtl, onOpenProfile, onExitSimulation, children }: {
  page: PageId;
  themeCtl: ReturnType<typeof useTheme>;
  onOpenProfile: () => void;
  onExitSimulation: () => void;
  children: React.ReactNode;
}) {
  const review = useReviewItems();
  const items = useNavItems(review.total);
  return (
    <AppShell page={page} items={items} onLogout={() => signOut(auth)} onOpenProfile={onOpenProfile} onExitSimulation={onExitSimulation}
      isDark={themeCtl.isDark} toggleTheme={themeCtl.toggle}>
      {children}
    </AppShell>
  );
}
