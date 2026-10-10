import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

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
  throw new Error(JSON.stringify(errInfo));
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'operator';
  is_synced: boolean;
  is_online: boolean;
  last_connection?: string;
  photo_url?: string;
}

export const isMasterAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return normalized === 'jorgealvarez.lj17@gmail.com' || normalized === 'j.alvarez.lj17@gmail.com';
};

interface ProfileContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({ user: null, profile: null, loading: true, logout: async () => {} });

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('auth_revoked_reason')) {
        localStorage.removeItem('cached_auth_user');
        localStorage.removeItem('cached_user_profile');
        return null;
      }
      const cached = localStorage.getItem('cached_auth_user');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed && parsed.is_authorized) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('auth_revoked_reason')) {
        return null;
      }
      const cached = localStorage.getItem('cached_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('cached_user_profile');
      return cached ? false : true;
    } catch {
      return true;
    }
  });

  const updateCachedProfile = (newProfile: Profile | null) => {
    setProfile(newProfile);
    if (newProfile) {
      try {
        localStorage.setItem('cached_user_profile', JSON.stringify(newProfile));
      } catch (e) {
        console.warn('Could not cache user profile:', e);
      }
    } else {
      localStorage.removeItem('cached_user_profile');
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('cached_auth_user');
      localStorage.removeItem('cached_user_profile');
    } catch {}
    setUser(null);
    updateCachedProfile(null);
    if (auth.currentUser) {
      const profileRef = doc(db, 'profiles', auth.currentUser.uid);
      try {
        await setDoc(profileRef, { is_online: false, last_connection: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.error('Error setting offline status on logout:', err);
      }
    }
    await signOut(auth);
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let currentUserRef: ReturnType<typeof doc> | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (incomingUser) => {
      if (incomingUser) {
        const userEmailLower = incomingUser.email ? incomingUser.email.toLowerCase().trim() : '';
        const isAdminEmail = isMasterAdminEmail(userEmailLower);

        // STAGE 1: GATEWAY SECURITY CHECK
        // If not master admin, verify against allowed_emails BEFORE touching user state, cache, or presence!
        if (!isAdminEmail) {
          if (!userEmailLower) {
            console.warn('[Security] Unauthorized attempt: User has no email.');
            sessionStorage.setItem('auth_revoked_reason', 'No registrado');
            localStorage.removeItem('cached_auth_user');
            localStorage.removeItem('cached_user_profile');
            setUser(null);
            updateCachedProfile(null);
            setLoading(false);
            await signOut(auth);
            return;
          }

          try {
            const allowedDocRef = doc(db, 'allowed_emails', userEmailLower);
            const allowedSnap = await getDoc(allowedDocRef);
            if (!allowedSnap.exists() || allowedSnap.data()?.status === 'inactive') {
              console.warn('[Security] Unauthorized email attempting access:', userEmailLower);
              sessionStorage.setItem('auth_revoked_reason', 'No registrado');
              localStorage.removeItem('cached_auth_user');
              localStorage.removeItem('cached_user_profile');
              setUser(null);
              updateCachedProfile(null);
              setLoading(false);
              await signOut(auth);
              return;
            }
          } catch (err) {
            const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            const cachedAuth = localStorage.getItem('cached_auth_user');
            if (isOffline && cachedAuth) {
              // Valid offline verified session
            } else {
              console.warn('Notice checking allowed_emails (blocking access):', err);
              sessionStorage.setItem('auth_revoked_reason', 'No registrado');
              localStorage.removeItem('cached_auth_user');
              localStorage.removeItem('cached_user_profile');
              setUser(null);
              updateCachedProfile(null);
              setLoading(false);
              await signOut(auth);
              return;
            }
          }
        }

        // STAGE 2: ONLY AUTHORIZED USERS REACH HERE
        // Set user state and save verified auth cache
        setUser(incomingUser);
        try {
          localStorage.setItem('cached_auth_user', JSON.stringify({
            uid: incomingUser.uid,
            email: incomingUser.email,
            displayName: incomingUser.displayName,
            photoURL: incomingUser.photoURL,
            is_authorized: true
          }));
        } catch (e) {
          console.warn('Error caching auth user:', e);
        }

        const profileRef = doc(db, 'profiles', incomingUser.uid);
        currentUserRef = profileRef;

        // Update presence only ONCE on login/load, avoiding repetitive write loops
        try {
          const initialUpdates: any = { 
            is_online: true, 
            last_connection: new Date().toISOString() 
          };
          if (incomingUser.photoURL) initialUpdates.photo_url = incomingUser.photoURL;
          if (incomingUser.displayName) initialUpdates.full_name = incomingUser.displayName;
          setDoc(profileRef, initialUpdates, { merge: true }).catch(() => {});
        } catch (err) {
          console.warn('Notice setting initial profile presence:', err);
        }

        // Realtime whitelist/authorization listener for non-admin accounts
        let unsubscribeAllowedEmail: (() => void) | undefined;

        if (!isAdminEmail) {
          const allowedDocRef = doc(db, 'allowed_emails', userEmailLower);
          unsubscribeAllowedEmail = onSnapshot(allowedDocRef, (allowedSnap) => {
            // Si no hay red o el snapshot es de caché no definitivo, no revocar
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              return;
            }
            const isFromCache = !!(allowedSnap as any)?.metadata?.fromCache;
            if (isFromCache && !allowedSnap.exists()) {
              return;
            }

            if (!allowedSnap.exists() || allowedSnap.data()?.status === 'inactive') {
              console.warn('[Security] User email removed or inactive. Revoking session immediately.');
              sessionStorage.setItem('auth_revoked_reason', 'No registrado');
              if (currentUserRef) {
                setDoc(currentUserRef, { is_online: false, last_connection: new Date().toISOString() }, { merge: true }).catch(() => {});
              }
              localStorage.removeItem('cached_auth_user');
              localStorage.removeItem('cached_user_profile');
              setUser(null);
              updateCachedProfile(null);
              signOut(auth).catch((e) => console.error('Sign out error:', e));
              return;
            }
          }, (err) => {
            console.warn('Notice listening to allowed_emails status (offline/cache):', err);
          });
        }

        // Listen to profile changes directly without blocking getDoc
        unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Profile;
            
            // Auto-promote master admin or sync admin role if needed
            if (isAdminEmail) {
              if (data.role !== 'admin' || !data.is_synced) {
                try {
                  await setDoc(profileRef, { role: 'admin', is_synced: true }, { merge: true });
                } catch (err) {
                  console.warn('Error setting admin role sync:', err);
                }
              }
            } else if (data.role === 'admin' && !data.is_synced) {
              // Ensure any admin user has is_synced: true so they are never in read-only mode
              try {
                await setDoc(profileRef, { is_synced: true }, { merge: true });
              } catch (err) {
                console.warn('Error setting admin is_synced:', err);
              }
            }
            
            updateCachedProfile(data);
            setLoading(false);
          } else {
            const isSnapshotFromCache = !!(docSnap as any)?.metadata?.fromCache;
            const isOfflineNow = typeof navigator !== 'undefined' && !navigator.onLine;

            // If server confirms doc doesn't exist, create initial profile
            if (!isSnapshotFromCache && !isOfflineNow) {
              let initialRole: 'admin' | 'operator' = isAdminEmail ? 'admin' : 'operator';
              let initialName = incomingUser.displayName || incomingUser.email?.split('@')[0] || (isAdminEmail ? 'Administrador' : 'Operador');

              try {
                const allowedDoc = await getDoc(doc(db, 'allowed_emails', userEmailLower));
                if (allowedDoc.exists()) {
                  const allowedData = allowedDoc.data();
                  if (allowedData.name) initialName = allowedData.name;
                  if (allowedData.role === 'admin') initialRole = 'admin';
                }
              } catch (e) {
                console.warn('Could not read allowed_emails for initial profile:', e);
              }

              const newProfile: Profile = {
                id: incomingUser.uid,
                email: incomingUser.email || '',
                full_name: initialName,
                role: initialRole,
                is_synced: true,
                is_online: document.visibilityState === 'visible' && !document.hidden,
                last_connection: new Date().toISOString()
              };
              if (incomingUser.photoURL) {
                newProfile.photo_url = incomingUser.photoURL;
              }
              
              updateCachedProfile(newProfile);
              setDoc(profileRef, newProfile).catch((err) => {
                console.warn('Could not write new profile to remote:', err);
              });
            }
            setLoading(false);
          }
        }, (err) => {
          console.warn('Profile snapshot notice (continuing with cached profile if offline):', err);
          setLoading(false);
        });

        const originalUnsubscribeProfile = unsubscribeProfile;
        unsubscribeProfile = () => {
          if (unsubscribeAllowedEmail) unsubscribeAllowedEmail();
          if (originalUnsubscribeProfile) originalUnsubscribeProfile();
        };

      } else {
        currentUserRef = undefined;
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }

        // CRITICAL: Do not clear profile cache when offline or if cached auth session exists
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const hasCachedAuth = typeof window !== 'undefined' && !!localStorage.getItem('cached_auth_user');
        if (!isOffline && !hasCachedAuth) {
          setUser(null);
          updateCachedProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
