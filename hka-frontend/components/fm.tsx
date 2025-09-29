// Lightweight dynamic loader for framer-motion to keep it out of the initial bundle.
// Exports mutable bindings so consumers get upgraded seamlessly once the real lib loads.
// During the first paint we render plain <div> wrappers (no animations) – then hydrate animations lazily.
// This trims initial bundle ~30-40 kB gzip (framer-motion) until interaction/idle.

import React, { JSX } from 'react';
/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Mutable live bindings; start as no-op fallbacks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let motion: any = new Proxy({}, {
  get: (_t, key) => {
    // Return a passthrough component for any motion.* element
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => {
      const Comp = (key === 'div' ? 'div' : key === 'span' ? 'span' : 'div') as keyof JSX.IntrinsicElements;
      // Strip animation-only props to avoid React warnings on DOM elements
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        whileHover: _whileHover,
        whileTap: _whileTap,
        transition: _transition,
        variants: _variants,
        layout: _layout,
        layoutId: _layoutId,
        drag: _drag,
        dragConstraints: _dragConstraints,
        dragElastic: _dragElastic,
        dragMomentum: _dragMomentum,
        dragTransition: _dragTransition,
        onDragStart: _onDragStart,
        onDrag: _onDrag,
        onDragEnd: _onDragEnd,
        onPan: _onPan,
        onPanStart: _onPanStart,
        onPanEnd: _onPanEnd,
        onTap: _onTap,
        onTapStart: _onTapStart,
        onTapCancel: _onTapCancel,
        onHoverStart: _onHoverStart,
        onHoverEnd: _onHoverEnd,
        whileInView: _whileInView,
        viewport: _viewport,
        ...rest
      } = props || {};
      return <Comp {...rest} />;
    };
  }
});

type AnimatePresenceType = React.ComponentType<{ children?: React.ReactNode }>
export let AnimatePresence: AnimatePresenceType = (props) => <>{props.children}</>;

let loading = false;
let loaded = false;

export function loadFramerMotion(immediate = false) {
  if (loaded || loading) return;
  loading = true;
  const doImport = () => import('framer-motion')
    .then(mod => {
      motion = mod.motion;
      AnimatePresence = mod.AnimatePresence;
      loaded = true;
    })
    .catch(() => { /* swallow – keep graceful fallbacks */ });
  if (immediate) {
    doImport();
  } else if (typeof window !== 'undefined') {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 60));
    idle(() => doImport());
  } else {
    doImport();
  }
}

// Hook for components that want to know when animations are available
export function useFramerReady() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!loaded) {
      loadFramerMotion();
      const t = setInterval(() => {
        if (loaded) { clearInterval(t); force(); }
      }, 100);
      return () => clearInterval(t);
    }
  }, []);
  return loaded;
}
