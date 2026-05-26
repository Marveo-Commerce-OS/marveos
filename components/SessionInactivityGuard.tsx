'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type SessionInactivityGuardProps = {
  enabled: boolean;
  idleTimeoutMinutes: number;
  idleWarningMinutes: number;
  loginRedirectPath: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function SessionInactivityGuard({
  enabled,
  idleTimeoutMinutes,
  idleWarningMinutes,
  loginRedirectPath,
}: SessionInactivityGuardProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const warningStartedAtRef = useRef<number | null>(null);

  const safeTimeoutMinutes = useMemo(() => clamp(Math.floor(idleTimeoutMinutes || 30), 5, 240), [idleTimeoutMinutes]);
  const safeWarningMinutes = useMemo(() => clamp(Math.floor(idleWarningMinutes || 2), 1, 30), [idleWarningMinutes]);

  const timeoutMs = safeTimeoutMinutes * 60 * 1000;
  const warningLeadMs = Math.min(safeWarningMinutes * 60 * 1000, timeoutMs - 1000);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const forceLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign(loginRedirectPath);
    }
  }, [clearAllTimers, loginRedirectPath]);

  const scheduleCountdown = useCallback(() => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    warningStartedAtRef.current = Date.now();
    setSecondsRemaining(Math.ceil(warningLeadMs / 1000));

    countdownRef.current = window.setInterval(() => {
      const startedAt = warningStartedAtRef.current;
      if (!startedAt) return;
      const elapsedMs = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((warningLeadMs - elapsedMs) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        if (countdownRef.current !== null) {
          window.clearInterval(countdownRef.current);
        }
        countdownRef.current = null;
      }
    }, 1000);
  }, [warningLeadMs]);

  const resetInactivity = useCallback(() => {
    if (!enabled) return;

    clearAllTimers();
    setShowWarning(false);

    warningTimerRef.current = window.setTimeout(() => {
      setShowWarning(true);
      scheduleCountdown();
    }, timeoutMs - warningLeadMs);

    logoutTimerRef.current = window.setTimeout(() => {
      void forceLogout();
    }, timeoutMs);
  }, [enabled, clearAllTimers, forceLogout, scheduleCountdown, timeoutMs, warningLeadMs]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    const onActivity = () => {
      resetInactivity();
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    resetInactivity();

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      clearAllTimers();
    };
  }, [enabled, resetInactivity, clearAllTimers]);

  if (!enabled || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Session timeout warning</h2>
        <p className="mt-2 text-sm text-slate-700">
          No activity detected. You will be signed out in <span className="font-semibold">{secondsRemaining}s</span>.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Interact with the page or click Continue session to stay signed in.
        </p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => {
              void forceLogout();
            }}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Sign out now
          </button>
          <button
            onClick={resetInactivity}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Continue session
          </button>
        </div>
      </div>
    </div>
  );
}
