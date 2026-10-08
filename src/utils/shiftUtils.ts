import { Timestamp } from 'firebase/firestore';

export function getSafeMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Returns the exact Date of the most recent shift cut.
 * e.g., if cut hour is 18:00:
 * At 19:30 today -> returns today at 18:00:00.000
 * At 15:00 today -> returns yesterday at 18:00:00.000
 * At 18:00:00 today -> returns today at 18:00:00.000
 */
export function getLatestShiftCutTime(shiftTimeStr: string = '18:00', now: Date = new Date()): Date {
  const parts = shiftTimeStr.split(':').map(Number);
  const h = isNaN(parts[0]) ? 18 : parts[0];
  const m = isNaN(parts[1]) ? 0 : parts[1];

  const cutToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (now.getTime() >= cutToday.getTime()) {
    return cutToday;
  }
  const cutYesterday = new Date(cutToday);
  cutYesterday.setDate(cutYesterday.getDate() - 1);
  return cutYesterday;
}

export function getShiftKey(cutDate: Date, shiftTimeStr: string = '18:00'): string {
  const y = cutDate.getFullYear();
  const m = String(cutDate.getMonth() + 1).padStart(2, '0');
  const d = String(cutDate.getDate()).padStart(2, '0');
  return `${shiftTimeStr}_${y}-${m}-${d}`;
}

/**
 * Calculates current shift operational uptime in seconds for an equipment.
 * If the equipment was ON prior to the cut, it continues running and its counter starts from 0 at the cut hour.
 */
export function calculateCurrentShiftUptime(
  equipment: {
    status?: 'on' | 'off';
    lastTurnedOn?: any;
    totalUsageTime?: number;
    lastShiftCutAt?: any;
  },
  latestCutTime: Date,
  now: Date = new Date()
): number {
  if (!equipment) return 0;

  const cutMs = latestCutTime.getTime();
  const nowMs = now.getTime();
  const startTime = getSafeMillis(equipment.lastTurnedOn);
  const cutAtTime = getSafeMillis(equipment.lastShiftCutAt);

  if (equipment.status === 'on') {
    // 1. If the equipment was turned ON before the cut hour (startTime < cutMs),
    // it continues running into the new shift. The time prior to the cut belongs to the previous shift report.
    // For this new shift and report, the counter begins strictly from 0 at the cut hour (cutMs)!
    if (startTime < cutMs) {
      const currentSessionSeconds = Math.max(0, Math.floor((nowMs - cutMs) / 1000));
      return currentSessionSeconds;
    }

    // 2. If equipment was turned on (or reset at the cut) at or after cutMs:
    // Only include base totalUsageTime if it was recorded within THIS shift cycle (cutAtTime >= cutMs).
    const validBaseUsage = cutAtTime >= cutMs ? (equipment.totalUsageTime || 0) : 0;
    const currentSessionSeconds = Math.max(0, Math.floor((nowMs - startTime) / 1000));
    return validBaseUsage + currentSessionSeconds;
  } else {
    // Equipment is currently OFF
    if (cutAtTime >= cutMs) {
      return equipment.totalUsageTime || 0;
    }
    // Turned off before the cut: in the new shift it has not run, so 0 seconds.
    return 0;
  }
}

export function formatElapsedSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export function formatUptimeParts(seconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    h: h.toString().padStart(2, '0'),
    m: m.toString().padStart(2, '0'),
    s: s.toString().padStart(2, '0')
  };
}
