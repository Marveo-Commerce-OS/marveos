'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, ShoppingCart, Users, Settings, FileText, LogOut, ExternalLink, Menu, X, MapPin, BarChart3, Shield } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true, moduleKey: 'dashboard' },
  { href: '/dashboard/products', label: 'Products', icon: ShoppingBag, moduleKey: 'products' },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart, moduleKey: 'orders' },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, moduleKey: 'reports' },
  { href: '/dashboard/customers', label: 'Customers', icon: Users, moduleKey: 'customers' },
  { href: '/dashboard/blog', label: 'Blog Posts', icon: FileText, moduleKey: 'blog' },
  { href: '/dashboard/stores', label: 'Stores', icon: MapPin, moduleKey: 'stores' },
  { href: '/dashboard/settings', label: 'Site Settings', icon: Settings, moduleKey: 'siteSettings' },
];

export default function Sidebar({
  displayName,
  email,
  canManageAccess,
  allowedModules,
}: {
  displayName: string;
  email: string;
  canManageAccess: boolean;
  allowedModules?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const allowed = new Set(allowedModules ?? []);
  const baseItems = NAV.filter((item) => allowed.size === 0 || allowed.has(item.moduleKey));
  const navItems = canManageAccess && (allowed.size === 0 || allowed.has('adminSettings'))
    ? [...baseItems, { href: '/dashboard/admin-settings', label: 'Admin Settings', icon: Shield, moduleKey: 'adminSettings' }]
    : baseItems;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-40 flex items-center justify-between px-4">
        <div className="relative w-28 h-8">
          <Image src="https://central.prag.global/wp-content/uploads/2026/04/Prag-Logo.png" alt="PRAG" fill className="object-contain" priority />
        </div>
        <button onClick={() => setIsOpen(true)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col h-screen transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shrink-0`}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="relative w-32 h-10 mb-1">
              <Image src="https://central.prag.global/wp-content/uploads/2026/04/Prag-Logo.png" alt="PRAG" fill className="object-contain" priority />
            </div>
            <p className="text-xs text-gray-500/50">Developed by Avario Digitals</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-sky-700 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <a href="https://shop.prag.global" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
            <ExternalLink size={16} />
            View Store
          </a>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0">
              {displayName?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">{email}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors font-medium">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
