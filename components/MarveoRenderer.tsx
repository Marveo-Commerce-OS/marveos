'use client';

import { useMemo } from 'react';
import { buildComponentRegistry, getPageBySlug } from '@/lib/marveo';
import type { MarveoPage } from '@/lib/marveo-api';
import { useMarveoRuntime } from '@/components/MarveoProvider';
import { MarveoComponentRenderer } from '@/components/MarveoComponentRenderer';

interface MarveoRendererProps {
  slug?: string;
  page?: MarveoPage;
}

export function MarveoRenderer({ slug = '', page }: MarveoRendererProps) {
  const { runtime, isLoading, error } = useMarveoRuntime();

  const resolvedPage = useMemo(() => {
    if (!runtime) {
      return null;
    }

    if (page) {
      return page;
    }

    return getPageBySlug(runtime.pages, slug);
  }, [runtime, page, slug]);

  const registry = useMemo(
    () => (runtime ? buildComponentRegistry(runtime.components) : {}),
    [runtime],
  );

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading Marveo runtime...</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Runtime error: {error}</div>;
  }

  if (!runtime || !resolvedPage) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">Page configuration not found.</div>;
  }

  const components = Array.isArray(resolvedPage.components) ? resolvedPage.components : [];
  const fallbackComponents = components.length > 0 ? components : [{ key: 'hero', props: { title: resolvedPage.title } }];

  return (
    <main className="space-y-6">
      {fallbackComponents.map((component, index) => {
        const registryEntry = registry[component.key];
        const renderedComponent = registryEntry ? component : { key: component.key, props: component.props };

        return (
          <MarveoComponentRenderer
            key={`${resolvedPage.slug}-${component.key}-${index}`}
            component={renderedComponent}
          />
        );
      })}
    </main>
  );
}

export default MarveoRenderer;
