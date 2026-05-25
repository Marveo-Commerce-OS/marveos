'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
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
  FileBarChart2,
  LineChart,
  ScrollText,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { getConfig } from '@/src/config/client';
import type { ControlCenterModuleKey } from '@/lib/adminStore';

const MASTER_NAV = [
  { href: '/master', label: 'Overview', icon: LayoutDashboard, exact: true, moduleKey: 'overview' as const },
  { href: '/master/clients', label: 'Clients', icon: Building2, moduleKey: 'clients' as const },
  { href: '/master/workspaces', label: 'Workspaces', icon: Briefcase, moduleKey: 'workspaces' as const },
  { href: '/master/mvp-deployments', label: 'Deployment Queue', icon: Rocket, moduleKey: 'deploymentQueue' as const },
  { href: '/master/support', label: 'Support Queue', icon: LifeBuoy, moduleKey: 'supportQueue' as const },
  { href: '/master/launch-readiness', label: 'Launch Readiness', icon: ShieldCheck, moduleKey: 'launchReadiness' as const },
  { href: '/master/connectors', label: 'Connectors', icon: PlugZap, moduleKey: 'connectors' as const },
  { href: '/master/templates', label: 'Templates', icon: LayoutTemplate, moduleKey: 'templates' as const },
  { href: '/master/team', label: 'Team', icon: Users, moduleKey: 'team' as const },
  { href: '/master/billing', label: 'Plans & Billing', icon: CreditCard, moduleKey: 'plansBilling' as const },
  { href: '/master/reports', label: 'Reports', icon: FileBarChart2, moduleKey: 'reports' as const },
  { href: '/master/analytics', label: 'Analytics', icon: LineChart, moduleKey: 'analytics' as const },
  { href: '/master/audit-logs', label: 'Audit Logs', icon: ScrollText, moduleKey: 'auditLogs' as const },
  { href: '/master/system-settings', label: 'System Settings', icon: Settings, moduleKey: 'systemSettings' as const },
];

export default function MasterSidebar({
  displayName,
  email,
  allowedModules,
  dashboardLogoUrl,
  brandName,
}: {
  displayName: string;
  email: string;
  allowedModules: ControlCenterModuleKey[];
  dashboardLogoUrl: string;
  brandName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const config = getConfig();
  const [profile, setProfile] = useState<{ displayName: string; email: string; avatarUrl?: string } | null>(null);
  const [billingMenuOpen, setBillingMenuOpen] = useState(pathname.startsWith('/master/billing'));
  const allowedModuleSet = new Set(allowedModules);
  const visibleNav = MASTER_NAV.filter((item) => allowedModuleSet.has(item.moduleKey));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          user?: { displayName?: string; email?: string; avatarUrl?: string; id?: string };
        } | null;
        if (!res.ok || !body?.ok || !body.user) return;
        if (cancelled) return;
        setProfile({
          displayName: body.user.displayName || displayName,
          email: body.user.email || email,
          avatarUrl: body.user.avatarUrl || undefined,
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayName, email]);

  const resolvedName = profile?.displayName ?? displayName;
  const resolvedEmail = profile?.email ?? email;
  const resolvedAvatarUrl = profile?.avatarUrl;
  const resolvedLogoUrl = dashboardLogoUrl || config.clientLogo;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/master-login');
  }

  return (
    <aside className="h-screen w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        {resolvedLogoUrl ? (
          <div className="relative mb-2 h-10 w-40">
            <Image
              src={resolvedLogoUrl}
              alt={brandName || config.clientName}
              fill
              className="object-contain object-left"
              priority
              unoptimized
            />
          </div>
        ) : (
          <h2 className="text-lg font-bold text-slate-900">{brandName || 'Marveo'}</h2>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Control Center</p>
      </div>

      <nav className="space-y-1 p-3">
        {visibleNav.map(({ href, label, icon: Icon, exact, moduleKey }) => {
          if (moduleKey === 'plansBilling') {
            const active = pathname.startsWith('/master/billing');
            return (
              <div key={href}>
                <button
                  type="button"
                  onClick={() => setBillingMenuOpen((current) => !current)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} />
                    {label}
                  </span>
                  <ChevronDown size={14} className={billingMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>

                {billingMenuOpen ? (
                  <div className="mt-1 ml-7 space-y-1 border-l border-slate-200 pl-3">
                    <Link
                      href="/master/billing#plans"
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Plans
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">All plans and setup</span>
                    </Link>
                    <Link
                      href="/master/billing#subscriptions"
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Billing
                      <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Commercial subscriptions only</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          }

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
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 relative">
              {resolvedAvatarUrl ? (
                <Image src={resolvedAvatarUrl} alt={resolvedName || 'User avatar'} fill className="object-cover" sizes="36px" />
              ) : (
                <Image src="/images/avatar-placeholder.svg" alt="User avatar placeholder" fill className="object-cover" sizes="36px" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{resolvedName}</p>
              <p className="text-xs text-slate-600 truncate">{resolvedEmail}</p>
              <Link href="/master/profile" className="mt-1 inline-block text-[11px] font-medium text-slate-600 underline">Manage profile</Link>
            </div>
          </div>
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
