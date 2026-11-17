import type { User } from 'firebase/auth';
import type { FirebaseOptions } from 'firebase/app';

export type FamilyFirebaseConfig = Pick<FirebaseOptions, 'apiKey' | 'authDomain' | 'projectId' | 'appId'> & Partial<Pick<FirebaseOptions, 'messagingSenderId' | 'storageBucket'>>;
export type CloudStatus = 'unconfigured' | 'signed-out' | 'connecting' | 'online' | 'error';
export type FamilyDocument = { version: number };

const CONFIG_KEY = 'setareh-family-firebase-config-v1';

export function readFirebaseConfig(): FamilyFirebaseConfig | null {
  try {
    const value = localStorage.getItem(CONFIG_KEY);
    if (!value) return null;
    const config = JSON.parse(value) as FamilyFirebaseConfig;
    return config.apiKey && config.projectId && config.appId ? config : null;
  } catch { return null; }
}

export function parseFirebaseConfig(source: string): FamilyFirebaseConfig {
  let text = source.replace(/```(?:javascript|js|json)?/gi, '').trim();
  const declaration = text.indexOf('firebaseConfig');
  const start = text.indexOf('{', declaration >= 0 ? declaration : 0);
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('missing-config-object');
  text = text.slice(start, end + 1)
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([{,]\s*)(apiKey|authDomain|projectId|appId|messagingSenderId|storageBucket|measurementId)\s*:/g, '$1"$2":')
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/,\s*}/g, '}');
  const config = JSON.parse(text) as Partial<FamilyFirebaseConfig>;
  if (!config.apiKey || !config.projectId || !config.appId) throw new Error('missing-config-fields');
  return {
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId,
    ...(config.authDomain ? { authDomain: config.authDomain } : { authDomain: `${config.projectId}.firebaseapp.com` }),
    ...(config.messagingSenderId ? { messagingSenderId: config.messagingSenderId } : {}),
    ...(config.storageBucket ? { storageBucket: config.storageBucket } : {}),
  };
}

export function storeFirebaseConfig(config: FamilyFirebaseConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function watchAuth(config: FamilyFirebaseConfig, callback: (user: User | null) => void, onError: (error: unknown) => void): () => void {
  let cancelled = false;
  let unsubscribe: () => void = () => {};
  void import('./firebaseRuntime').then(runtime => {
    if (!cancelled) unsubscribe = runtime.watchAuth(config, callback, onError);
  }).catch(onError);
  return () => { cancelled = true; unsubscribe(); };
}

export async function createFamilyAccount(config: FamilyFirebaseConfig, email: string, password: string) {
  const runtime = await import('./firebaseRuntime');
  return runtime.createFamilyAccount(config, email, password);
}

export async function loginFamilyAccount(config: FamilyFirebaseConfig, email: string, password: string) {
  const runtime = await import('./firebaseRuntime');
  return runtime.loginFamilyAccount(config, email, password);
}

export async function logoutFamilyAccount(config: FamilyFirebaseConfig) {
  const runtime = await import('./firebaseRuntime');
  await runtime.logoutFamilyAccount(config);
}

export function watchFamilyData(config: FamilyFirebaseConfig, userId: string, initialData: FamilyDocument, onData: (data: FamilyDocument) => void, onReady: () => void, onError: (error: unknown) => void): () => void {
  let cancelled = false;
  let unsubscribe: () => void = () => {};
  void import('./firebaseRuntime').then(runtime => {
    if (!cancelled) unsubscribe = runtime.watchFamilyData(config, userId, initialData, onData, onReady, onError);
  }).catch(onError);
  return () => { cancelled = true; unsubscribe(); };
}

export async function writeFamilyData(config: FamilyFirebaseConfig, userId: string, data: FamilyDocument) {
  const runtime = await import('./firebaseRuntime');
  await runtime.writeFamilyData(config, userId, data);
}

export function friendlyFirebaseError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-in-use': return 'این ایمیل قبلاً حساب دارد؛ به‌جای ثبت‌نام، وارد شوید.';
    case 'auth/invalid-email': return 'قالب ایمیل درست نیست.';
    case 'auth/weak-password': return 'رمز باید حداقل ۶ نویسه داشته باشد.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'ایمیل یا رمز عبور درست نیست.';
    case 'auth/operation-not-allowed': return 'ورود با ایمیل/رمز را در Firebase فعال کنید.';
    case 'permission-denied':
    case 'firestore/permission-denied': return 'دسترسی پایگاه‌داده رد شد؛ قواعد Firestore را طبق راهنمای پروژه تنظیم کنید.';
    case 'auth/network-request-failed':
    case 'unavailable': return 'اتصال اینترنت برقرار نیست؛ اطلاعات این گوشی همچنان ذخیره می‌شود.';
    case 'invalid-cloud-data': return 'اطلاعات ابری قابل خواندن نیست.';
    default: return 'اتصال ابری برقرار نشد. تنظیم Firebase و اینترنت را بررسی کنید.';
  }
}
