import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Silence diagnostic SDK messages to prevent benign offline transitions from triggering error monitors
setLogLevel('silent');

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.warn("Falling back to memory local cache:", e);
    return initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, firebaseConfig.firestoreDatabaseId);
  }
})();

export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Auth persistence configuration error:", err);
  });
}

export const storage = getStorage(app);


