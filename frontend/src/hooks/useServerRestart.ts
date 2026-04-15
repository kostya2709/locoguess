import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Polls the server boot ID every 5 seconds.
 * If it changes (server restarted), redirects to the home page.
 */
export function useServerRestart() {
  const navigate = useNavigate();
  const location = useLocation();
  const bootIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkBootId() {
      try {
        const res = await fetch('/api/v1/boot-id');
        if (!res.ok) return;
        const { boot_id } = await res.json();

        if (bootIdRef.current === null) {
          // First fetch — just store it
          bootIdRef.current = boot_id;
        } else if (bootIdRef.current !== boot_id) {
          // Server restarted — redirect to home
          bootIdRef.current = boot_id;
          if (location.pathname !== '/') {
            navigate('/');
          }
        }
      } catch {
        // Server is down — ignore, will retry
      }
    }

    checkBootId();
    const interval = setInterval(checkBootId, 5000);
    return () => clearInterval(interval);
  }, [navigate, location.pathname]);
}
