# Marvéo Module System

Marvéo supports a modular architecture where features can be enabled or disabled through environment configuration.

## Core Modules (Always Available)

These modules are always enabled and visible in Marvéo:

- **Dashboard** — Business overview and metrics
- **Blog** — Blog post management
- **Pages** — Page content management
- **Media** — Media library management
- **Products** — Product catalog
- **Orders** — Order management
- **Customers** — Customer management
- **Reports** — Business reporting and analytics
- **Settings** — System and store settings

## Optional Modules (License Required)

These modules require activation through the `ACTIVE_MODULES` environment variable:

### Inventory Management

Advanced inventory tracking and stock management.

```bash
ACTIVE_MODULES=inventory
```

### CRM (Customer Relationship Management)

Customer relationship and engagement tracking.

```bash
ACTIVE_MODULES=crm
```

### Analytics

Advanced business analytics and performance insights.

```bash
ACTIVE_MODULES=analytics
```

### AI Insights

AI-powered recommendations and business intelligence.

```bash
ACTIVE_MODULES=ai-insights
```

### WhatsApp Integration

WhatsApp business messaging integration.

```bash
ACTIVE_MODULES=whatsapp
```

### Procurement

Supplier and procurement management.

```bash
ACTIVE_MODULES=procurement
```

### Multi-Branch

Multi-location and branch management.

```bash
ACTIVE_MODULES=branches
```

---

## Activating Modules

### Method 1: Single Module

```bash
ACTIVE_MODULES=inventory
```

### Method 2: Multiple Modules

Comma-separated list (no spaces):

```bash
ACTIVE_MODULES=inventory,crm,analytics,whatsapp
```

### Method 3: Environment Variables

In `.env.local`:

```bash
ACTIVE_MODULES=inventory,crm,analytics,whatsapp,procurement,branches,ai-insights
```

---

## Checking Module Status

### In Components

```typescript
import { isModuleEnabled, shouldShowInNavigation } from '@/src/lib/modules';

// Check if module is enabled
if (isModuleEnabled('inventory')) {
  // Show inventory features
}

// Check if module should appear in navigation
if (shouldShowInNavigation('crm')) {
  // Add CRM to sidebar
}
```

### At Runtime

```typescript
import { getActiveModules } from '@/src/lib/modules';

const activeModules = getActiveModules();
console.log(activeModules); // Array of enabled modules
```

---

## Module Visibility in UI

When a module is not enabled:

1. ❌ Hidden from sidebar navigation
2. ❌ Routes blocked with 403 error
3. ❌ Features completely unavailable
4. ❌ No UI elements shown

Users cannot access disabled modules even if they try to access routes directly.

---

## Example Configuration

### Startup Plan

Minimal setup for new businesses:

```bash
MARVEO_DEPLOYMENT_MODE=wordpress
ACTIVE_MODULES=
# Core modules only
```

### Growth Plan

Growing business with inventory and CRM:

```bash
MARVEO_DEPLOYMENT_MODE=wordpress
ACTIVE_MODULES=inventory,crm
```

### Enterprise Plan

Full-featured setup:

```bash
MARVEO_DEPLOYMENT_MODE=wordpress
ACTIVE_MODULES=inventory,crm,analytics,ai-insights,procurement,branches
```

### Headless Plan

Headless commerce with full modules:

```bash
MARVEO_DEPLOYMENT_MODE=headless
ACTIVE_MODULES=inventory,crm,analytics,ai-insights
```

---

## Adding New Modules

To add a new module to Marvéo:

1. Add module definition to `src/lib/modules.ts`
2. Create module routes in `app/dashboard/[module-name]/`
3. Create module components in `components/[module-name]/`
4. Import module helpers in feature components
5. Test visibility and access control

---

## License Management

Optional modules require valid licenses. Set:

```bash
LICENSE_KEY=YOUR-LICENSE-KEY
```

The license key is validated at deployment time. Invalid or expired licenses will disable optional modules automatically.

---

## Troubleshooting

### Module not showing in sidebar

Check that:
- Module name is correct in `ACTIVE_MODULES`
- Module is listed in `src/lib/modules.ts`
- `shouldShowInNavigation()` returns true
- User has appropriate permissions

### Module route returns 403

This is expected for disabled modules. Enable the module:

```bash
ACTIVE_MODULES=inventory
```

### Changes not taking effect

1. Rebuild the application: `npm run build`
2. Clear Next.js cache: `rm -rf .next`
3. Restart dev server: `npm run dev`
