import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import { getConfig } from '@/src/config/client';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'Marvéo',
  description: 'Marvéo — Modern commerce operations built for businesses using WordPress, WooCommerce, and headless commerce stacks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} font-['Space_Grotesk'] antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  );
}
