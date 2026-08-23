import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useUrbanGuard } from '../context/UrbanGuardContext';

export default function Toast() {
  const { toastMessage } = useUrbanGuard();

  if (!toastMessage) return null;

  const { message, type } = toastMessage;

  const iconMap = {
    info: <Info className="w-5 h-5 text-blue-400" />,
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />
  };

  const bgMap = {
    info: "bg-slate-900/90 border-blue-500/30 text-slate-100",
    success: "bg-slate-900/90 border-emerald-500/30 text-slate-100",
    warning: "bg-slate-900/90 border-amber-500/30 text-slate-100",
    error: "bg-slate-900/90 border-red-500/30 text-slate-100"
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl glass-panel max-w-sm pointer-events-auto ${bgMap[type] || bgMap.info}`}
        >
          <div>{iconMap[type] || iconMap.info}</div>
          <p className="text-sm font-medium leading-relaxed">{message}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
