# Marvéo

**Modern commerce operations built for businesses using WordPress, WooCommerce, and headless commerce stacks.**

**Tagline:** Operate Smarter. Scale Faster.

**By:** Avario Digitals

---

## What is Marvéo?

Marvéo is a clean, modern operations dashboard designed to replace daily WordPress admin usage for business users. While WordPress remains an excellent content management system, its admin interface was not designed for modern business operations. Marvéo changes that.

### Business Reality

- **Business users should operate from Marvéo, not WordPress admin.**
- WordPress admin should become technical/admin territory only.
- Normal users should never need to log into `/wp-admin` except for advanced technical tasks or plugin management.

### Supported Deployment Modes

#### 1. **WordPress/WooCommerce** (Standard)

Your entire business runs on WordPress and WooCommerce. Marvéo provides:

- A clean operations backend for daily management
- Blog post and page editing
- Product management
- Order and customer management
- Media management
- Reports and analytics
- Staff access management

Your public website remains a normal WordPress theme.

#### 2. **Headless WordPress/WooCommerce**

Your public frontend is separate (Next.js, React, custom app) while WordPress/WooCommerce serve as the backend API. Marvéo operates as:

- The clean admin/control center
- Content management (CMS)
- Product and order operations
- Customer management
- Ecommerce operations
- Module management
- Reporting

---

## Core Features

Marvéo always includes these core modules:

- **Dashboard** — Quick overview of business metrics
- **Blog** — Create, edit, and publish blog posts
- **Pages** — Manage website pages and content
- **Media** — Upload, manage, and organize media files
- **Products** — Product catalog management
- **Orders** — Order processing and fulfillment
- **Customers** — Customer information and management
- **Reports** — Business metrics and reporting
- **Settings** — Configure store and system settings

## Optional Modules

Enable additional features through environment configuration:

- **Inventory** — Advanced stock and inventory tracking
- **CRM** — Customer relationship management
- **Analytics** — Advanced business analytics and insights
- **AI Insights** — AI-powered recommendations and insights
- **WhatsApp** — WhatsApp business integration
- **Procurement** — Procurement and supplier management
- **Multi-Branch** — Manage multiple store locations

---

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your client-specific settings
```

### Environment Configuration

See [.env.example](.env.example) for all available configuration options.

**Critical settings:**

```bash
# Client Information
NEXT_PUBLIC_CLIENT_NAME=My Store
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#14B8A6

# Deployment Mode
MARVEO_DEPLOYMENT_MODE=wordpress    # or 'headless'

# WordPress/WooCommerce URLs
WORDPRESS_API_URL=https://mystore.com
WOOCOMMERCE_API_URL=https://mystore.com

# WooCommerce API Credentials
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...

# Optional: Active modules
ACTIVE_MODULES=inventory,crm,analytics
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build & Production

```bash
npm run build
npm run start
```

---

## Configuration

### Deployment Modes

Set `MARVEO_DEPLOYMENT_MODE` to define your deployment type:

#### `wordpress`

Standard WordPress/WooCommerce setup:

```bash
MARVEO_DEPLOYMENT_MODE=wordpress
WORDPRESS_API_URL=https://mystore.com
WOOCOMMERCE_API_URL=https://mystore.com
NEXT_PUBLIC_FRONTEND_URL=https://mystore.com
```

#### `headless`

Separate frontend and WordPress backend:

```bash
MARVEO_DEPLOYMENT_MODE=headless
WORDPRESS_API_URL=https://cms.mycompany.com
WOOCOMMERCE_API_URL=https://api.mycompany.com
NEXT_PUBLIC_FRONTEND_URL=https://mystore.com
```

### Module Activation

Control which modules are available to users:

```bash
ACTIVE_MODULES=inventory,crm,analytics,whatsapp
```

Modules not listed are hidden from navigation and blocked from access. Core modules (Dashboard, Blog, Products, Orders, Customers, Reports, Settings) are always available.

---

## Architecture

### Configuration Layer

All environment configuration is centralized in `src/config/client.ts`. Components import configuration from this single source:

```typescript
import { getConfig } from '@/src/config/client';

const config = getConfig();
console.log(config.clientName);
console.log(config.isModuleEnabled('inventory'));
```

### Module System

The module system in `src/lib/modules.ts` handles:

- Module availability checking
- Navigation visibility
- Feature licensing

```typescript
import { isModuleEnabled, shouldShowInNavigation } from '@/src/lib/modules';

if (isModuleEnabled('crm')) {
  // Show CRM features
}

if (shouldShowInNavigation('inventory')) {
  // Add to sidebar navigation
}
```

### Service Layer

API interactions are organized in `src/services/`:

- `wordpress.ts` — WordPress REST API
- `woocommerce.ts` — WooCommerce REST API

Services are typed and centralized:

```typescript
import { getPosts, createPost, updatePost } from '@/src/services/wordpress';

const posts = await getPosts(1, 20);
await createPost({ title: 'New Post', content: '...' });
```

---

## Content Management

### Blog Posts

Marvéo supports full blog post management:

- List, create, edit, and delete blog posts
- Rich text editing with formatting
- Featured images
- Categories and tags
- Publish/draft status
- SEO-friendly slug management

### Pages

Standard WordPress pages can be edited in Marvéo:

- Edit page title and content
- Update featured images
- Manage page slug and metadata
- Support for ACF and custom meta fields (where exposed by API)

**Note:** Pages built with page builders (Elementor, Avada, WPBakery, Divi, etc.) should be edited in WordPress, as Marvéo focuses on standard content pages.

### Media Management

- Browse media library
- Upload new images and files
- Select featured images for posts/pages/products
- Organize media by upload date or search

### Content Editor

Marvéo uses a modern rich text editor supporting:

- Bold, italic, underline
- Headings
- Links and lists
- Block quotes
- Embedded media
- HTML-safe content handling

---

## Deployment

### Single Repository, Multiple Clients

Marvéo uses a single codebase deployed to multiple Vercel projects:

1. Clone this repository
2. Create a new Vercel project
3. Set environment variables for your client
4. Deploy

Each client deployment uses the same codebase but different environment variables:

```bash
# Client 1
NEXT_PUBLIC_CLIENT_NAME=PRAG
WORDPRESS_API_URL=https://cms.prag.global

# Client 2
NEXT_PUBLIC_CLIENT_NAME=Example Store
WORDPRESS_API_URL=https://examplestore.com
```

### Branch Flow

Use these branches for deployment:

- `development` — Active development
- `staging` — Pre-production testing
- `main` — Production release

Flow: `development` → `staging` → `main`

---

## WordPress Admin Limitations

Marvéo is designed to replace operational WordPress admin usage. However, some tasks still require WordPress:

### Marvéo Handles

✅ Blog post editing  
✅ Page editing (standard content)  
✅ Product management  
✅ Order management  
✅ Customer management  
✅ Media management  
✅ Reports and analytics  
✅ User access management  

### WordPress Still Required

⚠️ Page builder editing (Elementor, Avada, WPBakery, Divi)  
⚠️ Plugin installation and configuration  
⚠️ Theme customization  
⚠️ Advanced system administration  
⚠️ Server and security configuration  

---

## Security

- No secrets are stored in the repository
- WooCommerce credentials stored in `.env.local` (not committed)
- Authentication handled via JWT tokens stored in secure cookies
- All API calls use HTTPS where available
- Configuration is read-only at runtime

---

## License

Marvéo is a product of Avario Digital Products.

---

## Support & Documentation

- [Module Documentation](docs/modules.md)
- [CMS & Content Management](docs/cms-content-management.md)
- [Deployment Guide](docs/deployment.md)
- [Client Configuration Examples](docs/)

---

## Philosophy

> **Business users should operate from Marvéo, not WordPress admin.**

This is the guiding principle of Marvéo's design. We believe that:

- Modern business operations need modern interfaces
- Content management is separate from system administration
- Business users should never encounter technical complexity
- Technical teams can focus on system maintenance while business teams focus on operations

Marvéo makes this reality possible.
