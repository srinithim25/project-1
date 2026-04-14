import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertCircle,
  info:    AlertCircle,
};
const COLORS = {
  success: 'border-l-teal-500 text-teal-400',
  error:   'border-l-red-500 text-red-400',
  warning: 'border-l-yellow-500 text-yellow-400',
  info:    'border-l-sky-500 text-sky-400',
};

let addToast = () => {};

export function useToast() {
  const show = (message, type = 'info', title = '') => {
    addToast({ message, type, title, id: Date.now() });
  };
  return {
    success: (msg, title) => show(msg, 'success', title),
    error:   (msg, title) => show(msg, 'error', title),
    warning: (msg, title) => show(msg, 'warning', title),
    info:    (msg, title) => show(msg, 'info', title),
  };
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  addToast = (toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 3500);
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`card border-l-2 ${COLORS[t.type]} px-4 py-3 flex items-start gap-3
                        shadow-xl shadow-black/40 pointer-events-auto
                        animate-fade-up min-w-[260px] max-w-[340px]`}
          >
            <Icon size={15} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-xs font-semibold text-ink-200 mb-0.5">{t.title}</div>}
              <div className="text-xs text-ink-400">{t.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-ink-600 hover:text-ink-400 flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
