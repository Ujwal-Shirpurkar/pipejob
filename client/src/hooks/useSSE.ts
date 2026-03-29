import { useEffect, useRef, useState } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function useSSE(path: string) {
  const [events, setEvents] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource(`${BASE_URL}${path}`);
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e: MessageEvent) => {
        setEvents((prev) => [e.data, ...prev].slice(0, 100));
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
    };
  }, [path]);

  return { events, connected };
}
