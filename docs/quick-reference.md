# Marveo Quick Reference Guide

## For Site Admins

### Starting a New Deployment

1. **Install Plugin**
   ```bash
   # Activate Marveo Connector plugin
   # Go to WordPress admin > Plugins > Marveo Connector > Activate
   ```

2. **Run Setup Wizard**
   ```bash
   # Navigate to: Dashboard > Marveo Setup
   # Choose your onboarding path
   # Follow the 7-step wizard
   ```

3. **Select Path**
   - **New Build**: Starting from scratch
   - **Existing WordPress**: Connecting to current site
   - **Existing Headless**: Connecting to existing frontend

4. **Configure Business Info**
   - Business name, industry, business model
   - Contact email, phone, WhatsApp
   - Address, hours, currency

5. **Set Branding**
   - Upload logo
   - Choose primary/secondary colors
   - Select typography and layout style

6. **Enable Modules**
   - Products, Blog, Pages
   - Testimonials, Case Studies
   - Newsletter, Analytics, SEO
   - Multi-location, etc.

7. **Validate & Activate**
   - System validates all requirements
   - Shows any missing configurations
   - Dashboard becomes active once validated

---

## For Developers

### Quick Setup

```bash
# Clone both repos
git clone https://github.com/marveocommerce/marveos.git
git clone https://github.com/marveocommerce/marveo-connector.git

# Install plugin in WordPress plugins/ folder
cp -r marveo-connector /path/to/wordpress/wp-content/plugins/

# Install frontend dependencies
cd marveos
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values
```

### Environment Variables

**Minimum Required**:
```env
# WordPress backend
NEXT_PUBLIC_WP_API_URL=https://yoursite.com/wp-json

# License
MARVEO_LICENSE_KEY=your-license-key
```

**For Headless/Hybrid**:
```env
# Frontend deployment
NEXT_PUBLIC_FRONTEND_URL=https://yoursite.com
REVALIDATION_SECRET=your-secret-key
GITHUB_PLUGIN_UPDATES_TOKEN=ghp_xxxxx
```

**For WooCommerce**:
```env
NEXT_PUBLIC_WOOCOMMERCE_API_URL=https://yoursite.com/wp-json/wc/v3
WC_API_USER=ck_xxx
WC_API_PASSWORD=cs_xxx
```

### Using the Frontend Adapter

```typescript
// 1. Wrap your app
import { MarveoProvider } from '@/components/MarveoProvider';

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

// 2. Use hooks in components
import { useMarveoSettings, useMarveoContent, useMarveoPage } from '@/lib/hooks/useMarveo';

export default function HomePage() {
  const { settings, isLoading } = useMarveoSettings();
  const { content } = useMarveoContent();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{settings?.content_settings?.homepage_title}</h1>
      <p>{settings?.business_profile?.business_name}</p>
    </div>
  );
}

// 3. Fetch specific pages
export default function AboutPage() {
  const { page, isLoading } = useMarveoPage('about');
  
  if (isLoading) return <div>Loading...</div>;
  if (!page) return <div>Not found</div>;
  
  return (
    <div>
      <h1>{page.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
```

### Checking Module Status

```typescript
// Check if a module is enabled
const { enabled } = useMarveoModule('products');

if (!enabled) {
  return <div>Products module not enabled</div>;
}

// Use module features
return <ProductsList />;
```

### Getting Theme Colors

```typescript
// Use brand settings from global config
const { primaryColor, secondaryColor, typography } = useMarveoTheme();

return (
  <div style={{
    backgroundColor: primaryColor,
    borderColor: secondaryColor,
    fontFamily: typography
  }}>
    {/* Your content */}
  </div>
);
```

### REST API Usage

**Get Settings Group**:
```bash
curl https://yoursite.com/wp-json/marveo/v1/settings/business_profile \
  -H "Authorization: Bearer $TOKEN"
```

**Update Settings Group**:
```bash
curl -X POST https://yoursite.com/wp-json/marveo/v1/settings/business_profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "New Name",
    "contact_email": "new@email.com"
  }'
```

**Get Content Inventory**:
```bash
curl https://yoursite.com/wp-json/marveo/v1/content-inventory \
  -H "Authorization: Bearer $TOKEN"
```

**Trigger Content Scan**:
```bash
curl -X POST https://yoursite.com/wp-json/marveo/v1/content-scan \
  -H "Authorization: Bearer $TOKEN"
```

**Check Module Dependencies**:
```bash
curl -X POST https://yoursite.com/wp-json/marveo/v1/modules/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "modules": ["products", "promotions", "blog"]
  }'
```

---

## Common Tasks

### Enable Products Module

```php
// In WordPress admin or via REST API
$modules = get_option('marveo_active_modules');
if (!in_array('products', $modules)) {
    $modules[] = 'products';
    update_option('marveo_active_modules', $modules);
}
```

### Check if Site is Headless

```typescript
// In Next.js
import { getDeploymentMode } from '@/config/deployment';

const mode = getDeploymentMode();
if (mode === 'headless') {
    console.log('This is a headless deployment');
}
```

### Migrate PRAG Site

```php
// In WordPress
require_once 'marveo-connector/includes/class-prag-migration.php';

if (Marveo_PRAG_Migration::has_prag_config()) {
    Marveo_PRAG_Migration::create_rollback_point();
    Marveo_PRAG_Migration::migrate_configuration();
    Marveo_PRAG_Migration::migrate_settings();
    Marveo_PRAG_Migration::complete_migration();
}
```

### Validate Deployment

```typescript
import { validateFullDeployment } from '@/config/validation';

const result = await validateFullDeployment();

if (!result.validationPassed) {
    result.checks
        .filter(c => !c.passed)
        .forEach(check => {
            console.error(`${check.code}: ${check.message}`);
        });
}
```

### Scan WordPress Content

```bash
# Trigger content discovery
curl -X POST https://api.example.com/wp-json/marveo/v1/content-scan

# Check results
curl https://api.example.com/wp-json/marveo/v1/content-inventory | jq '.total_count'
```

---

## File Structure

```
marveo-connector/
├── includes/
│   ├── class-onboarding.php           # Onboarding paths & modules
│   ├── class-content-discovery.php    # WordPress content scan
│   ├── class-settings-schema.php      # Settings structure
│   ├── class-rest-api-extended.php    # New REST endpoints
│   ├── class-prag-migration.php       # PRAG migration
│   ├── class-rest-api.php             # (existing)
│   ├── class-admin-page.php           # (existing)
│   ├── helpers.php                    # (existing)
│   └── ...
└── marveo-connector.php               # Main plugin file

marveos/
├── src/
│   ├── config/
│   │   ├── deployment.ts              # (existing) Deployment modes
│   │   └── validation.ts              # (new) Comprehensive validation
│   ├── lib/
│   │   ├── marveo.ts                  # (new) Frontend adapter
│   │   └── hooks/
│   │       └── useMarveo.ts           # (new) React hooks
│   └── components/
│       └── MarveoProvider.tsx         # (new) Context provider
├── docs/
│   ├── onboarding-paths.md            # (new) Setup guide
│   ├── access-control.md              # (new) Permission model
│   └── platform-architecture.md       # (new) System overview
└── ...
```

---

## Troubleshooting

### Plugin Not Showing Setup

```bash
# Check plugin is activated
wp plugin list | grep marveo

# Check WordPress version >= 5.9
wp core version

# Check PHP >= 7.4
php -v

# Clear WordPress cache
wp cache flush
```

### Content Scan Not Working

```bash
# Check REST API enabled
curl https://yoursite.com/wp-json

# Check WP API accessible
curl https://yoursite.com/wp-json/wp/v2

# Check authentication
curl -H "Authorization: Bearer $TOKEN" \
  https://yoursite.com/wp-json/marveo/v1/content-inventory
```

### Frontend Not Connecting

```bash
# Check environment variables
echo $NEXT_PUBLIC_WP_API_URL

# Test API endpoint
curl $NEXT_PUBLIC_WP_API_URL/wp/v2

# Check MarveoProvider wraps layout
# Check hooks used only inside MarveoProvider
```

### Module Dependency Error

```bash
# Check which modules are active
curl https://yoursite.com/wp-json/marveo/v1/modules

# Validate dependencies
curl -X POST https://yoursite.com/wp-json/marveo/v1/modules/validate \
  -d '{"modules": ["products", "promotions"]}'

# Check error message for missing deps
```

---

## Support Resources

- [Onboarding Paths Guide](./onboarding-paths.md) - Detailed setup for each path
- [Access Control Guide](./access-control.md) - Permission model explained
- [Platform Architecture](./platform-architecture.md) - System overview
- [API Reference](./api-reference.md) - All endpoints documented
- [Module System](./modules.md) - Complete feature list

---

## Version Info

**Marveo Connector**: 1.0.7
**Marveos Frontend**: Latest
**WordPress Required**: 5.9+
**WooCommerce Required**: 6.0+ (if using commerce)
**PHP Required**: 7.4+
**Node.js Required**: 18+

---

## Quick Links

- GitHub: https://github.com/marveocommerce
- Documentation: https://docs.marveocommerce.com
- Support: support@marveocommerce.com
- License: GPL 2.0+
