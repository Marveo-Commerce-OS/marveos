import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Setup - Marvéo',
  description: 'Connect your WordPress store to Marvéo',
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {children}
    </div>
  );
}
