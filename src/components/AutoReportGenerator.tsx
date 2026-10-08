import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { updateStagedUpcomingReport } from '../services/reportBuilder';
import { getLatestShiftCutTime, getShiftKey } from '../utils/shiftUtils';

export function AutoReportGenerator() {
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('18:00');
  const isStagingRef = useRef(false);
  const stagingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCutCheckingRef = useRef(false);

  const latestSettingsRef = useRef<any>(null);

  const checkAndApplyClientCut = async (settingsParam?: any) => {
    const settings = settingsParam || latestSettingsRef.current;
    if (isCutCheckingRef.current || !auth.currentUser || !settings) return;
    try {
      isCutCheckingRef.current = true;
      const now = new Date();
      const effectiveEndTime = settings.shiftEndTime || settings.shiftStartTime || '18:00';
      const latestCut = getLatestShiftCutTime(effectiveEndTime, now);
      const shiftKey = getShiftKey(latestCut, effectiveEndTime);
      
      if (settings.lastShiftCutKey !== shiftKey) {
        const { getDocs, writeBatch, Timestamp, doc, getDoc, setDoc, deleteDoc } = await import('firebase/firestore');
        const equipSnap = await getDocs(collection(db, 'equipment'));
        const batch = writeBatch(db);
        const cutTimestamp = Timestamp.fromDate(latestCut);

        // Running equipment continues in the new shift, with counter starting strictly from 0 at the cut hour!
        equipSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === 'on') {
            batch.update(docSnap.ref, {
              totalUsageTime: 0,
              lastTurnedOn: cutTimestamp,
              lastShiftCutAt: cutTimestamp,
              lastShiftCutKey: shiftKey,
              lastUpdated: cutTimestamp
            });
          } else {
            batch.update(docSnap.ref, {
              totalUsageTime: 0,
              lastShiftCutAt: cutTimestamp,
              lastShiftCutKey: shiftKey,
              lastUpdated: cutTimestamp
            });
          }
        });

        // Backup current tanks to previous shift tanks
        try {
          const tanksSnap = await getDoc(doc(db, 'config', 'current_shift_tanks'));
          if (tanksSnap.exists()) {
            await setDoc(doc(db, 'config', 'previous_shift_tanks'), {
              tanquesAireacion: tanksSnap.data().tanquesAireacion || [],
              tanquesMovimiento: tanksSnap.data().tanquesMovimiento || [],
              timestamp: new Date().toISOString()
            });
          }
          await deleteDoc(doc(db, 'config', 'current_shift_observations')).catch(() => {});
          await deleteDoc(doc(db, 'config', 'current_shift_maintenance')).catch(() => {});
        } catch (shiftCleanupErr) {
          console.warn('[AutoReportGenerator] Shift cleanup error:', shiftCleanupErr);
        }

        batch.update(doc(db, 'config', 'app_settings'), {
          lastShiftCutKey: shiftKey,
          lastShiftCutTimestamp: cutTimestamp
        });

        await batch.commit();
        if (latestSettingsRef.current) {
          latestSettingsRef.current.lastShiftCutKey = shiftKey;
          latestSettingsRef.current.lastShiftCutTimestamp = cutTimestamp;
        }
        console.log('[AutoReportGenerator] Client shift cut applied successfully:', shiftKey);
      }
    } catch (err) {
      console.warn('[AutoReportGenerator] Notice checking client shift cut:', err);
    } finally {
      isCutCheckingRef.current = false;
    }
  };

  // 1. Listen to app settings and periodically check cut condition
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'app_settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        latestSettingsRef.current = data;
        if (data.shiftStartTime) setStartTime(data.shiftStartTime);
        if (data.shiftEndTime) setEndTime(data.shiftEndTime);
        checkAndApplyClientCut(data);
      }
    });

    // Check every 5 seconds so when the cut time arrives in real time, it triggers immediately
    const cutInterval = setInterval(() => {
      if (latestSettingsRef.current) {
        checkAndApplyClientCut(latestSettingsRef.current);
      }
    }, 5000);

    return () => {
      unsub();
      clearInterval(cutInterval);
    };
  }, []);

  // 2. Debounced stage function
  const triggerStaging = (delayMs = 1500) => {
    if (stagingTimeoutRef.current) {
      clearTimeout(stagingTimeoutRef.current);
    }
    stagingTimeoutRef.current = setTimeout(async () => {
      if (isStagingRef.current) return;
      isStagingRef.current = true;
      try {
        await updateStagedUpcomingReport({
          shiftStartTime: startTime,
          shiftEndTime: endTime
        });
      } catch (err) {
        console.warn('[AutoReportGenerator] Error updating staged upcoming report:', err);
      } finally {
        isStagingRef.current = false;
      }
    }, delayMs);
  };

  // 3. Listen to all relevant shift data changes to keep draft 100% in sync with Panel de Registro
  useEffect(() => {
    // Initial stage on startup
    triggerStaging(500);

    // Logs (when equipment is turned ON/OFF in Panel de Registro)
    const unsubLogs = onSnapshot(collection(db, 'logs'), () => triggerStaging(1200));

    // Equipment state changes
    const unsubEquip = onSnapshot(collection(db, 'equipment'), () => triggerStaging(1200));

    // Power events (cortes / fallas)
    const unsubPower = onSnapshot(collection(db, 'power_events'), () => triggerStaging(1200));

    // Shift notes, maintenance, and tanks
    const unsubObs = onSnapshot(doc(db, 'config', 'current_shift_observations'), () => triggerStaging(1200));
    const unsubMaint = onSnapshot(doc(db, 'config', 'current_shift_maintenance'), () => triggerStaging(1200));
    const unsubTanks = onSnapshot(doc(db, 'config', 'current_shift_tanks'), () => triggerStaging(1200));

    // Periodic check every 2 minutes
    const interval = setInterval(() => {
      triggerStaging(100);
    }, 120000);

    const handleFocus = () => {
      triggerStaging(300);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      if (stagingTimeoutRef.current) clearTimeout(stagingTimeoutRef.current);
      clearInterval(interval);
      unsubLogs();
      unsubEquip();
      unsubPower();
      unsubObs();
      unsubMaint();
      unsubTanks();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [startTime, endTime]);

  return null;
}
