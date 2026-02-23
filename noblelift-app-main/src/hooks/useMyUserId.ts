import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Возвращает userId из /profiles/me или null пока не загружено */
export function useMyUserId(): number | null {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api('/profiles/me');
        if (!r.ok) return;
        const data = await r.json();
        const first = Array.isArray(data) ? data[0] : data?.items?.[0] ?? data;
        const idRaw = first?.id ?? first?.userId ?? first?.userID;
        const n = Number(idRaw);
        if (mounted && !Number.isNaN(n)) setUserId(n);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  return userId;
}
