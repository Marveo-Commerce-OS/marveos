# Deployment Guide

Marvéo uses a single codebase deployed to multiple client instances through Vercel.

## Deployment Architecture

### Single Repository, Multiple Clients

One codebase can serve unlimited clients with different configurations:

```
marveos (repository)
├── vercel.com/client-1 (Example Commerce)
├── vercel.com/client-2 (Example Store)
└── vercel.com/client-n (Your Store)
```

Each deployment uses identical code with different environment variables.

---

## Branch Strategy

Use these branches for deployment flow:

| Branch | Purpose | Visibility |
|--------|---------|------------|
| `development` | Active development | Private development |
| `staging` | Pre-production | Staging environments |
| `main` | Production | Live deployments |

### Deployment Flow

```
development → staging → main
```

1. Work on `development` branch
2. Create pull requests for review
3. Merge to `staging` for testing
4. Promote to `main` for production release

---

## Vercel Setup

### Initial Setup

1. **Create Vercel Project**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import the `marveos` repository
   - Select `Next.js` framework

2. **Connect Repository**
   - Authorize GitHub access
   - Select `marveocommerce/marveos`
   - Leave build/install settings as default

3. **Configure Environment Variables**
   - See [Environment Variables](#environment-variables) section below

4. **Deploy**
   - Initial deployment happens automatically

### Production Deployment

```bash
# On main branch
git checkout main
git pull origin main
# Vercel auto-deploys when commits are pushed
```

---

## Environment Variables

### Setting Variables in Vercel

1. Project Settings → Environment Variables
2. Add variables for each environment (Production, Preview, Development)
3. Redeploy for changes to take effect

### Required Variables

All variables from [.env.example](../.env.example) should be set:

#### Client Information

```
NEXT_PUBLIC_APP_NAME=Marvéo
NEXT_PUBLIC_CLIENT_NAME=Example Commerce
NEXT_PUBLIC_CLIENT_LOGO=https://...
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#14B8A6
NEXT_PUBLIC_CLIENT_SECONDARY_COLOR=#A3E635
```

#### Deployment Configuration

```
MARVEO_DEPLOYMENT_MODE=wordpress
# or
MARVEO_DEPLOYMENT_MODE=headless
```

#### API Endpoints

```
NEXT_PUBLIC_FRONTEND_URL=https://example.com
WORDPRESS_API_URL=https://cms.example.com/wp-json
WOOCOMMERCE_API_URL=https://cms.example.com/wp-json
WORDPRESS_ADMIN_URL=https://cms.example.com/wp-admin
WORDPRESS_MEDIA_URL=https://cms.example.com/wp-content/uploads
```

#### API Credentials

```
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

#### Features

```
ACTIVE_MODULES=inventory,crm,analytics
LICENSE_KEY=YOUR-KEY
```

#### System

```
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_BRAND_BYLINE=A product by Avario Digital Products
```

---

## Client Configuration Examples

### Example 1: WordPress Store (Example Commerce)

```bash
NEXT_PUBLIC_CLIENT_NAME=Example Commerce
MARVEO_DEPLOYMENT_MODE=wordpress
WORDPRESS_API_URL=https://central.example.com/wp-json
WOOCOMMERCE_API_URL=https://central.example.com/wp-json
WORDPRESS_ADMIN_URL=https://central.example.com/wp-admin
WORDPRESS_MEDIA_URL=https://central.example.com/wp-content/uploads
NEXT_PUBLIC_FRONTEND_URL=https://example.com
WOOCOMMERCE_CONSUMER_KEY=ck_1234...
WOOCOMMERCE_CONSUMER_SECRET=cs_5678...
ACTIVE_MODULES=inventory,crm,analytics
```

### Example 2: WordPress Store (Example Store)

```bash
NEXT_PUBLIC_CLIENT_NAME=Example Store
MARVEO_DEPLOYMENT_MODE=wordpress
WORDPRESS_API_URL=https://examplestore.com/wp-json
WOOCOMMERCE_API_URL=https://examplestore.com/wp-json
WORDPRESS_ADMIN_URL=https://examplestore.com/wp-admin
WORDPRESS_MEDIA_URL=https://examplestore.com/wp-content/uploads
NEXT_PUBLIC_FRONTEND_URL=https://examplestore.com
WOOCOMMERCE_CONSUMER_KEY=ck_abcd...
WOOCOMMERCE_CONSUMER_SECRET=cs_efgh...
ACTIVE_MODULES=inventory,crm
```

### Example 3: Headless Commerce

```bash
NEXT_PUBLIC_CLIENT_NAME=Headless Shop
MARVEO_DEPLOYMENT_MODE=headless
WORDPRESS_API_URL=https://cms.mycompany.com/wp-json
WOOCOMMERCE_API_URL=https://api.mycompany.com/wp-json
NEXT_PUBLIC_FRONTEND_URL=https://mystore.com
WOOCOMMERCE_CONSUMER_KEY=ck_xyz...
WOOCOMMERCE_CONSUMER_SECRET=cs_uvw...
ACTIVE_MODULES=inventory,crm,analytics,procurement
```

---

## Development Workflow

### Local Development

```bash
# Clone repository
git clone https://github.com/marveocommerce/marveos.git
cd marveos

# Create local env
cp .env.example .env.local

# Edit .env.local with your test credentials
nano .env.local

# Install and run
npm install
npm run dev

# Open http://localhost:3000
```

### Testing Deployment

```bash
# Build locally to catch errors
npm run build

# Run production build
npm run start

# Test at http://localhost:3000
```

---

## Staging Deployment

Use Vercel's automatic staging environment:

1. **Create Pull Request** to `staging` branch
2. **Vercel Preview** generated automatically
3. **Test** the preview deployment
4. **Merge** when tests pass

### Preview URLs

Vercel generates URLs like:

```
https://marveos-pr-123.vercel.app
```

Share preview URLs with stakeholders for testing.

---

## Production Deployment

### Promoting to Production

1. **Merge** `staging` → `main`
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

2. **Vercel deploys** automatically to production

3. **Verify** deployment at production URL

### Production Checklist

- [ ] All tests passing
- [ ] Staging deployment verified
- [ ] Environment variables configured
- [ ] API credentials correct
- [ ] SSL certificate valid
- [ ] DNS pointing to Vercel
- [ ] Backup of previous deployment

---

## Domain Configuration

### Custom Domain Setup

1. **Add Domain** in Vercel Project Settings
2. **Update DNS** at domain registrar
3. **Verify** with Vercel's DNS records
4. **SSL** automatically configured

### DNS Records

Example for `marveos.example.com`:

```
Name: marveos
Type: CNAME
Value: cname.vercel.app
```

---

## SSL/TLS Certificates

- Vercel automatically provisions SSL certificates
- Certificates auto-renew before expiration
- No manual configuration needed
- All traffic should use HTTPS

---

## Monitoring & Logs

### Vercel Dashboard

View in Vercel Project:

- Deployment history
- Build logs
- Function logs
- Performance analytics

### Local Log Checking

```bash
# View recent deployments
vercel logs

# Stream live logs
vercel logs --follow

# Filter by function
vercel logs --follow --service=api
```

---

## Rollback

### Revert to Previous Deployment

```bash
# In Vercel Dashboard:
# 1. Go to Deployments
# 2. Click previous deployment
# 3. Click "Promote to Production"
```

Or via Git:

```bash
# Revert last commit
git revert HEAD
git push origin main

# Vercel will deploy the reverted version
```

---

## Performance Optimization

### Edge Caching

Vercel automatically caches:

- Static assets (CSS, JS, images)
- API responses with `next: { revalidate: X }`

### Build Optimization

```typescript
// Revalidate cache every 30 seconds
export const revalidate = 30;

// Revalidate on demand
export const revalidateTag = 'posts';
```

### Image Optimization

Vercel automatically optimizes images:

- Formats (WebP, AVIF)
- Sizes (responsive)
- Compression

---

## Security

### Environment Variables

- ✅ **Secret** variables never exposed
- ✅ **Secrets** not included in client bundle
- ✅ **API keys** server-side only
- ❌ Never commit `.env.local`

### CORS & HTTPS

- ✅ All requests use HTTPS
- ✅ CORS configured for trusted origins
- ✅ No exposed credentials in requests

---

## Troubleshooting

### Build Failures

Check Vercel build logs:

```bash
# View build output
vercel logs --follow
```

Common causes:

- Missing environment variables
- TypeScript errors
- Dependency conflicts
- Disk space

### Runtime Errors

Check function logs:

```bash
# View API logs
vercel logs --follow --service=api
```

### Slow Deployments

- Check large dependencies in package.json
- Optimize image sizes
- Remove unused dependencies

---

## Scaling

### Traffic Scaling

Vercel automatically scales:

- Handles traffic spikes
- Global edge network
- No manual configuration needed

### Database Scaling

If using database:

- Consider migration tools
- Monitor connection limits
- Optimize queries

---

## Disaster Recovery

### Data Backup

Implement regular backups:

- WordPress database backups
- Media file backups
- Configuration backups

### Recovery Procedure

1. Restore database backup
2. Restore media files
3. Re-deploy Marvéo
4. Verify functionality

---

## Support

For Vercel-specific issues:

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [GitHub Issues](https://github.com/marveocommerce/marveos/issues)
