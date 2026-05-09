# Marvéo — CTO Handoff Report

**Generated after:** `rebrand: PRAG → Marvéo, add config layer, module system, service layer, docs`  
**Commit:** `24800f4`

---

## 1. Current Branch
`development`

## 2. Remote URL
`https://github.com/marveocommerce/marveos.git`

## 3. Branches Confirmed
| Branch | Status |
|--------|--------|
| `development` | ✅ Active working branch |
| `staging` | ✅ Created from development |
| `main` | ✅ Created (production target) |
| `master` | Legacy — was the original default branch |

**Recommended next step:** Set `development` as default branch in GitHub settings and protect `staging` and `main`.

## 4. Marvéo Product Rename — Complete
- `package.json`: `"name": "marveos"`, `"author": "Avario Digital Products"`
- `app/layout.tsx`: metadata title/description updated to Marvéo
- `app/login/page.tsx`: config-driven branding, no hardcoded PRAG logo
- `app/portal/page.tsx`: all PRAG references removed, Marvéo identity applied
- `components/Sidebar.tsx`: config-driven logo, colors, nav
- `README.md`: fully rewritten as Marvéo product documentation

## 5. Plugin Renamed / Cleaned
- WordPress plugin references to `prag-core` remain in `lib/adminStore.ts` (`prag-core/v1/admin-config` endpoint)
- **Action required:** Rename the WordPress plugin from `prag-core` to `marveo-core` in the WordPress codebase and update the endpoint reference in `lib/adminStore.ts`

## 6. PRAG Hardcoding Removed
All scattered `const WP_API_URL = 'https://central.prag.global/wp-json'` references have been removed from:
- `lib/api.ts`
- `lib/auth.ts`
- `lib/adminStore.ts`
- `app/api/auth/login/route.ts`
- `app/api/admin/wp-admin-email/route.ts`
- `app/api/reports/export/route.ts`
- `app/api/media/upload/route.ts`
- `app/dashboard/blog/[id]/page.tsx`
- `next.config.ts` (removed prag.global image domains)

**Remaining:** `lib/adminStore.ts` still calls `prag-core/v1/admin-config` — functional but branded PRAG.

## 7. Deployment Modes Added
Two modes supported via `MARVEO_DEPLOYMENT_MODE` env var:
- `wordpress` — standard: WordPress + WooCommerce on same domain
- `headless` — decoupled: separate CMS and commerce domains

Defined in `src/config/client.ts` as `DeploymentMode` type.

## 8. CMS / Content Management Foundation
- WordPress REST API service layer: `src/services/wordpress.ts`
  - `getPosts`, `getPost`, `createPost`, `updatePost`, `deletePost`
  - `getPages`, `getPage`, `updatePage`
  - `getMedia`, `getMediaItem`
- Blog management UI: `app/dashboard/blog/`
- Media upload: `app/api/media/upload/route.ts`
- Docs: `docs/cms-content-management.md`

## 9. Rich Text Editor — Blocked by React 19
- `react-quill`, `react-draft-wysiwyg`, and `draft-js` are all **incompatible with React 19.2.4**
- All editor dependencies have been removed from `package.json`
- Blog post editing currently uses a plain `<textarea>` for HTML content
- **Action required:** Monitor ecosystem. When a React 19-compatible rich text editor is available (e.g., Lexical from Meta, or Tiptap with React 19 support), install and integrate it.

## 10. Page Editing Support
- `getPages`, `getPage`, `updatePage` added to `src/services/wordpress.ts`
- Dashboard page routes scaffold in place

## 11. Blog Editing Support
- Full blog CRUD in `app/dashboard/blog/`
- Blog API via `app/api/posts/route.ts`
- `PostStatusToggle` component for draft/publish toggle
- Blog included in Sidebar navigation

## 12. Media Support
- Upload endpoint: `app/api/media/upload/route.ts`
- `getMedia`, `getMediaItem` in WordPress service layer
- `next.config.ts` updated to allow generic image domains (not PRAG-specific)

## 13. Module System Added
- `src/lib/modules.ts` — module activation and registration
- **Core modules** (always active): dashboard, cms, pages, blog, media, products, orders, customers, reports, settings
- **Optional modules** (activated via `ACTIVE_MODULES` env var): inventory, crm, analytics, ai-insights, whatsapp, procurement, branches
- Docs: `docs/modules.md`

## 14. Dynamic Navigation Added
- `components/Sidebar.tsx` uses `shouldShowInNavigation(moduleKey)` to conditionally show nav items
- Nav items are driven by module activation, not hardcoded lists
- Active item accent uses `config.clientPrimaryColor`

## 15. API Service Layer Cleaned
- `src/services/wordpress.ts` — typed WordPress API calls
- `src/services/woocommerce.ts` — typed WooCommerce API calls
  - `getProducts`, `getProduct`, `createProduct`, `updateProduct`
  - `getOrders`, `getOrder`, `updateOrderStatus`
  - `getCustomers`, `getCustomer`
- `src/config/client.ts` — single source of truth for all env vars and config
- `lib/api.ts` updated to use config helpers instead of scattered `process.env` calls

## 16. Documentation Created / Updated
| File | Status |
|------|--------|
| `README.md` | ✅ Full rewrite — Marvéo product overview |
| `docs/modules.md` | ✅ New — module activation reference |
| `docs/cms-content-management.md` | ✅ New — CMS/blog/media docs |
| `docs/deployment.md` | ✅ New — branch strategy, Vercel, env vars |
| `docs/client-prag-example.md` | ✅ New — headless client config example |
| `docs/wordpress-standard-client-example.md` | ✅ New — standard WordPress client config example |
| `.env.example` | ✅ New — all required env vars with comments |

## 17. Build & Lint Results
- `npm run build` — ✅ **PASSING** (Turbopack, all routes compiled)
- TypeScript — ✅ **No type errors**
- All routes compile: `/login`, `/portal`, `/dashboard/*`, all `/api/*` endpoints

## 18. Remaining Risks & Manual Actions Required

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | WordPress plugin rename (`prag-core` → `marveo-core`) | HIGH | Requires changes to WordPress plugin repo. Update `lib/adminStore.ts` endpoint after rename. |
| 2 | Rich text editor | MEDIUM | Blocked by React 19 incompatibility. Monitor Lexical/Tiptap for React 19 support. |
| 3 | `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` env var names | LOW | Some API routes use old `WC_CONSUMER_KEY` names. `.env.example` uses `WOOCOMMERCE_CONSUMER_KEY`. Standardize or alias in env files. |
| 4 | `master` branch cleanup | LOW | Consider deleting `master` or setting `development` as default on GitHub. |
| 5 | Push branches to remote | ACTION | Run `git push origin development staging main` to publish branches. |
| 6 | License system | FUTURE | `LICENSE_KEY` env var defined but no license enforcement logic yet. |
| 7 | Inventory / CRM / Analytics modules | FUTURE | Optional modules defined in system but UI not yet built. |
| 8 | Page builder | FUTURE | Full drag-and-drop page builder is out of scope for current foundation. |

---

**Build commit:** `24800f4`  
**Prepared by:** GitHub Copilot  
**Product:** Marvéo by Avario Digital Products
