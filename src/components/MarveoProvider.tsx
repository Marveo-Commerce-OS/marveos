'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { MarveoContext } from '../lib/hooks/useMarveo';
import type { MarveoClient, MarveoSettings, MarveoContextType } from '../lib/marveo';
import { createMarveoClient, getMarveoConfig, getDefaultSettings } from '../lib/marveo';

interface MarveoProviderProps {
  children: ReactNode;
  apiUrl?: string;
  frontendUrl?: string;
}

/**
 * Marveo Provider Component
 *
 * Wraps your app with Marveo client context.
 * Can be used in the root layout or specific sections.
 *
 * @example
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <MarveoProvider>
 *           {children}
 *         </MarveoProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function MarveoProvider({
  children,
  apiUrl: customApiUrl,
  frontendUrl: customFrontendUrl,
}: MarveoProviderProps) {
  const { apiUrl: envApiUrl, frontendUrl: envFrontendUrl } = getMarveoConfig();
  const apiUrl = customApiUrl || envApiUrl || '';
  const frontendUrl = customFrontendUrl || envFrontendUrl || '';

  const [client] = useState<MarveoClient>(() => createMarveoClient(apiUrl, frontendUrl));
  const [settings, setSettings] = useState<MarveoSettings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Load settings on mount
    client
      .getSettings()
      .then((fetchedSettings: MarveoSettings) => {
        setSettings(fetchedSettings);
        setError(null);
      })
      .catch((err: Error) => {
        console.error('Marveo: Failed to load settings', err);
        setError(err);
        // Keep default settings on error
        setSettings(getDefaultSettings());
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [client]);

  const value: MarveoContextType = {
    client,
    settings,
    isLoading,
    error,
  };

  return (
    <MarveoContext.Provider value={value}>
      {children}
    </MarveoContext.Provider>
  );
}

/**
 * HOC to wrap components with Marveo provider
 */
export function withMarveo<P extends object>(
  Component: React.ComponentType<P>,
  options?: { apiUrl?: string; frontendUrl?: string }
) {
  return function WithMarveoWrapper(props: P) {
    return (
      <MarveoProvider apiUrl={options?.apiUrl} frontendUrl={options?.frontendUrl}>
        <Component {...props} />
      </MarveoProvider>
    );
  };
}

export default MarveoProvider;
