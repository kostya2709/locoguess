import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsMessage } from '../types/game';

interface UseWebSocketOptions {
  joinCode: string;
  sessionId: string;
  onMessage: (msg: WsMessage) => void;
}

/**
 * Manages a WebSocket connection to the game server.
 * Only connects when joinCode and sessionId are non-empty and valid.
 * Reconnects automatically on disconnect with a delay.
 */
export function useWebSocket({ joinCode, sessionId, onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const shouldReconnectRef = useRef(true);

  const canConnect = joinCode.length > 0 && sessionId.length > 0 && sessionId !== 'pending';

  const connect = useCallback(() => {
    if (!canConnect) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/${joinCode}?session_id=${sessionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (shouldReconnectRef.current && canConnect) {
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [joinCode, sessionId, canConnect]);

  useEffect(() => {
    if (!canConnect) return;

    shouldReconnectRef.current = true;
    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      shouldReconnectRef.current = false;
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, [connect, canConnect]);

  return { connected };
}
