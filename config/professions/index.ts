import type { ProfessionConfig } from '@/types/profession';
import { makeupArtistProfession } from './makeup-artist';
import { photographerProfession } from './photographer';
import { eventPlannerProfession } from './event-planner';
import { genericServiceBusinessProfession } from './generic-service-business';

const DEFAULT_PROFESSION_KEY = genericServiceBusinessProfession.key;

const KNOWN_MODULES = new Set([
  'bookings',
  'orders',
  'leads',
  'enquiries',
  'clients',
  'inventory',
  'team',
  'reports',
  'whatsapp',
  'payments',
  'portfolio',
  'calendar',
]);

export const professionConfigs: Record<string, ProfessionConfig> = {
  [genericServiceBusinessProfession.key]: genericServiceBusinessProfession,
  [makeupArtistProfession.key]: makeupArtistProfession,
  [photographerProfession.key]: photographerProfession,
  [eventPlannerProfession.key]: eventPlannerProfession,
};

function sanitizeConfig(input: ProfessionConfig): ProfessionConfig {
  const enabledModules = Array.from(
    new Set((input.enabledModules || []).filter((moduleKey) => KNOWN_MODULES.has(moduleKey))),
  );

  return {
    ...input,
    enabledModules,
    dashboardWidgets: Array.isArray(input.dashboardWidgets) ? input.dashboardWidgets : [],
    sidebarNavigation: Array.isArray(input.sidebarNavigation) ? input.sidebarNavigation : [],
    onboardingQuestions: Array.isArray(input.onboardingQuestions) ? input.onboardingQuestions : [],
    defaultWorkflows: Array.isArray(input.defaultWorkflows) ? input.defaultWorkflows : [],
    kpiCards: Array.isArray(input.kpiCards) ? input.kpiCards : [],
    terminology: input.terminology && typeof input.terminology === 'object' ? input.terminology : {},
  };
}

function normalizeProfessionKey(key?: string): string {
  return String(key || '').trim().toLowerCase();
}

export function resolveProfessionConfig(professionKey?: string): ProfessionConfig {
  const normalized = normalizeProfessionKey(professionKey);
  const selected = normalized ? professionConfigs[normalized] : undefined;
  const fallback = professionConfigs[DEFAULT_PROFESSION_KEY];
  const resolved = selected || fallback;
  return sanitizeConfig(resolved);
}

export function hasProfessionConfig(professionKey?: string): boolean {
  const normalized = normalizeProfessionKey(professionKey);
  if (!normalized) return false;
  return Boolean(professionConfigs[normalized]);
}

export function getProfessionConfig(key: string): ProfessionConfig {
  const selected = professionConfigs[normalizeProfessionKey(key)] || professionConfigs[DEFAULT_PROFESSION_KEY];
  return sanitizeConfig(selected);
}
