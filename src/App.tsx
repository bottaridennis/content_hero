import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser,
  getAuth,
  deleteUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  increment,
  writeBatch,
  deleteField,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { UserProfile, Task, UserRole, TaskDifficulty, TaskStatus, BonusPenalty, Badge, Area, AREAS, Reward, Challenge } from './types';
import { DIFFICULTY_SCORES, BONUSES, PENALTIES, BADGES } from './constants';
import { 
  LayoutDashboard, 
  Plus, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trophy, 
  User as UserIcon,
  ChevronRight,
  Shield,
  Gamepad2,
  Calendar,
  Filter,
  X,
  Check,
  MinusCircle,
  PlusCircle,
  ShieldAlert,
  ExternalLink,
  Eye,
  EyeOff,
  Star,
  Crown,
  Zap,
  Target,
  Flame,
  Medal,
  Trash2,
  Settings,
  Lock,
  UserCircle,
  ChevronDown,
  Layout,
  Users,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  isAfter, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isWeekend, 
  addDays, 
  isSameMonth, 
  isToday, 
  isSameDay,
  startOfDay,
  endOfDay,
  differenceInDays,
  differenceInMinutes
} from 'date-fns';
import { Toaster, toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types & Constants ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Errore di database (${operationType} su ${path}): ${errInfo.error}`);
}

// --- Utilities ---

const WORKING_HOURS_PER_DAY = 9; // 9:00 - 18:00

const isItalianHoliday = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month === 1 && day === 1) return true;
  if (month === 1 && day === 6) return true;
  if (month === 4 && day === 25) return true;
  if (month === 5 && day === 1) return true;
  if (month === 6 && day === 2) return true;
  if (month === 8 && day === 15) return true;
  if (month === 11 && day === 1) return true;
  if (month === 12 && day === 8) return true;
  if (month === 12 && day === 25) return true;
  if (month === 12 && day === 26) return true;

  const getEaster = (y: number) => {
    const f = Math.floor,
      G = y % 19,
      C = f(y / 100),
      H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
      I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
      J = (y + f(y / 4) + I + 2 - C + f(C / 4)) % 7,
      L = I - J,
      m = 3 + f((L + 40) / 44),
      d = L + 28 - 31 * f(m / 4);
    return new Date(y, m - 1, d);
  };

  const easter = getEaster(year);
  const easterMonday = addDays(easter, 1);
  return isSameDay(date, easterMonday);
};

const calculateEndDate = (startDate: Date, durationHours: number) => {
  let remainingHours = durationHours;
  let currentDate = new Date(startDate);
  
  // If start is weekend or holiday, move to next working day 9:00
  while (isWeekend(currentDate) || isItalianHoliday(currentDate)) {
    currentDate = addDays(currentDate, 1);
    currentDate.setHours(9, 0, 0, 0);
  }
  
  while (remainingHours > 0) {
    // If weekend or holiday, skip
    if (isWeekend(currentDate) || isItalianHoliday(currentDate)) {
      currentDate = addDays(currentDate, 1);
      currentDate.setHours(9, 0, 0, 0);
      continue;
    }
    
    const hoursLeftInDay = Math.max(0, 18 - currentDate.getHours());
    const hoursToTake = Math.min(remainingHours, hoursLeftInDay);
    
    remainingHours -= hoursToTake;
    
    if (remainingHours > 0) {
      currentDate = addDays(currentDate, 1);
      currentDate.setHours(9, 0, 0, 0);
    } else {
      currentDate.setHours(currentDate.getHours() + hoursToTake);
    }
  }
  return currentDate;
};

const calculateSequentialTimeline = (tasks: Task[], users: UserProfile[]) => {
  const activeTasks = tasks.filter(t => t.estimatedHours && t.status !== 'Completato');
  const userTimelines: Record<string, { taskId: string, start: Date, end: Date }[]> = {};

  // Initialize timelines for all users
  users.forEach(u => {
    userTimelines[u.uid] = [];
  });

  // For each user, calculate their sequential task timeline
  users.forEach(u => {
    const userTasks = activeTasks
      .filter(t => t.assignees.includes(u.uid))
      .sort((a, b) => {
        const aAccepted = a.logs.acceptedAt ? parseISO(a.logs.acceptedAt).getTime() : parseISO(a.createdAt).getTime();
        const bAccepted = b.logs.acceptedAt ? parseISO(b.logs.acceptedAt).getTime() : parseISO(b.createdAt).getTime();
        return aAccepted - bAccepted;
      });

    let currentPointer: Date | null = null;

    userTasks.forEach(task => {
      const durationPerPerson = task.estimatedHours! / task.assignees.length;
      const taskAcceptedAt = task.logs.acceptedAt ? parseISO(task.logs.acceptedAt) : parseISO(task.createdAt);
      
      // Start is either the end of previous task or the acceptance date of this task, whichever is later
      let startDate = currentPointer && isAfter(currentPointer, taskAcceptedAt) ? currentPointer : taskAcceptedAt;
      
      const endDate = calculateEndDate(startDate, durationPerPerson);
      userTimelines[u.uid].push({ taskId: task.id, start: startDate, end: endDate });
      currentPointer = endDate;
    });
  });

  // Aggregate user timelines back to tasks
  return activeTasks.map(task => {
    const taskUserTimelines = Object.values(userTimelines)
      .map(timeline => timeline.find(item => item.taskId === task.id))
      .filter(Boolean) as { start: Date, end: Date }[];

    if (taskUserTimelines.length === 0) {
      // Fallback if no user timelines found (shouldn't happen)
      const startDate = parseISO(task.createdAt);
      return { ...task, calculatedStartDate: startDate, calculatedEndDate: calculateEndDate(startDate, task.estimatedHours! / task.assignees.length) };
    }

    const calculatedStartDate = new Date(Math.min(...taskUserTimelines.map(t => t.start.getTime())));
    const calculatedEndDate = new Date(Math.max(...taskUserTimelines.map(t => t.end.getTime())));

    return { ...task, calculatedStartDate, calculatedEndDate };
  });
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'default' | 'sm' | 'icon' }>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
      secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    };
    const sizes = {
      default: 'px-4 py-2 text-sm',
      sm: 'px-3 py-1.5 text-xs',
      icon: 'p-2',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

// --- Main App ---

const BadgeIcon = ({ name, className }: { name: string, className?: string }) => {
  switch (name) {
    case 'Star': return <Star className={className} />;
    case 'Shield': return <Shield className={className} />;
    case 'Crown': return <Crown className={className} />;
    case 'Trophy': return <Trophy className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Target': return <Target className={className} />;
    case 'Flame': return <Flame className={className} />;
    default: return <Medal className={className} />;
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedProfile, setSimulatedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [selectedArea, setSelectedArea] = useState<Area | 'Tutte'>('Tutte');

  // Dynamic Metadata
  const [areas, setAreas] = useState<Area[]>(AREAS);
  const [badges, setBadges] = useState<Badge[]>(BADGES);
  const [bonuses, setBonuses] = useState<BonusPenalty[]>(BONUSES);
  const [penalties, setPenalties] = useState<BonusPenalty[]>(PENALTIES);
  const [rewards, setRewards] = useState<Reward[]>([
    { id: 'coffee', name: 'Caffè Offerto', cost: 500, icon: 'Zap', color: 'text-amber-500' },
    { id: 'lunch', name: 'Pranzo Offerto', cost: 2000, icon: 'Medal', color: 'text-indigo-500' },
    { id: 'dayoff', name: 'Mezza Giornata Off', cost: 5000, icon: 'Crown', color: 'text-rose-500' },
  ]);

  useEffect(() => {
    console.log("Initializing Auth listener...");
    const fallbackTimer = setTimeout(() => {
      if (loading) {
        console.warn("Auth listener timed out, forcing loading to false");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid || "No user");
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        clearTimeout(fallbackTimer);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (user.email === 'dennisbottari@gmail.com' && (data.role !== 'Admin' || !data.isApproved)) {
          const updatedProfile = { ...data, role: 'Admin' as UserRole, isApproved: true, badges: data.badges || [] };
          setDoc(docRef, updatedProfile, { merge: true });
          setProfile(updatedProfile);
        } else {
          setProfile({ ...data, badges: data.badges || [] });
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile sync error:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });

    const usersQuery = query(collection(db, 'users'), orderBy('score', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const challengesQuery = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'));
    const unsubscribeChallenges = onSnapshot(challengesQuery, (snapshot) => {
      setChallenges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'challenges');
    });

    // Metadata Sync
    const unsubscribeMetadata = onSnapshot(collection(db, 'metadata'), (snapshot) => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        switch (doc.id) {
          case 'areas': if (data.list) setAreas(data.list); break;
          case 'badges': if (data.list) setBadges(data.list); break;
          case 'bonuses': if (data.list) setBonuses(data.list); break;
          case 'penalties': if (data.list) setPenalties(data.list); break;
          case 'rewards': if (data.list) setRewards(data.list); break;
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'metadata');
    });

    return () => {
      unsubscribeTasks();
      unsubscribeUsers();
      unsubscribeChallenges();
      unsubscribeMetadata();
    };
  }, [user]);

  const handleLogout = () => signOut(auth);

  const activeProfile = simulatedProfile || profile;

  const visibleTasks = React.useMemo(() => {
    if (!activeProfile) return [];
    if (activeProfile.role === 'Player') {
      return tasks.filter(t => t.assignees.includes(activeProfile.uid));
    }
    return tasks;
  }, [tasks, activeProfile]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-slate-500 text-sm font-medium">Inizializzazione in corso...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthScreen onProfileCreated={setProfile} />;
  }

  const currentProfile = activeProfile;

  if (profile && profile.mustChangePassword && !simulatedProfile) {
    return (
      <ForcePasswordChangeModal 
        profile={profile} 
        onPasswordChanged={() => setProfile(prev => prev ? { ...prev, mustChangePassword: false } : null)} 
      />
    );
  }

  if (!currentProfile.isApproved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-lg shadow-amber-50">
            <Clock className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">In attesa di approvazione</h2>
          <p className="mt-2 text-slate-500">
            Il tuo account come <strong>Responsabile</strong> deve essere confermato dall'amministratore prima di poter accedere.
          </p>
          <div className="pt-4">
            <Button variant="outline" onClick={handleLogout} className="w-full gap-2">
              <LogOut className="h-4 w-4" /> Esci
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-x-hidden">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-white/60 backdrop-blur-2xl shadow-soft">
          <div className="container mx-auto flex h-20 items-center justify-between px-6 sm:px-10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-200/50 animate-float">
                <Gamepad2 className="h-7 w-7" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-slate-900 leading-none">
                  Content Hero {simulatedProfile && <span className="text-[10px] text-rose-500 font-black uppercase tracking-tighter ml-1">TEST</span>}
                </h1>
                <p className="hidden xs:block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">
                  {simulatedProfile ? `Simulazione: ${simulatedProfile.username}` : 'Gamified Management'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              {simulatedProfile && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSimulatedProfile(null)}
                  className="h-9 text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-2xl px-5"
                >
                  Esci Test
                </Button>
              )}
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100/80 px-4 py-2.5 border border-slate-200/50 shadow-inner">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="text-sm sm:text-base font-black font-display text-slate-700">{currentProfile.score} <span className="hidden xs:inline text-[10px] text-slate-400 ml-0.5">XP</span></span>
              </div>
              <div className="flex items-center gap-3 sm:gap-5 border-l border-slate-200/60 pl-4 sm:pl-6">
                <div className="text-right hidden md:block">
                  <p className="text-base font-black font-display text-slate-900 leading-none">{currentProfile.username}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                    {currentProfile.role === 'Admin' ? 'Administrator' : currentProfile.role === 'Responsabile' ? 'Manager' : 'Player'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowProfileModal(true)} className="rounded-2xl h-11 w-11 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all">
                    <Settings className="h-5 w-5 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-2xl h-11 w-11 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-200 transition-all">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 sm:py-10 sm:px-6">
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-[1fr_320px]">
            {/* Main Content */}
            <div className="space-y-8 sm:space-y-10 order-2 lg:order-1">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-4xl font-black font-display text-slate-900 tracking-tight">
                    {currentProfile.role === 'Admin' ? 'Pannello Admin' : currentProfile.role === 'Responsabile' ? 'Gestione Task' : 'I Miei Task'}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {(currentProfile.role === 'Responsabile' || currentProfile.role === 'Admin')
                      ? 'Crea e valida i task per il tuo team.' 
                      : 'Completa i task assegnati per guadagnare XP.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-wrap rounded-2xl bg-slate-100/80 p-1.5 shadow-inner border border-slate-200/50 backdrop-blur-sm">
                    {[
                      { id: 'dashboard', label: 'Dashboard' },
                      { id: 'tasks', label: 'Task' },
                      { id: 'challenges', label: 'Sfide' },
                      { id: 'gantt', label: 'Gantt' },
                      { id: 'calendar', label: 'Calendario' },
                      { id: 'history', label: 'Storico' },
                      { id: 'achievements', label: 'Traguardi' },
                      ...(currentProfile.role === 'Admin' || currentProfile.role === 'Responsabile' ? [
                        { id: 'team', label: 'Team' },
                        { id: 'logs', label: 'Log' },
                        { id: 'users', label: 'Utenti' }
                      ] : []),
                      ...(currentProfile.role === 'Admin' ? [
                        { id: 'settings', label: 'Config' }
                      ] : [])
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                          activeTab === tab.id ? "bg-white text-indigo-600 shadow-elegant" : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <select
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value as any)}
                        className="appearance-none rounded-2xl border border-slate-200 bg-white pl-5 pr-10 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-soft cursor-pointer hover:border-indigo-300 transition-all"
                      >
                        <option value="Tutte">Tutte le Aree</option>
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>

                    {(currentProfile.role === 'Responsabile' || currentProfile.role === 'Admin') && (
                      <Button onClick={() => setShowTaskForm(true)} className="gap-2 shrink-0 py-3.5 px-6 rounded-2xl btn-primary shadow-elegant hover:scale-105 transition-transform">
                        <Plus className="h-4 w-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Nuovo Task</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {activeTab === 'dashboard' ? (
                <AreaDashboard tasks={visibleTasks} users={users} selectedArea={selectedArea} />
              ) : activeTab === 'tasks' ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleTasks
                    .filter(t => t.status !== 'Completato')
                    .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
                    .map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        role={currentProfile.role} 
                        currentUid={currentProfile.uid}
                        users={users}
                        onAction={(t) => {
                          setSelectedTask(t);
                          if ((currentProfile.role === 'Responsabile' || currentProfile.role === 'Admin') && (t.status === 'In Revisione' || t.status === 'In corso')) {
                            setShowScoringModal(true);
                          }
                        }}
                        onEdit={(t) => {
                          setTaskToEdit(t);
                          setShowTaskForm(true);
                        }}
                        onDelete={(t) => {
                          setTaskToDelete(t);
                        }}
                      />
                    ))}
                </div>
              ) : activeTab === 'gantt' ? (
                <GanttChart 
                  tasks={visibleTasks
                    .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
                  } 
                  users={users.filter(u => selectedArea === 'Tutte' || u.area === selectedArea)} 
                  currentProfile={currentProfile} 
                />
              ) : activeTab === 'calendar' ? (
                <CalendarView 
                  tasks={visibleTasks
                    .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
                  } 
                  users={users}
                />
              ) : activeTab === 'team' ? (
                <TeamManagement 
                  users={users} 
                  currentProfile={currentProfile}
                  onUpdateUser={async (uid, updates) => {
                    try {
                      await updateDoc(doc(db, 'users', uid), updates);
                      toast.success("Utente aggiornato con successo!");
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
                    }
                  }}
                />
              ) : activeTab === 'achievements' ? (
                <AchievementsView 
                  profile={currentProfile} 
                  tasks={visibleTasks}
                  badges={badges}
                  rewards={rewards}
                />
              ) : activeTab === 'challenges' ? (
                <ChallengesView 
                  challenges={challenges} 
                  currentProfile={currentProfile}
                />
              ) : activeTab === 'settings' ? (
                <SettingsView 
                  areas={areas}
                  badges={badges}
                  bonuses={bonuses}
                  penalties={penalties}
                  rewards={rewards}
                />
              ) : activeTab === 'history' ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleTasks
                    .filter(t => t.status === 'Completato')
                    .filter(t => selectedArea === 'Tutte' || t.area === selectedArea)
                    .map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        role={currentProfile.role} 
                        currentUid={currentProfile.uid}
                        users={users}
                        onAction={() => {}}
                      />
                    ))}
                </div>
              ) : activeTab === 'logs' ? (
                <TaskLogsView 
                  tasks={visibleTasks.filter(t => selectedArea === 'Tutte' || t.area === selectedArea)} 
                  users={users} 
                  isAdmin={profile.role === 'Admin'} 
                  onDeleteTask={async (taskId) => {
                    try {
                      await deleteDoc(doc(db, 'tasks', taskId));
                      toast.success("Log eliminato con successo!");
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
                    }
                  }}
                />
              ) : (
                <UserManagement 
                  users={users.filter(u => {
                    const matchesArea = selectedArea === 'Tutte' || u.area === selectedArea;
                    if (!matchesArea) return false;
                    if (profile.role === 'Admin') return true;
                    return u.role === 'Player' && u.responsabileUids?.includes(profile.uid);
                  })} 
                  currentRole={profile.role}
                  areas={areas}
                  onSimulate={(u) => {
                    setSimulatedProfile(u);
                    setActiveTab('tasks');
                  }}
                  onUpdateUser={async (uid, updates) => {
                  try {
                    const userRef = doc(db, 'users', uid);
                    
                    if (updates.score !== undefined) {
                      const userSnap = await getDoc(userRef);
                      if (userSnap.exists()) {
                        const userProfile = userSnap.data() as UserProfile;
                        
                        // Fetch completed tasks for badge check
                        const q = query(
                          collection(db, 'tasks'),
                          where('assignees', 'array-contains', uid),
                          where('status', '==', 'Completato')
                        );
                        const completedTasksSnap = await getDocs(q);
                        const completedTasks = completedTasksSnap.docs.map(d => d.data() as Task);
                        
                        const updatedProfileForCheck = { ...userProfile, score: updates.score };
                        const newBadgeIds = checkAndAwardBadges(updatedProfileForCheck, completedTasks, badges);
                        
                        if (newBadgeIds.length > 0) {
                          updates.badges = [...(userProfile.badges || []), ...newBadgeIds];
                          newBadgeIds.forEach(bid => {
                            const b = badges.find(badge => badge.id === bid);
                            if (b) toast.success(`Nuovo Badge per ${userProfile.username}: ${b.name}!`, { icon: '🏆' });
                          });
                        }
                      }
                    }

                    await setDoc(userRef, updates, { merge: true });
                    toast.success("Utente aggiornato con successo!");
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
                  }
                }} onDeleteUser={async (uid) => {
                  try {
                    // Find the user to get their username and firstName (for the default password)
                    const userToDelete = users.find(u => u.uid === uid);
                    if (userToDelete) {
                      const sanitizedUsername = userToDelete.username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                      const email = `${sanitizedUsername}@gamified-tasks.local`;
                      const defaultPassword = `${userToDelete.firstName || ''}123`;

                      try {
                        // Attempt to delete from Auth using a secondary app
                        const secondaryApp = initializeApp(firebaseConfig, `DeleteUser_${Date.now()}`);
                        const secondaryAuth = getAuth(secondaryApp);
                        
                        // Sign in as the user to delete their account
                        const { user: authUser } = await signInWithEmailAndPassword(secondaryAuth, email, defaultPassword);
                        await deleteUser(authUser);
                        await deleteApp(secondaryApp);
                        console.log(`Auth account deleted for ${email}`);
                      } catch (authError) {
                        // If password was changed or other auth error, we still proceed with Firestore deletion
                        console.warn("Could not delete Auth account (password might have been changed or user not found):", authError);
                      }
                    }

                    // Delete from Firestore
                    await deleteDoc(doc(db, 'users', uid));
                    toast.success("Utente e dati associati eliminati con successo!");
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
                  }
                }} />
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-10 order-1 lg:order-2">
              {/* Leaderboard */}
              <div className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-10 shadow-elegant overflow-hidden relative group">
                <div className="absolute top-0 right-0 -mr-12 -mt-12 h-32 w-32 bg-amber-50 rounded-full blur-3xl opacity-50 group-hover:bg-amber-100 transition-colors duration-500" />
                <div className="mb-8 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                      <Trophy className="h-6 w-6 text-amber-500" />
                    </div>
                    <h3 className="font-black font-display text-slate-900 tracking-tight text-xl">Classifica</h3>
                  </div>
                  <div className="h-1.5 w-12 rounded-full bg-amber-100" />
                </div>
                <div className="space-y-4 relative z-10">
                    {users
                      .filter(u => u.role === 'Player' || u.role === 'Responsabile')
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 5)
                      .map((u, i) => (
                        <div key={u.uid} className={cn(
                          "flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border border-transparent",
                          currentProfile.uid === u.uid ? "bg-indigo-50 border-indigo-100 shadow-sm" : "hover:bg-slate-50 hover:border-slate-100"
                        )}>
                          <div className="flex items-center gap-4">
                          <span className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black border-2 transition-transform duration-300",
                            i === 0 ? "bg-amber-100 border-amber-200 text-amber-600 scale-110" : 
                            i === 1 ? "bg-slate-100 border-slate-200 text-slate-600" :
                            i === 2 ? "bg-orange-100 border-orange-200 text-orange-600" : "bg-white border-slate-100 text-slate-400"
                          )}>
                            {i + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-base font-black font-display text-slate-900 leading-none">{u.username}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase mt-1.5 tracking-widest">{u.role}</span>
                          </div>
                        </div>
                        <span className="text-sm font-black font-display text-indigo-600 bg-white px-3 py-1 rounded-full border border-indigo-50 shadow-sm">{u.score} XP</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Badges Section */}
              {currentProfile.role === 'Player' && (
                <div className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-10 shadow-elegant group">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                        <Medal className="h-6 w-6 text-indigo-500" />
                      </div>
                      <h3 className="font-black font-display text-slate-900 tracking-tight text-xl">I Tuoi Badge</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200/50">
                      {currentProfile.badges?.length || 0} / {BADGES.length}
                    </span>
                  </div>
                  
                  {(!currentProfile.badges || currentProfile.badges.length === 0) ? (
                    <div className="rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 p-6 text-center">
                      <p className="text-xs text-slate-400 italic font-medium">Completa task per guadagnare badge!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {BADGES.map(badge => {
                        const isEarned = currentProfile.badges?.includes(badge.id);
                        return (
                          <div 
                            key={badge.id}
                            className={cn(
                              "group relative flex flex-col items-center justify-center rounded-2xl border p-3 transition-all",
                              isEarned ? "border-indigo-100 bg-indigo-50/50 shadow-sm" : "border-slate-100 bg-slate-50/30 opacity-40 grayscale"
                            )}
                          >
                            <BadgeIcon name={badge.icon} className={cn("h-7 w-7", isEarned ? badge.color : "text-slate-400")} />
                            
                            {/* Tooltip - Adjusted for mobile */}
                            <div className="absolute bottom-full left-1/2 mb-3 hidden w-40 sm:w-56 -translate-x-1/2 flex-col items-center group-hover:flex z-50 pointer-events-none">
                              <div className="rounded-2xl bg-slate-900/95 backdrop-blur-sm p-4 text-center shadow-2xl">
                                <p className="text-xs font-black font-display text-white uppercase tracking-wider">{badge.name}</p>
                                <p className="mt-1.5 text-[10px] font-medium text-slate-400 leading-relaxed">{badge.description}</p>
                              </div>
                              <div className="h-2 w-2 rotate-45 bg-slate-900 -mt-1"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">Riepilogo</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-xl bg-indigo-50 p-3 text-center">
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">In Corso</p>
                    <p className="text-xl sm:text-2xl font-bold text-indigo-900">
                      {visibleTasks.filter(t => t.status === 'In corso').length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Finiti</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-900">
                      {visibleTasks.filter(t => t.status === 'Completato').length}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        {/* Modals */}
        <AnimatePresence>
          {showTaskForm && profile && (
            <TaskFormModal 
              onClose={() => {
                setShowTaskForm(false);
                setTaskToEdit(null);
              }} 
              players={users.filter(u => 
                (profile.role === 'Admin') || 
                (u.uid === profile.uid) || 
                (u.role === 'Player' && u.responsabileUids?.includes(profile.uid)) ||
                (profile.role === 'Responsabile' && u.role === 'Responsabile')
              )}
              creatorUid={profile.uid}
              task={taskToEdit || undefined}
              areas={areas}
            />
          )}
          {taskToDelete && (
            <DeleteTaskModal 
              task={taskToDelete} 
              onClose={() => setTaskToDelete(null)} 
              onConfirm={async () => {
                try {
                  await deleteDoc(doc(db, 'tasks', taskToDelete.id));
                  toast.success("Task eliminato con successo!");
                  setTaskToDelete(null);
                } catch (error) {
                  handleFirestoreError(error, OperationType.DELETE, `tasks/${taskToDelete.id}`);
                }
              }} 
            />
          )}
          {showScoringModal && selectedTask && (
            <ScoringModal 
              task={selectedTask} 
              onClose={() => {
                setShowScoringModal(false);
                setSelectedTask(null);
              }} 
              bonuses={bonuses}
              penalties={penalties}
              badges={badges}
            />
          )}

          {showProfileModal && profile && (
            <ProfileModal 
              profile={profile} 
              onClose={() => setShowProfileModal(false)} 
              onUpdateProfile={(updates) => setProfile(prev => prev ? { ...prev, ...updates } : null)}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

function AreaDashboard({ tasks, users, selectedArea }: { tasks: Task[], users: UserProfile[], selectedArea: Area | 'Tutte' }) {
  const filteredTasks = tasks.filter(t => selectedArea === 'Tutte' || t.area === selectedArea);
  const areaUsers = users.filter(u => selectedArea === 'Tutte' || u.area === selectedArea);

  const statusData = [
    { name: 'Completati', value: filteredTasks.filter(t => t.status === 'Completato').length, color: '#10b981' },
    { name: 'In Corso', value: filteredTasks.filter(t => t.status === 'In corso').length, color: '#6366f1' },
    { name: 'In Revisione', value: filteredTasks.filter(t => t.status === 'In Revisione').length, color: '#f59e0b' },
    { name: 'In Attesa', value: filteredTasks.filter(t => t.status === 'In attesa').length, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  const difficultyData = [
    { name: 'Rame', value: filteredTasks.filter(t => t.difficulty === 'Rame').length, color: '#ea580c' },
    { name: 'Bronzo', value: filteredTasks.filter(t => t.difficulty === 'Bronzo').length, color: '#d97706' },
    { name: 'Argento', value: filteredTasks.filter(t => t.difficulty === 'Argento').length, color: '#475569' },
    { name: 'Oro', value: filteredTasks.filter(t => t.difficulty === 'Oro').length, color: '#ca8a04' },
    { name: 'Platino', value: filteredTasks.filter(t => t.difficulty === 'Platino').length, color: '#4f46e5' },
  ];

  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Task Totali', value: filteredTasks.length, icon: Layout, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'XP Area', value: filteredTasks.reduce((acc, t) => acc + (t.finalScore || 0), 0), icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completati', value: filteredTasks.filter(t => t.status === 'Completato').length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Player Attivi', value: areaUsers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-[2.5rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-8 shadow-elegant hover:scale-[1.02] transition-all duration-500 group"
          >
            <div className={cn("mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:rotate-12", stat.bg)}>
              <stat.icon className={cn("h-7 w-7", stat.color)} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            <p className="mt-2 text-4xl font-black font-display text-slate-900 tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-10 shadow-elegant"
        >
          <div className="mb-10 flex items-center justify-between">
            <h3 className="text-2xl font-black font-display text-slate-900 tracking-tight">Distribuzione Stati</h3>
            <div className="h-2 w-24 rounded-full bg-indigo-100" />
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={90}
                  outerRadius={120}
                  paddingAngle={10}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-10 shadow-elegant"
        >
          <div className="mb-10 flex items-center justify-between">
            <h3 className="text-2xl font-black font-display text-slate-900 tracking-tight">Difficoltà Task</h3>
            <div className="h-2 w-24 rounded-full bg-amber-100" />
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.1)', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={48}>
                  {difficultyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-10 shadow-elegant"
      >
        <div className="mb-10 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-2xl font-black font-display text-slate-900 tracking-tight">Top 5 Player Area</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Classifica basata sugli XP totali</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <Trophy className="h-7 w-7 text-amber-500" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {areaUsers
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((u, i) => (
              <div key={u.uid} className="group relative flex flex-col items-center rounded-[2.5rem] border border-slate-100 bg-slate-50/50 p-8 transition-all duration-500 hover:bg-white hover:shadow-elegant hover:-translate-y-2">
                <div className={cn(
                  "absolute -top-4 -left-4 flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black border-4 border-white shadow-xl",
                  i === 0 ? "bg-amber-400 text-white scale-110" : 
                  i === 1 ? "bg-slate-300 text-white" :
                  i === 2 ? "bg-orange-400 text-white" : "bg-white text-slate-400"
                )}>
                  {i + 1}
                </div>
                <div className="mb-6 h-20 w-20 rounded-[2rem] bg-indigo-100 flex items-center justify-center text-2xl font-black text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                  {u.username.substring(0, 2).toUpperCase()}
                </div>
                <p className="text-center font-black font-display text-slate-900 line-clamp-1 text-lg">{u.username}</p>
                <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm border border-slate-100">
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-black text-slate-700">{u.score}</span>
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {(u.badges || []).slice(0, 3).map((bid, idx) => (
                    <div key={idx} className="h-7 w-7 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                      <Medal className="h-4 w-4 text-indigo-500" />
                    </div>
                  ))}
                  {(u.badges || []).length === 0 && (
                    <div className="h-7 w-7 rounded-xl bg-slate-100/50 border border-dashed border-slate-200 flex items-center justify-center" />
                  )}
                </div>
              </div>
            ))}
        </div>
      </motion.div>
    </div>
  );
}

function ForcePasswordChangeModal({ profile, onPasswordChanged }: { profile: UserProfile, onPasswordChanged: () => void }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("Le password non coincidono!");
    if (newPassword.length < 6) return toast.error("La password deve avere almeno 6 caratteri.");
    
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Utente non autenticato");

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      await setDoc(doc(db, 'users', profile.uid), { mustChangePassword: false }, { merge: true });
      
      toast.success("Password aggiornata! Benvenuto.");
      onPasswordChanged();
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        toast.error("Password attuale errata.");
      } else {
        toast.error("Errore: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-slate-900">Cambio Password Obbligatorio</h2>
          <p className="mt-2 text-slate-500">Per la tua sicurezza, devi cambiare la password predefinita al primo accesso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Password Attuale</label>
            <Input 
              type="password" 
              value={currentPassword} 
              onChange={e => setCurrentPassword(e.target.value)} 
              placeholder="La password Nome123 ricevuta"
              required 
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Nuova Password</label>
            <Input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Minimo 6 caratteri"
              required 
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Conferma Nuova Password</label>
            <Input 
              type="password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              placeholder="Ripeti la nuova password"
              required 
            />
          </div>
          <Button type="submit" className="w-full py-6" disabled={loading}>
            {loading ? 'Aggiornamento...' : 'Aggiorna Password'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => signOut(auth)}>Esci</Button>
        </form>
      </motion.div>
    </div>
  );
}

function ProfileModal({ profile, onClose, onUpdateProfile }: { 
  profile: UserProfile, 
  onClose: () => void, 
  onUpdateProfile: (updates: Partial<UserProfile>) => void 
}) {
  const [username, setUsername] = useState(profile.username || '');
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Lo username è obbligatorio");
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim()
      }, { merge: true });
      onUpdateProfile({ username: username.trim(), firstName: firstName.trim(), lastName: lastName.trim() });
      toast.success("Profilo aggiornato!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Le password non coincidono!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri.");
      return;
    }

    setPasswordLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Utente non autenticato");

      // Re-authenticate if necessary (for security, Firebase requires recent login to change password)
      if (user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      
      // Clear mustChangePassword flag in Firestore
      if (profile.mustChangePassword) {
        await setDoc(doc(db, 'users', profile.uid), { mustChangePassword: false }, { merge: true });
        onUpdateProfile({ mustChangePassword: false });
      }

      toast.success("Password aggiornata con successo!");
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        toast.error("Password attuale errata.");
      } else if (error.code === 'auth/requires-recent-login') {
        toast.error("Per favore, effettua nuovamente l'accesso per cambiare la password.");
      } else {
        toast.error("Errore durante il cambio password: " + error.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md max-h-[95vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            <h2 className="text-base sm:text-xl font-bold">Area Personale</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10">
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto">
          {/* Name Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
              <UserIcon className="h-4 w-4 text-indigo-500" /> Informazioni Personali
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Username"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Nome</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Cognome</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Cognome"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full py-2.5 sm:py-3" disabled={loading}>
                {loading ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
            </form>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Password Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
              <Lock className="h-4 w-4 text-indigo-500" /> Cambia Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Password Attuale</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Conferma Nuova Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 py-2.5 sm:py-3" disabled={passwordLoading}>
                {passwordLoading ? "Aggiornamento..." : "Aggiorna Password"}
              </Button>
            </form>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

function AuthScreen({ onProfileCreated }: { onProfileCreated: (p: UserProfile) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('Player');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Special handling for dennisbottari@gmail.com: allow role selection or default to Admin
        // For now, let's use the selected role from state if they were in the registration tab, 
        // or default to Admin for this specific email.
        const initialRole = user.email === 'dennisbottari@gmail.com' ? 'Admin' : 'Player';
        const finalRole = isLogin ? initialRole : role;
        
        const profile: UserProfile = {
          uid: user.uid,
          username: user.displayName || 'User_' + user.uid.slice(0, 5),
          firstName: '',
          lastName: '',
          role: finalRole,
          score: 0,
          isApproved: finalRole !== 'Responsabile' || user.email === 'dennisbottari@gmail.com',
          badges: []
        };
        await setDoc(docRef, profile);
        onProfileCreated(profile);
      } else {
        const existingProfile = docSnap.data() as UserProfile;
        // Ensure admin is approved if they log in
        if (user.email === 'dennisbottari@gmail.com' && !existingProfile.isApproved) {
          existingProfile.isApproved = true;
          await setDoc(docRef, { isApproved: true }, { merge: true });
        }
        onProfileCreated(existingProfile);
      }
      toast.success("Accesso effettuato con Google!");
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError('operation-not-allowed');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error("Il popup è stato bloccato. Abilita i popup per questo sito.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    
    // Sanitize username for virtual email: only lowercase letters and numbers
    const sanitizedUsername = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    if (!sanitizedUsername) {
      toast.error("Lo username deve contenere almeno una lettera o un numero.");
      setLoading(false);
      return;
    }

    const email = `${sanitizedUsername}@gamified-tasks.local`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Bentornato!");
      } else {
        if (password !== confirmPassword) {
          toast.error("Le password non coincidono!");
          setLoading(false);
          return;
        }
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const profile: UserProfile = {
          uid: user.uid,
          username, // Keep original username for display
          firstName: '',
          lastName: '',
          role,
          score: 0,
          isApproved: role !== 'Responsabile',
          badges: []
        };
        await setDoc(doc(db, 'users', user.uid), profile);
        onProfileCreated(profile);
        toast.success("Account creato con successo!");
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError('operation-not-allowed');
      } else if (error.code === 'auth/invalid-credential') {
        if (isLogin) {
          toast.error("Credenziali non valide. Controlla username e password o registrati se non hai un account.");
        } else {
          toast.error("Errore durante la registrazione. Controlla i dati inseriti.");
        }
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error("Questo username è già in uso. Prova ad accedere.");
      } else if (error.code === 'auth/weak-password') {
        toast.error("La password deve essere di almeno 6 caratteri.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4 sm:p-6 relative overflow-x-hidden font-sans">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[40rem] h-[40rem] bg-indigo-50 rounded-full blur-[120px] opacity-60" />
        <div className="absolute -bottom-48 -right-48 w-[40rem] h-[40rem] bg-emerald-50 rounded-full blur-[120px] opacity-60" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md space-y-10 rounded-[3rem] border border-white bg-white/70 backdrop-blur-3xl p-8 sm:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] relative z-10"
      >
        <div className="text-center space-y-6">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-600 text-white shadow-[0_20px_40px_-8px_rgba(79,70,229,0.4)]"
          >
            <Gamepad2 className="h-12 w-12" />
          </motion.div>
          
          <div className="space-y-2">
            <h2 className="text-4xl font-black font-display tracking-tight text-slate-900">
              Task<span className="text-indigo-600">Quest</span>
            </h2>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Gestione & Gamification</p>
          </div>
        </div>

        {authError === 'operation-not-allowed' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-rose-50 p-5 border border-rose-100 shadow-sm"
          >
            <div className="flex gap-4">
              <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-black text-rose-900 leading-tight uppercase tracking-wider">Configurazione Firebase</p>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                  I metodi di accesso non sono ancora stati abilitati nella tua Console Firebase.
                </p>
                <a 
                  href="https://console.firebase.google.com/project/gen-lang-client-0012836386/authentication/providers" 
                  target="_blank" 
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 underline underline-offset-4"
                >
                  Abilita ora <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-4 h-14 rounded-2xl border border-slate-200 bg-white px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-300"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continua con Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-slate-400">
              <span className="bg-white px-4">Oppure con username</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    placeholder="Il tuo username" 
                    required 
                    className="pl-12 h-14 rounded-2xl border-slate-200 bg-white/50 focus:bg-white focus:ring-indigo-500/20 transition-all text-base font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                    className="pl-12 pr-12 h-14 rounded-2xl border-slate-200 bg-white/50 focus:bg-white focus:ring-indigo-500/20 transition-all text-base font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conferma Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        placeholder="••••••••" 
                        required 
                        className="pl-12 h-14 rounded-2xl border-slate-200 bg-white/50 focus:bg-white focus:ring-indigo-500/20 transition-all text-base font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ruolo</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('Player')}
                        className={cn(
                          "rounded-2xl border-2 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300",
                          role === 'Player' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        Player
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('Responsabile')}
                        className={cn(
                          "rounded-2xl border-2 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300",
                          role === 'Responsabile' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        Responsabile
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-14 rounded-2xl btn-primary text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-200"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                isLogin ? 'Accedi Ora' : 'Crea Account'
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isLogin ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  role: UserRole;
  currentUid: string;
  users: UserProfile[];
  onAction: (t: Task) => void;
  onEdit?: (t: Task) => void;
  onDelete?: (t: Task) => void;
  key?: React.Key;
}

function TaskCard({ task, role, currentUid, users, onAction, onEdit, onDelete }: TaskCardProps) {
  const isAssigned = task.assignees.includes(currentUid);
  const isOverdue = isAfter(new Date(), parseISO(task.deadline)) && task.status !== 'Completato';
  
  const statusColors: Record<TaskStatus, string> = {
    'In attesa': 'bg-slate-100 text-slate-700',
    'In corso': 'bg-indigo-100 text-indigo-700',
    'In Revisione': 'bg-amber-100 text-amber-700',
    'Completato': 'bg-emerald-100 text-emerald-700',
  };

  const difficultyColors: Record<TaskDifficulty, string> = {
    'Rame': 'border-orange-200 text-orange-700',
    'Bronzo': 'border-amber-300 text-amber-800',
    'Argento': 'border-slate-300 text-slate-700',
    'Oro': 'border-yellow-400 text-yellow-800',
    'Platino': 'border-indigo-400 text-indigo-800',
  };

  const handleStatusUpdate = async (newStatus: TaskStatus) => {
    try {
      const now = new Date().toISOString();
      const updates: any = {};
      
      if (newStatus === 'In corso') {
        const acceptedBy = Array.from(new Set([...(task.acceptedBy || []), currentUid]));
        updates.acceptedBy = acceptedBy;
        if (acceptedBy.length === task.assignees.length) {
          updates.status = 'In corso';
          updates['logs.acceptedAt'] = now;
          toast.success("Tutti hanno accettato! Task in corso.");
        } else {
          toast.success(`Hai accettato il task. In attesa degli altri (${acceptedBy.length}/${task.assignees.length})`);
        }
      } else if (newStatus === 'In Revisione') {
        const submittedBy = Array.from(new Set([...(task.submittedBy || []), currentUid]));
        updates.submittedBy = submittedBy;
        if (submittedBy.length === task.assignees.length) {
          updates.status = 'In Revisione';
          updates['logs.submittedAt'] = now;
          toast.success("Tutti hanno consegnato! Task in revisione.");
        } else {
          toast.success(`Hai consegnato la tua parte. In attesa degli altri (${submittedBy.length}/${task.assignees.length})`);
        }
      } else {
        updates.status = newStatus;
      }
      
      await updateDoc(doc(db, 'tasks', task.id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const handleWithdraw = async () => {
    try {
      const updates: any = {
        status: 'In corso',
        submittedBy: arrayRemove(currentUid)
      };
      await updateDoc(doc(db, 'tasks', task.id), updates);
      toast.success("Consegna ritirata.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const handleReject = async () => {
    try {
      const updates: any = {
        status: 'In corso',
        submittedBy: [],
        penalties: arrayUnion('o_rejection')
      };
      await updateDoc(doc(db, 'tasks', task.id), updates);
      toast.error("Task respinto! Applicata penalità.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const hasAccepted = task.acceptedBy?.includes(currentUid);
  const hasSubmitted = task.submittedBy?.includes(currentUid);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8, shadow: "0 40px 80px -16px rgba(0, 0, 0, 0.12)" }}
      className="group relative flex flex-col rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-6 sm:p-8 shadow-elegant transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-100/50 overflow-hidden"
    >
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:bg-indigo-50 transition-colors duration-500" />
      
      {/* Task Color Indicator */}
      <div 
        className="absolute top-0 left-0 w-2 h-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: task.color || '#6366f1' }}
      />
      
      <div className="mb-8 flex items-start justify-between relative z-10">
        <div className="flex flex-wrap gap-3">
          <span className={cn("rounded-2xl border-2 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-transform group-hover:scale-110", difficultyColors[task.difficulty])}>
            {task.difficulty}
          </span>
          <span className={cn("rounded-2xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-transform group-hover:scale-110", statusColors[task.status])}>
            {task.status}
          </span>
        </div>
        {(role === 'Admin' || (role === 'Responsabile' && (task.creatorUid === currentUid || isAssigned))) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit?.(task)}
              className="rounded-2xl p-2.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-300 shadow-sm hover:shadow-md"
              title="Modifica Task"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => onDelete?.(task)}
              className="rounded-2xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all duration-300 shadow-sm hover:shadow-md"
              title="Elimina Task"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10 mb-6">
        <h3 className="mb-3 text-2xl font-black font-display text-slate-900 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors duration-300">{task.title}</h3>
        <p className="text-sm font-medium text-slate-500 line-clamp-2 leading-relaxed group-hover:text-slate-600 transition-colors">{task.description}</p>
      </div>

      <div className="mt-auto space-y-6 relative z-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Calendar className={cn("h-4 w-4", isOverdue ? "text-rose-500" : "text-slate-400")} />
              <span className={isOverdue ? "text-rose-600" : "text-slate-400"}>Scadenza</span>
            </div>
            <span className={isOverdue ? "text-rose-600" : "text-slate-900"}>
              {format(parseISO(task.deadline), 'dd MMM, HH:mm')}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: isOverdue ? '100%' : '60%' }}
              className={cn("h-full rounded-full transition-all duration-500", isOverdue ? "bg-rose-500" : "bg-indigo-500")}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100/60">
          <div className="flex -space-x-2.5">
            {task.assignees.map((uid, i) => {
              const user = users.find(u => u.uid === uid);
              const accepted = task.acceptedBy?.includes(uid);
              const submitted = task.submittedBy?.includes(uid);
              
              return (
                <div 
                  key={uid} 
                  className="group/avatar relative"
                >
                  <div 
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border-2 border-white text-[10px] font-black shadow-sm ring-2 ring-transparent hover:ring-indigo-200 transition-all cursor-help relative",
                      submitted ? "bg-emerald-100 text-emerald-600 border-emerald-200" :
                      accepted ? "bg-indigo-100 text-indigo-600 border-indigo-200" :
                      "bg-slate-100 text-slate-400 border-slate-200"
                    )}
                  >
                    {user?.username?.substring(0, 2).toUpperCase() || `U${i+1}`}
                    {submitted && <div className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white" />}
                    {!submitted && accepted && <div className="absolute -top-1 -right-1 h-3 w-3 bg-indigo-500 rounded-full border-2 border-white" />}
                  </div>
                  
                  {/* Custom Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover/avatar:translate-y-0 z-50">
                    <div className="bg-slate-900 text-white text-[10px] py-2.5 px-4 rounded-2xl shadow-2xl border border-slate-800 flex flex-col gap-1 min-w-[120px]">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-black tracking-tight text-sm">{user?.username || 'Utente'}</span>
                        <span className="text-indigo-400 font-black text-[8px] uppercase tracking-widest">{user?.role || 'Player'}</span>
                      </div>
                      <div className="h-px w-full bg-slate-800 my-1" />
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full shadow-sm", 
                          submitted ? "bg-emerald-400 shadow-emerald-400/50" : 
                          accepted ? "bg-indigo-400 shadow-indigo-400/50" : 
                          "bg-slate-500 shadow-slate-500/50"
                        )} />
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                          {submitted ? 'Consegnato' : accepted ? 'Accettato' : 'In attesa'}
                        </span>
                      </div>
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 border-[6px] border-transparent border-t-slate-900" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isAssigned && task.status === 'In attesa' && !hasAccepted && (
              <Button size="sm" onClick={() => handleStatusUpdate('In corso')} className="rounded-xl btn-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest">Accetta</Button>
            )}
            {isAssigned && task.status === 'In attesa' && hasAccepted && (
              <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">Accettato</div>
            )}
            {isAssigned && task.status === 'In corso' && !hasSubmitted && (
              <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate('In Revisione')} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Concludi</Button>
            )}
            {isAssigned && task.status === 'In corso' && hasSubmitted && (
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">Consegnato</div>
            )}
            {isAssigned && task.status === 'In Revisione' && hasSubmitted && (
              <Button size="sm" variant="ghost" onClick={handleWithdraw} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50">Ritira</Button>
            )}
            {(role === 'Responsabile' || role === 'Admin') && task.status === 'In Revisione' && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="danger" onClick={handleReject} className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700">Respingi</Button>
                <Button size="sm" variant="primary" onClick={() => onAction(task)} className="rounded-xl btn-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest">Valida</Button>
              </div>
            )}
            {task.status === 'Completato' && (
              <div className="flex items-center gap-1.5 text-emerald-600 font-black font-display text-sm bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                <CheckCircle2 className="h-4 w-4" /> +{task.finalScore} XP
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TaskFormModal({ onClose, players, creatorUid, task, areas }: { onClose: () => void, players: UserProfile[], creatorUid: string, task?: Task, areas: Area[] }) {
  const defaultDeadline = () => {
    const tomorrow = addDays(new Date(), 1);
    tomorrow.setHours(9, 0, 0, 0);
    return format(tomorrow, "yyyy-MM-dd'T'HH:mm");
  };

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [deadline, setDeadline] = useState(task ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : defaultDeadline());
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(task?.difficulty || 'Bronzo');
  const [estimatedHours, setEstimatedHours] = useState<string>(task?.estimatedHours?.toString() || '');
  const [basePoints, setBasePoints] = useState<string>(task?.basePoints?.toString() || DIFFICULTY_SCORES[task?.difficulty || 'Bronzo'].toString());
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(task?.assignees || []);
  const [area, setArea] = useState<Area | ''>(task?.area || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlayers.length === 0) return toast.error("Seleziona almeno un player");

    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0) return toast.error("Inserisci un numero di ore valido");

    const points = parseInt(basePoints);
    if (isNaN(points) || points < 0) return toast.error("Inserisci un punteggio base valido");

    try {
      if (task) {
        // Update existing task
        const taskRef = doc(db, 'tasks', task.id);
        const updates: Partial<Task> = {
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          difficulty,
          estimatedHours: hours,
          basePoints: points,
          assignees: selectedPlayers,
          area: area || null,
          color: task.color || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
        };
        await updateDoc(taskRef, updates);
        toast.success("Task aggiornato con successo!");
      } else {
        // Create new task
        const taskRef = doc(collection(db, 'tasks'));
        const now = new Date().toISOString();
        
        // Generate a random vibrant color for the task
        const hue = Math.floor(Math.random() * 360);
        const taskColor = `hsl(${hue}, 70%, 50%)`;

        const taskData: Task = {
          id: taskRef.id,
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          difficulty,
          estimatedHours: hours,
          basePoints: points,
          status: 'In attesa',
          assignees: selectedPlayers,
          acceptedBy: [],
          submittedBy: [],
          creatorUid,
          area: area || null,
          bonuses: [],
          penalties: [],
          finalScore: 0,
          createdAt: now,
          color: taskColor,
          logs: {
            createdAt: now,
            assignedAt: now
          }
        };
        await setDoc(taskRef, taskData);
        toast.success("Task creato con successo!");
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, task ? `tasks/${task.id}` : 'tasks');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg max-h-[95vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900">{task ? 'Modifica Task' : 'Nuovo Task'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10"><X className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-700">Titolo</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-700">Descrizione</label>
            <textarea 
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-700">Area</label>
            <select
              value={area}
              onChange={e => setArea(e.target.value as Area)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            >
              <option value="">Seleziona Area (Opzionale)</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="text-xs sm:text-sm font-semibold text-slate-700">Scadenza</label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700">Difficoltà</label>
              <select 
                className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as TaskDifficulty)}
              >
                {Object.keys(DIFFICULTY_SCORES).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700">Ore Stimante</label>
              <Input 
                type="number" 
                step="0.5" 
                value={estimatedHours} 
                onChange={e => setEstimatedHours(e.target.value)} 
                required 
                className="mt-1" 
                placeholder="es. 10"
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-slate-700">Punti Base</label>
              <Input 
                type="number" 
                value={basePoints} 
                onChange={e => setBasePoints(e.target.value)} 
                required 
                className="mt-1" 
                placeholder="es. 50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-700">Assegna a</label>
            <div className="mt-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-slate-50 rounded-lg">
              {players.map(p => (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => {
                    setSelectedPlayers(prev => 
                      prev.includes(p.uid) ? prev.filter(id => id !== p.uid) : [...prev, p.uid]
                    );
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-[10px] sm:text-xs font-medium transition-all",
                    selectedPlayers.includes(p.uid) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p.username}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full py-3 sm:py-6 text-sm sm:text-base">{task ? 'Aggiorna Task' : 'Crea Task'}</Button>
        </form>
      </motion.div>
    </div>
  );
}

function DeleteTaskModal({ task, onConfirm, onClose }: { task: Task, onConfirm: () => void, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mx-auto">
          <Trash2 className="h-8 w-8" />
        </div>
        
        <h2 className="mb-2 text-center text-xl font-bold text-slate-900">Elimina Task</h2>
        <p className="mb-6 text-center text-sm text-slate-500 leading-relaxed">
          Sei sicuro di voler eliminare il task <span className="font-bold text-slate-900">{task.title}</span>? 
          Questa azione è irreversibile.
        </p>

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Annulla</Button>
          <Button 
            variant="danger" 
            className="flex-1" 
            onClick={onConfirm}
          >
            Elimina
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function CalendarView({ tasks, users }: { tasks: Task[], users: UserProfile[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);
  const startOfCalendar = startOfWeek(startOfCurrentMonth, { weekStartsOn: 1 });
  const endOfCalendar = endOfWeek(endOfCurrentMonth, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });
  
  const tasksWithTimeline = calculateSequentialTimeline(tasks, users);

  // Assign slots to tasks to keep them in the same row across days
  const taskSlots: Record<string, number> = {};
  const occupiedSlots: Record<string, boolean[]> = {}; // dayKey -> [slot0, slot1, slot2...]

  tasksWithTimeline.forEach(task => {
    let slot = 0;
    let foundSlot = false;
    
    while (!foundSlot) {
      let isAvailable = true;
      let currentDate = new Date(task.calculatedStartDate);
      while (currentDate <= task.calculatedEndDate) {
        if (!isWeekend(currentDate) && !isItalianHoliday(currentDate)) {
          const dayKey = format(currentDate, 'yyyy-MM-dd');
          if (occupiedSlots[dayKey]?.[slot]) {
            isAvailable = false;
            break;
          }
        }
        currentDate = addDays(currentDate, 1);
      }
      
      if (isAvailable) {
        slot = slot;
        foundSlot = true;
      } else {
        slot++;
      }
    }
    
    taskSlots[task.id] = slot;
    let currentDate = new Date(task.calculatedStartDate);
    while (currentDate <= task.calculatedEndDate) {
      if (!isWeekend(currentDate) && !isItalianHoliday(currentDate)) {
        const dayKey = format(currentDate, 'yyyy-MM-dd');
        if (!occupiedSlots[dayKey]) occupiedSlots[dayKey] = [];
        occupiedSlots[dayKey][slot] = true;
      }
      currentDate = addDays(currentDate, 1);
    }
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm overflow-hidden flex flex-col h-[700px] max-w-full">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <h3 className="text-lg font-bold text-slate-900">Calendario Scadenze e Durate</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addDays(startOfCurrentMonth, -1))}>
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: undefined })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addDays(endOfCurrentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-xl overflow-hidden flex-1">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
          <div key={d} className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
        {calendarDays.map(day => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const dayTasks = (isWeekend(day) || isItalianHoliday(day)) ? [] : tasksWithTimeline.filter(t => 
            (isSameDay(day, t.calculatedStartDate) || isAfter(day, t.calculatedStartDate)) && 
            (isSameDay(day, t.calculatedEndDate) || isAfter(t.calculatedEndDate, day))
          ).slice(0, 2); // Limit to 2 tasks per day

          return (
            <div 
              key={day.toString()} 
              className={cn(
                "bg-white p-1 sm:p-2 min-h-[80px] sm:min-h-[100px] flex flex-col gap-1 transition-colors",
                !isCurrentMonth && "bg-slate-50/50 opacity-40",
                isTodayDate && "bg-indigo-50/30"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn(
                  "text-[10px] sm:text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                  isTodayDate ? "bg-indigo-600 text-white" : "text-slate-400"
                )}>
                  {format(day, 'd')}
                </span>
                {(isWeekend(day) || isItalianHoliday(day)) && (
                  <span className="text-[8px] font-bold text-rose-300 uppercase">
                    {isItalianHoliday(day) ? 'Festivo' : 'Off'}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[60px] sm:max-h-[80px] scrollbar-hide relative">
                {[0, 1].map(slot => {
                  const task = dayTasks.find(t => taskSlots[t.id] === slot);
                  if (!task) return <div key={`empty-${slot}`} className="h-[14px] sm:h-[16px]" />;
                  
                  const isStart = isSameDay(day, task.calculatedStartDate);
                  const isEnd = isSameDay(day, task.calculatedEndDate);
                  
                  return (
                    <div 
                      key={task.id}
                      className={cn(
                        "px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold truncate text-white shadow-sm transition-all h-[14px] sm:h-[16px] flex items-center",
                        isStart ? "rounded-l-md ml-0.5" : "-ml-1",
                        isEnd ? "rounded-r-md mr-0.5" : "-mr-1"
                      )}
                      style={{ backgroundColor: task.color || (task.difficulty === 'Oro' || task.difficulty === 'Platino' ? '#f59e0b' : '#6366f1') }}
                      title={`${task.title} - Scadenza: ${format(parseISO(task.deadline), 'dd/MM HH:mm')}`}
                    >
                      {task.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 border border-slate-100 shrink-0">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-bold mb-1">Dettagli Orari:</p>
            <p>
              Il calendario calcola la durata basandosi su una giornata lavorativa di <strong>9 ore (09:00 - 18:00)</strong>, 
              escludendo <strong>Sabato, Domenica e Festività Italiane</strong>. Le task sono pianificate sequenzialmente per ogni utente, 
              partendo dalla data di accettazione del primo task attivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttChart({ tasks, users, currentProfile }: { tasks: Task[], users: UserProfile[], currentProfile: UserProfile }) {
  const tasksWithTimeline = calculateSequentialTimeline(tasks, users);
  
  // Filter users based on role
  const visibleUsers = users.filter(u => {
    if (currentProfile.role === 'Admin') return u.role !== 'Admin';
    if (currentProfile.role === 'Responsabile') {
      return u.uid === currentProfile.uid || (u.role === 'Player' && u.responsabileUids?.includes(currentProfile.uid));
    }
    return u.uid === currentProfile.uid;
  });
  
  // Find the overall start and end dates for the Gantt view
  const allDates = tasksWithTimeline.map(t => [t.calculatedStartDate, t.calculatedEndDate]).flat();
  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(new Date(), 7);
  
  // Add some padding to the range
  const ganttStart = startOfDay(minDate);
  const ganttEnd = endOfDay(addDays(maxDate, 2));
  const totalDays = Math.max(7, differenceInDays(ganttEnd, ganttStart));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm overflow-x-auto">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Timeline Carico di Lavoro (Gantt)</h3>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Task Attivi</span>
          </div>
        </div>
      </div>
      
      <div className="min-w-[700px] space-y-6">
        {visibleUsers.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500 italic">Nessun utente trovato per visualizzare il Gantt.</p>
          </div>
        ) : (
          visibleUsers.map(u => {
            const userTasks = tasksWithTimeline.filter(t => t.assignees.includes(u.uid));
            const totalHours = userTasks.reduce((acc, t) => acc + (t.estimatedHours! / t.assignees.length), 0);
            
            return (
              <div key={u.uid} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", u.role === 'Responsabile' ? "bg-amber-500" : "bg-indigo-500")} />
                    <span className="text-sm font-bold text-slate-700">{u.username}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">({u.role})</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{totalHours.toFixed(1)}h Totali</span>
                </div>
                
                <div className="relative h-12 w-full rounded-lg bg-slate-50 border border-slate-100 overflow-hidden">
                  {/* Day markers */}
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const day = addDays(ganttStart, i);
                    const left = (i / totalDays) * 100;
                    const isW = isWeekend(day) || isItalianHoliday(day);
                    return (
                      <div 
                        key={i} 
                        className={cn("absolute top-0 h-full border-r border-slate-200/50", isW && "bg-slate-200/20")}
                        style={{ left: `${left}%`, width: `${100 / totalDays}%` }}
                      />
                    );
                  })}

                  {userTasks.map((task) => {
                    const duration = task.estimatedHours! / task.assignees.length;
                    const left = (differenceInMinutes(task.calculatedStartDate, ganttStart) / (totalDays * 24 * 60)) * 100;
                    const width = (differenceInMinutes(task.calculatedEndDate, task.calculatedStartDate) / (totalDays * 24 * 60)) * 100;
                    
                    return (
                      <div 
                        key={task.id}
                        className="absolute top-2 h-8 rounded-md border-r border-white/20 flex items-center px-2 overflow-hidden group transition-all cursor-help shadow-sm"
                        style={{ 
                          left: `${left}%`, 
                          width: `${Math.max(1, width)}%`,
                          backgroundColor: task.color || (u.role === 'Responsabile' ? '#f59e0b' : '#6366f1')
                        }}
                      >
                        <span className="text-[10px] font-bold text-white truncate">{task.title}</span>
                        
                        <div className="absolute bottom-full left-1/2 mb-2 hidden w-56 -translate-x-1/2 flex-col items-center group-hover:flex z-20 pointer-events-none">
                          <div className="rounded-lg bg-slate-900 px-3 py-2 text-center shadow-xl">
                            <p className="text-xs font-bold text-white">{task.title}</p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Inizio: {format(task.calculatedStartDate, 'dd/MM HH:mm')}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Fine: {format(task.calculatedEndDate, 'dd/MM HH:mm')}
                            </p>
                            <p className="mt-1 text-[10px] text-indigo-300 font-bold">
                              { (duration / 9).toFixed(1) } Giornate lavorative ({duration.toFixed(1)}h)
                            </p>
                          </div>
                          <div className="h-2 w-2 rotate-45 bg-slate-900 -mt-1"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        
        <div className="flex justify-between px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-100">
          {Array.from({ length: Math.min(10, totalDays) }).map((_, i) => {
            const day = addDays(ganttStart, Math.floor(i * (totalDays / 10)));
            return (
              <span key={i}>{format(day, 'dd/MM')}</span>
            );
          })}
        </div>
      </div>
      
      <div className="mt-8 rounded-xl bg-indigo-50 p-4 border border-indigo-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-700 leading-relaxed">
            <p className="font-bold mb-1">Logica del Gantt:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Visualizza il carico di lavoro stimato per ogni player basato sulle ore inserite.</li>
              <li><strong>Automatismo:</strong> Se un task è assegnato a più persone, il tempo individuale si riduce (es. 10h / 2 persone = 5h a testa).</li>
              <li>Il grafico assume un'esecuzione sequenziale dei task assegnati.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helper Functions ---
function checkAndAwardBadges(profile: UserProfile, completedTasks: Task[], badges: Badge[], lastCompletedTask?: Task): string[] {
  const newBadgeIds: string[] = [];
  const currentBadgeIds = new Set(profile.badges || []);

  badges.forEach(badge => {
    if (currentBadgeIds.has(badge.id)) return;

    let earned = false;
    const { requirement } = badge;

    switch (requirement.type) {
      case 'score':
        if (profile.score >= requirement.value) earned = true;
        break;
      case 'tasks_completed':
        if (completedTasks.length >= requirement.value) earned = true;
        break;
      case 'difficulty_completed':
        const count = completedTasks.filter(t => t.difficulty === requirement.difficulty).length;
        if (count >= (requirement.value || 0)) earned = true;
        break;
    }

    if (earned) {
      newBadgeIds.push(badge.id);
    }
  });

  return newBadgeIds;
}

function ScoringModal({ task, onClose, bonuses, penalties, badges }: { task: Task, onClose: () => void, bonuses: BonusPenalty[], penalties: BonusPenalty[], badges: Badge[] }) {
  const [selectedBonuses, setSelectedBonuses] = useState<string[]>([]);
  const [selectedPenalties, setSelectedPenalties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const baseScore = task.basePoints || DIFFICULTY_SCORES[task.difficulty];
  
  // Auto "Perfect" bonus logic
  const perfectBonusId = `e_${task.difficulty.toLowerCase()}_perf`;
  const perfectBonus = bonuses.find(b => b.id === perfectBonusId);
  const isPerfect = selectedPenalties.length === 0;
  const perfectBonusValue = isPerfect && perfectBonus ? perfectBonus.value : 0;

  // Time-based bonus logic
  const calculateTimeBonus = () => {
    if (!task.logs.submittedAt) return 0;
    const submitted = parseISO(task.logs.submittedAt);
    const deadline = parseISO(task.deadline);
    const diffMs = deadline.getTime() - submitted.getTime();
    if (diffMs <= 0) return 0;
    
    // Proportional bonus: 10% of base score for every 24h early, max 50%
    const diffHours = diffMs / (1000 * 60 * 60);
    const bonusPercent = Math.min(0.5, (diffHours / 24) * 0.1);
    return Math.round(baseScore * bonusPercent);
  };
  
  const timeBonusValue = calculateTimeBonus();

  const bonusTotal = bonuses.filter(b => selectedBonuses.includes(b.id)).reduce((acc, b) => acc + b.value, 0);
  const penaltyTotal = penalties.filter(p => selectedPenalties.includes(p.id)).reduce((acc, p) => acc + p.value, 0);
  const finalScore = Math.max(0, baseScore + bonusTotal + penaltyTotal + perfectBonusValue + timeBonusValue);

  const handleValidate = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      
      const autoBonuses = [];
      if (isPerfect && perfectBonus) autoBonuses.push(perfectBonus.id);
      if (timeBonusValue > 0) autoBonuses.push('time_bonus');

      // Update task
      const taskRef = doc(db, 'tasks', task.id);
      batch.update(taskRef, {
        status: 'Completato',
        bonuses: selectedBonuses,
        penalties: selectedPenalties,
        autoBonuses: autoBonuses,
        finalScore: finalScore,
        'logs.validatedAt': now
      });

      // Update each assignee's score and check for badges
      for (const uid of task.assignees) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userProfile = userSnap.data() as UserProfile;
          const newScore = userProfile.score + finalScore;
          
          const q = query(
            collection(db, 'tasks'),
            where('assignees', 'array-contains', uid),
            where('status', '==', 'Completato')
          );
          const completedTasksSnap = await getDocs(q);
          const completedTasks = completedTasksSnap.docs.map(d => d.data() as Task);
          
          const updatedCompletedTasks = [...completedTasks, { ...task, status: 'Completato' as TaskStatus }];
          
          const updatedProfileForCheck = { ...userProfile, score: newScore };
          const newBadgeIds = checkAndAwardBadges(updatedProfileForCheck, updatedCompletedTasks, badges, task);
          
          if (newBadgeIds.length > 0) {
            batch.update(userRef, { 
              score: newScore,
              badges: [...(userProfile.badges || []), ...newBadgeIds]
            });
            newBadgeIds.forEach(bid => {
              const b = badges.find(badge => badge.id === bid);
              if (b) toast.success(`Nuovo Badge per ${userProfile.username}: ${b.name}!`, { icon: '🏆' });
            });
          } else {
            batch.update(userRef, { score: newScore });
          }
        }
      }

      await batch.commit();
      toast.success("Task validato e punteggi assegnati!");
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">Validazione Task</h2>
            <p className="text-[10px] sm:text-sm text-slate-500 line-clamp-1">{task.title} ({task.difficulty})</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10"><X className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Penalties */}
            <section>
              <h3 className="mb-3 sm:mb-4 flex items-center gap-2 font-bold text-rose-600 text-sm sm:text-base">
                <MinusCircle className="h-4 w-4" /> Penali (Errori)
              </h3>
              <div className="space-y-2">
                {penalties.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPenalties(prev => 
                      prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                    )}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all",
                      selectedPenalties.includes(p.id) ? "border-rose-200 bg-rose-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <span className="text-xs sm:text-sm font-medium">{p.label}</span>
                    <span className="text-xs sm:text-sm font-bold text-rose-600">{p.value}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Bonuses */}
            <section className="space-y-6">
              <div>
                <h3 className="mb-3 sm:mb-4 flex items-center gap-2 font-bold text-emerald-600 text-sm sm:text-base">
                  <PlusCircle className="h-4 w-4" /> Bonus Manuali
                </h3>
                <div className="space-y-2">
                  {bonuses.filter(b => !b.id.endsWith('_perf')).map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBonuses(prev => 
                        prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                      )}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all",
                        selectedBonuses.includes(b.id) ? "border-emerald-200 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <span className="text-xs sm:text-sm font-medium">{b.label}</span>
                      <span className="text-xs sm:text-sm font-bold text-emerald-600">+{b.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 sm:mb-4 flex items-center gap-2 font-bold text-indigo-600 text-sm sm:text-base">
                  <Zap className="h-4 w-4" /> Bonus Automatici
                </h3>
                <div className="space-y-2">
                  {perfectBonus && (
                    <div className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 border-dashed",
                      isPerfect ? "border-amber-200 bg-amber-50" : "border-slate-100 opacity-50"
                    )}>
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-slate-700">Perfect {task.difficulty}</span>
                        <span className="text-[10px] text-slate-500">Applicato se non ci sono penali</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-amber-600">+{perfectBonus.value}</span>
                    </div>
                  )}
                  {timeBonusValue > 0 && (
                    <div className="flex w-full items-center justify-between rounded-xl border p-3 border-dashed border-indigo-200 bg-indigo-50">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-slate-700">Bonus Velocità</span>
                        <span className="text-[10px] text-slate-500">Proporzionale all'anticipo</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-indigo-600">+{timeBonusValue}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center gap-4 sm:justify-between shrink-0">
          <div className="flex items-center justify-center gap-4 sm:gap-8 w-full sm:w-auto">
            <div className="text-center">
              <p className="text-[8px] sm:text-[10px] font-bold uppercase text-slate-400">Base</p>
              <p className="text-sm sm:text-lg font-bold text-slate-700">{baseScore}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] sm:text-[10px] font-bold uppercase text-slate-400">Modificatori</p>
              <p className={cn("text-sm sm:text-lg font-bold", (bonusTotal + penaltyTotal + perfectBonusValue + timeBonusValue) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {(bonusTotal + penaltyTotal + perfectBonusValue + timeBonusValue) >= 0 ? '+' : ''}{bonusTotal + penaltyTotal + perfectBonusValue + timeBonusValue}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[8px] sm:text-[10px] font-bold uppercase text-indigo-400">Totale</p>
              <p className="text-base sm:text-2xl font-black text-indigo-600">{finalScore} XP</p>
            </div>
          </div>
          <Button onClick={handleValidate} disabled={loading} className="w-full sm:w-auto px-8 py-3 sm:py-6 text-sm sm:text-lg">
            {loading ? 'Validazione...' : 'Approva e Chiudi'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteUserModal({ user, onConfirm, onClose }: { user: UserProfile, onConfirm: () => void, onClose: () => void }) {
  const [verificationString] = useState(() => Math.random().toString(36).substring(2, 8));
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(false);

  const handleDelete = () => {
    if (inputValue === verificationString) {
      onConfirm();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mx-auto">
          <Trash2 className="h-8 w-8" />
        </div>
        
        <h2 className="mb-2 text-center text-xl font-bold text-slate-900">Elimina Utente</h2>
        <p className="mb-6 text-center text-sm text-slate-500 leading-relaxed">
          Sei sicuro di voler eliminare l'utente <span className="font-bold text-slate-900">{user.username}</span>? 
          Questa azione è irreversibile e rimuoverà tutti i dati del profilo.
        </p>

        <div className="mb-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <p className="mb-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Codice di Verifica</p>
          <div className="mb-4 flex justify-center">
            <span className="rounded-lg bg-white px-4 py-2 font-mono text-xl font-bold tracking-widest text-indigo-600 shadow-sm border border-indigo-100">
              {verificationString}
            </span>
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(false);
            }}
            placeholder="Scrivi il codice qui..."
            className={cn(
              "w-full rounded-xl border bg-white px-4 py-3 text-center font-mono text-lg font-bold focus:outline-none focus:ring-2",
              error ? "border-rose-300 ring-rose-100" : "border-slate-200 focus:ring-indigo-100"
            )}
          />
          {error && (
            <p className="mt-2 text-center text-xs font-bold text-rose-500">Il codice non corrisponde!</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Annulla</Button>
          <Button 
            variant="destructive" 
            className="flex-1" 
            onClick={handleDelete}
            disabled={inputValue !== verificationString}
          >
            Elimina
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmModal({ title, message, onConfirm, onClose }: { title: string, message: string, onConfirm: () => void, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 mx-auto">
          <Trash2 className="h-8 w-8" />
        </div>
        
        <h2 className="mb-2 text-center text-xl font-bold text-slate-900">{title}</h2>
        <p className="mb-8 text-center text-sm text-slate-500 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Annulla</Button>
          <Button 
            variant="destructive" 
            className="flex-1" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Elimina
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function TaskLogsView({ tasks, users, isAdmin, onDeleteTask }: { 
  tasks: Task[], 
  users: UserProfile[], 
  isAdmin: boolean,
  onDeleteTask: (taskId: string) => void 
}) {
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const sortedTasks = [...tasks].sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm overflow-x-auto">
      <h3 className="text-lg font-bold text-slate-900 mb-6">Log Attività Task</h3>
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            <th className="pb-4 font-semibold">Task</th>
            <th className="pb-4 font-semibold">Creatore</th>
            <th className="pb-4 font-semibold">Assegnatari</th>
            <th className="pb-4 font-semibold">Creazione</th>
            <th className="pb-4 font-semibold">Accettazione</th>
            <th className="pb-4 font-semibold">Consegna</th>
            <th className="pb-4 font-semibold">Validazione</th>
            {isAdmin && <th className="pb-4 font-semibold">Azioni</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sortedTasks.map(t => (
            <tr key={t.id} className="hover:bg-slate-50/50">
              <td className="py-4">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">{t.title}</span>
                  <span className="text-[10px] text-slate-400 uppercase">{t.difficulty}</span>
                </div>
              </td>
              <td className="py-4">
                {users.find(u => u.uid === t.creatorUid)?.username || 'Sistema'}
              </td>
              <td className="py-4">
                <div className="flex -space-x-1">
                  {t.assignees.map(uid => {
                    const u = users.find(user => user.uid === uid);
                    return (
                      <div key={uid} className="h-6 w-6 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] font-bold text-indigo-600" title={u?.username}>
                        {u?.username?.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </td>
              <td className="py-4 text-slate-500">{t.logs?.createdAt ? format(parseISO(t.logs.createdAt), 'dd/MM HH:mm') : '-'}</td>
              <td className="py-4 text-slate-500">{t.logs?.acceptedAt ? format(parseISO(t.logs.acceptedAt), 'dd/MM HH:mm') : '-'}</td>
              <td className="py-4 text-slate-500">{t.logs?.submittedAt ? format(parseISO(t.logs.submittedAt), 'dd/MM HH:mm') : '-'}</td>
              <td className="py-4 text-slate-500">{t.logs?.validatedAt ? format(parseISO(t.logs.validatedAt), 'dd/MM HH:mm') : '-'}</td>
              {isAdmin && (
                <td className="py-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                    onClick={() => setTaskToDelete(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {taskToDelete && (
        <DeleteConfirmModal 
          title="Elimina Log"
          message="Sei sicuro di voler eliminare questa voce di log? Questa azione eliminerà definitivamente il task associato."
          onConfirm={() => onDeleteTask(taskToDelete)}
          onClose={() => setTaskToDelete(null)}
        />
      )}
    </div>
  );
}

function CompactSupervisorSelector({ 
  user, 
  responsabili, 
  onUpdate 
}: { 
  user: UserProfile, 
  responsabili: UserProfile[], 
  onUpdate: (uids: string[]) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const assignedUids = user.responsabileUids || [];

  return (
    <div className="relative">
      <div 
        className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        {assignedUids.length > 0 ? (
          assignedUids.map(uid => {
            const r = responsabili.find(res => res.uid === uid);
            return (
              <div 
                key={uid}
                className="h-7 w-7 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-[8px] font-black text-white shadow-sm"
                title={r?.username}
              >
                {r?.username.substring(0, 2).toUpperCase()}
              </div>
            );
          })
        ) : (
          <div className="h-7 w-7 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
            <Plus className="h-3 w-3" />
          </div>
        )}
        {assignedUids.length > 0 && (
           <div className="ml-3 h-6 w-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
             <Settings className="h-3 w-3" />
           </div>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-20 animate-in fade-in zoom-in duration-200">
            <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
              {responsabili.map(r => {
                const isAssigned = assignedUids.includes(r.uid);
                return (
                  <button
                    key={r.uid}
                    onClick={() => {
                      const newUids = isAssigned
                        ? assignedUids.filter(id => id !== r.uid)
                        : [...assignedUids, r.uid];
                      onUpdate(newUids);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                      isAssigned ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                       <div className={cn(
                         "h-5 w-5 rounded-md flex items-center justify-center text-[8px]",
                         isAssigned ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                       )}>
                         {r.username.substring(0, 2).toUpperCase()}
                       </div>
                       {r.username}
                    </div>
                    {isAssigned && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserManagement({ users, currentRole, areas, onSimulate, onUpdateUser, onDeleteUser }: { 
  users: UserProfile[], 
  currentRole: UserRole,
  areas: Area[],
  onSimulate: (user: UserProfile) => void,
  onUpdateUser: (uid: string, updates: Partial<UserProfile>) => void,
  onDeleteUser: (uid: string) => void
}) {
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const responsabili = users.filter(u => u.role === 'Responsabile' || u.role === 'Admin');
  const isAdmin = currentRole === 'Admin';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {isAdmin ? 'Gestione Utenti' : 'I Miei Player'}
          </h3>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)} size="sm" className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Nuovo Profilo
            </Button>
          )}
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="pb-4 font-semibold">Username</th>
                <th className="pb-4 font-semibold">Area</th>
                <th className="pb-4 font-semibold">Ruolo</th>
                <th className="pb-4 font-semibold">Approvato</th>
                <th className="pb-4 font-semibold">Responsabile</th>
                <th className="pb-4 font-semibold">Punteggio</th>
                {isAdmin && <th className="pb-4 font-semibold">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-slate-50/50">
                  <td className="py-4 font-medium text-slate-900">{u.username}</td>
                  <td className="py-4">
                    {isAdmin ? (
                      <select
                        value={u.area || ''}
                        onChange={(e) => onUpdateUser(u.uid, { area: e.target.value as Area || deleteField() as any })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Nessuna</option>
                        {areas.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{u.area || '-'}</span>
                    )}
                  </td>
                  <td className="py-4">
                    {isAdmin ? (
                      <select
                        value={u.role}
                        onChange={(e) => onUpdateUser(u.uid, { role: e.target.value as UserRole })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Player">Player</option>
                        <option value="Responsabile">Responsabile</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{u.role}</span>
                    )}
                  </td>
                  <td className="py-4">
                    {isAdmin ? (
                      <button
                        onClick={() => onUpdateUser(u.uid, { isApproved: !u.isApproved })}
                        className={cn(
                          "flex h-6 w-12 items-center rounded-full p-1 transition-colors",
                          u.isApproved ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full bg-white transition-transform",
                          u.isApproved ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    ) : (
                      <span className={cn("text-xs font-bold", u.isApproved ? "text-emerald-600" : "text-amber-600")}>
                        {u.isApproved ? 'Sì' : 'No'}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    {isAdmin && u.role === 'Player' ? (
                      <CompactSupervisorSelector 
                        user={u} 
                        responsabili={responsabili} 
                        onUpdate={(newUids) => onUpdateUser(u.uid, { responsabileUids: newUids })} 
                      />
                    ) : (
                      <div className="flex -space-x-2">
                        {u.responsabileUids?.map(uid => {
                          const r = responsabili.find(res => res.uid === uid);
                          return r ? (
                            <div 
                              key={uid}
                              className="h-7 w-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-600 shadow-sm"
                              title={r.username}
                            >
                              {r.username.substring(0, 2).toUpperCase()}
                            </div>
                          ) : null;
                        })}
                        {(!u.responsabileUids || u.responsabileUids.length === 0) && u.role === 'Player' && (
                          <span className="text-slate-400 text-[10px]">Nessuno</span>
                        )}
                        {u.role !== 'Player' && <span className="text-slate-400">-</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={u.score}
                        onBlur={(e) => {
                          const newScore = parseInt(e.target.value);
                          if (!isNaN(newScore) && newScore !== u.score) {
                            onUpdateUser(u.uid, { score: newScore });
                          }
                        }}
                        className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] font-bold text-slate-400">XP</span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          onClick={() => onSimulate(u)}
                          title="Simula Profilo"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          onClick={() => setUserToDelete(u)}
                          title="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-4">
          {users.map(u => (
            <div key={u.uid} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{u.username}</span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{u.role}</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => onSimulate(u)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      onClick={() => setUserToDelete(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Area</label>
                  {isAdmin ? (
                    <select
                      value={u.area || ''}
                      onChange={(e) => onUpdateUser(u.uid, { area: e.target.value as Area || deleteField() as any })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">Nessuna</option>
                      {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  ) : (
                    <div className="text-xs text-slate-600 py-1 font-bold">{u.area || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Ruolo</label>
                  {isAdmin ? (
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateUser(u.uid, { role: e.target.value as UserRole })}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="Player">Player</option>
                      <option value="Responsabile">Responsabile</option>
                      <option value="Admin">Admin</option>
                    </select>
                  ) : (
                    <div className="text-xs font-bold text-indigo-600 py-1">{u.role}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Approvato</label>
                  {isAdmin ? (
                    <div className="flex items-center">
                      <button
                        onClick={() => onUpdateUser(u.uid, { isApproved: !u.isApproved })}
                        className={cn(
                          "flex h-5 w-10 items-center rounded-full p-1 transition-colors",
                          u.isApproved ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "h-3 w-3 rounded-full bg-white transition-transform",
                          u.isApproved ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                  ) : (
                    <div className={cn("text-xs font-bold py-1", u.isApproved ? "text-emerald-600" : "text-amber-600")}>
                      {u.isApproved ? 'Sì' : 'No'}
                    </div>
                  )}
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Responsabili</label>
                  {isAdmin && u.role === 'Player' ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {responsabili.map(r => (
                        <button
                          key={r.uid}
                          onClick={() => {
                            const currentUids = u.responsabileUids || [];
                            const newUids = currentUids.includes(r.uid)
                              ? currentUids.filter(id => id !== r.uid)
                              : [...currentUids, r.uid];
                            onUpdateUser(u.uid, { responsabileUids: newUids });
                          }}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold transition-all",
                            u.responsabileUids?.includes(r.uid)
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          )}
                        >
                          {r.username}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {u.responsabileUids?.map(uid => {
                        const r = responsabili.find(res => res.uid === uid);
                        return r ? (
                          <span key={uid} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {r.username}
                          </span>
                        ) : null;
                      })}
                      {(!u.responsabileUids || u.responsabileUids.length === 0) && u.role === 'Player' && (
                        <span className="text-slate-400 text-[10px]">Nessuno</span>
                      )}
                      {u.role !== 'Player' && <span className="text-slate-400">-</span>}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Punteggio (XP)</label>
                  <input
                    type="number"
                    defaultValue={u.score}
                    onBlur={(e) => {
                      const newScore = parseInt(e.target.value);
                      if (!isNaN(newScore) && newScore !== u.score) {
                        onUpdateUser(u.uid, { score: newScore });
                      }
                    }}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-bold text-indigo-600"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateUserModal 
            onClose={() => setShowCreateModal(false)} 
            onCreated={() => setShowCreateModal(false)} 
            areas={areas}
          />
        )}
        {userToDelete && (
          <DeleteUserModal 
            user={userToDelete} 
            onClose={() => setUserToDelete(null)} 
            onConfirm={() => {
              onDeleteUser(userToDelete.uid);
              setUserToDelete(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated, areas }: { onClose: () => void, onCreated: () => void, areas: Area[] }) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('Player');
  const [area, setArea] = useState<Area | ''>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("Il nome è obbligatorio per generare la password.");
      return;
    }
    setLoading(true);
    
    // Sanitize username for virtual email
    const sanitizedUsername = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!sanitizedUsername) {
      toast.error("Username non valido.");
      setLoading(false);
      return;
    }
    const email = `${sanitizedUsername}@gamified-tasks.local`;
    const password = `${firstName.trim()}123`;

    try {
      // Use a secondary Firebase app to create the user without signing out the admin
      const secondaryApp = initializeApp(firebaseConfig, `Secondary_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      const userRef = doc(db, 'users', newUser.uid);
      const userData: UserProfile = {
        uid: newUser.uid,
        username: username.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        area: area || undefined,
        score: 0,
        isApproved: true,
        badges: [],
        mustChangePassword: true
      };
      await setDoc(userRef, userData);
      
      // Clean up secondary app
      await deleteApp(secondaryApp);
      
      toast.success(`Profilo creato! Password: ${password}`);
      onCreated();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Questo username è già in uso.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 mx-auto">
          <UserCircle className="h-8 w-8" />
        </div>
        
        <h2 className="mb-6 text-center text-xl font-bold text-slate-900">Nuovo Profilo</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Username</label>
            <Input value={username} onChange={e => setUsername(e.target.value)} required className="mt-1" placeholder="es. mario_rossi" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Nome</label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="mt-1" placeholder="Mario" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Cognome</label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="mt-1" placeholder="Rossi" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Area</label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">Nessuna</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Ruolo</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="Player">Player</option>
              <option value="Responsabile">Responsabile</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          
          <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
            <p className="text-[10px] text-amber-700 font-medium leading-tight">
              <strong>Nota:</strong> La password predefinita sarà <strong>{firstName || 'Nome'}123</strong>. 
              L'utente dovrà cambiarla al primo accesso.
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" className="flex-1" onClick={onClose} type="button">Annulla</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creazione...' : 'Crea Profilo'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SettingsView({ areas, badges, bonuses, penalties, rewards }: { areas: Area[], badges: Badge[], bonuses: BonusPenalty[], penalties: BonusPenalty[], rewards: Reward[] }) {
  const [newArea, setNewArea] = useState('');
  const [newBonus, setNewBonus] = useState({ label: '', value: 0 });
  const [newPenalty, setNewPenalty] = useState({ label: '', value: 0 });
  const [newReward, setNewReward] = useState({ name: '', cost: 0, icon: 'Zap', color: 'text-indigo-500' });

  const updateMetadata = async (id: string, list: any[]) => {
    try {
      await setDoc(doc(db, 'metadata', id), { list });
      toast.success("Configurazione aggiornata!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `metadata/${id}`);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Areas Management */}
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant">
          <h3 className="text-xl font-black font-display text-slate-900 mb-6 flex items-center gap-2">
            <Layout className="h-5 w-5 text-indigo-500" /> Gestione Aree
          </h3>
          <div className="flex gap-2 mb-6">
            <Input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Nuova Area..." className="rounded-xl" />
            <Button onClick={() => {
              if (!newArea) return;
              updateMetadata('areas', [...areas, newArea]);
              setNewArea('');
            }} className="rounded-xl"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {areas.map(a => (
              <div key={a} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
                {a}
                <button onClick={() => updateMetadata('areas', areas.filter(item => item !== a))} className="text-rose-400 hover:text-rose-600"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Rewards Management */}
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant">
          <h3 className="text-xl font-black font-display text-slate-900 mb-6 flex items-center gap-2">
            <Star className="h-5 w-5 text-rose-500" /> Gestione Premi
          </h3>
          <div className="space-y-3 mb-6">
            <Input value={newReward.name} onChange={e => setNewReward({...newReward, name: e.target.value})} placeholder="Nome Premio..." className="rounded-xl" />
            <div className="flex gap-2">
              <Input type="number" value={newReward.cost} onChange={e => setNewReward({...newReward, cost: parseInt(e.target.value)})} placeholder="Costo XP" className="rounded-xl" />
              <Button onClick={() => {
                if (!newReward.name || !newReward.cost) return;
                updateMetadata('rewards', [...rewards, { ...newReward, id: Date.now().toString() }]);
                setNewReward({ name: '', cost: 0, icon: 'Zap', color: 'text-indigo-500' });
              }} className="rounded-xl w-full"><Plus className="mr-2 h-4 w-4" /> Aggiungi</Button>
            </div>
          </div>
          <div className="space-y-2">
            {rewards.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <BadgeIcon name={r.icon} className={cn("h-4 w-4", r.color)} />
                  <span className="text-xs font-bold text-slate-700">{r.name} ({r.cost} XP)</span>
                </div>
                <button onClick={() => updateMetadata('rewards', rewards.filter(item => item.id !== r.id))} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Bonuses Management */}
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant">
          <h3 className="text-xl font-black font-display text-slate-900 mb-6 flex items-center gap-2 text-emerald-600">
            <PlusCircle className="h-5 w-5" /> Gestione Bonus
          </h3>
          <div className="flex gap-2 mb-6">
            <Input value={newBonus.label} onChange={e => setNewBonus({...newBonus, label: e.target.value})} placeholder="Etichetta..." className="rounded-xl" />
            <Input type="number" value={newBonus.value} onChange={e => setNewBonus({...newBonus, value: parseInt(e.target.value)})} placeholder="XP" className="rounded-xl w-24" />
            <Button onClick={() => {
              if (!newBonus.label || !newBonus.value) return;
              updateMetadata('bonuses', [...bonuses, { ...newBonus, id: `b_${Date.now()}`, category: 'Bonus' }]);
              setNewBonus({ label: '', value: 0 });
            }} className="rounded-xl"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {bonuses.filter(b => !b.id.endsWith('_perf')).map(b => (
              <div key={b.id} className="flex items-center justify-between bg-emerald-50/50 px-4 py-2 rounded-xl border border-emerald-100">
                <span className="text-xs font-bold text-emerald-700">{b.label} (+{b.value} XP)</span>
                <button onClick={() => updateMetadata('bonuses', bonuses.filter(item => item.id !== b.id))} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Penalties Management */}
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant">
          <h3 className="text-xl font-black font-display text-slate-900 mb-6 flex items-center gap-2 text-rose-600">
            <MinusCircle className="h-5 w-5" /> Gestione Malus
          </h3>
          <div className="flex gap-2 mb-6">
            <Input value={newPenalty.label} onChange={e => setNewPenalty({...newPenalty, label: e.target.value})} placeholder="Etichetta..." className="rounded-xl" />
            <Input type="number" value={newPenalty.value} onChange={e => setNewPenalty({...newPenalty, value: parseInt(e.target.value)})} placeholder="XP" className="rounded-xl w-24" />
            <Button onClick={() => {
              if (!newPenalty.label || !newPenalty.value) return;
              updateMetadata('penalties', [...penalties, { ...newPenalty, id: `p_${Date.now()}`, category: 'Penalty' }]);
              setNewPenalty({ label: '', value: 0 });
            }} className="rounded-xl"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {penalties.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-rose-50/50 px-4 py-2 rounded-xl border border-rose-100">
                <span className="text-xs font-bold text-rose-700">{p.label} ({p.value} XP)</span>
                <button onClick={() => updateMetadata('penalties', penalties.filter(item => item.id !== p.id))} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChallengesView({ challenges, currentProfile }: { challenges: Challenge[], currentProfile: UserProfile }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bonusXP, setBonusXP] = useState('50');
  const [expiresAt, setExpiresAt] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));

  const isAdmin = currentProfile.role === 'Admin';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const challengeRef = doc(collection(db, 'challenges'));
      const now = new Date().toISOString();
      const challengeData: Challenge = {
        id: challengeRef.id,
        title,
        description,
        bonusXP: parseInt(bonusXP),
        expiresAt: new Date(expiresAt).toISOString(),
        completedBy: [],
        createdAt: now
      };
      await setDoc(challengeRef, challengeData);
      toast.success("Sfida a tempo creata!");
      setShowForm(false);
      setTitle('');
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'challenges');
    }
  };

  const handleCompleteChallenge = async (challenge: Challenge) => {
    if (challenge.completedBy.includes(currentProfile.uid)) return;
    
    try {
      const batch = writeBatch(db);
      
      // Update challenge
      const challengeRef = doc(db, 'challenges', challenge.id);
      batch.update(challengeRef, {
        completedBy: arrayUnion(currentProfile.uid)
      });

      // Update user score
      const userRef = doc(db, 'users', currentProfile.uid);
      batch.update(userRef, {
        score: increment(challenge.bonusXP)
      });

      await batch.commit();
      toast.success(`Sfida completata! +${challenge.bonusXP} XP`, { icon: '⚡' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'challenge-complete');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 shadow-inner">
            <Zap className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h3 className="font-black font-display text-slate-900 tracking-tight text-3xl">Sfide a Tempo</h3>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Completa le sfide prima della scadenza per bonus extra</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="rounded-2xl h-12 px-6 gap-2">
            <Plus className="h-5 w-5" /> Nuova Sfida
          </Button>
        )}
      </div>

      {showForm && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-elegant"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Titolo Sfida</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Bonus XP</label>
                <Input type="number" value={bonusXP} onChange={e => setBonusXP(e.target.value)} required className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Descrizione</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                required 
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Scadenza</label>
              <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="flex-1 rounded-xl">Annulla</Button>
              <Button type="submit" className="flex-1 rounded-xl bg-indigo-600">Crea Sfida</Button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {challenges.map(challenge => {
          const isExpired = isAfter(new Date(), parseISO(challenge.expiresAt));
          const isCompleted = challenge.completedBy.includes(currentProfile.uid);
          
          return (
            <motion.div 
              key={challenge.id}
              whileHover={{ y: -5 }}
              className={cn(
                "rounded-[2.5rem] border p-8 relative overflow-hidden group transition-all duration-500",
                isCompleted ? "border-emerald-100 bg-emerald-50/30" : 
                isExpired ? "border-slate-100 bg-slate-50 opacity-60" : 
                "border-amber-100 bg-white shadow-elegant"
              )}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center",
                    isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-amber-50 text-amber-500"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bonus</p>
                    <p className="text-xl font-black text-indigo-600">+{challenge.bonusXP} XP</p>
                  </div>
                </div>

                <h4 className="text-xl font-black font-display text-slate-900 mb-2">{challenge.title}</h4>
                <p className="text-xs text-slate-500 mb-6 line-clamp-2">{challenge.description}</p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Clock className="h-3 w-3" />
                    {isExpired ? 'Scaduta' : format(parseISO(challenge.expiresAt), 'dd/MM HH:mm')}
                  </div>
                  {!isCompleted && !isExpired && (
                    <Button 
                      size="sm" 
                      onClick={() => handleCompleteChallenge(challenge)}
                      className="rounded-xl bg-amber-500 hover:bg-amber-600 text-[10px] font-black uppercase tracking-widest px-4"
                    >
                      Completa
                    </Button>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completata</span>
                  )}
                </div>
              </div>
              
              {!isCompleted && !isExpired && (
                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-amber-50 rounded-full blur-2xl opacity-50 group-hover:scale-125 transition-transform duration-700" />
              )}
            </motion.div>
          );
        })}
        {challenges.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-slate-400 font-bold uppercase tracking-widest">Nessuna sfida attiva al momento</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamManagement({ users, currentProfile, onUpdateUser }: { users: UserProfile[], currentProfile: UserProfile, onUpdateUser: (uid: string, updates: Partial<UserProfile>) => Promise<void> }) {
  const isAdmin = currentProfile.role === 'Admin';
  const isResponsabile = currentProfile.role === 'Responsabile';
  
  const players = users.filter(u => u.role === 'Player');
  const responsabili = users.filter(u => u.role === 'Responsabile');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black font-display text-slate-900 tracking-tight">Gestione Team</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assegna i supervisori ai player in modo visuale</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {players.map(player => {
          const isMyPlayer = player.responsabileUids?.includes(currentProfile.uid);
          if (!isAdmin && !isMyPlayer && isResponsabile) return null;

          return (
            <motion.div 
              key={player.uid}
              whileHover={{ y: -5 }}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-elegant hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                  <UserCircle className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <h4 className="font-black font-display text-slate-900 leading-none">{player.username}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{player.area}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supervisori Assegnati</p>
                <div className="flex flex-wrap gap-2">
                  {player.responsabileUids?.map(uid => {
                    const resp = users.find(u => u.uid === uid);
                    return (
                      <div key={uid} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-700">{resp?.username || 'Sconosciuto'}</span>
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              const newUids = player.responsabileUids?.filter(id => id !== uid) || [];
                              onUpdateUser(player.uid, { responsabileUids: newUids });
                            }}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {(!player.responsabileUids || player.responsabileUids.length === 0) && (
                    <p className="text-[10px] text-slate-400 italic">Nessun supervisore</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="pt-4 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-indigo-600">Aggiungi Supervisore</p>
                    <div className="flex flex-wrap gap-2">
                      {responsabili
                        .filter(r => !player.responsabileUids?.includes(r.uid))
                        .map(r => (
                          <button
                            key={r.uid}
                            onClick={() => {
                              const newUids = [...(player.responsabileUids || []), r.uid];
                              onUpdateUser(player.uid, { responsabileUids: newUids });
                            }}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                          >
                            + {r.username}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementsView({ profile, tasks, badges, rewards }: { profile: UserProfile, tasks: Task[], badges: Badge[], rewards: Reward[] }) {
  const completedTasks = tasks.filter(t => t.status === 'Completato');
  const totalEarnedXP = profile.score || 0;

  return (
    <div className="space-y-10">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="rounded-[2.5rem] bg-indigo-600 p-8 text-white shadow-elegant relative overflow-hidden group">
          <Zap className="absolute -right-4 -top-4 h-32 w-32 text-white/10 group-hover:scale-110 transition-transform duration-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-2">Esperienza Totale</p>
          <h4 className="text-5xl font-black font-display tracking-tight">{totalEarnedXP} <span className="text-xl text-indigo-300">XP</span></h4>
        </div>
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant relative overflow-hidden group">
          <CheckCircle2 className="absolute -right-4 -top-4 h-32 w-32 text-slate-50 group-hover:scale-110 transition-transform duration-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Task Completati</p>
          <h4 className="text-5xl font-black font-display tracking-tight text-slate-900">{completedTasks.length}</h4>
        </div>
        <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-elegant relative overflow-hidden group">
          <Medal className="absolute -right-4 -top-4 h-32 w-32 text-slate-50 group-hover:scale-110 transition-transform duration-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Badge Sbloccati</p>
          <h4 className="text-5xl font-black font-display tracking-tight text-slate-900">{profile.badges?.length || 0}</h4>
        </div>
      </div>

      <div className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-8 sm:p-12 shadow-elegant">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 shadow-inner">
              <Trophy className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-black font-display text-slate-900 tracking-tight text-3xl">I Tuoi Badge</h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Colleziona badge completando task e guadagnando XP</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {badges.map(badge => {
            const isEarned = profile.badges?.includes(badge.id);
            return (
              <motion.div 
                key={badge.id}
                whileHover={isEarned ? { scale: 1.05, y: -5 } : {}}
                className={cn(
                  "group relative flex flex-col items-center justify-center rounded-[2.5rem] border p-8 transition-all duration-500",
                  isEarned 
                    ? "border-indigo-100 bg-white shadow-elegant hover:shadow-2xl hover:shadow-indigo-100/50" 
                    : "border-slate-100 bg-slate-50/50 opacity-40 grayscale"
                )}
              >
                <div className={cn(
                  "mb-4 flex h-20 w-20 items-center justify-center rounded-3xl transition-all duration-500",
                  isEarned ? "bg-indigo-50 shadow-inner group-hover:bg-white" : "bg-slate-100"
                )}>
                  <BadgeIcon name={badge.icon} className={cn("h-10 w-10", isEarned ? badge.color : "text-slate-400")} />
                </div>
                <p className={cn("text-center text-sm font-black font-display uppercase tracking-tight", isEarned ? "text-slate-900" : "text-slate-400")}>
                  {badge.name}
                </p>
                <p className="mt-2 text-center text-[10px] font-bold text-slate-400 leading-relaxed max-w-[120px]">
                  {badge.description}
                </p>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 mb-4 hidden w-56 -translate-x-1/2 flex-col items-center group-hover:flex z-50 pointer-events-none">
                  <div className="rounded-2xl bg-slate-900/95 backdrop-blur-sm p-4 text-center shadow-2xl border border-slate-800">
                    <p className="text-xs font-black font-display text-white uppercase tracking-wider">{badge.name}</p>
                    <p className="mt-1.5 text-[10px] font-medium text-slate-400 leading-relaxed">{badge.description}</p>
                  </div>
                  <div className="h-2 w-2 rotate-45 bg-slate-900 -mt-1"></div>
                </div>
                
                {isEarned && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rewards Section */}
      <div className="rounded-[3rem] border border-white bg-white/80 backdrop-blur-xl p-8 sm:p-12 shadow-elegant">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 shadow-inner">
            <Star className="h-8 w-8 text-rose-500" />
          </div>
          <div>
            <h3 className="font-black font-display text-slate-900 tracking-tight text-3xl">Premi Disponibili</h3>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Usa i tuoi XP per sbloccare premi reali</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map(reward => {
            const canAfford = totalEarnedXP >= reward.cost;
            return (
              <div key={reward.id} className={cn(
                "rounded-[2.5rem] border p-8 flex flex-col items-center text-center transition-all duration-500",
                canAfford ? "border-slate-100 bg-white shadow-elegant" : "border-slate-50 bg-slate-50/30 opacity-60"
              )}>
                <div className={cn("h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4", reward.color)}>
                  <BadgeIcon name={reward.icon} className="h-8 w-8" />
                </div>
                <h5 className="font-black font-display text-slate-900 text-xl">{reward.name}</h5>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{reward.cost} XP Necessari</p>
                <Button 
                  disabled={!canAfford}
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'users', profile.uid), {
                        score: increment(-reward.cost)
                      });
                      toast.success(`Hai riscattato: ${reward.name}!`, { icon: '🎁' });
                    } catch (error) {
                      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
                    }
                  }}
                  className={cn(
                    "mt-6 w-full rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest",
                    canAfford ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-200 text-slate-400"
                  )}
                >
                  {canAfford ? 'Riscatta Premio' : 'XP Insufficienti'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
