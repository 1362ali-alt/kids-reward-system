import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, Bell, Check, CheckCircle2, ChevronLeft,
  CircleHelp, Coins, Gift, Heart, House, Menu, Plus, Search, Settings,
  ShieldCheck, Sparkles, Star, Target, Trash2, Trophy, Users, Wallet, X,
} from 'lucide-react';

type Child = { id: string; name: string; age: number; avatar: string; color: string; balance: number };
type Task = { id: string; title: string; childId: string; points: number; status: 'pending' | 'done'; category: string; date: string };
type Reward = { id: string; title: string; points: number; emoji: string; color: string };
type ActivityItem = { id: string; text: string; detail: string; time: string; kind: 'earn' | 'spend' | 'task' };
type Data = { children: Child[]; tasks: Task[]; rewards: Reward[]; activity: ActivityItem[] };

const initialData: Data = {
  children: [
    { id: 'c1', name: 'آراد', age: 8, avatar: '🧒🏻', color: 'blue', balance: 125 },
    { id: 'c2', name: 'رها', age: 5, avatar: '👧🏻', color: 'pink', balance: 85 },
  ],
  tasks: [
    { id: 't1', title: 'مرتب کردن اتاق', childId: 'c1', points: 15, status: 'pending', category: 'خانه', date: 'امروز' },
    { id: 't2', title: 'مطالعه‌ی کتاب', childId: 'c2', points: 10, status: 'pending', category: 'یادگیری', date: 'امروز' },
    { id: 't3', title: 'آب دادن به گل‌ها', childId: 'c1', points: 8, status: 'done', category: 'خانه', date: 'دیروز' },
    { id: 't4', title: 'کمک در چیدن میز', childId: 'c2', points: 12, status: 'done', category: 'خانواده', date: 'دیروز' },
  ],
  rewards: [
    { id: 'r1', title: 'یک ساعت بازی', points: 50, emoji: '🎮', color: 'lavender' },
    { id: 'r2', title: 'انتخاب دسر', points: 35, emoji: '🍰', color: 'peach' },
    { id: 'r3', title: 'پارک رفتن', points: 80, emoji: '🛝', color: 'mint' },
  ],
  activity: [
    { id: 'a1', text: 'آب دادن به گل‌ها', detail: 'آراد · ۸ ستاره دریافت کرد', time: 'امروز، ۱۰:۳۰', kind: 'earn' },
    { id: 'a2', text: 'انتخاب دسر', detail: 'رها · ۳۵ ستاره خرج کرد', time: 'دیروز، ۱۸:۱۵', kind: 'spend' },
    { id: 'a3', text: 'کمک در چیدن میز', detail: 'رها · ۱۲ ستاره دریافت کرد', time: 'دیروز، ۱۷:۰۰', kind: 'earn' },
  ],
};

const storageKey = 'setareh-family-data-v1';
const loadData = (): Data => {
  try { const raw = localStorage.getItem(storageKey); return raw ? { ...initialData, ...JSON.parse(raw) } : initialData; }
  catch { return initialData; }
};
const uid = () => Math.random().toString(36).slice(2, 10);
const toFa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const dateToday = () => new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric' }).format(new Date());
type Tab = 'خانه' | 'بچه‌ها' | 'کارها' | 'جایزه‌ها' | 'گزارش';

function App() {
  const [data, setData] = useState<Data>(loadData);
  const [tab, setTab] = useState<Tab>('خانه');
  const [modal, setModal] = useState<'child' | 'task' | 'reward' | null>(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [selectedChild, setSelectedChild] = useState('all');
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(data)); }, [data]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2800); return () => clearTimeout(id); }, [toast]);

  const pending = data.tasks.filter(t => t.status === 'pending');
  const finished = data.tasks.filter(t => t.status === 'done');
  const totalPoints = data.children.reduce((sum, child) => sum + child.balance, 0);
  const filteredTasks = data.tasks.filter(t => (selectedChild === 'all' || t.childId === selectedChild) && t.title.includes(search));

  const approveTask = (task: Task) => {
    const child = data.children.find(c => c.id === task.childId);
    if (!child) return;
    setData(current => ({
      ...current,
      children: current.children.map(c => c.id === child.id ? { ...c, balance: c.balance + task.points } : c),
      tasks: current.tasks.map(t => t.id === task.id ? { ...t, status: 'done' } : t),
      activity: [{ id: uid(), text: task.title, detail: `${child.name} · ${toFa(task.points)} ستاره دریافت کرد`, time: `امروز، ${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`, kind: 'earn' }, ...current.activity],
    }));
    setToast(`آفرین به ${child.name}! ${toFa(task.points)} ستاره به حسابش اضافه شد.`);
  };

  const redeem = (reward: Reward, child: Child) => {
    if (child.balance < reward.points) { setToast(`ستاره‌های ${child.name} برای این جایزه کافی نیست.`); return; }
    setData(current => ({
      ...current,
      children: current.children.map(c => c.id === child.id ? { ...c, balance: c.balance - reward.points } : c),
      activity: [{ id: uid(), text: reward.title, detail: `${child.name} · ${toFa(reward.points)} ستاره خرج کرد`, time: `امروز، ${new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`, kind: 'spend' }, ...current.activity],
    }));
    setToast(`جایزه‌ی «${reward.title}» برای ${child.name} ثبت شد!`);
  };

  const addChild = (name: string, age: number, avatar: string) => {
    const newChild: Child = { id: uid(), name, age, avatar, color: data.children.length % 2 ? 'pink' : 'blue', balance: 0 };
    setData(current => ({ ...current, children: [...current.children, newChild] }));
    setToast(`${name} با موفقیت به خانواده اضافه شد.`); setModal(null);
  };
  const addTask = (title: string, childId: string, points: number, category: string) => {
    setData(current => ({ ...current, tasks: [{ id: uid(), title, childId, points, status: 'pending', category, date: 'امروز' }, ...current.tasks] }));
    setToast('کار جدید به فهرست اضافه شد.'); setModal(null);
  };
  const addReward = (title: string, points: number, emoji: string) => {
    setData(current => ({ ...current, rewards: [...current.rewards, { id: uid(), title, points, emoji, color: 'lavender' }] }));
    setToast('جایزه‌ی تازه آماده شد!'); setModal(null);
  };
  const deleteReward = (id: string) => { setData(current => ({ ...current, rewards: current.rewards.filter(r => r.id !== id) })); setToast('جایزه حذف شد.'); };
  const navItems: { label: Tab; icon: typeof House }[] = [
    { label: 'خانه', icon: House }, { label: 'بچه‌ها', icon: Users }, { label: 'کارها', icon: CheckCircle2 }, { label: 'جایزه‌ها', icon: Gift }, { label: 'گزارش', icon: Activity },
  ];

  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileMenu ? 'show' : ''}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={21}/></span><div><strong>ستاره</strong><small>با هم رشد می‌کنیم</small></div><button className="icon-btn close-menu" onClick={() => setMobileMenu(false)} aria-label="بستن منو"><X size={18}/></button></div>
      <div className="family-card"><div className="family-avatar">🏡</div><div><strong>خانواده‌ی ما</strong><span>{toFa(data.children.length)} عضو فعال</span></div><ChevronLeft size={16} className="muted"/></div>
      <div className="menu-caption">منوی اصلی</div>
      <nav className="side-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${tab === label ? 'active' : ''}`} onClick={() => { setTab(label); setMobileMenu(false); }}><Icon size={19}/><span>{label}</span>{label === 'کارها' && pending.length > 0 && <b className="nav-count">{toFa(pending.length)}</b>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="tip-card"><div className="tip-icon"><Heart size={17}/></div><b>یک قدم کوچک، یک عادت بزرگ</b><p>تشویق‌های کوچک امروز، اعتمادبه‌نفس بزرگ فرداست.</p><div className="tip-dots"><i/><i/><i/></div></div>
      <button className="nav-item settings-link" onClick={() => setToast('همه‌ی اطلاعات فقط روی همین دستگاه ذخیره می‌شود.')}><Settings size={18}/><span>تنظیمات</span></button>
      <div className="user-mini"><div className="parent-avatar">👨🏻‍👩🏻‍👧🏻‍👦🏻</div><div><b>والد خانواده</b><small>مدیر حساب</small></div><button className="icon-btn" onClick={() => setToast('خوشحالیم که با ستاره همراهی!')} aria-label="راهنما"><CircleHelp size={18}/></button></div>
    </aside>
    {mobileMenu && <button aria-label="بستن منو" className="scrim" onClick={() => setMobileMenu(false)}/>}

    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu-btn" onClick={() => setMobileMenu(true)} aria-label="باز کردن منو"><Menu size={21}/></button><div className="breadcrumbs"><span>خانواده‌ی ما</span><ChevronLeft size={14}/><b>{tab}</b></div><div className="top-actions"><span className="date-chip">{dateToday()}</span><button className="icon-btn notification" aria-label="اعلان‌ها" onClick={() => setToast(pending.length ? `${toFa(pending.length)} کار منتظر تأیید شماست.` : 'فعلاً اعلان تازه‌ای ندارید.')}><Bell size={19}/>{pending.length > 0 && <i/>}</button><div className="top-avatar">👨🏻</div></div></header>
      <div className="page-content">
        {tab === 'خانه' && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> فضای گرم خانواده‌ی شما</div><h1>سلام، روزتون پر از <em>لبخند!</em> <span>☀️</span></h1><p>با یک تشویق کوچک، روز بچه‌ها رو قشنگ‌تر کنیم.</p></div><button className="primary-btn" onClick={() => setModal('task')}><Plus size={18}/> تعریف کار جدید</button></section>
          <section className="hero-card"><div className="hero-copy"><span className="hero-pill"><Sparkles size={13}/> هفته‌ی پربار شما</span><h2>قهرمان‌های کوچولوی<br/>خانواده درخشیدن! <span>✨</span></h2><p>بچه‌ها این هفته با انجام کارهای خوب، کلی ستاره جمع کردن.</p><div className="hero-stats"><div><strong>{toFa(finished.length)}</strong><span>کار انجام‌شده</span></div><i/><div><strong>{toFa(totalPoints)}</strong><span>ستاره‌ی خانواده</span></div></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="sun-blob">🌟</div><span className="float-star star-one">✦</span><span className="float-star star-two">✧</span><span className="float-star star-three">✦</span><span className="art-sparkle">✧</span></div><div className="hero-decoration">✿</div></section>
          <section className="stats-grid"><StatCard icon={<CheckCircle2/>} label="کارهای منتظر تأیید" value={toFa(pending.length)} note={pending.length ? 'وقت یک تشویق قشنگه!' : 'همه‌چیز مرتبه'} tone="amber"/><StatCard icon={<Coins/>} label="ستاره‌های جمع‌شده" value={toFa(totalPoints)} note="در حساب بچه‌ها" tone="green"/><StatCard icon={<Trophy/>} label="جایزه‌های قابل دریافت" value={toFa(data.rewards.length)} note="برای انگیزه‌ی بیشتر" tone="violet"/><StatCard icon={<Target/>} label="اعضای خانواده" value={toFa(data.children.length)} note="هر روز یک قدم بهتر" tone="blue"/></section>
          <div className="dashboard-grid"><section className="panel pending-panel"><div className="section-head"><div><h3>کارهای در انتظار <span className="small-count">{toFa(pending.length)}</span></h3><p>با تأیید شما، ستاره‌ها به حسابشون اضافه می‌شه.</p></div><button className="text-link" onClick={() => setTab('کارها')}>همه‌ی کارها <ChevronLeft size={15}/></button></div>{pending.length ? <div className="task-list">{pending.slice(0, 4).map(task => <TaskRow key={task.id} task={task} child={data.children.find(c => c.id === task.childId)} onApprove={() => approveTask(task)}/>)}</div> : <EmptyState icon="🎉" title="همه‌ی کارها تأیید شدن!" text="یک کار تازه تعریف کنید تا ماجراجویی ادامه پیدا کنه." button="تعریف کار" onClick={() => setModal('task')}/>}</section>
          <section className="panel children-panel"><div className="section-head"><div><h3>ستاره‌های کوچولوی شما</h3><p>هر ستاره، یک قدم رو به جلوست.</p></div><button className="round-add" onClick={() => setModal('child')} aria-label="افزودن فرزند"><Plus size={18}/></button></div><div className="child-list">{data.children.map(child => <ChildRow key={child.id} child={child}/>)}</div><button className="soft-btn full-btn" onClick={() => setTab('بچه‌ها')}>دیدن صفحه‌ی بچه‌ها <ChevronLeft size={15}/></button></section>
          <section className="panel activity-panel"><div className="section-head"><div><h3>تازه‌های خانواده</h3><p>لحظه‌های خوب رو مرور کنیم.</p></div><button className="text-link" onClick={() => setTab('گزارش')}>گزارش کامل <ChevronLeft size={15}/></button></div><ActivityList items={data.activity.slice(0, 4)}/></section>
          <section className="quote-card"><div className="quote-top"><span className="quote-icon">💛</span><span className="quote-label">یادآوری امروز</span></div><blockquote>«بچه‌ها با تشویق شکوفا می‌شن، نه با کامل بودن.»</blockquote><div className="quote-bottom"><span/> یک جمله‌ی مهربون، روزی به‌یادماندنی می‌سازه <span>✦</span></div><div className="quote-decoration">“</div></section></div>
        </>}
        {tab === 'بچه‌ها' && <><PageHeading title="ستاره‌های خانواده" subtitle="پیشرفت و موجودی ستاره‌های هر کدوم رو ببینید." action="افزودن فرزند" onAction={() => setModal('child')}/><section className="children-cards">{data.children.map((child, index) => <div className="child-profile panel" key={child.id}><div className={`profile-avatar ${child.color}`}>{child.avatar}</div><div className="profile-name"><h3>{child.name}</h3><span>{toFa(child.age)} ساله · عضو خانواده</span></div><div className="profile-balance"><Coins size={17}/><strong>{toFa(child.balance)}</strong><span>ستاره</span></div><div className="profile-progress"><div><span>کارهای انجام‌شده</span><b>{toFa(data.tasks.filter(t => t.childId === child.id && t.status === 'done').length)} کار</b></div><div className="progress-track"><i style={{ width: `${Math.min(100, data.tasks.filter(t => t.childId === child.id && t.status === 'done').length * 18 + 16)}%` }}/></div></div><div className="profile-footer"><span>{index ? 'رنگ مورد علاقه: صورتی' : 'رنگ مورد علاقه: آبی'}</span><button className="text-link" onClick={() => { setSelectedChild(child.id); setTab('کارها'); }}>دیدن کارها <ChevronLeft size={14}/></button></div></div>)}<button className="add-child-card" onClick={() => setModal('child')}><span><Plus size={22}/></span><b>یک ستاره‌ی تازه اضافه کن</b><small>پروفایل فرزند جدید بسازید</small></button></section><section className="panel family-note"><ShieldCheck size={20}/><div><b>فضای امن و مخصوص خانواده</b><p>اطلاعات فرزندان شما روی همین دستگاه نگهداری می‌شود و به جایی ارسال نمی‌شود.</p></div></section></>}
        {tab === 'کارها' && <><PageHeading title="کارهای خوب" subtitle="کارها رو تعریف کنید و بعد از انجام، ستاره‌ها رو تأیید کنید." action="تعریف کار جدید" onAction={() => setModal('task')}/><section className="panel list-page"><div className="filter-bar"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی کار..."/></div><select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}><option value="all">همه‌ی بچه‌ها</option>{data.children.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><div className="filter-count">{toFa(filteredTasks.length)} کار</div></div><div className="task-list full-task-list">{filteredTasks.map(task => <TaskRow key={task.id} task={task} child={data.children.find(c => c.id === task.childId)} onApprove={() => approveTask(task)}/>)}</div>{!filteredTasks.length && <EmptyState icon="📝" title="کاری پیدا نشد" text="عبارت دیگری جست‌وجو کنید یا یک کار تازه بسازید." button="تعریف کار" onClick={() => setModal('task')}/>}</section></>}
        {tab === 'جایزه‌ها' && <><PageHeading title="فروشگاه جایزه‌ها" subtitle="برای تلاش‌های قشنگ، جایزه‌های دوست‌داشتنی در نظر بگیرید." action="افزودن جایزه" onAction={() => setModal('reward')}/><div className="redeem-hint"><Sparkles size={17}/><span>برای ثبت دریافت جایزه، روی دکمه‌ی «انتخاب برای...» بزنید.</span><span className="hint-stars">{toFa(totalPoints)} <Star size={15} fill="currentColor"/></span></div><section className="reward-grid">{data.rewards.map(reward => <div className="reward-card panel" key={reward.id}><button className="delete-reward" onClick={() => deleteReward(reward.id)} aria-label={`حذف ${reward.title}`}><Trash2 size={16}/></button><div className={`reward-emoji ${reward.color}`}>{reward.emoji}</div><h3>{reward.title}</h3><div className="reward-cost"><Star size={15} fill="currentColor"/>{toFa(reward.points)} <span>ستاره</span></div><div className="reward-actions">{data.children.map(child => <button key={child.id} className="redeem-btn" disabled={child.balance < reward.points} onClick={() => redeem(reward, child)}>انتخاب برای {child.name}</button>)}</div></div>)}<button className="add-reward-card" onClick={() => setModal('reward')}><span><Plus size={22}/></span><b>جایزه‌ی تازه</b><small>یک انگیزه‌ی دوست‌داشتنی بسازید</small></button></section>{!data.children.length && <p className="empty-inline">برای ثبت جایزه، اول یک فرزند اضافه کنید.</p>}</>}
        {tab === 'گزارش' && <><PageHeading title="گزارش خانواده" subtitle="نگاهی به تمام لحظه‌های تلاش و پیشرفت."/><div className="report-summary"><StatCard icon={<CheckCircle2/>} label="کارهای تأییدشده" value={toFa(finished.length)} note="از شروع فعالیت" tone="green"/><StatCard icon={<Wallet/>} label="ستاره در گردش" value={toFa(totalPoints)} note="موجودی فعلی بچه‌ها" tone="amber"/><StatCard icon={<Gift/>} label="جایزه‌های دریافت‌شده" value={toFa(data.activity.filter(a => a.kind === 'spend').length)} note="لحظه‌های شیرین" tone="violet"/></div><section className="panel report-panel"><div className="section-head"><div><h3>تاریخچه‌ی خانواده</h3><p>همه‌ی ستاره‌ها و تلاش‌ها در یک نگاه.</p></div><span className="history-badge"><Activity size={15}/> {toFa(data.activity.length)} رویداد</span></div><ActivityList items={data.activity}/>{data.activity.length === 0 && <EmptyState icon="✨" title="هنوز گزارشی نداریم" text="با ثبت اولین کار، اینجا پر از خبرهای خوب می‌شه."/>}</section></>}
        <footer className="footer"><span>ساخته‌شده با <Heart size={13} fill="currentColor"/> برای روزهای بهتر خانواده</span><span>ستاره · نسخه‌ی ۱.۰</span></footer>
      </div>
    </main>
    <nav className="mobile-bottom-nav">{navItems.slice(0, 5).map(({ label, icon: Icon }) => <button className={tab === label ? 'active' : ''} key={label} onClick={() => setTab(label)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {modal && <Modal title={modal === 'child' ? 'افزودن ستاره‌ی تازه' : modal === 'task' ? 'تعریف یک کار خوب' : 'ساخت جایزه‌ی تازه'} onClose={() => setModal(null)}><FormContent type={modal} childrenList={data.children} onChild={addChild} onTask={addTask} onReward={addReward} onClose={() => setModal(null)}/></Modal>}
    {toast && <div className="toast"><span><Check size={16}/></span>{toast}<button onClick={() => setToast('')} aria-label="بستن"><X size={16}/></button></div>}
  </div>;
}

function StatCard({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card panel"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note"><span/> {note}</div></div>;
}
function TaskRow({ task, child, onApprove }: { task: Task; child?: Child; onApprove: () => void }) {
  return <div className="task-row"><div className={`task-check ${task.status === 'done' ? 'is-done' : ''}`}>{task.status === 'done' ? <Check size={16}/> : <span/>}</div><div className="task-info"><b>{task.title}</b><span><span className={`mini-avatar ${child?.color}`}>{child?.avatar ?? '🙂'}</span>{child?.name ?? 'بدون فرزند'}<i/> {task.category} <i/> {task.date}</span></div><div className="task-points"><Star size={14} fill="currentColor"/>{toFa(task.points)}</div>{task.status === 'pending' ? <button className="approve-btn" onClick={onApprove}><Check size={15}/> تأیید</button> : <span className="done-label"><Check size={14}/> انجام شد</span>}</div>;
}
function ChildRow({ child }: { child: Child }) { return <div className="child-row"><div className={`child-avatar ${child.color}`}>{child.avatar}</div><div className="child-info"><b>{child.name}</b><small>{toFa(child.age)} ساله</small></div><div className="child-points"><strong>{toFa(child.balance)}</strong><span>ستاره</span></div><Star className="child-star" size={15} fill="currentColor"/></div>; }
function ActivityList({ items }: { items: ActivityItem[] }) { return <div className="activity-list">{items.map(item => <div className="activity-row" key={item.id}><div className={`activity-icon ${item.kind}`}>{item.kind === 'spend' ? <Gift size={17}/> : item.kind === 'task' ? <CheckCircle2 size={17}/> : <Star size={17}/>}</div><div className="activity-info"><b>{item.text}</b><span>{item.detail}</span></div><div className="activity-time">{item.time}</div>{item.kind !== 'task' && <div className={`activity-delta ${item.kind}`}>{item.kind === 'spend' ? '−' : '+'}{toFa(Number(item.detail.match(/[۰-۹0-9]+/)?.[0]?.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) ?? 0))} <Star size={12} fill="currentColor"/></div>}</div>)}</div>; }
function EmptyState({ icon, title, text, button, onClick }: { icon: string; title: string; text: string; button?: string; onClick?: () => void }) { return <div className="empty-state"><span>{icon}</span><b>{title}</b><p>{text}</p>{button && onClick && <button className="soft-btn" onClick={onClick}><Plus size={15}/>{button}</button>}</div>; }
function PageHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) { return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> همراه رشد بچه‌ها</div><h1>{title}</h1><p>{subtitle}</p></div>{action && onAction && <button className="primary-btn" onClick={onAction}><Plus size={18}/>{action}</button>}</section>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="modal-mark"><Sparkles size={17}/></span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="بستن"><X size={19}/></button></div>{children}</div></div>; }
function FormContent({ type, childrenList, onChild, onTask, onReward, onClose }: { type: 'child' | 'task' | 'reward'; childrenList: Child[]; onChild: (name: string, age: number, avatar: string) => void; onTask: (title: string, childId: string, points: number, category: string) => void; onReward: (title: string, points: number, emoji: string) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [age, setAge] = useState(7); const [points, setPoints] = useState(10); const [childId, setChildId] = useState(childrenList[0]?.id ?? ''); const [category, setCategory] = useState('خانه'); const [emoji, setEmoji] = useState('🎁');
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; if (type === 'child') onChild(name.trim(), age, age < 7 ? '👧🏻' : '🧒🏻'); else if (type === 'task') onTask(name.trim(), childId, points, category); else onReward(name.trim(), points, emoji); };
  const title = type === 'child' ? 'اسم کوچولوتون چیه؟' : type === 'task' ? 'چه کار خوبی قراره انجام بشه؟' : 'این جایزه رو چی صدا کنیم؟';
  const canSubmit = type !== 'task' || childrenList.length > 0;
  return <form className="form-content" onSubmit={submit}><p className="form-intro">{title}</p><label>{type === 'child' ? 'نام فرزند' : type === 'task' ? 'عنوان کار' : 'نام جایزه'}<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={type === 'child' ? 'مثلاً آوا' : type === 'task' ? 'مثلاً مرتب کردن اسباب‌بازی‌ها' : 'مثلاً رفتن به شهربازی'} required/></label>
    {type === 'child' && <label>سن فرزند<input type="number" min="1" max="18" value={age} onChange={e => setAge(Number(e.target.value))}/></label>}
    {type === 'task' && <>{childrenList.length ? <label>برای کدوم فرزند؟<select value={childId} onChange={e => setChildId(e.target.value)}>{childrenList.map(c => <option key={c.id} value={c.id}>{c.avatar} {c.name}</option>)}</select></label> : <p className="form-warning">برای تعریف کار، ابتدا یک فرزند اضافه کنید.</p>}<label>دسته‌بندی<select value={category} onChange={e => setCategory(e.target.value)}><option>خانه</option><option>یادگیری</option><option>خانواده</option><option>سلامتی</option><option>مسئولیت‌پذیری</option></select></label></>}
    {type === 'reward' && <label>شکلک جایزه<select value={emoji} onChange={e => setEmoji(e.target.value)}>{['🎁','🎮','🍦','🍰','🛝','📚','⚽','🎨','🍿','🚲'].map(em => <option key={em}>{em}</option>)}</select></label>}
    {type !== 'child' && <label>{type === 'task' ? 'ارزش کار (ستاره)' : 'هزینه‌ی جایزه (ستاره)'}<div className="number-input"><input type="number" min="1" max="999" value={points} onChange={e => setPoints(Number(e.target.value))}/><Star size={16} fill="currentColor"/></div></label>}
    <div className="form-actions"><button type="button" className="cancel-btn" onClick={onClose}>انصراف</button><button type="submit" className="primary-btn" disabled={!canSubmit}><Plus size={17}/>{type === 'child' ? 'افزودن به خانواده' : type === 'task' ? 'ثبت کار جدید' : 'ساخت جایزه'}</button></div>
  </form>;
}

export default App;
