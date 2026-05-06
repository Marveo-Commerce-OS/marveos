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

export interface SiteSettings {
  // Contact
  contact_phone: string;
  contact_email: string;
  whatsapp: string;
  address: string;
  business_hours_weekday: string;
  business_hours_saturday: string;
  // Socials
  socials: SocialLinks;
  // Announcement
  announcement_bar: string;
  // Under Construction
  site_under_construction: boolean;
  under_construction_title: string;
  under_construction_message: string;
  // Footer
  footer_description: string;
  // Brand Banner
  brand_banner_title: string;
  brand_banner_description: string;
  brand_banner_cta: string;
  brand_banner_link: string;
  brand_banner_image: string;
  // Hero Slides
  hero_background: string;
  slides: SlideItem[];
  // Category Grid
  categories: CategoryItem[];
  // Payments
  paystack_public_key: string;
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
