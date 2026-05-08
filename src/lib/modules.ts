/**
 * Marvéo Module System
 * Manages feature activation through environment configuration
 */

import { getCachedConfig } from '@/src/config/client';

export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  category: 'core' | 'optional';
  requiresLicense?: boolean;
}

/**
 * Core modules - always available
 */
export const CORE_MODULES: ModuleDefinition[] = [
  { key: 'dashboard', name: 'Dashboard', description: 'Main dashboard overview', category: 'core' },
  { key: 'cms', name: 'CMS', description: 'Content management system', category: 'core' },
  { key: 'pages', name: 'Pages', description: 'Page editing and management', category: 'core' },
  { key: 'blog', name: 'Blog', description: 'Blog post management', category: 'core' },
  { key: 'media', name: 'Media', description: 'Media library and uploads', category: 'core' },
  { key: 'products', name: 'Products', description: 'Product catalog management', category: 'core' },
  { key: 'orders', name: 'Orders', description: 'Order management', category: 'core' },
  { key: 'customers', name: 'Customers', description: 'Customer management', category: 'core' },
  { key: 'reports', name: 'Reports', description: 'Business reporting and analytics', category: 'core' },
  { key: 'settings', name: 'Settings', description: 'System and store settings', category: 'core' },
];

/**
 * Optional modules - require activation through ACTIVE_MODULES
 */
export const OPTIONAL_MODULES: ModuleDefinition[] = [
  {
    key: 'inventory',
    name: 'Inventory Management',
    description: 'Advanced inventory tracking',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'crm',
    name: 'CRM',
    description: 'Customer relationship management',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'analytics',
    name: 'Analytics',
    description: 'Advanced business analytics',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'ai-insights',
    name: 'AI Insights',
    description: 'AI-powered business insights',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Integration',
    description: 'WhatsApp business integration',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'procurement',
    name: 'Procurement',
    description: 'Procurement management',
    category: 'optional',
    requiresLicense: true,
  },
  {
    key: 'branches',
    name: 'Multi-Branch',
    description: 'Multi-branch management',
    category: 'optional',
    requiresLicense: true,
  },
];

export const ALL_MODULES = [...CORE_MODULES, ...OPTIONAL_MODULES];

/**
 * Get all active modules based on environment configuration
 */
export function getActiveModules(): ModuleDefinition[] {
  const config = getCachedConfig();
  return ALL_MODULES.filter(
    (module) => module.category === 'core' || config.activeModules.includes(module.key),
  );
}

/**
 * Check if a specific module is enabled
 */
export function isModuleEnabled(moduleName: string): boolean {
  const config = getCachedConfig();
  return config.isModuleEnabled(moduleName);
}

/**
 * Get module by key
 */
export function getModule(key: string): ModuleDefinition | undefined {
  return ALL_MODULES.find((m) => m.key === key);
}

/**
 * Get all core modules
 */
export function getCoreModules(): ModuleDefinition[] {
  return CORE_MODULES;
}

/**
 * Get all optional modules that are active
 */
export function getActiveOptionalModules(): ModuleDefinition[] {
  const config = getCachedConfig();
  return OPTIONAL_MODULES.filter((module) => config.activeModules.includes(module.key));
}

/**
 * Check if module is available for navigation
 * Shows in UI if enabled or core
 */
export function shouldShowInNavigation(moduleName: string): boolean {
  const config = getCachedConfig();
  const module = getModule(moduleName);
  if (!module) return false;
  return module.category === 'core' || config.isModuleEnabled(moduleName);
}

export default {
  getActiveModules,
  isModuleEnabled,
  getModule,
  getCoreModules,
  getActiveOptionalModules,
  shouldShowInNavigation,
};
