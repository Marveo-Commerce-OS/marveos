# Client Example: Generic Headless Commerce

This example shows how to configure a Marvéo deployment for a headless commerce client where the frontend and backend are decoupled.

## Environment Variables

```env
NEXT_PUBLIC_APP_NAME=Marvéo
NEXT_PUBLIC_CLIENT_NAME=Example Commerce Client
NEXT_PUBLIC_CLIENT_LOGO=https://cms.example.com/wp-content/uploads/logo.png
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#14B8A6
NEXT_PUBLIC_CLIENT_SECONDARY_COLOR=#A3E635

# Headless mode: separate frontend and WordPress/WooCommerce instances
MARVEO_DEPLOYMENT_MODE=headless
NEXT_PUBLIC_FRONTEND_URL=https://www.example.com

# WordPress and WooCommerce on separate domains
WORDPRESS_API_URL=https://cms.example.com/wp-json
WOOCOMMERCE_API_URL=https://shop.example.com/wp-json
WORDPRESS_ADMIN_URL=https://cms.example.com/wp-admin
WORDPRESS_MEDIA_URL=https://cms.example.com/wp-content/uploads

# WooCommerce REST API credentials
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxx

# Optional modules enabled for this client
ACTIVE_MODULES=inventory,crm,analytics

# License key for this deployment
LICENSE_KEY=CLIENT-001

NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_BRAND_BYLINE=A product by Avario Digital Products
```

## Notes

- **Headless mode** means the storefront is separate from the WordPress/WooCommerce backend.
- CMS content is served from `cms.example.com`, commerce from `shop.example.com`.
- The "View Store" link in the sidebar will point to `NEXT_PUBLIC_FRONTEND_URL`.
- Optional modules `inventory`, `crm`, and `analytics` are enabled.
