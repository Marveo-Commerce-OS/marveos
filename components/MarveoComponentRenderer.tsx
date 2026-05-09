import type { MarveoComponentInstance } from '@/lib/marveo-api';

interface MarveoComponentRendererProps {
  component: MarveoComponentInstance;
}

function readString(props: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const value = props?.[key];
  return typeof value === 'string' ? value : fallback;
}

export function MarveoComponentRenderer({ component }: MarveoComponentRendererProps) {
  const props = component.props;

  switch (component.key) {
    case 'hero':
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-900">{readString(props, 'title', 'Welcome')}</h1>
          <p className="mt-3 text-slate-600">{readString(props, 'subtitle', '')}</p>
          {readString(props, 'cta') ? (
            <button className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
              {readString(props, 'cta')}
            </button>
          ) : null}
        </section>
      );

    case 'cta':
      return (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold text-emerald-900">{readString(props, 'title', 'Call to action')}</h2>
          <p className="mt-2 text-emerald-800">{readString(props, 'description', '')}</p>
        </section>
      );

    case 'faq':
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
          <p className="mt-2 text-slate-600">Manage FAQ items from Marveo Cloud settings.</p>
        </section>
      );

    case 'blog_preview':
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Blog Preview</h2>
          <p className="mt-2 text-slate-600">Posts are delivered by the connector runtime.</p>
        </section>
      );

    case 'product_grid':
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-900">Product Grid</h2>
          <p className="mt-2 text-slate-600">Products are resolved dynamically from WooCommerce.</p>
        </section>
      );

    default:
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Unknown component key: {component.key}
        </section>
      );
  }
}

export default MarveoComponentRenderer;
