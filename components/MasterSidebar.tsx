'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Building2,
  CreditCard,
  FileBarChart2,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Landmark,
  LifeBuoy,
  LineChart,
  LogOut,
  PlugZap,
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { getConfig } from '@/src/config/client';
import type { ControlCenterModuleKey } from '@/lib/adminStore';
import type { SidebarItem } from '@/lib/master/roleDashboard';

type Props = {
  displayName: string;
  email: string;
  allowedModules: ControlCenterModuleKey[];
  dashboardLogoUrl: string;
  brandName: string;
  navItems?: SidebarItem[];
  surfaceLabel?: string;
  roleLabel?: string;
  isSuperAdmin?: boolean;
};

type LocalChevronProps = {
  size?: number;
  className?: string;
};

function ChevronLeftIcon({ size = 16, className }: LocalChevronProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className} aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 16, className }: LocalChevronProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon({ size = 16, className }: LocalChevronProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function resolveIconForItem(item: SidebarItem) {
  const key = item.key;

  if (key === 'overview' || key === 'myDashboard') return LayoutDashboard;
  if (key === 'clients') return Building2;
  if (key === 'workspaces') return Briefcase;
  if (key === 'deploymentQueue' || key === 'deployments') return Rocket;
  if (key === 'launchReadiness') return ShieldCheck;
  if (key === 'connectors' || key === 'connectorIssues') return PlugZap;
  if (key === 'templates') return LayoutTemplate;
  if (key === 'finance' || key.includes('finance')) return Landmark;
  if (key === 'reports') return FileBarChart2;
  if (key === 'analytics') return LineChart;
  if (key === 'systemSettings') return Settings;
  if (key === 'rolePrivileges') return Users;
  if (key === 'auditLogs') return ScrollText;

  if (key === 'tickets' || key === 'technicalTickets') return Ticket;
  if (key === 'complaints' || key.includes('complaint')) return AlertTriangle;
  if (key === 'enquiries') return Inbox;
  if (key === 'definedReplies') return BookOpen;
  if (key === 'billing' || key === 'subscriptions') return CreditCard;
  if (key === 'paymentIssues') return AlertTriangle;
  if (key === 'supportCenter' || key === 'supportQueue' || key === 'supportSessions' || key === 'liveChatPanel') return LifeBuoy;

  return LayoutDashboard;
}

function isItemActive(pathname: string, item: SidebarItem) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const target = item.href.split('#')[0]?.replace(/\/+$/, '') || '/';

  if (item.exact) return normalized === target;
  if (target === '/master') return normalized === '/master';
  return normalized === target || normalized.startsWith(`${target}/`);
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function normalizeItemHref(item: SidebarItem): string {
  return item.href.split('#')[0]?.replace(/\/+$/, '') || '/';
}

function filterByAllowedModules(items: SidebarItem[], allowedModuleSet: Set<ControlCenterModuleKey>): SidebarItem[] {
  return items
    .filter((item) => {
      if (!item.moduleKey) return true;
      return allowedModuleSet.has(item.moduleKey);
    })
    .map((item) => {
      if (!item.children) return item;
      const children = filterByAllowedModules(item.children, allowedModuleSet);
      return { ...item, children };
    })
    .filter((item) => (item.children ? item.children.length > 0 : true));
}

export default function MasterSidebar({
  displayName,
  email,
  allowedModules,
  dashboardLogoUrl,
  brandName,
  navItems,
  surfaceLabel,
  roleLabel,
  isSuperAdmin,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const config = getConfig();

  const [profile, setProfile] = useState<{ displayName: string; email: string; avatarUrl?: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const collapsedPreferenceLoadedRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  const allowedModuleSet = useMemo(() => new Set(allowedModules), [allowedModules]);

  const resolvedNavItems = useMemo(() => {
    const items = navItems ?? [];
    return filterByAllowedModules(items, allowedModuleSet);
  }, [allowedModuleSet, navItems]);

  const autoOpenGroups = useMemo<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const item of resolvedNavItems) {
      if (!item.children?.length) continue;
      const active = item.children.some((child) => isItemActive(pathname, child)) || isItemActive(pathname, item);
      if (active) next[item.key] = true;
    }
    return next;
  }, [pathname, resolvedNavItems]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCollapsed = window.localStorage.getItem('marveo.master.sidebar.collapsed') === '1';
    collapsedPreferenceLoadedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(storedCollapsed);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!collapsedPreferenceLoadedRef.current) return;
    window.localStorage.setItem('marveo.master.sidebar.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const resolvedName = profile?.displayName ?? displayName;
  const resolvedEmail = profile?.email ?? email;
  const resolvedAvatarUrl = profile?.avatarUrl;
  const resolvedLogoUrl = dashboardLogoUrl || config.clientLogo;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/master-login');
  }

  return (
    <aside className={`relative z-40 h-screen shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-hidden overflow-x-visible transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-72'}`}>
      <div className={`border-b border-slate-200 ${collapsed ? 'px-2 py-3' : 'px-5 py-4'}`}>
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-between'} items-start gap-2`}>
          <div className={collapsed ? 'hidden' : 'block'}>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {surfaceLabel || 'Control Center'}
            </p>
            {isSuperAdmin ? (
              <span className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Super Admin
              </span>
            ) : roleLabel ? (
              <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {roleLabel}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-visible p-3">
        {resolvedNavItems.map((item) => {
          const Icon = resolveIconForItem(item);
          const active = isItemActive(pathname, item);
          const hasChildren = Boolean(item.children?.length);

          if (hasChildren && !collapsed) {
            const open = Boolean(openGroups[item.key] ?? autoOpenGroups[item.key]);
            const parentOnlyActive = normalizePath(pathname) === normalizeItemHref(item);
            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [item.key]: !open }))}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    parentOnlyActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  <ChevronDownIcon size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>

                {open ? (
                  <div className="mt-1 ml-7 space-y-1 border-l border-slate-200 pl-3">
                    {item.children?.map((child) => {
                      const childActive = isItemActive(pathname, child);
                      return (
                        <Link
                          key={child.key}
                          href={child.href}
                          className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            childActive ? 'bg-slate-200 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          if (hasChildren && collapsed) {
            const childActive = item.children?.some((child) => isItemActive(pathname, child)) ?? false;
            return (
              <div key={item.key} className="relative">
                <button
                  type="button"
                  className={`flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    childActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    setCollapsed(false);
                    setOpenGroups((prev) => ({ ...prev, [item.key]: true }));
                  }}
                >
                  <Icon size={16} />
                </button>
              </div>
            );
          }

          return (
            <div key={item.key} className="relative">
              <Link
                href={item.href}
                title={item.label}
                className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center' : 'gap-3'
                } ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                {collapsed ? null : item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className={`mb-2 rounded-xl bg-slate-100 ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 relative">
              {resolvedAvatarUrl ? (
                <Image src={resolvedAvatarUrl} alt={resolvedName || 'User avatar'} fill className="object-cover" sizes="36px" />
              ) : (
                <Image src="/images/avatar-placeholder.svg" alt="User avatar placeholder" fill className="object-cover" sizes="36px" />
              )}
            </div>
            {collapsed ? null : (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">{resolvedName}</p>
                <p className="text-xs text-slate-600 truncate">{resolvedEmail}</p>
                {isSuperAdmin ? (
                  <p className="mt-1 text-[11px] font-semibold text-indigo-700">Role: Super Admin</p>
                ) : roleLabel ? (
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">Role: {roleLabel}</p>
                ) : null}
                <Link href="/master/profile" className="mt-1 inline-block text-[11px] font-medium text-slate-600 underline">Manage profile</Link>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className={`flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 ${collapsed ? 'justify-center' : 'gap-2'}`}
        >
          <LogOut size={16} />
          {collapsed ? null : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
