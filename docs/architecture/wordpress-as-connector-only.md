# WordPress As Connector Only

## Direction
WordPress is an optional integration module for CMS/commerce sync, not the operational platform core.

## Allowed Responsibilities
WordPress may provide:
- optional connector activation and handshake
- optional CMS content integration
- optional WooCommerce integration

## Disallowed Responsibilities
WordPress must not be the source of truth for:
- Marveo auth and session control
- platform user/role governance
- organization lifecycle
- subscription lifecycle
- Master settings
- support ownership
- audit ledger

## Boundary Contract
At the boundary:
- map WordPress roles to Marveo-native roles
- import bridge identity metadata
- tag bridge sessions as source=WORDPRESS_BRIDGE

Inside platform core:
- enforce Marveo-native roles only
- read/write platform-native store only

## Connector Isolation Guarantees
Master must remain operational when:
- zero websites are connected
- connector status is NOT_CONNECTED
- WordPress endpoints are unreachable

Expected behavior in this state:
- billing/team/templates/workspaces/support still function on native records
- connector pages show integration status without blocking core operations

## Migration Path
1. Keep WordPress JWT bridge as temporary compatibility path.
2. Move internal operators to native credentials and native session issuance.
3. Retire bridge cookies (admin_token/admin_user) after migration completion.
