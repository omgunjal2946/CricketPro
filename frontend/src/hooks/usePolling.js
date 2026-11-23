import { useEffect, useRef } from 'react';

/** Calls `fn` every `ms` milliseconds while the tab is visible and `enabled` is true. */
export default function usePolling(fn, ms, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => { if (!document.hidden) ref.current(); };
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [ms, enabled]);
}
