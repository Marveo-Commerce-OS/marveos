# First-Time Setup: Security Model & CTO Design

## The Problem

When a new client deploys Marvéo for the first time, we face a **bootstrap paradox**:

1. **Access Control**: Only a super admin should be able to set up Marvéo
2. **Chicken-and-Egg**: We need admin access to create the first Marvéo user, but who creates the admin?
3. **Disaster Recovery**: If the Marvéo connector breaks, we must still have a way to recover access

**Risk Analysis:**
- ❌ Allow unauthenticated setup → Anyone can create admin account
- ❌ Require WordPress admin login → If connector breaks, setup is impossible
- ❌ Email verification only → Not secure enough for operations platform
- ❌ Shared credentials → Violates principle of least privilege

## Recommended Solution: Multi-Factor Bootstrap

This approach combines **temporary activation tokens**, **WordPress admin verification**, and **audit logging** to achieve both security and recoverability.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FIRST-TIME SETUP FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

1. CLIENT INSTALLS PLUGIN
   │
   ├─→ WordPress admin dashboard
   │   └─→ Plugins → Install "Marvéo Connector"
   │
   └─→ Activation triggers:
       ├─→ Create unique SITE_ID
       ├─→ Generate 32-char ACTIVATION_TOKEN (valid 24h)
       ├─→ Store in wp_options (encrypted)
       └─→ Display admin notice with token

2. CLIENT VISITS MARVÉO DEPLOYMENT
   │
   ├─→ Marvéo portal detects first-time (no users)
   │   └─→ Redirects to /setup/activate
   │
   └─→ Setup form requires:
       ├─→ Activation Token (from WordPress admin notice)
       ├─→ WordPress Admin Email (for verification)
       └─→ Desired Marvéo Username & Password

3. MARVÉO VALIDATES TOKEN
   │
   ├─→ Backend calls WordPress REST API:
   │   POST /wp-json/marveo/v1/init-admin
   │   Headers: Authorization: Bearer {activation_token}
   │
   └─→ WordPress plugin verifies:
       ├─→ Token exists and valid (not expired)
       ├─→ Request originates from registered Marvéo deployment
       ├─→ No Marvéo user has been created yet (single-use)
       └─→ Token matches no other active deployments

4. SUCCESS: First Marvéo Admin Created
   │
   ├─→ Token marked as consumed (cannot be reused)
   ├─→ User stored in Marvéo database with WordPress ID mapping
   ├─→ Audit log: "First admin created via activation token"
   ├─→ Connector status → "active"
   └─→ Redirect to /portal (user now logged in)

5. RECOVERY: Connector Lost/Broken
   │
   ├─→ If Marvéo becomes inaccessible:
   │   └─→ Admin logs into WordPress directly (wp-admin)
   │
   └─→ WordPress admin area shows:
       ├─→ "Marvéo Connector" status
       ├─→ "Regenerate Activation Token" button (revokes old, creates new)
       ├─→ New 24-hour token displayed
       └─→ Retry setup from step 2
```

## Implementation Details

### Step 1: Plugin Activation (WordPress Side)

**File:** `wp-plugin/marveo-connector/marveo-connector.php`

```php
<?php
// Register activation hook
register_activation_hook( __FILE__, 'marveo_on_plugin_activate' );

function marveo_on_plugin_activate() {
    // Create unique site identifier
    $site_id = wp_generate_uuid4();
    update_option( 'marveo_site_id', $site_id );
    
    // Generate activation token (32 chars, cryptographically secure)
    $activation_token = bin2hex( random_bytes( 16 ) );
    update_option( 'marveo_activation_token', $activation_token );
    
    // Set expiry to 24 hours from now
    $expiry = time() + ( 24 * 60 * 60 );
    update_option( 'marveo_activation_token_expiry', $expiry );
    
    // Mark setup as pending
    update_option( 'marveo_connector_status', 'pending_setup' );
    update_option( 'marveo_activated_at', time() );
    
    // Log activation
    error_log( "Marvéo Connector activated. Site ID: {$site_id}. Token valid until: " . date( 'Y-m-d H:i:s', $expiry ) );
}
?>
```

### Step 2: Admin Notice & Token Display

**In WordPress admin dashboard, immediately after activation:**

```php
add_action( 'admin_notices', 'marveo_activation_notice' );

function marveo_activation_notice() {
    if ( get_option( 'marveo_connector_status' ) !== 'pending_setup' ) {
        return;
    }
    
    $token = get_option( 'marveo_activation_token' );
    $expiry = get_option( 'marveo_activation_token_expiry' );
    $time_left = $expiry - time();
    
    if ( $time_left <= 0 ) {
        $token = null; // Token expired
    }
    
    ?>
    <div class="notice notice-success is-dismissible">
        <h3>🎯 Marvéo Connector Activated</h3>
        <p>Your operations platform is ready to connect.</p>
        
        <?php if ( $token ) : ?>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <strong>Setup Token (valid for <?php echo gmdate( 'H:i', $time_left ); ?>):</strong>
                <code style="display: block; background: white; padding: 10px; margin: 5px 0; font-family: monospace; word-break: break-all;">
                    <?php echo esc_html( $token ); ?>
                </code>
                <small>Copy this token to set up your Marvéo deployment.</small>
            </div>
            
            <p>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=marveo' ) ); ?>" class="button button-primary">
                    Setup Marvéo Portal →
                </a>
            </p>
        <?php else : ?>
            <p style="color: #d32f2f;">Token expired. Go to <strong>Settings > Marvéo Connector</strong> to regenerate.</p>
        <?php endif; ?>
    </div>
    <?php
}
?>
```

### Step 3: Marvéo Setup Route (`/setup/activate`)

**File:** `app/setup/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getConfig } from '@/src/config/client';

export default function SetupPage() {
  const router = useRouter();
  const config = getConfig();
  const [step, setStep] = useState<'token' | 'details'>('token');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call WordPress plugin endpoint with activation token
      const res = await fetch(
        `${config.wordpressApiUrl}/marveo/v1/init-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            username,
            email,
            password,
            marveo_deployment_url: config.frontendUrl,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Setup failed');
      }

      // Token was valid, create local Marvéo admin account
      const setupRes = await fetch('/api/setup/init-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          wp_user_id: res.headers.get('x-wp-user-id'),
        }),
      });

      if (setupRes.ok) {
        router.push('/portal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="backdrop-blur-2xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-2">Marvéo Setup</h1>
        <p className="text-gray-300 text-sm mb-8">Connect to WordPress and create your first admin account</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {step === 'token' ? (
          <form onSubmit={(e) => { e.preventDefault(); setStep('details'); }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Activation Token</label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-gray-400/60"
                placeholder="Paste token from WordPress admin notice"
              />
              <p className="text-xs text-gray-400 mt-2">Find this in your WordPress admin panel after installing the Marvéo Connector plugin.</p>
            </div>
            <button type="submit" className="w-full h-12 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all mt-6">
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Username</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white" />
            </div>
            <button type="submit" disabled={loading} className="w-full h-12 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-60 transition-all mt-6">
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

### Step 4: Disaster Recovery

**If Marvéo is down or connector is broken:**

1. Admin logs into `wordpress-site.com/wp-admin` directly
2. Goes to **Settings > Marvéo Connector**
3. Sees current status and "Regenerate Token" button
4. Clicks to generate new 24-hour token
5. Returns to Marvéo and retries setup

**This ensures:**
- No permanent lock-out
- Audit trail of all setup attempts
- Admin always has a fallback path (WordPress)

## Why This Design Works

| Requirement | How Addressed |
|-------------|---------------|
| **Only admins can set up** | Activation token generated by plugin; must control WordPress site |
| **No permanent lock-out** | Token can be regenerated from WordPress admin |
| **Disaster recovery** | If Marvéo breaks, admin uses WordPress directly |
| **Single-use token** | Token consumed after first setup; prevents accidental re-setup |
| **Audit trail** | Every setup attempt logged with timestamp, token, user |
| **Secure transmission** | Token sent over HTTPS only; tokens are cryptographically random |
| **Time-limited** | Token expires in 24 hours to reduce attack window |
| **No shared passwords** | Each deployment gets unique token; no credentials written anywhere |

## Comparison with Alternatives

### ❌ Approach 1: Magic Link via Email
**Problem:** Email can be intercepted or shared. Not suitable for operations platform.

### ❌ Approach 2: Require WordPress Admin Login
**Problem:** If we need to log into their WordPress, we end up with their credentials. Poor UX and security.

### ❌ Approach 3: Pre-shared Secret in Env Variables
**Problem:** Requires manual setup by developers. Client can't self-serve. Harder to rotate/revoke.

### ✅ Our Approach: Activation Token + WordPress Admin Verification
**Pros:**
- Client self-serves (copies token from WordPress)
- Secure (cryptographically random, time-limited)
- Recoverable (can regenerate if needed)
- Audit trail (all attempts logged)
- No shared credentials

## Security Checklist

- [ ] Activation token is 32+ random bytes (not sequential, not predictable)
- [ ] Token expires in exactly 24 hours (not earlier, not later)
- [ ] Token consumed after first use (SQL `UPDATE` mark as used)
- [ ] WordPress validates token **before** creating admin user
- [ ] Marvéo validates WordPress response (checks user_id, email)
- [ ] Setup logged with: timestamp, token, IP, user-agent
- [ ] Failed setup attempts rate-limited (max 5/min per IP)
- [ ] Token displayed only in WordPress admin (not in URLs, not in email)
- [ ] HTTPS enforced for all token transmission
- [ ] Token regeneration requires WordPress admin authentication

## Implementation Checklist

- [ ] Create `marveo-connector` WordPress plugin (separate repo)
- [ ] Add activation token generation on plugin activation
- [ ] Add `/wp-json/marveo/v1/init-admin` endpoint to plugin
- [ ] Create `/setup/activate` page in Marvéo frontend
- [ ] Create `/api/setup/init-admin` endpoint in Marvéo backend
- [ ] Add setup UI with token entry and admin account creation
- [ ] Add audit logging for all setup attempts
- [ ] Add token regeneration to WordPress admin settings
- [ ] Test: Normal flow (token copied and used)
- [ ] Test: Expired token (handled gracefully)
- [ ] Test: Invalid token (rejected with clear error)
- [ ] Test: Duplicate setup attempt (rejected)
- [ ] Test: Token regeneration (old token invalidated)

## Go-Live Checklist

1. **Pre-Deployment:** Connector plugin tested and working
2. **Documentation:** Client gets clear setup guide with screenshots
3. **Failover:** Support team trained on recovery procedures
4. **Monitoring:** Alert on repeated failed setup attempts
5. **Support:** 24-hour on-call during initial client deployments
