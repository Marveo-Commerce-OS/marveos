export interface BusinessTypeOption {
  key: string;
  label: string;
  allowsCustom?: boolean;
}

export interface SectorOption {
  key: string;
  label: string;
  businessTypeKeys: string[];
}

export interface ProfessionOption {
  key: string;
  label: string;
  hasProfessionConfig: boolean;
}

export const businessTypes: BusinessTypeOption[] = [
  { key: 'Retail', label: 'Retail' },
  { key: 'Service', label: 'Service' },
  { key: 'Ecommerce', label: 'Ecommerce' },
  { key: 'Professional Services', label: 'Professional Services' },
  { key: 'Professional Services / Technology', label: 'Professional Services / Technology' },
  { key: 'Creative Services', label: 'Creative Services' },
  { key: 'Health & Wellness', label: 'Health & Wellness' },
  { key: 'Education / Training', label: 'Education / Training' },
  { key: 'Hospitality', label: 'Hospitality' },
  { key: 'Real Estate', label: 'Real Estate' },
  { key: 'Other', label: 'Other', allowsCustom: true },
];

export const sectors: SectorOption[] = [
  { key: 'Beauty & Personal Care', label: 'Beauty & Personal Care', businessTypeKeys: ['Service', 'Health & Wellness'] },
  { key: 'Creative Production', label: 'Creative Production', businessTypeKeys: ['Creative Services', 'Service'] },
  { key: 'Events & Lifestyle', label: 'Events & Lifestyle', businessTypeKeys: ['Service', 'Creative Services', 'Hospitality'] },
  { key: 'General Services', label: 'General Services', businessTypeKeys: ['Service', 'Professional Services', 'Other'] },
  { key: 'Technology & Software', label: 'Technology & Software', businessTypeKeys: ['Professional Services', 'Professional Services / Technology', 'Service'] },
];

export const professionsBySector: Record<string, ProfessionOption[]> = {
  'Beauty & Personal Care': [
    { key: 'makeup-artist', label: 'Makeup Artist', hasProfessionConfig: true },
    { key: 'hair-stylist', label: 'Hair Stylist', hasProfessionConfig: false },
    { key: 'nail-technician', label: 'Nail Technician', hasProfessionConfig: false },
    { key: 'lash-technician', label: 'Lash Technician', hasProfessionConfig: false },
    { key: 'beauty-studio', label: 'Beauty Studio', hasProfessionConfig: false },
    { key: 'other', label: 'Other', hasProfessionConfig: false },
  ],
  'Creative Production': [
    { key: 'photographer', label: 'Photographer', hasProfessionConfig: true },
    { key: 'videographer', label: 'Videographer', hasProfessionConfig: false },
    { key: 'decorator', label: 'Decorator', hasProfessionConfig: false },
    { key: 'dj-mc', label: 'DJ / MC', hasProfessionConfig: false },
    { key: 'other', label: 'Other', hasProfessionConfig: false },
  ],
  'Events & Lifestyle': [
    { key: 'event-planner', label: 'Event Planner', hasProfessionConfig: true },
    { key: 'decorator', label: 'Decorator', hasProfessionConfig: false },
    { key: 'dj-mc', label: 'DJ / MC', hasProfessionConfig: false },
    { key: 'other', label: 'Other', hasProfessionConfig: false },
  ],
  'General Services': [
    { key: 'generic-service-business', label: 'Generic Service Business', hasProfessionConfig: true },
    { key: 'other', label: 'Other', hasProfessionConfig: false },
  ],
  'Technology & Software': [
    { key: 'saas-software-platform', label: 'SaaS / Software Platform', hasProfessionConfig: true },
    { key: 'digital-agency', label: 'Digital Agency', hasProfessionConfig: true },
    { key: 'it-support-company', label: 'IT Support Company', hasProfessionConfig: true },
    { key: 'software-development-company', label: 'Software Development Company', hasProfessionConfig: true },
    { key: 'automation-consultant', label: 'Automation Consultant', hasProfessionConfig: true },
    { key: 'other', label: 'Other', hasProfessionConfig: false },
  ],
};

export function getSectorsForBusinessType(businessType: string): SectorOption[] {
  const normalized = String(businessType || '').trim();
  if (!normalized || normalized === 'Other') return sectors;
  return sectors.filter((item) => item.businessTypeKeys.includes(normalized));
}

export function getProfessionsForSector(sector: string): ProfessionOption[] {
  const normalized = String(sector || '').trim();
  if (!normalized) return [];
  return professionsBySector[normalized] || [];
}

export function sectorRequiresProfession(sector: string): boolean {
  return getProfessionsForSector(sector).length > 0;
}
