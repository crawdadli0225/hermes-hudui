import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
};

export interface VastServerStatus {
  gpu: { vram_used: number; vram_total: number; temp: number; utilization: number };
  system: { cpu_load: number; mem_used: number; disk_free: number };
  service: { occupied_slots: number; total_slots: number; active_connections: number; is_healthy: boolean };
}

export interface TokenMetrics {
  cumulative: { input: number; output: number };
  realtime: { tps: number; latency_ms: number };
  recent_requests: Array<{ id: string; in: number; out: number; duration: number }>;
}

export function useVastApi() {
  // Poll status every 5s
  const { data: status, error: statusError, mutate: mutateStatus } = useSWR<VastServerStatus>(
    '/api/vast/status',
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: false }
  );

  // Poll tokens every 10s (or similar)
  const { data: tokens, error: tokensError, mutate: mutateTokens } = useSWR<TokenMetrics>(
    '/api/vast/tokens',
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: false }
  );

  // SSE for recovery events
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/vast/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const timestamp = new Date().toLocaleTimeString();
        const logLine = `[${timestamp}] Step ${data.step || '?'}: ${data.msg}`;
        setLogs((prev) => [...prev, logLine].slice(-100)); // Keep last 100 lines
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[VastMonitor] SSE connection lost. Retrying...', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const triggerRecovery = async (action: 'full' | 'step', step?: string) => {
    const endpoint = action === 'full' ? '/api/vast/recovery/full' : '/api/vast/recovery/step';
    const body = action === 'full' ? { session_id: 'hud-session' } : { action: step };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Recovery failed: ${res.statusText}`);
      
      // Trigger immediate refresh of status
      mutateStatus();
    } catch (e) {
      console.error('Recovery trigger error:', e);
      throw e;
    }
  };

  return {
    status,
    tokens,
    logs,
    statusError,
    tokensError,
    triggerRecovery,
    refresh: () => {
      mutateStatus();
      mutateTokens();
    },
  };
}
