import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Info, X, XCircle } from 'lucide-react';

// Notifications et boîtes de dialogue de l'application : remplacent alert(),
// confirm() et prompt(), bloquants et non stylables. Le rendu est assuré par un
// unique <FeedbackHost />, monté dans App.

type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface DialogRequest {
  type: 'confirm' | 'prompt' | 'info';
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  defaultValue?: string;
  inputLabel?: string;
  secret?: string;
  resolve: (value: any) => void;
}

interface State {
  toasts: Toast[];
  dialog: DialogRequest | null;
}

let state: State = { toasts: [], dialog: null };
let nextId = 1;
const listeners = new Set<() => void>();

const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const dismissToast = (id: number) => setState({ toasts: state.toasts.filter((t) => t.id !== id) });

const PREFIXES: [string, ToastKind][] = [
  ['✅', 'success'],
  ['❌', 'error'],
  ['⚠️', 'warning'],
];

const parseMessage = (raw: string): { kind: ToastKind | null; message: string } => {
  const text = raw.trim();
  for (const [prefix, kind] of PREFIXES) {
    if (text.startsWith(prefix)) return { kind, message: text.slice(prefix.length).trim() };
  }
  return { kind: null, message: text };
};

// Le type est déduit du préfixe (✅ ❌ ⚠️) à défaut d'être précisé.
export const notify = (raw: string, kind?: ToastKind) => {
  const parsed = parseMessage(raw);
  const toast: Toast = { id: nextId++, kind: kind || parsed.kind || 'info', message: parsed.message };
  setState({ toasts: [...state.toasts, toast] });
  window.setTimeout(() => dismissToast(toast.id), toast.kind === 'success' ? 4000 : 8000);
};

const openDialog = <T,>(request: Omit<DialogRequest, 'resolve'>): Promise<T> =>
  new Promise((resolve) => setState({ dialog: { ...request, resolve } }));

export const confirmDialog = (
  message: string,
  options: { title?: string; confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> => {
  const parsed = parseMessage(message);
  return openDialog<boolean>({
    type: 'confirm',
    title: options.title || 'Confirmation',
    message: parsed.message,
    confirmLabel: options.confirmLabel || 'Confirmer',
    danger: options.danger ?? parsed.kind === 'warning',
  });
};

export const promptDialog = (options: {
  title: string;
  inputLabel: string;
  defaultValue?: string;
  confirmLabel?: string;
}): Promise<string | null> => openDialog<string | null>({ type: 'prompt', ...options });

export const infoDialog = (options: { title: string; message?: string; secret?: string }): Promise<void> =>
  openDialog<void>({ type: 'info', ...options });

const TOAST_STYLES: Record<ToastKind, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-green-600' },
  error: { icon: XCircle, className: 'text-red-600' },
  warning: { icon: AlertTriangle, className: 'text-orange-600' },
  info: { icon: Info, className: 'text-blue-600' },
};

const Dialog: React.FC<{ dialog: DialogRequest }> = ({ dialog }) => {
  const [value, setValue] = useState(dialog.defaultValue || '');
  const [copied, setCopied] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const close = (result: unknown) => {
    setState({ dialog: null });
    dialog.resolve(result);
  };
  const cancelValue = dialog.type === 'prompt' ? null : dialog.type === 'confirm' ? false : undefined;

  useEffect(() => {
    if (dialog.type !== 'prompt') confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // Un mot de passe temporaire ne s'affiche qu'une fois : pas de fermeture par accident.
      if (event.key === 'Escape' && !dialog.secret) close(cancelValue);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog.type === 'prompt') {
      if (value.trim()) close(value.trim());
      return;
    }
    close(dialog.type === 'confirm' ? true : undefined);
  };

  const copySecret = async () => {
    await navigator.clipboard?.writeText(dialog.secret || '');
    setCopied(true);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && dialog.type !== 'info') close(cancelValue);
      }}
    >
      <form
        onSubmit={submit}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">{dialog.title}</h2>
        {dialog.message && (
          <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{dialog.message}</p>
        )}
        {dialog.secret && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-gray-100 px-4 py-3">
            <code data-testid="dialog-secret" className="break-all font-mono text-base font-semibold text-gray-900">
              {dialog.secret}
            </code>
            {navigator.clipboard && (
              <button
                type="button"
                onClick={copySecret}
                className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
              >
                <Copy className="h-4 w-4" /> {copied ? 'Copié' : 'Copier'}
              </button>
            )}
          </div>
        )}
        {dialog.type === 'prompt' && (
          <label className="mt-4 block text-sm font-medium text-gray-700">
            {dialog.inputLabel}
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
            />
          </label>
        )}
        <div className="mt-6 flex justify-end gap-3">
          {dialog.type !== 'info' && (
            <button
              type="button"
              onClick={() => close(cancelValue)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
            >
              Annuler
            </button>
          )}
          <button
            ref={confirmRef}
            type="submit"
            data-testid="dialog-confirm"
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {dialog.confirmLabel || (dialog.type === 'info' ? 'Fermer' : 'Valider')}
          </button>
        </div>
      </form>
    </div>
  );
};

export const FeedbackHost: React.FC = () => {
  const { toasts, dialog } = useSyncExternalStore(subscribe, () => state);

  return (
    <>
      <div
        aria-live="polite"
        className="no-print fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = TOAST_STYLES[toast.kind];
          return (
            <div key={toast.id} role="status" className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-lg">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${className}`} />
              <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm text-gray-800">{toast.message}</p>
              <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Fermer la notification"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      {dialog && <Dialog key={dialog.title} dialog={dialog} />}
    </>
  );
};
