import React, { useState, useEffect } from 'react';
import { WifiOff, Cloud, Check, Loader2 } from 'lucide-react';
import { onSnapshot, collection, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center">
      <AnimatePresence mode="wait">
        {!isOnline ? (
          <motion.div
            key="offline"
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-700 border border-rose-300/80 rounded-full shadow-xs backdrop-blur-xs select-none"
            title="Estás trabajando sin conexión. Los cambios se guardarán localmente."
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 opacity-40 animate-ping"></span>
              <span className="relative inline-block w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <span className="text-[11px] font-bold tracking-tight">Offline</span>
            <WifiOff size={13} className="text-rose-600 stroke-[2.5]" />
          </motion.div>
        ) : (
          <motion.div
            key="online"
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2 px-3.5 py-1 bg-emerald-500/10 text-emerald-800 border border-emerald-300/80 rounded-full shadow-xs backdrop-blur-xs select-none"
            title="Conectado y sincronizado en tiempo real"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-500 opacity-30 animate-pulse"></span>
              <span className="relative inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"></span>
            </div>
            <span className="text-[11px] font-bold tracking-tight">Sincronizado</span>
            <Cloud size={13} className="text-emerald-600 stroke-[2.5]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
