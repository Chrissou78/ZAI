import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { apiService } from '../services/api';

/**
 * How many paid orders are still waiting to be processed.
 *
 * Three places want this number — the sidebar's Store & Content badge, the
 * mobile menu button and the ORDERS tab in the admin store — and they must
 * never disagree, so they share one hook rather than each polling on their
 * own schedule. Returns 0 for non-admins, which reads naturally as "no dot".
 */
export function usePendingOrders(): number {
  const { user } = useAppContext();
  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdminUser) { setCount(0); return; }
    let alive = true;
    const check = async () => {
      try {
        const res = await apiService.get('/store/admin/orders/pending-count');
        if (alive && res.data?.success) {
          setCount((res.data as any).count ?? (res.data as any).data?.count ?? 0);
        }
      } catch {
        // A failed count is not worth surfacing — the indicator simply stays
        // as it was rather than flickering off on one bad request.
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [isAdminUser]);

  return count;
}
