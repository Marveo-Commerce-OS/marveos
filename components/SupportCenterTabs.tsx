import Link from 'next/link';

export type SupportCenterTabKey = 'tickets' | 'queue' | 'sessions';

export default function SupportCenterTabs({ active }: { active: SupportCenterTabKey }) {
  const tabs: Array<{ key: SupportCenterTabKey; label: string; href: string }> = [
    { key: 'tickets', label: 'Tickets', href: '/master/tickets' },
    { key: 'queue', label: 'Support Queue', href: '/master/support' },
    { key: 'sessions', label: 'Support Sessions', href: '/master/support-sessions' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
