# Marveo Onboarding Paths

This guide explains the three main onboarding paths and how to set up Marveo for each use case.

## Table of Contents

- [1. New Build](#1-new-build)
- [2. Existing WordPress Site](#2-existing-wordpress-site)
- [3. Existing Headless/Next.js Site](#3-existing-headlessnextjs-site)
- [Module Dependencies](#module-dependencies)
- [Access Control](#access-control)

---

## 1. New Build

**Best for:** Starting from scratch with a modern, custom commerce OS.

### Overview

The New Build path is for organizations starting completely fresh. You get to choose your ideal architecture and all features are available for configuration.

### Deployment Architecture Options

#### WordPress Only
- WordPress + WooCommerce as the single source of truth
- Next.js frontend fetches everything from WordPress REST APIs
- Suitable for: Small to medium-sized businesses, simple catalogs
- Requirements:
  - WordPress 5.9+
  - WooCommerce 6.0+ (if using commerce features)
  - PHP 7.4+

#### Headless Next.js + WordPress
- Separate WordPress and Next.js deployments
- WordPress serves as content/commerce backend
- Next.js renders frontend independently
- Suitable for: Agencies, high-traffic sites, premium branding
- Requirements:
  - Separate WordPress hosting
  - Separate Next.js hosting (e.g., Vercel)
  - Revalidation secret for ISR
  - GitHub token for plugin updates (Vercel environment only)

#### Hybrid (Gradual Migration)
- Start with WordPress Only, gradually move to Headless
- Run both modes simultaneously during transition
- Suitable for: Large sites needing zero downtime migration
- Requirements:
  - Both WordPress Only and Headless configurations
  - Content parity between systems
  - Migration tracking and validation

### Setup Steps

1. **Select Onboarding Path**: Choose "New Build"
2. **Select Architecture**: Choose from WordPress Only, Headless, or Hybrid
3. **Configure Business Profile**:
   - Business name, industry, business model
   - Country/currency
   - Contact email, phone, WhatsApp
   - Business address and hours
4. **Configure Brand Settings**:
   - Logo and favicon
   - Primary and secondary colors
   - Typography and layout style
5. **Select Modules**: Choose which features to enable:
   - Products and catalog
   - Blog and news
   - Pages and landing pages
   - Testimonials and case studies
   - Multi-location support
   - Analytics and SEO
   - Etc.
6. **Configure Integrations**:
   - CRM webhooks
   - Email providers
   - Payment gateways
   - Third-party APIs
7. **Review and Validate**: System verifies all requirements met

### Example Configuration

```bash
# .env for New Build (Headless mode)
MARVEO_DEPLOYMENT_MODE=headless
NEXT_PUBLIC_DEPLOYMENT_MODE=headless

# WordPress as backend
NEXT_PUBLIC_WP_API_URL=https://api.yourdomain.com
WORDPRESS_API_URL=https://api.yourdomain.com
WORDPRESS_API_USER=admin
WORDPRESS_API_PASSWORD=<app-password>

# Frontend hosting
NEXT_PUBLIC_FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Revalidation (ISR)
REVALIDATION_SECRET=<secure-random-string>

# GitHub updates
GITHUB_PLUGIN_UPDATES_TOKEN=<github-token>

# License
MARVEO_LICENSE_KEY=<license-key>

# Active modules
MARVEO_ACTIVE_MODULES=products,blog,pages,newsletter,analytics,seo
```

---

## 2. Existing WordPress Site

**Best for:** Migrating from an existing WordPress installation to Marveo.

### Overview

The Existing WordPress path lets you connect Marveo to a live WordPress site with existing content, products, and customers. Marveo scans your site, maps content, and provides admin tools.

### Deployment Architecture Options

#### WordPress Only
- Keep your existing WordPress setup exactly as is
- Add Marveo dashboard as admin tool
- Marveo app fetches from your WordPress APIs
- Suitable for: Sites happy with current WordPress setup
- Minimal changes required

#### Hybrid Upgrade
- Gradually introduce modern Next.js frontend
- WordPress remains as backend
- Run old and new frontends simultaneously
- Gradually migrate traffic
- Suitable for: Large sites needing zero downtime
- Benefits: Test new frontend with real data before cutover

#### Headless Migration
- Move away from WordPress frontend completely
- WordPress becomes content-only backend
- Deploy new Next.js frontend separately
- Full control over frontend technology
- Suitable for: Sites needing better performance or design control

### Setup Steps

1. **Select Onboarding Path**: Choose "Existing WordPress Site"
2. **Connect Your WordPress**:
   - Enter WordPress API URL
   - Provide admin username and password (or app password)
   - Marveo verifies connection
3. **Content Discovery**: Marveo scans your site:
   - Pages, posts, menus
   - WooCommerce products and categories
   - Media library
   - SEO metadata (Yoast, Rank Math)
   - Special pages (homepage, blog, shop, etc.)
4. **Review Content Inventory**:
   - See what Marveo found
   - View statistics (X pages, Y products, Z media)
   - Special page detection results
5. **Map Content** (if needed):
   - Assign detected pages to Marveo roles
   - Verify product categories
   - Confirm SEO settings
6. **Select Architecture**:
   - Keep WordPress frontend only
   - Upgrade to hybrid with new Next.js frontend
   - Migrate to headless completely
7. **Configure Business Profile**:
   - Auto-populate from existing WordPress settings if available
   - Edit/override as needed
8. **Select Modules**: Enable features based on your current setup
9. **Validate and Activate**: Final checks before going live

### Content Discovery Features

Marveo automatically scans for:

```
Pages:
  ✓ Homepage, About, Contact, Blog, Shop, Services, FAQs, Privacy, Terms
  ✓ All published and draft pages
  ✓ Page hierarchy and menu order

Posts:
  ✓ Blog posts with categories and tags
  ✓ Publication dates and authors
  ✓ Featured images

WooCommerce:
  ✓ All products with SKU, price, stock status
  ✓ Product categories and attributes
  ✓ Product variations
  ✓ Orders (read-only for analytics)

Media:
  ✓ Images, videos, documents, audio
  ✓ Usage tracking
  ✓ Missing image reports

Menus:
  ✓ All navigation menus
  ✓ Menu structure and hierarchy

SEO:
  ✓ Yoast SEO metadata
  ✓ Rank Math configuration
  ✓ Meta descriptions and focus keywords
```

### Legacy Deployment Migration

If you're currently on a legacy deployment:

1. Marveo automatically detects legacy configuration
2. Creates migration plan preserving all data
3. Maps legacy store types to Marveo location records
4. Converts legacy URLs to your current WordPress URLs
5. Preserves all content and products
6. Optional rollback if needed

### Example Configuration

```bash
# .env for Existing WordPress (Headless migration)
MARVEO_DEPLOYMENT_MODE=wordpress
NEXT_PUBLIC_DEPLOYMENT_MODE=wordpress

# Your existing WordPress
NEXT_PUBLIC_WP_API_URL=https://yoursite.com/wp-json
WORDPRESS_API_URL=https://yoursite.com/wp-json
WORDPRESS_API_USER=admin
WORDPRESS_API_PASSWORD=<app-password>

# WooCommerce (if applicable)
NEXT_PUBLIC_WOOCOMMERCE_API_URL=https://yoursite.com/wp-json/wc/v3
WC_API_USER=<consumer-key>
WC_API_PASSWORD=<consumer-secret>

# Frontend (new Next.js deployment)
NEXT_PUBLIC_FRONTEND_URL=https://new.yoursite.com
NEXT_PUBLIC_SITE_URL=https://new.yoursite.com

# Revalidation
REVALIDATION_SECRET=<secure-random-string>

# License
MARVEO_LICENSE_KEY=<license-key>

# Modules
MARVEO_ACTIVE_MODULES=products,blog,pages,multi_location,analytics

# Special post types (if custom)
MARVEO_STORE_POST_TYPE=marveo_location
MARVEO_DOCUMENT_POST_TYPE=marveo_document
```

---

## 3. Existing Headless/Next.js Site

**Best for:** Sites already running a separate frontend (Next.js, etc.) that want to connect to Marveo backend.

### Overview

The Existing Headless path is for sites already running a custom Next.js (or similar) frontend separately from WordPress. Marveo provides the backend APIs and settings management, while your frontend continues to work.

### Deployment Architecture Options

#### Connect Existing Frontend
- Use Marveo backend with your existing frontend code
- Add Marveo settings and admin UI
- Reuse your frontend styling and logic
- Suitable for: Teams with custom frontend expertise
- Benefits: No frontend rewrite needed

#### Gradual Content Migration
- Migrate content piece by piece
- Old frontend pages coexist with new Marveo pages
- A/B testing and traffic routing options
- Smooth transition without cutover risks
- Suitable for: Complex sites with many integrations

#### Full Template Replacement
- Replace your entire frontend with Marveo templates
- Keep your backend WordPress/WooCommerce
- Get pre-built responsive design
- Professional UI/UX included
- Suitable for: Teams wanting modern design without building

### Setup Steps

1. **Select Onboarding Path**: Choose "Existing Headless/Next.js Site"
2. **Select Architecture**:
   - Connect existing frontend (keep your code)
   - Gradual content migration (coexist with current)
   - Full template replacement (use Marveo UI)
3. **Connect Your Frontend**:
   - Enter your frontend URL
   - Verify deployment (Vercel, netlify, etc.)
4. **Configure Backend Connection**:
   - Enter WordPress API URL
   - Provide credentials
   - Verify connectivity
5. **Install Frontend Adapter**:
   - Copy Marveo adapter library to your project
   - `npm install @marveo/adapter`
   - Add `<MarveoProvider>` to your layout
6. **Configure Business Settings**:
   - Enter business profile
   - Set brand colors and typography
   - Upload logo
7. **Test Integration**:
   - Run hooks and components
   - Fetch sample data
   - Verify API connectivity
8. **Select Modules**: Enable features you're using
9. **Validate and Activate**

### Frontend Adapter Library

Marveo provides a reusable adapter for your Next.js frontend:

```typescript
// lib/marveo.ts
import { createMarveoClient } from '@marveo/adapter';

const marveo = createMarveoClient(
  process.env.NEXT_PUBLIC_WP_API_URL!,
  process.env.NEXT_PUBLIC_FRONTEND_URL!
);

export default marveo;
```

```typescript
// app/layout.tsx
import { MarveoProvider } from '@marveo/adapter/components';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MarveoProvider>
          {children}
        </MarveoProvider>
      </body>
    </html>
  );
}
```

```typescript
// app/page.tsx
import { useMarveoSettings, useMarveoContent } from '@marveo/adapter/hooks';

export default function HomePage() {
  const { settings } = useMarveoSettings();
  const { content } = useMarveoContent();

  return (
    <div>
      <h1>{settings?.content_settings?.homepage_title}</h1>
      {/* Your content */}
    </div>
  );
}
```

### Available Hooks

```typescript
// Fetch and cache settings
const { settings, isLoading } = useMarveoSettings();

// Fetch all content
const { content, isLoading } = useMarveoContent();

// Fetch page by slug
const { page, isLoading } = useMarveoPage('about');

// Fetch post by slug
const { post, isLoading } = useMarveoPost('hello-world');

// Fetch product
const { product, isLoading } = useMarveoProduct('123');

// Fetch menu
const { menu, isLoading } = useMarveoMenu('main');

// Get theme colors
const { primaryColor, secondaryColor } = useMarveoTheme();

// Get business contact info
const { email, phone, whatsapp } = useMarveoContact();

// Check if module enabled
const { enabled } = useMarveoModule('products');
```

### Example Configuration

```bash
# .env for Existing Headless
MARVEO_DEPLOYMENT_MODE=headless
NEXT_PUBLIC_DEPLOYMENT_MODE=headless

# Your frontend
NEXT_PUBLIC_FRONTEND_URL=https://yoursite.com
NEXT_PUBLIC_SITE_URL=https://yoursite.com

# Marveo backend (WordPress)
NEXT_PUBLIC_MARVEO_API_URL=https://api.yoursite.com
NEXT_PUBLIC_WP_API_URL=https://api.yoursite.com

# WordPress credentials (server-only)
WORDPRESS_API_USER=admin
WORDPRESS_API_PASSWORD=<app-password>

# Revalidation (ISR)
REVALIDATION_SECRET=<secure-random-string>

# License
MARVEO_LICENSE_KEY=<license-key>

# Modules
MARVEO_ACTIVE_MODULES=products,blog,pages,analytics
```

---

## Module Dependencies

Some modules require others to be enabled:

```
products         → requires: (commerce)
promotions       → requires: products
landing_pages    → requires: pages
b2b_quotation    → requires: products (commerce)
multi_location   → requires: (none)
newsletter       → requires: (none)
analytics        → requires: (none)
seo              → requires: (none)
blog             → requires: (none)
pages            → requires: (none)
solutions        → requires: (none)
testimonials     → requires: (none)
case_studies     → requires: (none)
whatsapp_cta     → requires: (none)
crm_webhook      → requires: (none)
```

---

## Access Control

### Client Settings (Editable by admins)

- Business profile (name, contact, hours)
- Brand settings (logo, colors, typography)
- Content (pages, posts, testimonials)
- Commerce settings (checkout mode, shipping info)
- Social links and contact info

### System Settings (Read-only for clients)

- Deployment mode (WordPress/Headless)
- API URLs (WordPress, WooCommerce)
- Revalidation secrets
- License keys
- Plugin settings
- Update channel
- Feature flags

**Important**: GitHub and Vercel tokens should NEVER be stored in WordPress.

---

## Quick Start

### New Build
```bash
# 1. Install Marveo plugin on WordPress
# 2. Run setup wizard in admin dashboard
# 3. Select "New Build" path
# 4. Choose your architecture and modules
# 5. Configure business profile and branding
# 6. Deploy frontend
```

### Existing WordPress
```bash
# 1. Install Marveo plugin on your WordPress
# 2. Run setup wizard in admin dashboard
# 3. Select "Existing WordPress Site" path
# 4. Connect to your WordPress
# 5. Let Marveo scan your content
# 6. Review content inventory
# 7. Optionally map custom fields
# 8. Deploy admin panel
```

### Existing Headless
```bash
# 1. Install Marveo plugin on WordPress backend
# 2. In your frontend: npm install @marveo/adapter
# 3. Add MarveoProvider to app layout
# 4. Use hooks in your components
# 5. Run setup wizard to configure
# 6. Verify frontend adapter working
```

---

## Troubleshooting

### Content Not Showing

```bash
# Check WordPress API is accessible
curl https://yoursite.com/wp-json/wp/v2/posts

# Verify Marveo plugin is activated
curl https://yoursite.com/wp-json/marveo/v1/status

# Check API credentials
WORDPRESS_API_USER=admin
WORDPRESS_API_PASSWORD=<app-password>  # Not your login password!
```

### Frontend Adapter Not Connecting

```bash
# Verify environment variables
echo $NEXT_PUBLIC_MARVEO_API_URL

# Test API endpoint
curl $NEXT_PUBLIC_MARVEO_API_URL/wp/v2

# Check MarveoProvider wrapped your layout
# Check hooks only used inside MarveoProvider
```

### Module Dependencies Failed

```bash
# Use Marveo admin panel to view dependencies
# Marveo will show which modules are missing
# Enable required modules first
```

---

## Next Steps

- [Administrator Guide](./admin-guide.md)
- [Module Configuration](./modules.md)
- [API Reference](./api-reference.md)
- [Troubleshooting](./troubleshooting.md)
