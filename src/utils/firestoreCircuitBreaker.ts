// Global circuit breaker to prevent Firebase writes when quota is exhausted
export const ALLOW_FIRESTORE_WRITES = false;

export const safeWrite = async <T>(operation: () => Promise<T>): Promise<T | null> => {
  if (!ALLOW_FIRESTORE_WRITES) {
    console.warn('Firestore write blocked by circuit breaker.');
    return null;
  }
  return await operation();
};
