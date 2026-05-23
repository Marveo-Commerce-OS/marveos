'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Rocket,
  LifeBuoy,
  ShieldCheck,
  PlugZap,
  LayoutTemplate,
  Users,
  CreditCard,
  ScrollText,
  Settings,
  LogOut,
} from 'lucide-react';
import { getConfig } from '@/src/config/client';

const MASTER_NAV = [
  { href: '/master', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/master/clients', label: 'Clients', icon: Building2 },
  { href: '/master/workspaces', label: 'Workspaces', icon: Briefcase },
  { href: '/master/mvp-deployments', label: 'Deployment Queue', icon: Rocket },
  { href: '/master/support', label: 'Support Queue', icon: LifeBuoy },
  { href: '/master/launch-readiness', label: 'Launch Readiness', icon: ShieldCheck },
  { href: '/master/connectors', label: 'Connectors', icon: PlugZap },
  { href: '/master/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/master/team', label: 'Team', icon: Users },
  { href: '/master/billing', label: 'Plans & Billing', icon: CreditCard },
  { href: '/master/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/master/system-settings', label: 'System Settings', icon: Settings },
];

export default function MasterSidebar({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const config = getConfig();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/master-login');
  }

  return (
    <aside className="h-screen w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        {config.clientLogo ? (
          <div className="relative mb-2 h-10 w-40">
            <Image src={config.clientLogo} alt={config.clientName} fill className="object-contain object-left" priority />
          </div>
        ) : (
          <h2 className="text-lg font-bold text-slate-900">Marveo</h2>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Control Center</p>
      </div>

      <nav className="space-y-1 p-3">
        {MASTER_NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 p-3">
        <div className="mb-2 rounded-xl bg-slate-100 px-3 py-2">
          <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
          <p className="text-xs text-slate-600 truncate">{email}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
