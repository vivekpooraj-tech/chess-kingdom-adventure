"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Polled<T> =
  | { status: "loading"; data: null; stale: false; retry: () => void }
  | { status: "error"; data: T | null; stale: boolean; retry: () => void }
  | { status: "ready"; data: T; stale: boolean; retry: () => void };

/** A refetch that goes quiet when the tab is hidden, resumes on return / reconnect, and aborts on unmount. `intervalMs = 0` fetches once. */
export function usePolled<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
  key = "",
): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setData(null);
    setFailed(false);
    setStale(false);
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctl: AbortController | null = null;
    let inflight = false;

    const run = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(run, 1000);
        return;
      }
      if (inflight) return;
      inflight = true;
      ctl = new AbortController();
      const timeout = setTimeout(() => ctl?.abort(), 12000);
      try {
        const next = await loadRef.current(ctl.signal);
        if (cancelled) return;
        setData(next);
        setFailed(false);
        setStale(false);
      } catch {
        if (cancelled) return;
        setFailed(true);
        setStale(true);
      } finally {
        clearTimeout(timeout);
        inflight = false;
      }
      if (!cancelled && intervalMs > 0) timer = setTimeout(run, intervalMs);
    };

    const wake = () => {
      if (timer) clearTimeout(timer);
      run();
    };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      ctl?.abort();
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [intervalMs, enabled, key, tick]);

  const retry = useCallback(() => {
    setFailed(false);
    setData(null);
    setTick((n) => n + 1);
  }, []);

  if (data !== null) return failed ? { status: "error", data, stale, retry } : { status: "ready", data, stale, retry };
  if (failed) return { status: "error", data: null, stale: false, retry };
  return { status: "loading", data: null, stale: false, retry };
}
