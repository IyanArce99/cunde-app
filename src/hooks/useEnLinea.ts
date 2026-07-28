import { useEffect, useState } from 'react';

export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  useEffect(() => {
    const marcarOnline = () => setEnLinea(true);
    const marcarOffline = () => setEnLinea(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  return enLinea;
}
