# User Registration & Account Management

## Overview

Marvéo is an **operations-only platform** designed for store administrators and managers. Unlike a public storefront, registration should be **controlled and invitation-only**.

## Current Model: Admin-Invite Only (v1.0)

### Why No Public Registration?

1. **Security**: This is an operations dashboard, not a consumer app
2. **Access Control**: Only authorized staff should have access
3. **Data Sensitivity**: Financial data, customer info, orders are shown
4. **Compliance**: Controlled access is required for audit trails
5. **Support**: Easier to manage user base without self-service signup

### Current User Management Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    USER MANAGEMENT IN MARVÉO                   │
└────────────────────────────────────────────────────────────────┘

1. CREATE USER IN WORDPRESS
   └─→ WordPress Admin
       └─→ Users → Add New User
       └─→ Set role: Administrator or Shop Manager
       └─→ Send WordPress login credentials to user

2. FIRST LOGIN TO MARVÉO
   └─→ User visits /login
   └─→ Enters WordPress username + password
   └─→ Marvéo verifies via WordPress JWT endpoint
   └─→ User gets Marvéo dashboard access

3. MANAGE USER PERMISSIONS
   └─→ In WordPress: Change user role or deactivate
   └─→ Marvéo respects WordPress permissions (reads from user profile)
   └─→ Deactivated users: admins can disable in admin store settings

RESULT: User management is centralized in WordPress, not Marvéo
```

### How It Works Today

1. **WordPress is the source of truth**
   - Users are created in WordPress admin only
   - Roles define access: `administrator` or `shop_manager`
   - User deactivation managed in Marvéo admin settings

2. **Marvéo reads from WordPress**
   - Login calls WordPress JWT endpoint
   - Checks user roles on each session
   - Respects WordPress user lifecycle

## Registration: Design Decision

### ❌ Public Registration (NOT RECOMMENDED)
**Problem:** Anyone can sign up → major security risk

### ❌ Registration Link / Invite Code
**Problem:** Additional system to manage. Duplication of WordPress.

### ✅ Create Users in WordPress Admin (RECOMMENDED)
**Solution:** Admins create users where they already manage the store

**Benefits:**
- Single source of truth (WordPress)
- No duplicate user databases
- Admins already know WordPress
- Integrates with existing WordPress workflow
- Centralized permissions/roles management

## Future: Self-Service Portal (Roadmap)

**Phase 3 (v2.0):** Consider adding an admin-controlled invite system:

```
┌─────────────────────────┐
│  Marvéo Admin Panel     │
├─────────────────────────┤
│ Users Section:          │
│  ├─ Active Users (5)    │
│  ├─ Pending Invites (2) │
│  └─ [Invite User] btn   │
└─────────────────────────┘
        │
        ↓
  [Invite Form]
    email: __________
    role: [dropdown]
    [Send Invite]
        │
        ↓
  Email sent with link:
  https://app.marveo.com/invite/token123
        │
        ↓
  User clicks → [Accept & Create Password]
        │
        ↓
  User now active in Marvéo
```

**This approach:**
- Allows Marvéo admins to invite staff
- Still requires verification (email)
- Creates user accounts in WordPress via API
- No public registration

**Implementation complexity:** Medium (requires invite management DB table, email queue, token validation)

## Current Best Practice

### For Store Admins

1. **Create user in WordPress first:**
   - WordPress Admin → Users → Add New
   - Set username, email, password (or send reset link)
   - Assign role: Administrator or Shop Manager
   - Save

2. **Share WordPress credentials:**
   - Email username to new user
   - Include login URL: `https://yoursite.com/wp-admin`
   - User sets their own password via reset link

3. **User then logs into Marvéo:**
   - Visit Marvéo portal
   - Enter same WordPress username + password
   - Now has dashboard access
   - Can change password in WordPress

### For Developers (Multi-Site)

If you need to programmatically create users:

```php
$user_id = wp_create_user(
    'username',
    'password',
    'email@example.com'
);

// Set role
$user = new WP_User( $user_id );
$user->set_role( 'administrator' );
// or
$user->set_role( 'shop_manager' );
```

## Account Settings & Changes

### Updating User Profile

User can update their own info via WordPress profile page:
- Name
- Email
- Password
- Avatar

Then these changes are reflected in Marvéo on next login.

### Disabling a User

**Option 1: WordPress Admin**
- Go to Users → find user
- Click Edit
- Uncheck "Subscriber" (removes all roles)
- User loses access

**Option 2: Marvéo Admin Panel** (future)
- Settings → Users
- Toggle "Active" status
- Checks admin store setting in Marvéo

### Deleting a User

**Option 1: WordPress Admin**
- Users → find user → Delete
- Choose: Delete user & reassign posts
- User fully removed

**Option 2: Marvéo Admin Panel** (future)
- Settings → Users → Remove User
- Confirmation dialog
- User deleted (calls WordPress API)

## Security & Compliance

### Password Requirements
- Managed by WordPress password policy
- Can enforce strong passwords via plugin

### Session Management
- JWT tokens valid for 7 days (configurable)
- HttpOnly cookies prevent XSS access
- Tokens expire on logout

### Audit Logging
- Every login attempt logged
- Failed attempts tracked for rate limiting
- User actions can be logged per phase 2

## FAQ

**Q: Can users register themselves for Marvéo?**
A: Not in v1.0. Users must be created in WordPress admin. This is intentional for security.

**Q: What if we want self-service registration?**
A: We can build an admin-controlled invite system (Phase 3). Not public registration, but invite-based.

**Q: Can we send password reset links?**
A: Yes, users can use "Forgot Password" on login page. It uses WordPress password reset flow.

**Q: What roles can access Marvéo?**
A: Currently: `administrator` and `shop_manager`. Can be expanded if needed.

**Q: How do we bulk import users?**
A: Via WP-CLI or plugin. Example:
```bash
wp user import-csv users.csv
```

**Q: Can we set different permission levels?**
A: Not in v1.0. Role-based access (Admin vs Manager) is determined by WordPress role.
Future (v2.0): Per-module permissions, feature flags per user.

## Roadmap

| Version | Feature | Status |
|---------|---------|--------|
| v1.0 | WordPress-based user management | ✅ Done |
| v1.0 | Login with WordPress credentials | ✅ Done |
| v1.0 | Password reset flow | ✅ Done |
| v1.5 | User disable/enable in Marvéo | 🚧 Planned |
| v2.0 | Admin invite system | 📋 Roadmap |
| v2.0 | Per-module role permissions | 📋 Roadmap |
| v2.5 | User activity logging & audit trail | 📋 Roadmap |

## Implementation Notes

If you want to implement invite system early:

1. **Create invite table:**
```sql
CREATE TABLE marveo_user_invites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'shop_manager',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP NULL,
  created_by INT,
  FOREIGN KEY (created_by) REFERENCES wp_users(ID)
);
```

2. **Create invite endpoint:**
```
POST /api/admin/users/invite
Body: { email, role }
Response: { invite_link, expires_in }
```

3. **Create acceptance endpoint:**
```
POST /api/auth/accept-invite
Body: { token, password }
Response: { success, user_id }
```

This is **not implemented yet** but architecture is ready for it.
