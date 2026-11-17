import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { CloudStatus, FamilyDocument, FamilyFirebaseConfig } from './cloud';
import { createFamilyAccount, friendlyFirebaseError, loginFamilyAccount, logoutFamilyAccount, parseFirebaseConfig, readFirebaseConfig, storeFirebaseConfig, watchAuth, watchFamilyData, writeFamilyData } from './cloud';
import CloudSettings from './CloudSettings';
import CashoutForm from './CashoutForm';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, Bell, CalendarDays, Check, CheckCircle2, ChevronLeft, CircleHelp, Cloud, CloudOff,
  Coins, Download, Dumbbell, FileText, Gift, Heart, House, Languages, Menu,
  Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Star, Target, Trash2,
  Trophy, Users, Wallet, X, BookOpen, BookMarked,
} from 'lucide-react';

type Child = { id: string; name: string; birthDate: string; avatar: string; color: string; balance: number };
type TaskStatus = 'pending' | 'done';
type Task = { id: string; title: string; childId: string; points: number; status: TaskStatus; category: string; date: string; dayKey: string; routineId?: string };
type Routine = { id: string; title: string; childId: string; points: number; category: string; active: boolean };
type Reward = { id: string; title: string; points: number; emoji: string; color: string };
type ActivityItem = { id: string; text: string; detail: string; time: string; kind: 'earn' | 'spend' | 'task'; points?: number; money?: number };
type AppData = { version: number; children: Child[]; tasks: Task[]; routines: Routine[]; rewards: Reward[]; activity: ActivityItem[]; pointsToToman: number; dayKey: string };
type Tab = 'خانه' | 'فرزندان' | 'کارها' | 'جایزه‌ها' | 'گزارش' | 'تنظیمات';
type ModalType = 'child' | 'task' | 'routine' | 'reward' | null;

const STORAGE_KEY = 'setareh-family-data-v2';
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const SEED_CHILDREN: Child[] = [
  { id: 'child-mh', name: 'محمد حسین', birthDate: '1394-01-26', avatar: '👦🏻', color: 'blue', balance: 0 },
  { id: 'child-mm', name: 'محمد مهدی', birthDate: '1396-12-02', avatar: '🧒🏻', color: 'green', balance: 0 },
  { id: 'child-z', name: 'زهرا', birthDate: '1405-08-12', avatar: '👶🏻', color: 'pink', balance: 0 },
];
const DEFAULT_REWARDS: Reward[] = [
  { id: 'reward-game', title: 'یک ساعت بازی', points: 50, emoji: '🎮', color: 'lavender' },
  { id: 'reward-treat', title: 'انتخاب خوراکی', points: 35, emoji: '🍰', color: 'peach' },
  { id: 'reward-outing', title: 'تفریح خانوادگی', points: 80, emoji: '🛝', color: 'mint' },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const toFa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const digitsToLatin = (value: string) => value.replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(d) % 10));
const jalaliToday = () => {
  const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const value = (key: string) => Number(parts.find(part => part.type === key)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day') };
};
const todayKey = () => { const { year, month, day } = jalaliToday(); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };
const isValidJalaliDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (year < 1200 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const offset = month <= 6 ? (month - 1) * 31 + day - 1 : month <= 11 ? 186 + (month - 7) * 30 + day - 1 : 336 + day - 1;
  const approximate = Date.UTC(year + 621, 2, 20) + offset * 86_400_000;
  const calendar = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const matchesJalaliDay = [-2, -1, 0, 1, 2].some(delta => {
    const parts = calendar.formatToParts(new Date(approximate + delta * 86_400_000));
    const part = (type: string) => Number(parts.find(item => item.type === type)?.value ?? 0);
    return part('year') === year && part('month') === month && part('day') === day;
  });
  const now = jalaliToday();
  return matchesJalaliDay && (year < now.year || (year === now.year && (month < now.month || (month === now.month && day <= now.day))));
};
const todayLabel = () => { const { year, month, day } = jalaliToday(); return `${toFa(day)} ${MONTHS[month - 1]} ${toFa(year)}`; };
const formatBirthDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return value;
  const month = Number(match[2]);
  return `${toFa(Number(match[3]))} ${MONTHS[month - 1] ?? ''} ${toFa(Number(match[1]))}`;
};
const ageLabel = (birthDate: string) => {
  const parts = birthDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 'تاریخ تولد ثبت نشده';
  const now = jalaliToday();
  let years = now.year - parts[0];
  if (now.month < parts[1] || (now.month === parts[1] && now.day < parts[2])) years -= 1;
  return years < 1 ? 'نوزاد' : `${toFa(years)} ساله`;
};
const toman = (points: number, rate: number) => `${toFa(points * rate)} تومان`;
const createRoutineDefaults = (children: Child[]): Routine[] => {
  const daily = [
    { title: 'درس و گفت‌وگوی درسی', category: 'درس و گفت‌وگو' },
    { title: 'تمرین و حفظ زبان انگلیسی', category: 'زبان انگلیسی' },
    { title: 'حفظ قرآن', category: 'قرآن' },
    { title: 'ورزش روزانه', category: 'ورزش' },
  ];
  return children.flatMap(child => {
    const age = ageLabel(child.birthDate);
    if (age === 'نوزاد') return [];
    return daily.map(item => ({ id: uid(), title: item.title, category: item.category, childId: child.id, points: 1, active: true }));
  });
};
const routineTask = (routine: Routine, day: string): Task => ({
  id: uid(), routineId: routine.id, title: routine.title, childId: routine.childId,
  points: routine.points, status: 'pending', category: routine.category, date: todayLabel(), dayKey: day,
});
const rolloverTasks = (tasks: Task[], routines: Routine[], day: string) => {
  const alreadyCreated = new Set(tasks.filter(task => task.dayKey === day && task.routineId).map(task => task.routineId));
  const todaysRoutines = routines.filter(routine => routine.active && !alreadyCreated.has(routine.id));
  return [...todaysRoutines.map(routine => routineTask(routine, day)), ...tasks];
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validAppData = (value: unknown): value is AppData => {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.children) || !Array.isArray(value.tasks) || !Array.isArray(value.routines) || !Array.isArray(value.rewards) || !Array.isArray(value.activity)) return false;
  if (typeof value.pointsToToman !== 'number' || !Number.isSafeInteger(value.pointsToToman) || value.pointsToToman < 1) return false;
  const validIdName = (item: unknown) => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string';
  const safeInteger = (input: unknown) => typeof input === 'number' && Number.isSafeInteger(input);
  return value.children.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.birthDate === 'string' && typeof item.avatar === 'string' && typeof item.color === 'string' && safeInteger(item.balance) && Number(item.balance) >= 0)
    && value.tasks.every(item => validIdName(item) && typeof item.childId === 'string' && safeInteger(item.points) && Number(item.points) > 0 && (item.status === 'pending' || item.status === 'done') && typeof item.category === 'string' && typeof item.date === 'string' && typeof item.dayKey === 'string')
    && value.routines.every(item => validIdName(item) && typeof item.childId === 'string' && safeInteger(item.points) && Number(item.points) > 0 && typeof item.category === 'string' && typeof item.active === 'boolean')
    && value.rewards.every(item => validIdName(item) && safeInteger(item.points) && Number(item.points) > 0 && typeof item.emoji === 'string' && typeof item.color === 'string')
    && value.activity.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.detail === 'string' && typeof item.time === 'string' && ['earn', 'spend', 'task'].includes(String(item.kind)) && (item.points === undefined || (safeInteger(item.points) && Number(item.points) >= 0)) && (item.money === undefined || (safeInteger(item.money) && Number(item.money) >= 0)));
};
const freshData = (): AppData => {
  const children = SEED_CHILDREN.map(child => ({ ...child }));
  const routines = createRoutineDefaults(children);
  const day = todayKey();
  return {
    version: 2,
    children,
    routines,
    tasks: routines.map(routine => routineTask(routine, day)),
    rewards: DEFAULT_REWARDS.map(reward => ({ ...reward })),
    activity: [],
    pointsToToman: 1000,
    dayKey: day,
  };
};
function loadData(): AppData {
  const defaults = freshData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<AppData>;
    if (saved.version !== 2 || !Array.isArray(saved.children) || !saved.children.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.birthDate === 'string' && typeof item.avatar === 'string' && typeof item.color === 'string' && Number.isSafeInteger(item.balance) && Number(item.balance) >= 0)) return defaults;
    const children = saved.children;
    const routines = Array.isArray(saved.routines) && saved.routines.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.childId === 'string' && Number.isSafeInteger(item.points) && Number(item.points) > 0 && typeof item.category === 'string' && typeof item.active === 'boolean') ? saved.routines as Routine[] : createRoutineDefaults(children);
    let tasks = Array.isArray(saved.tasks) && saved.tasks.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.childId === 'string' && Number.isSafeInteger(item.points) && Number(item.points) > 0 && (item.status === 'pending' || item.status === 'done') && typeof item.category === 'string' && typeof item.date === 'string' && typeof item.dayKey === 'string') ? saved.tasks as Task[] : [];
    const day = todayKey();
    if (saved.dayKey !== day) tasks = rolloverTasks(tasks, routines, day);
    const restored = {
      ...defaults,
      ...saved,
      children,
      routines,
      tasks,
      rewards: Array.isArray(saved.rewards) ? saved.rewards : defaults.rewards,
      activity: Array.isArray(saved.activity) ? saved.activity : [],
      pointsToToman: Number(saved.pointsToToman) > 0 ? Number(saved.pointsToToman) : 1000,
      dayKey: day,
    } as AppData;
    return validAppData(restored) ? restored : defaults;
  } catch {
    return defaults;
  }
}

function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [firebaseConfig, setFirebaseConfig] = useState<FamilyFirebaseConfig | null>(readFirebaseConfig);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(readFirebaseConfig() ? 'signed-out' : 'unconfigured');
  const [cloudMessage, setCloudMessage] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const lastCloudState = useRef('');
  const [tab, setTab] = useState<Tab>('خانه');
  const [modal, setModal] = useState<ModalType>(null);
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [editing, setEditing] = useState<Child | Task | Routine | Reward | undefined>();
  const [toast, setToast] = useState('');
  const [selectedChild, setSelectedChild] = useState('all');
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { setToast('ذخیره‌سازی دستگاه انجام نشد؛ فضای خالی دستگاه را بررسی و از اطلاعات پشتیبان بگیرید.'); }
  }, [data]);
  useEffect(() => {
    if (!firebaseConfig) { setCloudUser(null); setCloudStatus('unconfigured'); setCloudReady(false); return; }
    setCloudStatus('connecting');
    return watchAuth(firebaseConfig, user => {
      setCloudUser(user);
      setCloudReady(false);
      setCloudStatus(user ? 'connecting' : 'signed-out');
      lastCloudState.current = '';
    }, error => { setCloudStatus('error'); setCloudMessage(friendlyFirebaseError(error)); });
  }, [firebaseConfig]);
  useEffect(() => {
    if (!firebaseConfig || !cloudUser) return;
    setCloudReady(false);
    setCloudStatus('connecting');
    lastCloudState.current = JSON.stringify(data);
    const unsubscribe = watchFamilyData(firebaseConfig, cloudUser.uid, data as unknown as FamilyDocument, remote => {
      let incoming = remote as AppData;
      if (!validAppData(incoming)) {
        setCloudStatus('error'); setCloudMessage('ساختار اطلاعات حساب ابری با این نسخه سازگار نیست.'); return;
      }
      const remoteSerialized = JSON.stringify(incoming);
      const day = todayKey();
      if (incoming.dayKey !== day) incoming = { ...incoming, dayKey: day, tasks: rolloverTasks(incoming.tasks, incoming.routines, day) };
      const serialized = JSON.stringify(incoming);
      lastCloudState.current = remoteSerialized;
      setData(current => JSON.stringify(current) === serialized ? current : incoming);
      setCloudMessage('');
    }, () => { setCloudReady(true); setCloudStatus('online'); }, error => {
      setCloudStatus('error'); setCloudMessage(friendlyFirebaseError(error));
    });
    return () => unsubscribe();
  }, [firebaseConfig, cloudUser]);
  useEffect(() => {
    if (!firebaseConfig || !cloudUser || !cloudReady || cloudStatus !== 'online') return;
    const serialized = JSON.stringify(data);
    if (serialized === lastCloudState.current) return;
    const timer = window.setTimeout(() => {
      void writeFamilyData(firebaseConfig, cloudUser.uid, data as unknown as FamilyDocument).then(() => {
        lastCloudState.current = serialized; setCloudStatus('online'); setCloudMessage('');
      }).catch(error => { setCloudStatus('error'); setCloudMessage(friendlyFirebaseError(error)); });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [data, firebaseConfig, cloudUser, cloudReady, cloudStatus]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 3200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    const refreshDay = () => setData(current => {
      const day = todayKey();
      if (current.dayKey === day) return current;
      return { ...current, dayKey: day, tasks: rolloverTasks(current.tasks, current.routines, day) };
    });
    const timer = window.setInterval(refreshDay, 60_000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);

  const todayTasks = useMemo(() => data.tasks.filter(task => task.dayKey === todayKey()), [data.tasks]);
  const pending = todayTasks.filter(task => task.status === 'pending');
  const finished = todayTasks.filter(task => task.status === 'done');
  const totalPoints = data.children.reduce((sum, child) => sum + child.balance, 0);
  const filteredTasks = data.tasks.filter(task => (showTaskHistory || task.dayKey === todayKey()) && (selectedChild === 'all' || task.childId === selectedChild) && task.title.includes(query));
  const navItems: { label: Tab; icon: typeof House }[] = [
    { label: 'خانه', icon: House }, { label: 'فرزندان', icon: Users }, { label: 'کارها', icon: CheckCircle2 },
    { label: 'جایزه‌ها', icon: Gift }, { label: 'گزارش', icon: Activity }, { label: 'تنظیمات', icon: Settings },
  ];
  const openModal = (type: ModalType, item?: Child | Task | Routine | Reward) => { setEditing(item); setModal(type); };
  const closeModal = () => { setModal(null); setEditing(undefined); };
  const setPage = (next: Tab) => { setTab(next); setMobileMenu(false); };

  const approveTask = (task: Task) => {
    const child = data.children.find(item => item.id === task.childId);
    if (!child || task.status === 'done') return;
    setData(current => {
      const currentTask = current.tasks.find(item => item.id === task.id);
      const currentChild = current.children.find(item => item.id === currentTask?.childId);
      if (!currentTask || currentTask.status === 'done' || !currentChild) return current;
      return {
        ...current,
        children: current.children.map(item => item.id === currentChild.id ? { ...item, balance: item.balance + currentTask.points } : item),
        tasks: current.tasks.map(item => item.id === currentTask.id ? { ...item, status: 'done' } : item),
        activity: [{ id: uid(), text: currentTask.title, detail: `${currentChild.name} · ${toFa(currentTask.points)} ستاره گرفت`, points: currentTask.points, time: `امروز، ${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`, kind: 'earn' }, ...current.activity],
      };
    });
    setToast(`آفرین به ${child.name}! ${toFa(task.points)} ستاره (${toman(task.points, data.pointsToToman)}) به حسابش اضافه شد.`);
  };
  const redeemReward = (reward: Reward, child: Child) => {
    if (child.balance < reward.points) { setToast(`ستاره‌های ${child.name} برای این جایزه کافی نیست.`); return; }
    setData(current => {
      const currentChild = current.children.find(item => item.id === child.id);
      const currentReward = current.rewards.find(item => item.id === reward.id);
      if (!currentChild || !currentReward || currentChild.balance < currentReward.points) return current;
      return {
        ...current,
        children: current.children.map(item => item.id === currentChild.id ? { ...item, balance: item.balance - currentReward.points } : item),
        activity: [{ id: uid(), text: currentReward.title, detail: `${currentChild.name} · ${toFa(currentReward.points)} ستاره خرج کرد`, points: currentReward.points, time: `امروز، ${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`, kind: 'spend' }, ...current.activity],
      };
    });
    setToast(`جایزه‌ی «${reward.title}» برای ${child.name} ثبت شد.`);
  };
  const cashOutStars = (childId: string, stars: number) => {
    const child = data.children.find(item => item.id === childId);
    if (!child || !Number.isInteger(stars) || stars < 1 || stars > child.balance) return;
    setData(current => {
      const currentChild = current.children.find(item => item.id === childId);
      if (!currentChild || !Number.isInteger(stars) || stars < 1 || stars > currentChild.balance) return current;
      const currentMoney = stars * current.pointsToToman;
      return {
        ...current,
        children: current.children.map(item => item.id === childId ? { ...item, balance: item.balance - stars } : item),
        activity: [{ id: uid(), text: 'دریافت پاداش نقدی', detail: `${currentChild.name} · ${toFa(stars)} ستاره تبدیل به ${toman(stars, current.pointsToToman)} شد`, points: stars, money: currentMoney, time: `امروز، ${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`, kind: 'spend' }, ...current.activity],
      };
    });
    setCashoutOpen(false);
    setToast(`${toFa(stars)} ستاره‌ی ${child.name} با موفقیت به ${toman(stars, data.pointsToToman)} تبدیل شد.`);
  };
  const saveChild = (input: Omit<Child, 'id' | 'balance' | 'color'>, id?: string) => {
    if (id) {
      setData(current => {
        const updated = current.children.find(child => child.id === id);
        if (!updated) return current;
        const nextChild = { ...updated, ...input };
        const isNewborn = ageLabel(nextChild.birthDate) === 'نوزاد';
        const defaults = !isNewborn && !current.routines.some(routine => routine.childId === id) ? createRoutineDefaults([nextChild]) : [];
        const routines = [...current.routines.map(routine => routine.childId === id && isNewborn ? { ...routine, active: false } : routine), ...defaults];
        const tasks = [
          ...(defaults.length ? defaults.map(routine => routineTask(routine, todayKey())) : []),
          ...current.tasks.filter(task => !(isNewborn && task.childId === id && task.routineId && task.status === 'pending' && task.dayKey === todayKey())),
        ];
        return { ...current, children: current.children.map(child => child.id === id ? nextChild : child), routines, tasks };
      });
      setToast('اطلاعات فرزند ویرایش شد.');
    } else {
      const child: Child = { id: uid(), ...input, color: 'blue', balance: 0 };
      const routines = createRoutineDefaults([child]);
      setData(current => ({ ...current, children: [...current.children, child], routines: [...current.routines, ...routines], tasks: [...routines.map(routine => routineTask(routine, todayKey())), ...current.tasks] }));
      setToast(`${child.name} به خانواده اضافه شد.`);
    }
    closeModal();
  };
  const removeChild = (child: Child) => {
    if (!window.confirm(`«${child.name}» و کارهای روزانه‌ی مربوط به او حذف شود؟ ستاره موجودی هم پاک می‌شود.`)) return;
    setData(current => ({ ...current, children: current.children.filter(item => item.id !== child.id), routines: current.routines.filter(item => item.childId !== child.id), tasks: current.tasks.filter(item => item.childId !== child.id) }));
    setToast(`${child.name} حذف شد.`);
  };
  const saveTask = (input: Omit<Task, 'id' | 'status' | 'date' | 'dayKey' | 'routineId'>, id?: string) => {
    if (id) setData(current => ({ ...current, tasks: current.tasks.map(task => task.id === id && task.status === 'pending' ? { ...task, ...input } : task) }));
    else setData(current => ({ ...current, tasks: [{ id: uid(), ...input, status: 'pending', date: todayLabel(), dayKey: todayKey() }, ...current.tasks] }));
    setToast(id ? 'کار ویرایش شد.' : 'کار تازه برای امروز ثبت شد.'); closeModal();
  };
  const removeTask = (task: Task) => {
    if (task.status === 'done') return;
    if (!window.confirm(`کار «${task.title}» حذف شود؟`)) return;
    setData(current => ({ ...current, tasks: current.tasks.filter(item => item.id !== task.id || item.status === 'done') }));
    setToast('کار حذف شد.');
  };
  const saveRoutine = (input: Omit<Routine, 'id' | 'active'>, id?: string) => {
    if (id) {
      setData(current => ({
        ...current,
        routines: current.routines.map(routine => routine.id === id ? { ...routine, ...input } : routine),
        tasks: current.tasks.map(task => task.routineId === id && task.status === 'pending' && task.dayKey === todayKey() ? { ...task, ...input } : task),
      }));
      setToast('برنامه‌ی روزانه ویرایش شد.');
    } else {
      const routine: Routine = { id: uid(), ...input, active: true };
      setData(current => ({ ...current, routines: [...current.routines, routine], tasks: [routineTask(routine, todayKey()), ...current.tasks] }));
      setToast('برنامه‌ی روزانه اضافه شد.');
    }
    closeModal();
  };
  const toggleRoutine = (routine: Routine) => {
    setData(current => {
      const enabled = !routine.active;
      const hasTodayTask = current.tasks.some(task => task.routineId === routine.id && task.dayKey === todayKey());
      const tasks = enabled && !hasTodayTask ? [routineTask({ ...routine, active: true }, todayKey()), ...current.tasks] : current.tasks;
      return { ...current, routines: current.routines.map(item => item.id === routine.id ? { ...item, active: enabled } : item), tasks };
    });
    setToast(routine.active ? 'این برنامه از فردا متوقف می‌شود.' : 'برنامه فعال شد و کار امروز هم اضافه شد.');
  };
  const removeRoutine = (routine: Routine) => {
    if (!window.confirm(`برنامه‌ی تکرارشونده‌ی «${routine.title}» حذف شود؟ سابقه‌ی کارهای ثبت‌شده حفظ می‌شود.`)) return;
    setData(current => ({ ...current, routines: current.routines.filter(item => item.id !== routine.id), tasks: current.tasks.map(task => task.routineId === routine.id ? { ...task, routineId: undefined } : task) }));
    setToast('برنامه‌ی روزانه حذف شد؛ سابقه‌ی کارها حفظ شد.');
  };
  const saveReward = (title: string, points: number, emoji: string, id?: string) => {
    if (id) setData(current => ({ ...current, rewards: current.rewards.map(reward => reward.id === id ? { ...reward, title, points, emoji } : reward) }));
    else setData(current => ({ ...current, rewards: [...current.rewards, { id: uid(), title, points, emoji, color: 'lavender' }] }));
    setToast(id ? 'جایزه ویرایش شد.' : 'جایزه‌ی تازه ساخته شد.'); closeModal();
  };
  const removeReward = (reward: Reward) => {
    if (!window.confirm(`جایزه‌ی «${reward.title}» حذف شود؟`)) return;
    setData(current => ({ ...current, rewards: current.rewards.filter(item => item.id !== reward.id) }));
    setToast('جایزه حذف شد.');
  };
  const saveCloudConfiguration = (configuration: FamilyFirebaseConfig) => {
    storeFirebaseConfig(configuration);
    lastCloudState.current = '';
    setFirebaseConfig(configuration);
    setCloudMessage('');
    setToast('تنظیمات Firebase ذخیره شد. حالا حساب خانواده را بسازید یا وارد شوید.');
  };
  const registerCloudAccount = async (email: string, password: string) => {
    if (!firebaseConfig) return;
    try { await createFamilyAccount(firebaseConfig, email, password); setToast('حساب خانواده ساخته شد و همگام‌سازی آغاز شد. از همین ایمیل و رمز در گوشی‌های دیگر استفاده کنید.'); }
    catch (error) { setCloudMessage(friendlyFirebaseError(error)); }
  };
  const loginCloudAccount = async (email: string, password: string) => {
    if (!firebaseConfig) return;
    try { await loginFamilyAccount(firebaseConfig, email, password); setToast('وارد حساب خانواده شدید؛ اطلاعات در حال همگام‌سازی است.'); }
    catch (error) { setCloudMessage(friendlyFirebaseError(error)); }
  };
  const logoutCloudAccount = async () => {
    if (!firebaseConfig) return;
    try { await logoutFamilyAccount(firebaseConfig); setToast('از حساب ابری خارج شدید؛ اطلاعات همین گوشی باقی می‌ماند.'); }
    catch (error) { setCloudMessage(friendlyFirebaseError(error)); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ format: 'setareh-family-backup-v1', data, firebaseConfig }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'setareh-backup.json'; link.click(); URL.revokeObjectURL(url);
    setToast('نسخه‌ی پشتیبان دریافت شد.');
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as { data?: AppData; firebaseConfig?: FamilyFirebaseConfig } & Partial<AppData>;
      const imported = (backup.data ?? backup) as AppData;
      const importedConfig = backup.firebaseConfig ? parseFirebaseConfig(JSON.stringify(backup.firebaseConfig)) : null;
      if (!validAppData(imported)) throw new Error('invalid file');
      if (!window.confirm('اطلاعات فعلی با نسخه‌ی پشتیبان جایگزین شود؟')) return;
      const day = todayKey();
      const tasks = imported.dayKey === day ? imported.tasks : rolloverTasks(imported.tasks, imported.routines, day);
      setData({ ...freshData(), ...imported, tasks, pointsToToman: Number(imported.pointsToToman) || 1000, dayKey: day });
      if (importedConfig) { storeFirebaseConfig(importedConfig); setFirebaseConfig(importedConfig); }
      setToast(importedConfig ? 'نسخه‌ی پشتیبان و تنظیمات Firebase بازیابی شد؛ حالا وارد حساب خانواده شوید.' : 'نسخه‌ی پشتیبان بازیابی شد.');
    } catch { setToast('فایل پشتیبان معتبر نیست.'); }
  };

  const dashboard = <>
    <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> فضای گرم خانواده‌ی شما</div><h1>سلام، روزتون پر از <em>لبخند!</em> <span>☀️</span></h1><p>برای محمد حسین، محمد مهدی و زهرا یک روز پربار و شاد بسازیم.</p></div><button className="primary-btn" onClick={() => openModal('task')}><Plus size={18}/> تعریف کار</button></section>
    <section className="hero-card"><div className="hero-copy"><span className="hero-pill"><Sparkles size={14}/> رشد با مهربانی</span><h2>هر تلاش کوچیک،<br/>یک درخشش بزرگه! <span>✨</span></h2><p>یک ستاره برابر است با {toFa(data.pointsToToman)} تومان جایزه.</p><div className="hero-stats"><div><strong>{toFa(finished.length)}</strong><span>کار انجام‌شده امروز</span></div><i/><div><strong>{toFa(totalPoints)}</strong><span>ستاره بچه‌ها</span></div></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="sun-blob">🌟</div><span className="float-star star-one">✦</span><span className="float-star star-two">✧</span><span className="float-star star-three">✦</span><span className="art-sparkle">✧</span></div><div className="hero-decoration">✿</div></section>
    <section className="stats-grid"><StatCard icon={<CheckCircle2/>} label="کارهای امروز در انتظار تأیید" value={toFa(pending.length)} note={pending.length ? 'با تأیید، ستاره اضافه می‌شود' : 'همه‌چیز مرتبه'} tone="amber"/><StatCard icon={<Coins/>} label="موجودی کل ستاره‌ها" value={toFa(totalPoints)} note={toman(totalPoints, data.pointsToToman)} tone="green"/><StatCard icon={<Trophy/>} label="جایزه‌های آماده" value={toFa(data.rewards.length)} note="برای انگیزه‌ی بیشتر" tone="violet"/><StatCard icon={<Target/>} label="اعضای خانواده" value={toFa(data.children.length)} note="هر روز یک قدم بهتر" tone="blue"/></section>
    <div className="dashboard-grid"><section className="panel pending-panel"><div className="section-head"><div><h3>کارهای امروز <span className="small-count">{toFa(pending.length)}</span></h3><p>پس از انجام کار، والد ستاره را تأیید می‌کند.</p></div><button className="text-link" onClick={() => setPage('کارها')}>مدیریت کارها <ChevronLeft size={16}/></button></div>{pending.length ? <div className="task-list">{pending.slice(0, 5).map(task => <TaskRow key={task.id} task={task} child={data.children.find(child => child.id === task.childId)} onApprove={() => approveTask(task)} onEdit={() => openModal(task.routineId ? 'routine' : 'task', task.routineId ? data.routines.find(r => r.id === task.routineId) : task)} onDelete={() => removeTask(task)} rate={data.pointsToToman}/>)}</div> : <EmptyState icon="🎉" title="کار منتظر تأیید نداریم" text="برنامه‌ی فردا آماده است؛ یک کار دیگر هم می‌توانید اضافه کنید." button="تعریف کار" onClick={() => openModal('task')}/>}</section>
      <section className="panel children-panel"><div className="section-head"><div><h3>بچه‌های خانواده</h3><p>ستاره و جایزه‌ی هر نفر.</p></div><button className="round-add" onClick={() => openModal('child')} aria-label="افزودن فرزند"><Plus size={20}/></button></div><div className="child-list">{data.children.map(child => <ChildRow key={child.id} child={child} pointsToToman={data.pointsToToman}/>)}</div><button className="soft-btn full-btn" onClick={() => setPage('فرزندان')}>مدیریت فرزندان <ChevronLeft size={15}/></button></section>
      <section className="panel activity-panel"><div className="section-head"><div><h3>تازه‌های خانواده</h3><p>تلاش‌ها و جایزه‌های اخیر.</p></div><button className="text-link" onClick={() => setPage('گزارش')}>گزارش کامل <ChevronLeft size={16}/></button></div><ActivityList items={data.activity.slice(0, 5)}/>{!data.activity.length && <p className="empty-inline">با تأیید اولین کار، گزارش اینجا نمایش داده می‌شود.</p>}</section>
      <section className="quote-card"><div className="quote-top"><span className="quote-icon">💛</span><span className="quote-label">یادآوری امروز</span></div><blockquote>«تشویق، تلاش بچه‌ها را به عادت‌های قشنگ تبدیل می‌کند.»</blockquote><div className="quote-bottom"><span/> یک جمله‌ی مهربان، روزی به‌یادماندنی می‌سازد <span>✦</span></div><div className="quote-decoration">“</div></section></div>
  </>;

  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileMenu ? 'show' : ''}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={22}/></span><div><strong>ستاره</strong><small>با هم رشد می‌کنیم</small></div><button className="icon-btn close-menu" onClick={() => setMobileMenu(false)} aria-label="بستن منو"><X size={20}/></button></div>
      <div className="family-card"><div className="family-avatar">🏡</div><div><strong>خانواده‌ی ما</strong><span>{toFa(data.children.length)} عضو</span></div><ChevronLeft size={18} className="muted"/></div>
      <div className="menu-caption">منوی اصلی</div><nav className="side-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? 'active' : ''}`} onClick={() => setPage(label)}><Icon size={20}/><span>{label}</span>{label === 'کارها' && pending.length > 0 && <b className="nav-count">{toFa(pending.length)}</b>}</button>)}</nav>
      <div className="sidebar-spacer"/><div className="tip-card"><div className="tip-icon"><Heart size={18}/></div><b>یک قدم کوچک، یک عادت بزرگ</b><p>تشویق‌های کوچک امروز، اعتمادبه‌نفس بزرگ فرداست.</p><div className="tip-dots"><i/><i/><i/></div></div>
      <button className="nav-item settings-link" onClick={() => setPage('تنظیمات')}><Settings size={20}/><span>تنظیمات و پشتیبان</span></button>
      <div className="user-mini"><div className="parent-avatar">👨🏻‍👩🏻‍👧🏻‍👦🏻</div><div><b>والد خانواده</b><small>اطلاعات روی همین دستگاه</small></div><button className="icon-btn" onClick={() => setToast('از منوی تنظیمات می‌توانید نرخ ستاره را تغییر دهید و پشتیبان بگیرید.')} aria-label="راهنما"><CircleHelp size={19}/></button></div>
    </aside>
    {mobileMenu && <button aria-label="بستن منو" className="scrim" onClick={() => setMobileMenu(false)}/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-main"><button className="icon-btn mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="باز کردن منو"><Menu size={23}/></button><div className="breadcrumbs"><span>خانواده‌ی ما</span><ChevronLeft size={15}/><b>{tab}</b></div><div className="top-actions"><span className="date-chip"><CalendarDays size={15}/>{todayLabel()}</span><button className={`sync-chip ${cloudStatus}`} onClick={() => setPage('تنظیمات')} title="وضعیت همگام‌سازی">{cloudStatus === 'online' ? <Cloud size={16}/> : cloudStatus === 'connecting' ? <Cloud size={16}/> : <CloudOff size={16}/>}<span>{cloudStatus === 'online' ? 'همگام' : cloudStatus === 'connecting' ? 'در حال اتصال' : cloudStatus === 'error' ? 'خطای اتصال' : 'محلی'}</span></button><button className="icon-btn notification" aria-label="کارهای در انتظار" onClick={() => { setPage('کارها'); setToast(pending.length ? `${toFa(pending.length)} کار منتظر تأیید شماست.` : 'کار تأییدنشده‌ای برای امروز ندارید.'); }}><Bell size={20}/>{pending.length > 0 && <i/>}</button><div className="top-avatar">👨🏻</div></div></div><nav className="top-tabs" aria-label="منوی اصلی">{navItems.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setPage(label)}><Icon size={18}/><span>{label}</span></button>)}</nav></header>
      <div className="page-content">
        {tab === 'خانه' && dashboard}
        {tab === 'فرزندان' && <><PageHeading title="فرزندان خانواده" subtitle="نام، تاریخ تولد و ستاره هر فرزند را هر زمان تغییر دهید." action="افزودن فرزند" onAction={() => openModal('child')}/><section className="children-cards">{data.children.map(child => <ChildProfile key={child.id} child={child} pointsToToman={data.pointsToToman} tasks={data.tasks} onEdit={() => openModal('child', child)} onDelete={() => removeChild(child)} onTasks={() => { setSelectedChild(child.id); setPage('کارها'); }}/>) }<button className="add-child-card" onClick={() => openModal('child')}><span><Plus size={24}/></span><b>افزودن فرزند</b><small>پروفایل تازه بسازید</small></button></section><section className="panel family-note"><ShieldCheck size={23}/><div><b>حریم خصوصی خانواده</b><p>اطلاعات به‌صورت محلی روی همین دستگاه ذخیره می‌شود. از بخش تنظیمات نسخه‌ی پشتیبان بگیرید.</p></div></section></>}
        {tab === 'کارها' && <><PageHeading title="کارها و برنامه‌ی روزانه" subtitle="برنامه‌های هرروزه، کارهای امروز و ستاره قابل ویرایش‌اند." action="تعریف کار یک‌باره" onAction={() => openModal('task')}/><section className="panel routines-panel"><div className="section-head"><div><h3><CalendarDays size={19}/> برنامه‌های تکرارشونده</h3><p>کارهای فعال هر روز خودکار برای فرزندها ساخته می‌شوند.</p></div><button className="primary-btn compact-btn" onClick={() => openModal('routine')}><Plus size={17}/> افزودن برنامه</button></div><div className="routine-list">{data.routines.map(routine => <RoutineRow key={routine.id} routine={routine} child={data.children.find(child => child.id === routine.childId)} rate={data.pointsToToman} onEdit={() => openModal('routine', routine)} onDelete={() => removeRoutine(routine)} onToggle={() => toggleRoutine(routine)}/>)}</div>{!data.routines.length && <EmptyState icon="📅" title="برنامه‌ی روزانه‌ای ندارید" text="یک برنامه‌ی تکرارشونده اضافه کنید؛ مثل تمرین زبان یا ورزش روزانه." button="افزودن برنامه" onClick={() => openModal('routine')}/>}</section><section className="panel list-page"><div className="section-head list-title"><div><h3>فهرست کارها</h3><p>تأیید والد ستاره را به کیف پول اضافه می‌کند.</p></div><span className="history-badge">{toFa(filteredTasks.length)} کار</span></div><div className="filter-bar"><div className="search-box"><Search size={19}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی عنوان کار..."/></div><select value={selectedChild} onChange={event => setSelectedChild(event.target.value)} aria-label="فیلتر فرزند"><option value="all">همه‌ی فرزندان</option>{data.children.map(child => <option value={child.id} key={child.id}>{child.name}</option>)}</select><button className="soft-btn today-filter" onClick={() => setShowTaskHistory(value => !value)}>{showTaskHistory ? 'فقط امروز' : 'نمایش تاریخچه'}</button></div><div className="task-list full-task-list">{filteredTasks.map(task => <TaskRow key={task.id} task={task} child={data.children.find(child => child.id === task.childId)} onApprove={() => approveTask(task)} onEdit={() => openModal(task.routineId ? 'routine' : 'task', task.routineId ? data.routines.find(routine => routine.id === task.routineId) : task)} onDelete={() => removeTask(task)} rate={data.pointsToToman}/>)}</div>{!filteredTasks.length && <EmptyState icon="📝" title="کاری پیدا نشد" text="جست‌وجوی دیگری انجام دهید یا کار تازه‌ای ثبت کنید." button="تعریف کار" onClick={() => openModal('task')}/>}</section></>}
        {tab === 'جایزه‌ها' && <><PageHeading title="فروشگاه جایزه‌ها" subtitle="هزینه‌ی هر جایزه را متناسب با ارزش ستاره‌ها تنظیم کنید." action="افزودن جایزه" onAction={() => openModal('reward')}/><div className="redeem-hint"><Sparkles size={19}/><span>هر ستاره فعلاً معادل {toFa(data.pointsToToman)} تومان است.</span><button className="text-link" onClick={() => setPage('تنظیمات')}>تغییر نرخ <ChevronLeft size={16}/></button><span className="hint-stars">{toFa(totalPoints)} <Star size={16} fill="currentColor"/></span><button className="cashout-trigger" onClick={() => setCashoutOpen(true)}><Wallet size={18}/> تبدیل ستاره به پول نقد</button></div><section className="reward-grid">{data.rewards.map(reward => <RewardCard key={reward.id} reward={reward} childrenList={data.children} onRedeem={redeemReward} onEdit={() => openModal('reward', reward)} onDelete={() => removeReward(reward)} rate={data.pointsToToman}/>) }<button className="add-reward-card" onClick={() => openModal('reward')}><span><Plus size={24}/></span><b>جایزه‌ی تازه</b><small>یک انگیزه‌ی دوست‌داشتنی بسازید</small></button></section></>}
        {tab === 'گزارش' && <><PageHeading title="گزارش خانواده" subtitle="موجودی، تلاش‌ها و ارزش تومانی ستاره‌های خانواده."/><div className="report-summary"><StatCard icon={<CheckCircle2/>} label="کارهای تأییدشده‌ی امروز" value={toFa(finished.length)} note="از برنامه‌ی امروز" tone="green"/><StatCard icon={<Wallet/>} label="موجودی ستاره‌ها" value={toFa(totalPoints)} note={toman(totalPoints, data.pointsToToman)} tone="amber"/><StatCard icon={<Gift/>} label="جایزه‌های دریافت‌شده" value={toFa(data.activity.filter(item => item.kind === 'spend' && item.money === undefined).length)} note="لحظه‌های شیرین" tone="violet"/></div><section className="panel report-panel"><div className="section-head"><div><h3>تاریخچه‌ی خانواده</h3><p>همه‌ی ستاره‌ها و تلاش‌ها در یک نگاه.</p></div><span className="history-badge"><Activity size={17}/>{toFa(data.activity.length)} رویداد</span></div><ActivityList items={data.activity}/>{!data.activity.length && <EmptyState icon="✨" title="هنوز گزارشی نداریم" text="با ثبت اولین کار، اینجا پر از خبرهای خوب می‌شود."/>}</section></>}
        {tab === 'تنظیمات' && <><PageHeading title="تنظیمات و پشتیبان" subtitle="نرخ جایزه، همگام‌سازی گوشی‌ها و پشتیبان را مدیریت کنید."/><CloudSettings config={firebaseConfig} status={cloudStatus} user={cloudUser} message={cloudMessage} onSaveConfig={saveCloudConfiguration} onRegister={registerCloudAccount} onLogin={loginCloudAccount} onLogout={logoutCloudAccount}/><div className="settings-grid"><section className="panel setting-card"><div className="setting-icon green"><Coins size={23}/></div><h3>ارزش هر ستاره</h3><p>به‌ازای هر ستاره، چند تومان جایزه در نظر گرفته شود؟</p><label className="settings-rate-label">تومان برای هر ستاره<div className="number-input"><input type="number" min="1" max="10000000" step="1" value={data.pointsToToman} onChange={event => { const rate = Number(event.target.value); if (rate > 0) setData(current => ({ ...current, pointsToToman: rate })); }}/><span>تومان</span></div></label><div className="setting-example"><span>مثال: ۱۰ ستاره برابر است با</span><b>{toman(10, data.pointsToToman)}</b></div></section><section className="panel setting-card"><div className="setting-icon violet"><Download size={22}/></div><h3>پشتیبان‌گیری</h3><p>نسخه‌ی پشتیبان را نگه دارید تا اطلاعات بچه‌ها، کارها و ستاره‌ها محفوظ بماند.</p><button className="primary-btn" onClick={exportData}><Download size={18}/> دریافت فایل پشتیبان</button><label className="import-label"><FileText size={17}/> بازیابی از فایل پشتیبان<input type="file" accept="application/json,.json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = ''; }}/></label></section></div><section className="panel family-note"><ShieldCheck size={23}/><div><b>همگام‌سازی در دستگاه‌های خانواده</b><p>پس از اتصال Firebase، تغییرات روی گوشی‌های واردشده با همان حساب به‌صورت زنده همگام می‌شوند؛ بدون اتصال، نسخه‌ی محلی و پشتیبان شما محفوظ می‌ماند.</p></div></section></>}
        <footer className="footer"><span>ساخته‌شده با <Heart size={14} fill="currentColor"/> برای روزهای بهتر خانواده</span><span>ستاره · نسخه‌ی ۲.۰</span></footer>
      </div>
    </main>
    <nav className="mobile-bottom-nav">{navItems.slice(0, 5).map(({ label, icon: Icon }) => <button className={tab === label ? 'active' : ''} key={label} onClick={() => setPage(label)}><Icon size={22}/><span>{label}</span></button>)}</nav>
    {modal && <Modal title={modal === 'child' ? (editing ? 'ویرایش اطلاعات فرزند' : 'افزودن فرزند') : modal === 'task' ? (editing ? 'ویرایش کار امروز' : 'تعریف کار یک‌باره') : modal === 'routine' ? (editing ? 'ویرایش برنامه‌ی روزانه' : 'افزودن برنامه‌ی روزانه') : (editing ? 'ویرایش جایزه' : 'ساخت جایزه‌ی تازه')} onClose={closeModal}><FormContent type={modal} item={editing} childrenList={data.children} onChild={saveChild} onTask={saveTask} onRoutine={saveRoutine} onReward={saveReward} onClose={closeModal}/></Modal>}
    {cashoutOpen && <Modal title="تبدیل ستاره به پول نقد" onClose={() => setCashoutOpen(false)}><CashoutForm childrenList={data.children} rate={data.pointsToToman} onCashOut={cashOutStars} onClose={() => setCashoutOpen(false)}/></Modal>}
    {toast && <div className="toast" role="status"><span><Check size={18}/></span>{toast}<button onClick={() => setToast('')} aria-label="بستن"><X size={18}/></button></div>}
  </div>;
}

function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card panel"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note"><span/> {note}</div></div>;
}
function TaskRow({ task, child, onApprove, onEdit, onDelete, rate }: { task: Task; child?: Child; onApprove: () => void; onEdit: () => void; onDelete: () => void; rate: number }) {
  return <div className={`task-row ${task.status === 'done' ? 'task-completed' : ''}`}><div className={`task-check ${task.status === 'done' ? 'is-done' : ''}`}>{task.status === 'done' ? <Check size={17}/> : <span/>}</div><div className="task-info"><b>{task.title}</b><span><span className={`mini-avatar ${child?.color}`}>{child?.avatar ?? '🙂'}</span>{child?.name ?? 'بدون فرزند'}<i/>{task.category}<i/>{task.date}</span></div><div className="task-points"><Star size={16} fill="currentColor"/>{toFa(task.points)}<small>{toman(task.points, rate)}</small></div><div className="task-controls">{task.status === 'pending' ? <><button className="approve-btn" onClick={onApprove}><Check size={17}/> تأیید</button><button className="row-icon-btn" onClick={onEdit} aria-label="ویرایش کار"><Pencil size={16}/></button><button className="row-icon-btn delete" onClick={onDelete} aria-label="حذف کار"><Trash2 size={16}/></button></> : <span className="done-label"><Check size={16}/> انجام شد</span>}</div></div>;
}
function ChildRow({ child, pointsToToman }: { child: Child; pointsToToman: number }) { return <div className="child-row"><div className={`child-avatar ${child.color}`}>{child.avatar}</div><div className="child-info"><b>{child.name}</b><small>{ageLabel(child.birthDate)}</small></div><div className="child-points"><strong>{toFa(child.balance)}</strong><span>{toman(child.balance, pointsToToman)}</span></div><Star className="child-star" size={18} fill="currentColor"/></div>; }
function ChildProfile({ child, pointsToToman, tasks, onEdit, onDelete, onTasks }: { child: Child; pointsToToman: number; tasks: Task[]; onEdit: () => void; onDelete: () => void; onTasks: () => void }) {
  const done = tasks.filter(task => task.childId === child.id && task.status === 'done').length;
  const pending = tasks.filter(task => task.childId === child.id && task.status === 'pending').length;
  return <article className="child-profile panel"><div className={`profile-avatar ${child.color}`}>{child.avatar}</div><div className="profile-name"><h3>{child.name}</h3><span>{ageLabel(child.birthDate)} · تولد {formatBirthDate(child.birthDate)}</span></div><div className="profile-tools"><button className="row-icon-btn" onClick={onEdit} aria-label="ویرایش فرزند"><Pencil size={17}/></button><button className="row-icon-btn delete" onClick={onDelete} aria-label="حذف فرزند"><Trash2 size={17}/></button></div><div className="profile-balance"><Coins size={20}/><strong>{toFa(child.balance)}</strong><span>ستاره</span><i/>{toman(child.balance, pointsToToman)}</div><div className="profile-progress"><div><span>وضعیت کارهای امروز</span><b>{toFa(done)} انجام‌شده · {toFa(pending)} باقی‌مانده</b></div><div className="progress-track"><i style={{ width: `${done + pending ? Math.round(done / (done + pending) * 100) : 0}%` }}/></div></div><div className="profile-footer"><span>ارزش ستاره: {toFa(pointsToToman)} تومان</span><button className="text-link" onClick={onTasks}>دیدن کارها <ChevronLeft size={16}/></button></div></article>;
}
function RoutineRow({ routine, child, rate, onEdit, onDelete, onToggle }: { routine: Routine; child?: Child; rate: number; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const Icon = routine.category === 'زبان انگلیسی' ? Languages : routine.category === 'قرآن' ? BookMarked : routine.category === 'ورزش' ? Dumbbell : BookOpen;
  return <div className={`routine-row ${routine.active ? '' : 'inactive'}`}><span className="routine-icon"><Icon size={20}/></span><div className="routine-info"><b>{routine.title}</b><span>{child?.name ?? 'فرزند حذف‌شده'} · {routine.category} · روزانه</span></div><div className="routine-reward"><strong>{toFa(routine.points)} ستاره</strong><small>{toman(routine.points, rate)}</small></div><button className={`toggle-switch ${routine.active ? 'on' : ''}`} onClick={onToggle} aria-label={routine.active ? 'متوقف کردن برنامه' : 'فعال کردن برنامه'}><i/></button><button className="row-icon-btn" onClick={onEdit} aria-label="ویرایش برنامه"><Pencil size={16}/></button><button className="row-icon-btn delete" onClick={onDelete} aria-label="حذف برنامه"><Trash2 size={16}/></button></div>;
}
function RewardCard({ reward, childrenList, onRedeem, onEdit, onDelete, rate }: { reward: Reward; childrenList: Child[]; onRedeem: (reward: Reward, child: Child) => void; onEdit: () => void; onDelete: () => void; rate: number }) {
  return <article className="reward-card panel"><div className="reward-tools"><button className="row-icon-btn" onClick={onEdit} aria-label="ویرایش جایزه"><Pencil size={16}/></button><button className="row-icon-btn delete" onClick={onDelete} aria-label="حذف جایزه"><Trash2 size={16}/></button></div><div className={`reward-emoji ${reward.color}`}>{reward.emoji}</div><h3>{reward.title}</h3><div className="reward-cost"><Star size={17} fill="currentColor"/>{toFa(reward.points)}<span>ستاره</span></div><div className="reward-money">معادل {toman(reward.points, rate)}</div><div className="reward-actions">{childrenList.map(child => <button key={child.id} className="redeem-btn" disabled={child.balance < reward.points} onClick={() => onRedeem(reward, child)}>ثبت برای {child.name}</button>)}</div></article>;
}
function ActivityList({ items }: { items: ActivityItem[] }) { return <div className="activity-list">{items.map(item => <div className="activity-row" key={item.id}><div className={`activity-icon ${item.kind}`}>{item.money !== undefined ? <Wallet size={19}/> : item.kind === 'spend' ? <Gift size={19}/> : item.kind === 'task' ? <CheckCircle2 size={19}/> : <Star size={18}/>}</div><div className="activity-info"><b>{item.text}</b><span>{item.detail}</span></div><div className="activity-time">{item.time}</div>{item.kind !== 'task' && <div className={`activity-delta ${item.kind}`}>{item.kind === 'spend' ? '−' : '+'}{toFa(item.points ?? 0)} <Star size={14} fill="currentColor"/></div>}</div>)}</div>; }
function EmptyState({ icon, title, text, button, onClick }: { icon: string; title: string; text: string; button?: string; onClick?: () => void }) { return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{text}</p>{button && onClick && <button className="soft-btn" onClick={onClick}><Plus size={17}/>{button}</button>}</div>; }
function PageHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) { return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> همراه رشد بچه‌ها</div><h1>{title}</h1><p>{subtitle}</p></div>{action && onAction && <button className="primary-btn" onClick={onAction}><Plus size={19}/>{action}</button>}</section>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="modal-mark"><Sparkles size={19}/></span><h2 id="modal-title">{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="بستن"><X size={21}/></button></div>{children}</div></div>;
}
function FormContent({ type, item, childrenList, onChild, onTask, onRoutine, onReward, onClose }: {
  type: Exclude<ModalType, null>; item?: Child | Task | Routine | Reward; childrenList: Child[];
  onChild: (input: Omit<Child, 'id' | 'balance' | 'color'>, id?: string) => void;
  onTask: (input: Omit<Task, 'id' | 'status' | 'date' | 'dayKey' | 'routineId'>, id?: string) => void;
  onRoutine: (input: Omit<Routine, 'id' | 'active'>, id?: string) => void;
  onReward: (title: string, points: number, emoji: string, id?: string) => void;
  onClose: () => void;
}) {
  const child = type === 'child' ? item as Child | undefined : undefined;
  const task = type === 'task' ? item as Task | undefined : undefined;
  const routine = type === 'routine' ? item as Routine | undefined : undefined;
  const reward = type === 'reward' ? item as Reward | undefined : undefined;
  const [name, setName] = useState(child?.name ?? task?.title ?? routine?.title ?? reward?.title ?? '');
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? '');
  const [points, setPoints] = useState(task?.points ?? routine?.points ?? reward?.points ?? 1);
  const [childId, setChildId] = useState(task?.childId ?? routine?.childId ?? childrenList[0]?.id ?? '');
  const [category, setCategory] = useState(task?.category ?? routine?.category ?? 'درس و گفت‌وگو');
  const [emoji, setEmoji] = useState(reward?.emoji ?? '🎁');
  const taskChildren = childrenList.filter(candidate => ageLabel(candidate.birthDate) !== 'نوزاد');
  const normalizedBirthDate = digitsToLatin(birthDate).replace(/\//g, '-').trim();
  const birthDateValid = isValidJalaliDate(normalizedBirthDate);
  const noChildren = (type === 'task' || type === 'routine') && taskChildren.length === 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (type === 'child') {
      if (!birthDateValid) return;
      const icon = ageLabel(normalizedBirthDate).includes('نوزاد') ? '👶🏻' : child?.avatar ?? '🧒🏻';
      onChild({ name: name.trim(), birthDate: normalizedBirthDate, avatar: icon }, child?.id);
    } else if (type === 'task') onTask({ title: name.trim(), childId, points: Math.max(1, Math.round(points)), category }, task?.id);
    else if (type === 'routine') onRoutine({ title: name.trim(), childId, points: Math.max(1, Math.round(points)), category }, routine?.id);
    else onReward(name.trim(), Math.max(1, Math.round(points)), emoji, reward?.id);
  };
  return <form className="form-content" onSubmit={submit}>
    {type === 'child' && <><p className="form-intro">نام و تاریخ شمسی تولد را وارد کنید؛ سن به‌صورت خودکار محاسبه می‌شود.</p><label>نام فرزند<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً آوا" required/></label><label>تاریخ تولد شمسی<input inputMode="numeric" value={birthDate} onChange={event => setBirthDate(event.target.value)} placeholder="مثلاً ۱۴۰۵/۰۸/۱۲" required aria-invalid={birthDate.length > 0 && !birthDateValid}/></label><small className="field-hint">روز / ماه / سال شمسی · نمونه: ۱۳۹۴/۰۱/۲۶{birthDate.length > 0 && !birthDateValid && <strong> · تاریخ را بررسی کنید</strong>}</small></>}
    {type === 'task' && <><p className="form-intro">این کار فقط برای امروز ثبت می‌شود.</p><label>عنوان کار<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً مرتب کردن میز مطالعه" required/></label><ChildPicker value={childId} childrenList={taskChildren} onChange={setChildId} disabled={noChildren}/><CategoryPicker value={category} onChange={setCategory}/><PointsInput label="ستاره کار" value={points} onChange={setPoints}/></>}
    {type === 'routine' && <><p className="form-intro">این برنامه هر روز برای فرزند انتخاب‌شده ساخته می‌شود و قابل ویرایش یا توقف است.</p><label>عنوان برنامه<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً حفظ پنج واژه‌ی انگلیسی" required/></label><ChildPicker value={childId} childrenList={taskChildren} onChange={setChildId} disabled={noChildren}/><CategoryPicker value={category} onChange={setCategory}/><PointsInput label="ستاره پس از تأیید روزانه" value={points} onChange={setPoints}/></>}
    {type === 'reward' && <><p className="form-intro">هزینه‌ی جایزه را با ستاره وارد کنید؛ مبلغ تومانی طبق نرخ تنظیم‌شده نمایش داده می‌شود.</p><label>نام جایزه<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً یک ساعت بازی" required/></label><label>شکلک جایزه<select value={emoji} onChange={event => setEmoji(event.target.value)}>{['🎁','🎮','🍦','🍰','🛝','📚','⚽','🎨','🍿','🚲','🧸','🌳'].map(value => <option key={value}>{value}</option>)}</select></label><PointsInput label="هزینه به ستاره" value={points} onChange={setPoints}/></>}
    {noChildren && <p className="form-warning">برای ثبت کار روزانه، فرزندی غیر از نوزاد باید در خانواده باشد.</p>}
    <div className="form-actions"><button type="button" className="cancel-btn" onClick={onClose}>انصراف</button><button type="submit" className="primary-btn" disabled={noChildren || (type === 'child' && !birthDateValid)}><Plus size={18}/>{type === 'child' ? child ? 'ذخیره‌ی تغییرات' : 'افزودن فرزند' : type === 'task' ? task ? 'ذخیره‌ی تغییرات' : 'ثبت کار امروز' : type === 'routine' ? routine ? 'ذخیره‌ی برنامه' : 'افزودن به برنامه‌ی روزانه' : reward ? 'ذخیره‌ی جایزه' : 'ساخت جایزه'}</button></div>
  </form>;
}
function ChildPicker({ value, childrenList, onChange, disabled }: { value: string; childrenList: Child[]; onChange: (value: string) => void; disabled: boolean }) { return <label>برای کدام فرزند؟<select value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>{childrenList.map(child => <option key={child.id} value={child.id}>{child.avatar} {child.name}</option>)}</select></label>; }
function CategoryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label>دسته‌بندی<select value={value} onChange={event => onChange(event.target.value)}>{['درس و گفت‌وگو','زبان انگلیسی','قرآن','ورزش','خانه','خانواده','سلامتی','مسئولیت‌پذیری','سایر'].map(item => <option key={item}>{item}</option>)}</select></label>; }
function PointsInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label>{label}<div className="number-input"><input type="number" min="1" max="100000" step="1" value={value} onChange={event => onChange(Number(event.target.value))}/><Star size={17} fill="currentColor"/></div></label>; }

export default App;
