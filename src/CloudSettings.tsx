import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { CloudStatus, FamilyFirebaseConfig } from './cloud';
import { parseFirebaseConfig } from './cloud';
import { CheckCircle2, Cloud, CloudOff, LoaderCircle, LogIn, LogOut, Save, ShieldCheck, UserPlus } from 'lucide-react';

type Props = {
  config: FamilyFirebaseConfig | null;
  status: CloudStatus;
  user: User | null;
  message: string;
  onSaveConfig: (config: FamilyFirebaseConfig) => void;
  onRegister: (email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
};
const EMPTY_CONFIG = `{
  "apiKey": "از Firebase Console کپی کنید",
  "authDomain": "نام-پروژه.firebaseapp.com",
  "projectId": "شناسه-پروژه",
  "appId": "شناسه-برنامه"
}`;

export default function CloudSettings({ config, status, user, message, onSaveConfig, onRegister, onLogin, onLogout }: Props) {
  const [configText, setConfigText] = useState(config ? JSON.stringify(config, null, 2) : EMPTY_CONFIG);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  useEffect(() => { if (config) setConfigText(JSON.stringify(config, null, 2)); }, [config]);
  const saveConfig = () => {
    try { onSaveConfig(parseFirebaseConfig(configText)); setLocalError(''); }
    catch { setLocalError('تنظیمات Firebase خوانده نشد. کل شیء تنظیمات برنامه‌ی وب را از Firebase Console کپی کنید.'); }
  };
  const submit = async (action: 'register' | 'login') => {
    setBusy(true); setLocalError('');
    try {
      if (action === 'register') await onRegister(email, password);
      else await onLogin(email, password);
      setPassword('');
    } finally { setBusy(false); }
  };
  const logout = async () => { setBusy(true); try { await onLogout(); } finally { setBusy(false); } };
  const statusText: Record<CloudStatus, string> = {
    unconfigured: 'اتصال ابری هنوز راه‌اندازی نشده',
    'signed-out': 'تنظیمات ذخیره شد؛ برای اتصال وارد حساب خانواده شوید',
    connecting: 'در حال اتصال و دریافت اطلاعات خانواده…',
    online: 'متصل و همگام؛ تغییرات گوشی‌ها خودکار می‌رسند',
    error: 'اتصال برقرار نشد؛ اطلاعات این گوشی همچنان ذخیره است',
  };
  return <section className="panel cloud-card">
    <div className="cloud-card-heading"><div className={`cloud-icon ${status}`}>
      {status === 'online' ? <CheckCircle2 size={23}/> : status === 'connecting' ? <LoaderCircle className="spin" size={23}/> : status === 'error' ? <CloudOff size={23}/> : <Cloud size={23}/>}
    </div><div className="cloud-heading-text"><h3>همگام‌سازی بین گوشی‌ها</h3><p>{statusText[status]}</p></div>{user && <span className="cloud-email">{user.email}</span>}</div>
    {user ? <div className="cloud-account"><div className="secure-note"><ShieldCheck size={20}/><span>حساب خانواده متصل است. برنامه‌ی باز روی گوشی‌های دیگر نیز تغییرات را دریافت می‌کند.</span></div><button className="cancel-btn cloud-logout" disabled={busy} onClick={() => void logout()}><LogOut size={17}/> خروج از حساب</button></div> : <>
      <div className="cloud-setup-note"><b>راه‌اندازی یک‌باره برای خانواده</b><span>یک نفر حساب را می‌سازد؛ سپس روی ۴ گوشی دیگر همان تنظیمات Firebase و ایمیل/رمز را وارد کنید. رمز را فقط در خود برنامه وارد کنید، نه در چت.</span></div>
      <details className="firebase-config-details"><summary>مرحله‌ی ۱ — تنظیمات عمومی Firebase را وارد کنید</summary><p>از راهنمای README یا Firebase Console → Project settings → Your apps، تنظیمات برنامه‌ی وب را کپی و اینجا جای‌گذاری کنید. این تنظیمات شناسه‌ی عمومی پروژه‌اند، نه رمز حساب.</p><textarea value={configText} onChange={event => setConfigText(event.target.value)} rows={6} dir="ltr" spellCheck={false} aria-label="تنظیمات Firebase"/><button className="soft-btn" onClick={saveConfig}><Save size={17}/>{config ? 'ذخیره‌ی تنظیمات Firebase' : 'ذخیره و ادامه'}</button></details>
      {config && <form className="cloud-login-form" onSubmit={event => { event.preventDefault(); void submit('login'); }}><div className="cloud-form-title"><UserPlus size={19}/><b>مرحله‌ی ۲ — حساب مشترک خانواده</b></div><label>ایمیل خانواده<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required/></label><label>رمز عبور<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={6} placeholder="حداقل ۶ نویسه" required/></label><div className="cloud-auth-actions"><button className="primary-btn" type="button" disabled={busy || password.length < 6} onClick={() => void submit('register')}><UserPlus size={18}/>{busy ? 'در حال انجام…' : 'ساخت حساب خانواده'}</button><button className="soft-btn" type="submit" disabled={busy}><LogIn size={18}/>ورود به حساب</button></div><p className="cloud-auth-help">روی گوشی اول «ساخت حساب خانواده» را بزنید؛ روی گوشی‌های دیگر با همان ایمیل و رمز «ورود به حساب» را انتخاب کنید.</p></form>}
    </>}
    {(message || localError) && <p className="cloud-error" role="alert">{localError || message}</p>}
    {status === 'error' && message && <button className="soft-btn cloud-retry" onClick={() => window.location.reload()}>تلاش دوباره</button>}
  </section>;
}
