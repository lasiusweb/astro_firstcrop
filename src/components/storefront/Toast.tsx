import { useEffect, useState, useCallback } from 'react';

export interface ToastPayload {
  message: string;
  variant?: 'success' | 'error';
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastPayload, 'duration'>> {
  id: number;
  leaving: boolean;
}

const TOAST_EVENT = 'firstcrop:toast';

export function showToast(payload: ToastPayload) {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

let nextId = 1;

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { message, variant = 'success', duration = 5000 } = (e as CustomEvent<ToastPayload>).detail;
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-2), { id, message, variant, leaving: false }]);
      setTimeout(() => dismiss(id), duration);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [dismiss]);

  return (
    <div className="toast-region" role="region" aria-label="Notifications">
      <div aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.variant}${toast.leaving ? ' toast-leaving' : ''}`}
          >
            {toast.variant === 'success' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <p className="toast-message">{toast.message}</p>
            <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <style>{`
        .toast-region {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 300;
          pointer-events: none;
        }
        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 260px;
          max-width: calc(100vw - 32px);
          margin-bottom: 8px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--c-white, #fff);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
          border: 1px solid var(--c-gray-100, #f1f5f9);
          pointer-events: auto;
          animation: toast-in 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .toast-leaving {
          opacity: 0;
          transform: translateY(-8px);
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }
        .toast-success { color: var(--c-green-600, #16a34a); }
        .toast-error { color: var(--c-error, #ef4444); }
        .toast-message {
          flex: 1;
          font-size: 0.875rem;
          color: var(--c-gray-900, #111827);
          line-height: 1.4;
        }
        .toast-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          color: var(--c-gray-400, #9ca3af);
          transition: color 150ms ease-out, background 150ms ease-out;
        }
        .toast-close:hover {
          color: var(--c-gray-700, #374151);
          background: var(--c-gray-50, #f9fafb);
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .toast { animation: none; }
          .toast-leaving { transition: none; }
        }
      `}</style>
    </div>
  );
}
