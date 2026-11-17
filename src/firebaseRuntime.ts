import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseOptions } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  doc, getFirestore, initializeFirestore, onSnapshot, persistentLocalCache, serverTimestamp, setDoc,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FamilyDocument, FamilyFirebaseConfig } from './cloud';

const firestoreInstances = new Map<string, Firestore>();
function getServices(config: FamilyFirebaseConfig) {
  const appName = `setareh-${config.projectId}-${config.apiKey?.slice(-6) ?? 'default'}`;
  const app = getApps().some(item => item.name === appName) ? getApp(appName) : initializeApp(config as FirebaseOptions, appName);
  let db = firestoreInstances.get(appName);
  if (!db) {
    try { db = initializeFirestore(app, { localCache: persistentLocalCache() }); }
    catch { db = getFirestore(app); }
    firestoreInstances.set(appName, db);
  }
  return { auth: getAuth(app), db };
}

export function watchAuth(config: FamilyFirebaseConfig, callback: (user: User | null) => void, onError: (error: unknown) => void) {
  try { return onAuthStateChanged(getServices(config).auth, callback, onError); }
  catch (error) { onError(error); return () => undefined; }
}

export async function createFamilyAccount(config: FamilyFirebaseConfig, email: string, password: string) {
  return createUserWithEmailAndPassword(getServices(config).auth, email.trim(), password);
}

export async function loginFamilyAccount(config: FamilyFirebaseConfig, email: string, password: string) {
  return signInWithEmailAndPassword(getServices(config).auth, email.trim(), password);
}

export async function logoutFamilyAccount(config: FamilyFirebaseConfig) {
  await signOut(getServices(config).auth);
}

export function watchFamilyData(config: FamilyFirebaseConfig, userId: string, initialData: FamilyDocument, onData: (data: FamilyDocument) => void, onReady: () => void, onError: (error: unknown) => void) {
  const { db } = getServices(config);
  const reference = doc(db, 'families', userId);
  return onSnapshot(reference, snapshot => {
    if (!snapshot.exists()) {
      void setDoc(reference, { appData: initialData, updatedAt: serverTimestamp() })
        .then(onReady)
        .catch(onError);
      return;
    }
    const cloudData = snapshot.data().appData;
    if (!cloudData || typeof cloudData !== 'object' || Array.isArray(cloudData)) {
      onError(new Error('invalid-cloud-data'));
      return;
    }
    onData(cloudData as FamilyDocument);
    onReady();
  }, onError);
}

export async function writeFamilyData(config: FamilyFirebaseConfig, userId: string, data: FamilyDocument) {
  const { db } = getServices(config);
  await setDoc(doc(db, 'families', userId), { appData: data, updatedAt: serverTimestamp() });
}
