import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
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
  User as FirebaseUser
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
  deleteField
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Task, UserRole, TaskDifficulty, TaskStatus, BonusPenalty, Badge } from './types';
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
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, parseISO } from 'date-fns';
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
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'users'>('tasks');

  useEffect(() => {
    console.log("Initializing Auth listener...");
    const fallbackTimer = setTimeout(() => {
      if (loading) {
        console.warn("Auth listener timed out, forcing loading to false");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid || "No user");
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            console.log("Profile found:", docSnap.data());
            const data = docSnap.data() as UserProfile;
            // Upgrade to Admin if it's the special email and ensure approved
            if (firebaseUser.email === 'dennisbottari@gmail.com' && (data.role !== 'Admin' || !data.isApproved)) {
              const updatedProfile = { ...data, role: 'Admin' as UserRole, isApproved: true, badges: data.badges || [] };
              await setDoc(docRef, updatedProfile, { merge: true });
              setProfile(updatedProfile);
            } else {
              setProfile({ ...data, badges: data.badges || [] });
            }
          } else {
            console.log("No profile found for user:", firebaseUser.uid);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        clearTimeout(fallbackTimer);
        setLoading(false);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

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

    return () => {
      unsubscribeTasks();
      unsubscribeUsers();
    };
  }, [user]);

  const handleLogout = () => signOut(auth);

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

  if (!profile.isApproved) {
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
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">TaskQuest</h1>
                <p className="hidden xs:block text-[10px] sm:text-xs font-medium text-slate-500">Gamified Management</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 md:flex">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold text-slate-700">{profile.score} XP</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-3 border-l border-slate-200 pl-2 sm:pl-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">{profile.username}</p>
                  <p className="text-xs font-medium text-slate-500">
                    {profile.role === 'Admin' ? 'Admin' : profile.role === 'Responsabile' ? 'Responsabile' : 'Player'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowProfileModal(true)} className="rounded-full">
                  <Settings className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            {/* Main Content */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {profile.role === 'Admin' ? 'Pannello Admin' : profile.role === 'Responsabile' ? 'Gestione Task' : 'I Miei Task'}
                  </h2>
                  <p className="text-slate-500">
                    {(profile.role === 'Responsabile' || profile.role === 'Admin')
                      ? 'Crea e valida i task per il tuo team.' 
                      : 'Completa i task assegnati per guadagnare XP.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {profile.role === 'Admin' && (
                    <div className="mr-4 flex rounded-lg bg-slate-100 p-1">
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                          activeTab === 'tasks' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Task
                      </button>
                      <button
                        onClick={() => setActiveTab('users')}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                          activeTab === 'users' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Utenti
                      </button>
                    </div>
                  )}
                  {(profile.role === 'Responsabile' || profile.role === 'Admin') && (
                    <Button onClick={() => setShowTaskForm(true)} className="gap-2">
                      <Plus className="h-4 w-4" /> Nuovo Task
                    </Button>
                  )}
                </div>
              </div>

              {activeTab === 'tasks' ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {tasks
                    .filter(t => (profile.role === 'Responsabile' || profile.role === 'Admin') || t.assignees.includes(profile.uid))
                    .map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        role={profile.role} 
                        currentUid={profile.uid}
                        onAction={(t) => {
                          setSelectedTask(t);
                          if ((profile.role === 'Responsabile' || profile.role === 'Admin') && (t.status === 'In Revisione' || t.status === 'In corso')) {
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
              ) : (
                <UserManagement users={users} onUpdateUser={async (uid, updates) => {
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
                        const newBadgeIds = checkAndAwardBadges(updatedProfileForCheck, completedTasks);
                        
                        if (newBadgeIds.length > 0) {
                          updates.badges = [...(userProfile.badges || []), ...newBadgeIds];
                          newBadgeIds.forEach(bid => {
                            const b = BADGES.find(badge => badge.id === bid);
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
                    await deleteDoc(doc(db, 'users', uid));
                    toast.success("Utente eliminato con successo!");
                  } catch (error) {
                    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
                  }
                }} />
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-8">
              {/* Leaderboard */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <h3 className="font-bold text-slate-900">Classifica Player</h3>
                </div>
                <div className="space-y-4">
                  {users
                    .filter(u => u.role === 'Player')
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5)
                    .map((u, i) => (
                      <div key={u.uid} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                            i === 0 ? "bg-amber-100 text-amber-700" : 
                            i === 1 ? "bg-slate-100 text-slate-700" :
                            i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700">{u.username}</span>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{u.score} XP</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Badges Section */}
              {profile.role === 'Player' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className="h-5 w-5 text-indigo-500" />
                      <h3 className="font-bold text-slate-900">I Tuoi Badge</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {profile.badges?.length || 0} / {BADGES.length}
                    </span>
                  </div>
                  
                  {(!profile.badges || profile.badges.length === 0) ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className="text-xs text-slate-500 italic">Completa task per guadagnare badge!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {BADGES.map(badge => {
                        const isEarned = profile.badges?.includes(badge.id);
                        return (
                          <div 
                            key={badge.id}
                            className={cn(
                              "group relative flex flex-col items-center justify-center rounded-xl border p-2 transition-all",
                              isEarned ? "border-indigo-100 bg-indigo-50/50" : "border-slate-100 bg-slate-50/30 opacity-40 grayscale"
                            )}
                          >
                            <BadgeIcon name={badge.icon} className={cn("h-6 w-6", isEarned ? badge.color : "text-slate-400")} />
                            
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 mb-2 hidden w-48 -translate-x-1/2 flex-col items-center group-hover:flex z-10">
                              <div className="rounded-lg bg-slate-900 px-3 py-2 text-center shadow-xl">
                                <p className="text-xs font-bold text-white">{badge.name}</p>
                                <p className="mt-1 text-[10px] text-slate-400 leading-tight">{badge.description}</p>
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
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-900">Riepilogo</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-indigo-50 p-3 text-center">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">In Corso</p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {tasks.filter(t => t.status === 'In corso').length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Finiti</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {tasks.filter(t => t.status === 'Completato').length}
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
                (u.role === 'Player' && u.responsabileUid === profile.uid)
              )}
              creatorUid={profile.uid}
              task={taskToEdit || undefined}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            <h2 className="text-lg sm:text-xl font-bold">Area Personale</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-h-[80vh] overflow-y-auto">
          {/* Name Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
              <UserIcon className="h-4 w-4 text-indigo-500" /> Informazioni Personali
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Username"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Nome</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Cognome</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Cognome"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
            </form>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Password Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
              <Lock className="h-4 w-4 text-indigo-500" /> Cambia Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Password Attuale</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Nuova Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Conferma Nuova Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" variant="outline" className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50" disabled={passwordLoading}>
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <Gamepad2 className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">TaskQuest</h2>
          <p className="mt-2 text-slate-500">
            {isLogin ? 'Bentornato nel team!' : 'Inizia la tua avventura.'}
          </p>
        </div>

        {authError === 'operation-not-allowed' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-rose-50 p-4 border border-rose-100"
          >
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-bold text-rose-900 leading-tight">Configurazione Firebase Incompleta</p>
                <p className="text-xs text-rose-700 leading-relaxed">
                  I metodi di accesso (Email o Google) non sono ancora stati abilitati nella tua Console Firebase.
                </p>
                <a 
                  href="https://console.firebase.google.com/project/gen-lang-client-0012836386/authentication/providers" 
                  target="_blank" 
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 underline underline-offset-4"
                >
                  Abilita ora nella Console <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full gap-3 py-6" 
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Accedi con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500 font-medium">Oppure con username</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Username</label>
                <Input 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="es. MarioRossi" 
                  required 
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Conferma Password</label>
                    <Input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="••••••••" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Ruolo</label>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRole('Player')}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all",
                        role === 'Player' ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <UserIcon className="h-4 w-4" /> Player
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Responsabile')}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 transition-all",
                        role === 'Responsabile' ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      <Shield className="h-4 w-4" /> Responsabile
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>

            <Button type="submit" className="w-full py-6 text-base" disabled={loading}>
              {loading ? 'Caricamento...' : isLogin ? 'Accedi' : 'Registrati'}
            </Button>
          </form>
        </div>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  role: UserRole;
  currentUid: string;
  onAction: (t: Task) => void;
  onEdit?: (t: Task) => void;
  onDelete?: (t: Task) => void;
  key?: React.Key;
}

function TaskCard({ task, role, currentUid, onAction, onEdit, onDelete }: TaskCardProps) {
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
      await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
      toast.success(`Stato aggiornato a: ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  return (
    <motion.div 
      layout
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", difficultyColors[task.difficulty])}>
            {task.difficulty}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", statusColors[task.status])}>
            {task.status}
          </span>
        </div>
        {(role === 'Admin' || (role === 'Responsabile' && task.creatorUid === currentUid)) && task.status !== 'Completato' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit?.(task)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
              title="Modifica Task"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete?.(task)}
              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Elimina Task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <h3 className="mb-2 text-lg font-bold text-slate-900 line-clamp-1">{task.title}</h3>
      <p className="mb-4 text-sm text-slate-500 line-clamp-2">{task.description}</p>

      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Calendar className={cn("h-3.5 w-3.5", isOverdue ? "text-rose-500" : "text-slate-400")} />
          <span className={isOverdue ? "text-rose-600 font-bold" : "text-slate-500"}>
            {format(parseISO(task.deadline), 'dd MMM, HH:mm')}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
          <div className="flex -space-x-2">
            {task.assignees.map((uid, i) => (
              <div key={uid} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-bold text-indigo-600">
                U{i+1}
              </div>
            ))}
          </div>

          {isAssigned && task.status === 'In attesa' && (
            <Button size="sm" onClick={() => handleStatusUpdate('In corso')}>Accetta</Button>
          )}
          {isAssigned && task.status === 'In corso' && (
            <Button size="sm" variant="secondary" onClick={() => handleStatusUpdate('In Revisione')}>Concludi</Button>
          )}
          {(role === 'Responsabile' || role === 'Admin') && (task.status === 'In Revisione' || task.status === 'In corso') && (
            <Button size="sm" variant="primary" onClick={() => onAction(task)}>Valida</Button>
          )}
          {task.status === 'Completato' && (
            <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" /> +{task.finalScore} XP
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TaskFormModal({ onClose, players, creatorUid, task }: { onClose: () => void, players: UserProfile[], creatorUid: string, task?: Task }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [deadline, setDeadline] = useState(task ? format(parseISO(task.deadline), "yyyy-MM-dd'T'HH:mm") : '');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(task?.difficulty || 'Bronzo');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(task?.assignees || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlayers.length === 0) return toast.error("Seleziona almeno un player");

    try {
      if (task) {
        // Update existing task
        const taskRef = doc(db, 'tasks', task.id);
        const updates: Partial<Task> = {
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          difficulty,
          assignees: selectedPlayers
        };
        await updateDoc(taskRef, updates);
        toast.success("Task aggiornato con successo!");
      } else {
        // Create new task
        const taskRef = doc(collection(db, 'tasks'));
        const taskData: Task = {
          id: taskRef.id,
          title,
          description,
          deadline: new Date(deadline).toISOString(),
          difficulty,
          status: 'In attesa',
          assignees: selectedPlayers,
          creatorUid,
          bonuses: [],
          penalties: [],
          finalScore: 0,
          createdAt: new Date().toISOString()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{task ? 'Modifica Task' : 'Nuovo Task'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Titolo</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Descrizione</label>
            <textarea 
              className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              rows={3} 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Scadenza</label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Difficoltà</label>
              <select 
                className="w-full h-10 rounded-lg border border-slate-200 px-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as TaskDifficulty)}
              >
                {Object.keys(DIFFICULTY_SCORES).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Assegna a</label>
            <div className="mt-2 flex flex-wrap gap-2">
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
                    "rounded-full px-3 py-1 text-xs font-medium transition-all",
                    selectedPlayers.includes(p.uid) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p.username}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full py-6">{task ? 'Aggiorna Task' : 'Crea Task'}</Button>
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

// --- Helper Functions ---
function checkAndAwardBadges(profile: UserProfile, completedTasks: Task[], lastCompletedTask?: Task): string[] {
  const newBadgeIds: string[] = [];
  const currentBadgeIds = new Set(profile.badges || []);

  BADGES.forEach(badge => {
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
        if (count >= requirement.value) earned = true;
        break;
    }

    if (earned) {
      newBadgeIds.push(badge.id);
    }
  });

  return newBadgeIds;
}

function ScoringModal({ task, onClose }: { task: Task, onClose: () => void }) {
  const [selectedBonuses, setSelectedBonuses] = useState<string[]>([]);
  const [selectedPenalties, setSelectedPenalties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const baseScore = DIFFICULTY_SCORES[task.difficulty];
  const bonusTotal = BONUSES.filter(b => selectedBonuses.includes(b.id)).reduce((acc, b) => acc + b.value, 0);
  const penaltyTotal = PENALTIES.filter(p => selectedPenalties.includes(p.id)).reduce((acc, p) => acc + p.value, 0);
  const finalScore = Math.max(0, baseScore + bonusTotal + penaltyTotal);

  const handleValidate = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Update task
      const taskRef = doc(db, 'tasks', task.id);
      batch.update(taskRef, {
        status: 'Completato',
        bonuses: selectedBonuses,
        penalties: selectedPenalties,
        finalScore: finalScore
      });

      // Update each assignee's score and check for badges
      for (const uid of task.assignees) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userProfile = userSnap.data() as UserProfile;
          const newScore = userProfile.score + finalScore;
          
          // We need all completed tasks for this user to check badges accurately
          // This is a bit expensive, but necessary for accurate badge awarding
          const q = query(
            collection(db, 'tasks'),
            where('assignees', 'array-contains', uid),
            where('status', '==', 'Completato')
          );
          const completedTasksSnap = await getDocs(q);
          const completedTasks = completedTasksSnap.docs.map(d => d.data() as Task);
          
          // Add the current task to the list as it's being completed
          const updatedCompletedTasks = [...completedTasks, { ...task, status: 'Completato' as TaskStatus }];
          
          const updatedProfileForCheck = { ...userProfile, score: newScore };
          const newBadgeIds = checkAndAwardBadges(updatedProfileForCheck, updatedCompletedTasks, task);
          
          if (newBadgeIds.length > 0) {
            batch.update(userRef, { 
              score: newScore,
              badges: [...(userProfile.badges || []), ...newBadgeIds]
            });
            newBadgeIds.forEach(bid => {
              const b = BADGES.find(badge => badge.id === bid);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Validazione Task</h2>
            <p className="text-xs sm:text-sm text-slate-500">{task.title} ({task.difficulty})</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Penalties */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-rose-600">
                <MinusCircle className="h-4 w-4" /> Penali (Errori)
              </h3>
              <div className="space-y-2">
                {PENALTIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPenalties(prev => 
                      prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                    )}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all",
                      selectedPenalties.includes(p.id) ? "border-rose-200 bg-rose-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-sm font-bold text-rose-600">{p.value}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Bonuses */}
            <section>
              <h3 className="mb-4 flex items-center gap-2 font-bold text-emerald-600">
                <PlusCircle className="h-4 w-4" /> Bonus
              </h3>
              <div className="space-y-2">
                {BONUSES.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBonuses(prev => 
                      prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                    )}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all",
                      selectedBonuses.includes(b.id) ? "border-emerald-200 bg-emerald-50" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <span className="text-sm font-medium">{b.label}</span>
                    <span className="text-sm font-bold text-emerald-600">+{b.value}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Base</p>
              <p className="text-lg font-bold text-slate-700">{baseScore}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Modificatori</p>
              <p className={cn("text-lg font-bold", (bonusTotal + penaltyTotal) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {(bonusTotal + penaltyTotal) >= 0 ? '+' : ''}{bonusTotal + penaltyTotal}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase text-indigo-400">Totale</p>
              <p className="text-2xl font-black text-indigo-600">{finalScore} XP</p>
            </div>
          </div>
          <Button onClick={handleValidate} disabled={loading} className="px-8 py-6 text-lg">
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

function UserManagement({ users, onUpdateUser, onDeleteUser }: { 
  users: UserProfile[], 
  onUpdateUser: (uid: string, updates: Partial<UserProfile>) => void,
  onDeleteUser: (uid: string) => void
}) {
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const responsabili = users.filter(u => u.role === 'Responsabile' || u.role === 'Admin');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-lg font-bold text-slate-900">Gestione Utenti</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="pb-4 font-semibold">Username</th>
                <th className="pb-4 font-semibold">Ruolo</th>
                <th className="pb-4 font-semibold">Approvato</th>
                <th className="pb-4 font-semibold">Responsabile</th>
                <th className="pb-4 font-semibold">Punteggio</th>
                <th className="pb-4 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.uid} className="hover:bg-slate-50/50">
                  <td className="py-4 font-medium text-slate-900">{u.username}</td>
                  <td className="py-4">
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateUser(u.uid, { role: e.target.value as UserRole })}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Player">Player</option>
                      <option value="Responsabile">Responsabile</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-4">
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
                  </td>
                  <td className="py-4">
                    {u.role === 'Player' ? (
                      <select
                        value={u.responsabileUid || ''}
                        onChange={(e) => onUpdateUser(u.uid, { responsabileUid: e.target.value || deleteField() as any })}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Nessuno</option>
                        {responsabili.map(r => (
                          <option key={r.uid} value={r.uid}>{r.username}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">-</span>
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
                  <td className="py-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      onClick={() => setUserToDelete(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
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
