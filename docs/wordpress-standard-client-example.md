# Client Example: Standard WordPress/WooCommerce Store

This example shows how to configure a Marvéo deployment for a standard WordPress client where WordPress, WooCommerce, and the storefront all live on the same domain.

## Environment Variables

```env
NEXT_PUBLIC_APP_NAME=Marvéo
NEXT_PUBLIC_CLIENT_NAME=Example Store
NEXT_PUBLIC_CLIENT_LOGO=https://examplestore.com/wp-content/uploads/logo.png
NEXT_PUBLIC_CLIENT_PRIMARY_COLOR=#14B8A6
NEXT_PUBLIC_CLIENT_SECONDARY_COLOR=#A3E635

# WordPress mode: all services on the same domain
MARVEO_DEPLOYMENT_MODE=wordpress
NEXT_PUBLIC_FRONTEND_URL=https://examplestore.com

# WordPress and WooCommerce on the same domain
WORDPRESS_API_URL=https://examplestore.com/wp-json
WOOCOMMERCE_API_URL=https://examplestore.com/wp-json
WORDPRESS_ADMIN_URL=https://examplestore.com/wp-admin
WORDPRESS_MEDIA_URL=https://examplestore.com/wp-content/uploads

# WooCommerce REST API credentials
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxx

# Optional modules enabled for this client
ACTIVE_MODULES=inventory,crm

# License key for this deployment
LICENSE_KEY=EXAMPLE-001

NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_BRAND_BYLINE=A product by Avario Digital Products
```

## Notes

- **WordPress mode** means the storefront, WordPress, and WooCommerce all use the same base URL.
- The Marvéo dashboard serves as the operations layer; clients continue to use their existing WooCommerce storefront.
- WordPress admin (`wp-admin`) is still available for technical tasks but day-to-day operations happen in Marvéo.
- Optional modules `inventory` and `crm` are enabled for this client.
