import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  addDoc, 
  getDocs, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Zap, 
  Trash2, 
  X, 
  AlertTriangle, 
  Clock, 
  ZapOff, 
  Plus, 
  Check, 
  CheckCircle2, 
  Calendar 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../firestoreUtils';

export const PowerEventsLog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [latestEvent, setLatestEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Manual Event Creation State
  const [showAddForm, setShowAddForm] = useState(false);
  const [eventType, setEventType] = useState<'corte' | 'falla' | 'ok'>('corte');
  const [eventDate, setEventDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [eventTime, setEventTime] = useState(() => format(new Date(), 'HH:mm'));
  const [eventNotes, setEventNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEventDate(format(new Date(), 'yyyy-MM-dd'));
      setEventTime(format(new Date(), 'HH:mm'));
      setSaveSuccess(false);
    }
  }, [isOpen]);

  // Lightweight status listener: only 1 document
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'power_events'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestEvent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setLatestEvent(null);
      }
    }, () => {
      // ignore
    });

    return () => unsubscribe();
  }, []);

  // History list listener: only active when modal is open
  useEffect(() => {
    if (!auth.currentUser || !isOpen) return;

    setLoading(true);
    const q = query(
      collection(db, 'power_events'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'power_events');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleSetCurrentTime = () => {
    const now = new Date();
    setEventDate(format(now, 'yyyy-MM-dd'));
    setEventTime(format(now, 'HH:mm'));
  };

  const handleCreateManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate || !eventTime) return;

    setIsSaving(true);
    try {
      const [year, month, day] = eventDate.split('-').map(Number);
      const [hours, minutes] = eventTime.split(':').map(Number);
      const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (isNaN(targetDate.getTime())) {
        throw new Error('Fecha u hora inválida');
      }

      await addDoc(collection(db, 'power_events'), {
        type: eventType,
        timestamp: Timestamp.fromDate(targetDate),
        userUid: auth.currentUser?.uid || null,
        userEmail: auth.currentUser?.email || null,
        notes: eventNotes.trim() || (eventType === 'corte' ? 'Corte Eléctrico' : eventType === 'falla' ? 'Fluctuación Eléctrica' : 'Servicio Restablecido'),
        isManual: true
      });

      setSaveSuccess(true);
      setEventNotes('');
      setTimeout(() => {
        setSaveSuccess(false);
        setShowAddForm(false);
      }, 1200);
    } catch (error) {
      console.error('Error saving manual power event:', error);
      handleFirestoreError(error, OperationType.CREATE, 'power_events');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSingleEvent = async (eventId: string) => {
    try {
      setDeletingId(eventId);
      await deleteDoc(doc(db, 'power_events', eventId));
    } catch (error) {
      console.error('Error deleting power event:', error);
      handleFirestoreError(error, OperationType.DELETE, `power_events/${eventId}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearHistory = async () => {
    try {
      const q = query(collection(db, 'power_events'));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(db, 'power_events', document.id))
      );
      
      await Promise.all(deletePromises);
      setConfirmClear(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'power_events');
    }
  };

  const currentState = latestEvent ? latestEvent.type : (events.length > 0 ? events[0].type : 'ok');
  const isFalla = currentState === 'falla';
  const isCorte = currentState === 'corte';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all border relative h-10 hover:scale-[1.01] active:scale-[0.99] ${
          isCorte 
            ? 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100 shadow-sm shadow-rose-100/50'
            : isFalla
            ? 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100 shadow-sm shadow-amber-100/50'
            : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 shadow-sm'
        }`}
      >
        {(isCorte || isFalla) && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCorte ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isCorte ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
          </span>
        )}
        {isCorte ? (
          <ZapOff size={16} className="text-rose-600 animate-pulse shrink-0" />
        ) : isFalla ? (
          <AlertTriangle size={16} className="text-amber-600 animate-pulse shrink-0" />
        ) : (
          <Zap size={16} className="text-slate-500 shrink-0 fill-slate-200" />
        )}
        <span className="hidden md:inline">
          {isCorte ? 'Corte Activo' : isFalla ? 'Falla Activa' : 'Registro Eléctrico'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Registro Eléctrico</h2>
                    <p className="text-xs font-medium text-slate-500">Historial y registro manual de eventos</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* Manual Event Creation Form */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.form
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      onSubmit={handleCreateManualEvent}
                      className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Plus size={15} className="text-amber-500" /> Nuevo Registro Manual
                        </span>
                        <button
                          type="button"
                          onClick={handleSetCurrentTime}
                          className="text-[11px] font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 transition-colors"
                        >
                          <Clock size={13} /> Poner fecha y hora actual
                        </button>
                      </div>

                      {/* Event Type Cards */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Tipo de Evento Eléctrico
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setEventType('corte')}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                              eventType === 'corte'
                                ? 'bg-red-500 text-white border-red-600 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <ZapOff size={18} className={eventType === 'corte' ? 'text-white' : 'text-red-500'} />
                            <div>
                              <div className="text-xs font-bold">Corte Eléctrico</div>
                              <div className={`text-[10px] ${eventType === 'corte' ? 'text-red-100' : 'text-slate-400'}`}>Sin luz total</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEventType('falla')}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                              eventType === 'falla'
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <AlertTriangle size={18} className={eventType === 'falla' ? 'text-white' : 'text-amber-500'} />
                            <div>
                              <div className="text-xs font-bold">Fluctuación</div>
                              <div className={`text-[10px] ${eventType === 'falla' ? 'text-amber-100' : 'text-slate-400'}`}>Falla / Bajón</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEventType('ok')}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                              eventType === 'ok'
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Clock size={18} className={eventType === 'ok' ? 'text-white' : 'text-emerald-500'} />
                            <div>
                              <div className="text-xs font-bold">Restablecido</div>
                              <div className={`text-[10px] ${eventType === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>Luz normal</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Date & Time Picker */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Fecha
                          </label>
                          <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Hora
                          </label>
                          <input
                            type="time"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Notes / Observación */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Observación (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Falla en fase A, corte de línea general, etc."
                          value={eventNotes}
                          onChange={(e) => setEventNotes(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                      </div>

                      {/* Submit Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <span>Guardando...</span>
                          ) : saveSuccess ? (
                            <>
                              <Check size={15} /> <span>¡Registrado!</span>
                            </>
                          ) : (
                            <>
                              <Plus size={15} /> <span>Guardar Evento</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Event History Header */}
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Historial de Eventos ({events.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      showAddForm
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {showAddForm ? (
                      <>
                        <X size={13} />
                        <span>Cerrar</span>
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        <span>Agregar Manual</span>
                      </>
                    )}
                  </button>
                </div>

                {/* History List */}
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 border border-slate-200 shadow-2xs">
                      <Zap size={32} />
                    </div>
                    <p className="text-slate-600 font-bold text-sm">No hay eventos registrados</p>
                    <p className="text-slate-400 text-xs mt-1">Usa el botón "Agregar Manual" para añadir un corte o fluctuación.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => {
                      const date = event.timestamp ? event.timestamp.toDate() : new Date();
                      
                      let icon = <Zap size={18} />;
                      let bgColor = 'bg-slate-100';
                      let textColor = 'text-slate-700';
                      let borderColor = 'border-slate-200';
                      let title = 'Desconocido';

                      if (event.type === 'falla') {
                        icon = <AlertTriangle size={18} />;
                        bgColor = 'bg-amber-100 text-amber-700';
                        textColor = 'text-amber-900';
                        borderColor = 'border-amber-200/80';
                        title = 'Falla Eléctrica (Fluctuación)';
                      } else if (event.type === 'corte') {
                        icon = <ZapOff size={18} />;
                        bgColor = 'bg-red-100 text-red-700';
                        textColor = 'text-red-900';
                        borderColor = 'border-red-200/80';
                        title = 'Corte Eléctrico (Sin luz)';
                      } else if (event.type === 'ok') {
                        icon = <Clock size={18} />;
                        bgColor = 'bg-emerald-100 text-emerald-700';
                        textColor = 'text-emerald-900';
                        borderColor = 'border-emerald-200/80';
                        title = 'Servicio Restablecido';
                      }

                      return (
                        <div 
                          key={event.id} 
                          className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border ${borderColor} bg-white shadow-2xs hover:bg-slate-50/60 transition-colors`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
                              {icon}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`font-black text-xs sm:text-sm ${textColor}`}>{title}</h4>
                                {event.isManual && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                                    Manual
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                {format(date, 'dd/MM/yyyy hh:mm a', { locale: es })}
                              </p>
                              {event.notes && (
                                <p className="text-xs text-slate-600 mt-1 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                                  {event.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Delete single button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleEvent(event.id)}
                            disabled={deletingId === event.id}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0"
                            title="Eliminar este registro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer with Clear All */}
              {events.length > 0 && (
                <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70">
                  {confirmClear ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-100 rounded-2xl p-3.5"
                    >
                      <p className="text-xs font-bold text-red-800 mb-2.5 text-center uppercase tracking-wider">
                        ¿Eliminar todo el historial de eventos eléctricos?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleClearHistory}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-widest"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmClear(false)}
                          className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors uppercase tracking-widest"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Total: {events.length} eventos
                      </span>
                      <button
                        onClick={() => setConfirmClear(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>Borrar Historial</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
