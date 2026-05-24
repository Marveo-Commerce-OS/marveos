import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { readAdminStore } from '@/lib/adminStore';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', weight: ['400', '500', '600', '700', '800'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export async function generateMetadata(): Promise<Metadata> {
  const store = await readAdminStore();
  const brandName = store.platformSettings.branding.brandName || 'Marvéo';
  const faviconUrl = store.platformSettings.branding.faviconUrl || '/icon';

  return {
    title: brandName,
    description: 'Marvéo — Modern commerce operations built for businesses using WordPress, WooCommerce, and headless commerce stacks.',
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${manrope.variable} font-[family-name:var(--font-manrope)] antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
