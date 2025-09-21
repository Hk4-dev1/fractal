import { useEffect, useRef } from 'react';

type IOOptions = { root?: Element | Document | null; rootMargin?: string; threshold?: number | number[] };

export function usePrefetchOnView(callback: () => void, options?: IOOptions) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let did = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !did) {
          did = true;
          callback();
          io.disconnect();
          break;
        }
      }
  }, options);
    io.observe(el);
    return () => io.disconnect();
  }, [callback, options]);

  return ref;
}
