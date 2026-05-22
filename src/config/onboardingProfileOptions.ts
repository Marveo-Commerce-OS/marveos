export type OnboardingOption = {
  value: string;
  label: string;
  tooltip?: string;
};

export const ONBOARDING_COUNTRY_OPTIONS: OnboardingOption[] = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'Australia', label: 'Australia' },
];

export const ONBOARDING_BUSINESS_MODEL_OPTIONS: OnboardingOption[] = [
  {
    value: 'B2C',
    label: 'Business to Consumer',
    tooltip: 'Sells directly to end customers. Typical consumer storefront and checkout flow.',
  },
  {
    value: 'B2B',
    label: 'Business to Business',
    tooltip: 'Sells to other businesses. Usually includes account pricing, quotes, or bulk orders.',
  },
];

export const ONBOARDING_BUSINESS_TYPE_OPTIONS: OnboardingOption[] = [
  { value: 'Retail', label: 'Retail' },
  { value: 'Wholesale', label: 'Wholesale' },
  { value: 'Services', label: 'Services' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Hospitality', label: 'Hospitality' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Real Estate', label: 'Real Estate' },
];
