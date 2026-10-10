import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  Send, 
  Check, 
  Copy, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText
} from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, onSnapshot, doc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useProfile } from '../context/ProfileContext';
import { sounds } from '../utils/sounds';
import { format } from 'date-fns';
import { sendWhatsAppMessageDirect } from '../whatsapp';

export interface WhatsAppBackupRecord {
  id: string;
  timestamp: string;
  recipient: string;
  message: string;
  status: 'success' | 'failed' | 'scheduled' | 'saved' | 'manual' | string;
  error?: string | null;
  provider?: string;
  type?: string;
}

export const BackupsPanel: React.FC = () => {
  const { profile } = useProfile();
  const isAdmin = profile?.role === 'admin';

  const [backups, setBackups] = useState<WhatsAppBackupRecord[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [isClearingBackups, setIsClearingBackups] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [backupSearch, setBackupSearch] = useState('');
  
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBackups = async () => {
    setIsLoadingBackups(true);
    try {
      if (!db) return;
      const backupsRef = collection(db, 'whatsapp_backups');
      const q = query(backupsRef, orderBy('timestamp', 'desc'), limit(150));
      const snapshot = await getDocs(q);
      const fetchedBackups: any[] = [];
      snapshot.forEach(docSnap => fetchedBackups.push({ id: docSnap.id, ...docSnap.data() }));
      
      setBackups(fetchedBackups.filter((b: any) => b.id !== 'staged_upcoming_report'));
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    if (!db) return;

    const q = query(collection(db, 'whatsapp_backups'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: WhatsAppBackupRecord[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === 'staged_upcoming_report') return;
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          timestamp: d.timestamp || new Date().toISOString(),
          recipient: d.recipient || '',
          message: d.message || '',
          status: d.status || 'success',
          error: d.error || null,
          provider: d.provider || ''
        });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setBackups(list);
      setIsLoadingBackups(false);
    }, (err) => {
      console.warn('Firestore listener on whatsapp_backups failed:', err);
    });

    return () => unsub();
  }, []);

  const handleResendBackup = async (backup: WhatsAppBackupRecord) => {
    sounds.playClick();
    setResendingId(backup.id);
    setResendStatus(null);
    try {
      // Load config for resend
      let config = {};
      if (db) {
        const configDoc = await getDoc(doc(db, 'config', 'app_settings'));
        if (configDoc.exists()) config = configDoc.data() || {};
      }
      const response = await sendWhatsAppMessageDirect(backup.message, config, backup.recipient);
      if (response.success) {
        sounds.playSuccess();
        setResendStatus({ id: backup.id, success: true, message: '¡Mensaje reenviado exitosamente a WhatsApp!' });
      } else {
        sounds.playError();
        setResendStatus({ id: backup.id, success: false, message: response.error || 'Error al reenviar mensaje.' });
      }
    } catch (err: any) {
      sounds.playError();
      setResendStatus({ id: backup.id, success: false, message: err.message || 'Error de conexión' });
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyBackup = (backup: WhatsAppBackupRecord) => {
    sounds.playClick();
    navigator.clipboard.writeText(backup.message);
    setCopiedId(backup.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteSingleBackup = async (id: string) => {
    sounds.playClick();
    try {
      if (db) {
        await deleteDoc(doc(db, 'whatsapp_backups', id));
      }
      setBackups(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Error deleting backup:', err);
    }
  };

  const handleClearAllBackups = async () => {
    sounds.playClick();
    setIsClearingBackups(true);
    try {
      if (db) {
        const backupsRef = collection(db, 'whatsapp_backups');
        const snapshot = await getDocs(backupsRef);
        const batchPromises = snapshot.docs.map(document => deleteDoc(doc(db, 'whatsapp_backups', document.id)));
        await Promise.all(batchPromises);
      }
      setBackups([]);
      setShowClearConfirm(false);
      sounds.playSuccess();
    } catch (err) {
      console.error('Error clearing backups:', err);
      sounds.playError();
    } finally {
      setIsClearingBackups(false);
    }
  };

  const filteredBackups = backups.filter(b => {
    if (!backupSearch) return true;
    const searchLower = backupSearch.toLowerCase();
    const formattedDate = b.timestamp ? format(new Date(b.timestamp), 'dd/MM/yyyy HH:mm') : '';
    return (
      b.message.toLowerCase().includes(searchLower) ||
      b.recipient.toLowerCase().includes(searchLower) ||
      formattedDate.includes(searchLower) ||
      b.timestamp.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1 flex items-center gap-3">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-2xl">
              <Database size={28} />
            </span>
            Respaldos
          </h2>
          <p className="text-slate-600 font-medium text-sm">
            Historial cronológico de reportes enviados y guardados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBackups}
            disabled={isLoadingBackups}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2 text-sm font-semibold shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoadingBackups ? 'animate-spin text-blue-600' : ''} />
            <span>Actualizar</span>
          </button>

          {isAdmin && backups.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="h-10 px-4 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all flex items-center gap-1.5 text-sm font-semibold shadow-xs"
            >
              <Trash2 size={15} />
              <span>Vaciar Historial</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerta de confirmación para vaciar */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm space-y-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5 font-bold text-rose-900">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span>¿Confirmas que deseas eliminar todo el historial de respaldo permanentemente?</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClearAllBackups}
                disabled={isClearingBackups}
                className="h-8 px-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-xs flex items-center gap-1.5"
              >
                {isClearingBackups ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Sí, eliminar todo</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="h-8 px-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors text-xs"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Búsqueda con Lupa */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={backupSearch}
            onChange={(e) => setBackupSearch(e.target.value)}
            placeholder="Buscar por fecha (ej. 10/10 o 2026), contenido del reporte o destinatario..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      {/* Lista de Respaldos (Uno debajo del otro) */}
      {isLoadingBackups ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <Loader2 size={28} className="animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-semibold text-slate-600">Cargando reportes...</p>
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center space-y-2">
          <Database size={36} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">No se encontraron reportes</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {backupSearch 
              ? 'No hay reportes que coincidan con la búsqueda.' 
              : 'Los reportes enviados aparecerán aquí uno tras otro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-500 px-1">
            Mostrando {filteredBackups.length} {filteredBackups.length === 1 ? 'reporte' : 'reportes'}
          </div>

          {filteredBackups.map((bk) => {
            const formattedDate = bk.timestamp 
              ? format(new Date(bk.timestamp), 'dd/MM/yyyy · hh:mm a')
              : 'Fecha no registrada';

            return (
              <div
                key={bk.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3 transition-all hover:border-slate-300"
              >
                {/* Metadatos y Acciones */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono">
                      {formattedDate}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{bk.recipient || 'WhatsApp'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyBackup(bk)}
                      className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                      title="Copiar texto del reporte"
                    >
                      {copiedId === bk.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedId === bk.id ? 'Copiado' : 'Copiar'}</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleResendBackup(bk)}
                        disabled={resendingId === bk.id}
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-xs"
                        title="Reenviar este reporte a WhatsApp"
                      >
                        {resendingId === bk.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>Reenviar</span>
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleBackup(bk.id)}
                        className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center"
                        title="Eliminar reporte"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Texto del Reporte */}
                <div className="bg-slate-50 text-slate-800 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                  {bk.message}
                </div>

                {/* Estado de Reenvío */}
                {resendStatus && resendStatus.id === bk.id && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    resendStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {resendStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{resendStatus.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BackupsPanel;

