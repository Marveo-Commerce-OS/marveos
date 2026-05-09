export interface AdminUser {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  status: string;
  stock_status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  featured: boolean;
  categories: { id: number; name: string; slug: string }[];
  images: { src: string; alt: string }[];
  date_created: string;
  total_sales: number;
}

export interface WCOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    state: string;
  };
  line_items: { id: number; name: string; quantity: number; total: string }[];
  shipping_total: string;
  payment_method_title: string;
}

export interface WCCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_created: string;
  orders_count: number;
  total_spent: string;
  avatar_url: string;
  billing: { phone: string; city: string; state: string };
}

export interface SlideItem {
  title: string;
  description: string;
  cta: string;
  link: string;
  productImage: string;
  productAlt: string;
}

export interface CategoryItem {
  name: string;
  slug: string;
  image: string;
}

export interface SocialLinks {
  facebook: string;
  instagram: string;
  linkedin: string;
  twitter: string;
  whatsapp: string;
}

export interface MenuItem {
  label: string;
  href: string;
}

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface ModulePreference {
  key: string;
  label: string;
  enabled: boolean;
  requiresPayment?: boolean;
}

export interface PaymentGateway {
  key: string;
  name: string;
  enabled: boolean;
  publicKey?: string;
  secretKey?: string;
  testMode?: boolean;
  requiredFields?: Record<string, string>;
}

export interface Integration {
  key: string;
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  requiresModules?: string[];
}

export interface PageContent {
  id: number;
  title: string;
  slug: string;
  type: 'home' | 'about' | 'contact' | 'services' | 'blog' | 'shop' | 'custom';
  heroSlides?: SlideItem[];
  footerContent?: string;
  contactInfo?: { email: string; phone: string; address: string };
  seoTitle?: string;
  seoDescription?: string;
  lastSynced?: string;
}

export interface MaintenanceSettings {
  site_under_construction: boolean;
  under_construction_title: string;
  under_construction_message: string;
}

export interface WordPressUser {
  username: string;
  display_name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface SiteSettings {
  // Branding (client upload)
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  typography: string;
  
  // Socials
  socials: SocialLinks;
  
  // Payments (multiple gateways, synced with WordPress)
  payment_gateways: PaymentGateway[];
  
  // Integrations (module-gated, default set)
  integrations: Integration[];
  
  // SEO & Scripts (global)
  seo_site_title: string;
  seo_meta_description: string;
  seo_keywords: string;
  custom_head_scripts: string;
  custom_body_scripts: string;
  google_analytics_id: string;
  google_search_console_id: string;
  
  // Team & Users
  team_members: TeamMember[];
  wordpress_users?: WordPressUser[];
  
  // Modules
  module_preferences: ModulePreference[];
  
  // Maintenance & Launch
  maintenance: MaintenanceSettings;
}

export interface WPPost {
  id: number;
  slug: string;
  status: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  date: string;
  _embedded?: { 'wp:featuredmedia'?: [{ source_url: string }] };
}
