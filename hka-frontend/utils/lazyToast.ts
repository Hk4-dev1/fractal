// Lazy toast wrapper to defer loading 'sonner' until first use
type ToastFn = (...args: unknown[]) => unknown;
type ToastMethod = 'success' | 'error' | 'info' | 'message' | 'loading' | 'dismiss';

interface ToastLike {
  (...args: unknown[]): unknown;
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  message: ToastFn;
  loading: ToastFn;
  dismiss: ToastFn;
}

async function loadToast(): Promise<ToastLike> {
  const mod = await import('sonner');
  return (mod as { toast: ToastLike }).toast;
}

const invoke = async (method: ToastMethod | null, args: unknown[]) => {
  const t = await loadToast();
  const fn: ToastFn = method ? (t[method] as ToastFn) : (t as ToastFn);
  return fn(...args);
};

export const toast = Object.assign((...args: unknown[]) => invoke(null, args), {
  success: (...args: unknown[]) => invoke('success', args),
  error: (...args: unknown[]) => invoke('error', args),
  info: (...args: unknown[]) => invoke('info', args),
  message: (...args: unknown[]) => invoke('message', args),
  loading: (...args: unknown[]) => invoke('loading', args),
  dismiss: (...args: unknown[]) => invoke('dismiss', args),
});

export default toast;
