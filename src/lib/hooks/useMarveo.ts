'use client';

/**
 * @deprecated Transitional runtime hook layer.
 * Pending migration verification, this file remains for compatibility only.
 * New runtime/provider work should use root-level runtime provider/hooks path.
 */

import { useContext, useEffect, useState, useCallback } from 'react';
import { createContext } from 'react';
import type { MarveoClient, MarveoSettings, MarveoContent, MarveoContextType } from '../marveo';

/**
 * Marveo React Context
 */
export const MarveoContext = createContext<MarveoContextType | undefined>(undefined);

/**
 * Hook to use Marveo client and settings
 */
export function useMarveo(): MarveoContextType {
  const context = useContext(MarveoContext);
  if (!context) {
    throw new Error('useMarveo must be used within MarveoProvider');
  }
  return context;
}

/**
 * Hook to fetch settings
 */
export function useMarveoSettings() {
  const { client } = useMarveo();
  const [settings, setSettings] = useState<MarveoSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client
      .getSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client]);

  return { settings, isLoading, error };
}

/**
 * Hook to fetch content
 */
export function useMarveoContent() {
  const { client } = useMarveo();
  const [content, setContent] = useState<MarveoContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client
      .getContent()
      .then(setContent)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [client]);

  return { content, isLoading, error };
}

/**
 * Hook to fetch page by slug
 */
export function useMarveoPage(slug: string) {
  const { client } = useMarveo();
  const [page, setPage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) return;

    client
      .getPageBySlug(slug)
      .then(setPage)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [slug, client]);

  return { page, isLoading, error };
}

/**
 * Hook to fetch post by slug
 */
export function useMarveoPost(slug: string) {
  const { client } = useMarveo();
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) return;

    client
      .getPostBySlug(slug)
      .then(setPost)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [slug, client]);

  return { post, isLoading, error };
}

/**
 * Hook to fetch product
 */
export function useMarveoProduct(id: string) {
  const { client } = useMarveo();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    client
      .getProduct(id)
      .then(setProduct)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [id, client]);

  return { product, isLoading, error };
}

/**
 * Hook to fetch menu
 */
export function useMarveoMenu(name: string) {
  const { client } = useMarveo();
  const [menu, setMenu] = useState<Array<{ label: string; url: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!name) return;

    client
      .getMenu(name)
      .then(setMenu)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [name, client]);

  return { menu, isLoading, error };
}

/**
 * Hook to fetch and cache brand colors
 */
export function useMarveoTheme() {
  const { settings } = useMarveoSettings();

  return {
    primaryColor: settings?.brand_settings?.primary_color || '#14B8A6',
    secondaryColor: settings?.brand_settings?.secondary_color || '#A3E635',
    typography: settings?.brand_settings?.typography || 'Inter',
  };
}

/**
 * Hook to fetch business contact info
 */
export function useMarveoContact() {
  const { settings } = useMarveoSettings();

  return {
    email: settings?.business_profile?.contact_email || '',
    phone: settings?.business_profile?.contact_phone || '',
    whatsapp: settings?.business_profile?.whatsapp_phone || '',
    address: settings?.business_profile?.business_address || '',
  };
}

/**
 * Hook to check if a module is enabled
 */
export function useMarveoModule(moduleName: string) {
  const { client } = useMarveo();
  const [enabled, setEnabled] = useState(false);

  const checkModule = useCallback(async () => {
    const settings = await client.getSettings();
    // This would check settings.module_settings.active_modules
    // For now, assuming all modules enabled by default
    setEnabled(true);
  }, [client]);

  useEffect(() => {
    checkModule();
  }, [checkModule]);

  return { enabled };
}
