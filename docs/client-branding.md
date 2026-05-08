# Client Branding & Frontend Customization

## Overview

Marvéo supports flexible client branding through environment variables. This allows each client deployment to maintain their own visual identity and brand experience.

## Current Branding Support (v1.0)

### Environment Variables

```env
NEXT_PUBLIC_CLIENT_NAME=Your Brand Name
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#14B8A6
NEXT_PUBLIC_CLIENT_SECONDARY_COLOR=#A3E635
NEXT_PUBLIC_CLIENT_LOGO=https://your-cdn.com/logo.png
```

### Where Branding Appears

| Element | Variable | Scope |
|---------|----------|-------|
| **App Title** | `NEXT_PUBLIC_CLIENT_NAME` | Sidebar, Portal, Login header |
| **Primary Brand Color** | `NEXT_PUBLIC_CLIENT_PRIMARY_COLOR` | Buttons, active nav, accents |
| **Secondary Color** | `NEXT_PUBLIC_CLIENT_SECONDARY_COLOR` | Hover states, highlights |
| **Logo** | `NEXT_PUBLIC_CLIENT_LOGO` | Login page, Portal header, Sidebar |
| **Byline/Tagline** | `NEXT_PUBLIC_BRAND_BYLINE` | Login page footer, Portal footer |

### Components Using Branding

1. **Login Page** (`app/login/page.tsx`)
   - Logo in glassmorphic container
   - Primary color on sign-in button
   - Byline below logo

2. **Portal Page** (`app/portal/page.tsx`)
   - Client name in header
   - Primary color accent on branding
   - Byline in footer

3. **Sidebar** (`components/Sidebar.tsx`)
   - Logo or text logo with primary color
   - Active nav item highlighted with primary color
   - Client name in branding section

4. **Dashboard** (`app/dashboard/layout.tsx`)
   - Header uses client name
   - Sidebar integrates branding

## Branding Tiers

### Tier 1: Starter (No Custom Branding)
- **Price:** $99/month
- **Branding:** Marvéo default logo and colors
- **Customization:** None
- **Use Case:** Small stores, initial trials

### Tier 2: Pro (Basic Branding)
- **Price:** $299/month
- **Branding:** Custom logo + custom primary color
- **Customization:** Logo URL + primary color only
- **Use Case:** Growing businesses, custom brand presence

### Tier 3: Enterprise (Full Branding)
- **Price:** $999/month+
- **Branding:** Full customization (logo, colors, fonts, custom domain)
- **Customization:** Logo, primary color, secondary color, custom CSS variables
- **Use Case:** Large enterprises, white-label deployments

## Future Enhancements (Roadmap)

### Phase 2: Extended Branding (v1.5)
- [ ] Custom fonts (via Google Fonts or uploaded TTF)
- [ ] Custom favicon
- [ ] Custom email templates (for password reset, notifications)
- [ ] Custom splash screens / loading states
- [ ] Light/dark mode toggle per brand

**Implementation Strategy:**
```env
# Phase 2 additions
NEXT_PUBLIC_CLIENT_FONT_FAMILY=Inter,system-ui,sans-serif
NEXT_PUBLIC_CLIENT_FAVICON_URL=https://cdn.com/favicon.ico
NEXT_PUBLIC_CLIENT_DARK_MODE=true
```

### Phase 3: White-Label Frontend (v2.0)
- [ ] Custom frontend storefront branding
- [ ] Custom checkout flow
- [ ] Custom email domain (e.g., orders@mybrand.com)
- [ ] Custom dashboard domain (e.g., admin.mybrand.com)

**Implementation Strategy:**
```env
CUSTOM_FRONTEND_URL=https://shop.mybrand.com
CUSTOM_ADMIN_DOMAIN=admin.mybrand.com
CUSTOM_EMAIL_DOMAIN=noreply@mybrand.com
```

### Phase 4: Advanced Customization (v2.5)
- [ ] Custom CSS injection (CSS variables system)
- [ ] Custom Tailwind theme overrides
- [ ] Module skinning (different looks per feature)
- [ ] Custom navigation structure
- [ ] Custom admin dashboard layout

## Implementation Guide: Adding New Branding Variable

### Step 1: Add to Config Layer

**File:** `src/config/client.ts`

```typescript
export interface MarveoConfig {
  // ... existing fields
  clientName: string;
  clientPrimaryColor: string;
  clientSecondaryColor: string;
  clientLogo: string | null;
  // NEW: Custom font
  clientFont?: string;
}

function getConfig(): MarveoConfig {
  return {
    // ... existing
    clientFont: process.env.NEXT_PUBLIC_CLIENT_FONT || 'system-ui, sans-serif',
  };
}
```

### Step 2: Use in Components

**File:** `app/layout.tsx`

```typescript
const config = getConfig();

export const metadata = {
  // ... existing
};

// Apply custom font to root
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontFamily = config.clientFont || 'system-ui, sans-serif';
  
  return (
    <html style={{ fontFamily }}>
      <body>{children}</body>
    </html>
  );
}
```

### Step 3: Document in `.env.example`

```env
NEXT_PUBLIC_CLIENT_FONT=Inter,system-ui,sans-serif
```

## Usage by Clients

### For Starter Tier
No action needed. Uses Marvéo defaults.

### For Pro/Enterprise Tier

1. **Set environment variables** on Vercel deployment
2. **Redeploy** (usually automatic)
3. **Verify** branding appears on next page load

Example Vercel deployment:
```bash
vercel env add NEXT_PUBLIC_CLIENT_LOGO "https://cdn.example.com/logo.png"
vercel env add NEXT_PUBLIC_CLIENT_PRIMARY_COLOR "#FF6B35"
vercel deploy --prod
```

## Branding Best Practices

### Color Accessibility
- **Primary color**: Must have sufficient contrast with white text (WCAG AA minimum)
- **Secondary color**: Optional, used for hover/active states
- **Recommend**: Use colors from established brand palette

### Logo Guidelines
- **Format**: PNG with transparent background (preferred)
- **Size**: 200x200px minimum
- **CDN**: Host on your CDN or Marvéo CDN
- **HTTPS**: Always use HTTPS URLs

### CSS Variables (Future)

Once CSS variables system is implemented:

```css
:root {
  --client-primary: #14B8A6;
  --client-secondary: #A3E635;
  --client-neutral: #F3F4F6;
  --client-danger: #EF4444;
}

button {
  background-color: var(--client-primary);
}

.active {
  color: var(--client-secondary);
}
```

## Per-Client Branding Data Structure

Stored in `.env` per deployment:

```
NEXT_PUBLIC_CLIENT_NAME=Brand Name
NEXT_PUBLIC_CLIENT_LOGO=https://...
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#...
NEXT_PUBLIC_CLIENT_SECONDARY_COLOR=#...
```

**Centralized in Marvéo Backend** (future):

Each client deployment has a record:
```json
{
  "client_id": "12345",
  "branding": {
    "name": "Brand Name",
    "logo_url": "https://...",
    "primary_color": "#14B8A6",
    "secondary_color": "#A3E635",
    "font_family": "Inter, sans-serif",
    "tier": "enterprise"
  }
}
```

Then Marvéo API can serve `/api/branding/config` so frontend fetches dynamically (no rebuild needed).

## Testing Branding

### Local Testing
```bash
NEXT_PUBLIC_CLIENT_NAME="Test Brand" \
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR="#FF0000" \
npm run dev
```

### Vercel Testing
1. Set env vars in Vercel project settings
2. Redeploy preview environment
3. Check branding on preview URL

## FAQ

**Q: Can we customize the entire dashboard layout?**
A: Not in v1.0. That's a v2.0+ feature. Currently only colors, logo, name, fonts.

**Q: Can we use custom CSS?**
A: Not directly in v1.0. Future roadmap includes CSS injection for Enterprise tier.

**Q: Does branding affect the storefront?**
A: No, this is operations dashboard branding only. Storefront branding is separate (Phase 3 roadmap).

**Q: Can we change the domain?**
A: Not in v1.0. That's Phase 3+ (custom domain support). Currently deployed on `app.marveo.com/client-123`.

**Q: Can we white-label Marvéo?**
A: Yes, for Enterprise tier (future). Currently in roadmap for v2.0.
