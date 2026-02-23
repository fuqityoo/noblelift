import { useEffect, useState } from 'react';
import { getJSON } from '../lib/api';

export function useIsSuperAdmin(): boolean {
  const [value, setValue] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await getJSON<{ userId: number }>('/profiles/me');
        const user = await getJSON<{ role?: { code?: string } }>(`/users/${me.userId}`);
        if (mounted) setValue(String(user?.role?.code ?? '').toLowerCase() === 'super_admin');
      } catch {
        if (mounted) setValue(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return value;
}
