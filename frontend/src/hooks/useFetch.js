import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../services/api.js';

/** Loads data from `fn` whenever `deps` change. Returns { data, loading, error, reload, setData }. */
export default function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const result = await fnRef.current();
      if (mine === seq.current) { setData(result); setError(''); }
    } catch (e) {
      if (mine === seq.current) setError(errMsg(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);

  return { data, loading, error, reload: run, setData };
}
