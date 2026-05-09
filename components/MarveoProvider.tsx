'use client';

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  createMarveoApiClient,
  type MarveoApiClient,
  type MarveoRuntimeBundle,
} from '@/lib/marveo-api';
import { loadMarveoRuntime } from '@/lib/marveo';

interface MarveoProviderProps {
  children: ReactNode;
  baseUrl?: string;
}

interface MarveoProviderValue {
  client: MarveoApiClient;
  runtime: MarveoRuntimeBundle | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const MarveoContext = createContext<MarveoProviderValue | null>(null);

function readBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MARVEO_API_URL ||
    process.env.NEXT_PUBLIC_WP_API_URL ||
    ''
  ).trim();
}

export function MarveoProvider({ children, baseUrl }: MarveoProviderProps) {
  const resolvedBaseUrl = baseUrl || readBaseUrl();
  const client = useMemo(() => createMarveoApiClient(resolvedBaseUrl), [resolvedBaseUrl]);

  const [runtime, setRuntime] = useState<MarveoRuntimeBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await loadMarveoRuntime(client);
      setRuntime(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Marveo runtime');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [client]);

  const value = useMemo<MarveoProviderValue>(
    () => ({
      client,
      runtime,
      isLoading,
      error,
      reload,
    }),
    [client, runtime, isLoading, error],
  );

  return <MarveoContext.Provider value={value}>{children}</MarveoContext.Provider>;
}

export function useMarveoRuntime() {
  const context = useContext(MarveoContext);
  if (!context) {
    throw new Error('useMarveoRuntime must be used within MarveoProvider');
  }

  return context;
}
