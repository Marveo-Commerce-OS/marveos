import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/src/config/client';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification, sendPlatformFailureAlert } from '@/lib/emailNotifications';
import { generateTempPassword, upsertPasswordEntries } from '@/lib/nativePasswords';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

/**
 * Password reset request endpoint
 * Sends a password reset email to the WordPress user
 * Uses WordPress native password reset flow via /wp-json/wp/v2/users endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email address required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const store = await readAdminStore();
    const nativeEntry = Object.entries(store.nativeAuth.identities).find(([, identity]) => identity.email.trim().toLowerCase() === normalizedEmail);
    const configuredAppBaseUrl = String(store.platformSettings.email.appBaseUrl || process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`).trim();

    if (nativeEntry) {
      const [identityId, identity] = nativeEntry;
      const tempPassword = generateTempPassword();
      const loginUrl = new URL('/master-login', configuredAppBaseUrl).toString();
      const changePasswordUrl = new URL('/master/profile', configuredAppBaseUrl).toString();

      await updateAdminStore((current) => ({
        ...current,
        nativeAuth: {
          ...current.nativeAuth,
          permissions: {
            ...current.nativeAuth.permissions,
            [identityId]: upsertPasswordEntries(current.nativeAuth.permissions[identityId], tempPassword),
          },
        },
      }));

      await sendPlatformEmailNotification({
        templateKey: 'PASSWORD_RESET_REQUESTED',
        to: identity.email,
        variables: {
          userName: identity.name || identity.email,
          appBaseUrl: configuredAppBaseUrl,
          loginUrl,
          changePasswordUrl,
          tempPassword,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a reset email has been sent.',
        redirect: '/login',
      });
    }

    const WP_API_URL = getWpApiUrl();
    
    // Find user by email
    const userSearchRes = await fetch(`${WP_API_URL}/wp/v2/users?search=${encodeURIComponent(email)}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!userSearchRes.ok) {
      // Don't reveal whether email exists (security best practice)
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with that email, a reset link has been sent.' 
      });
    }

    const users = await userSearchRes.json();
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with that email, a reset link has been sent.' 
      });
    }

    const user = users[0];
    if (!user.email) {
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with that email, a reset link has been sent.' 
      });
    }

    // Use WordPress native lost-password form action (works on all WP installs)
    const siteUrl = WP_API_URL.replace(/\/wp-json\/?$/, '');
    const formData = new URLSearchParams();
    formData.set('user_login', user.email);
    formData.set('redirect_to', '');
    formData.set('wp-submit', 'Get New Password');

    const lostPasswordRes = await fetch(`${siteUrl}/wp-login.php?action=lostpassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      redirect: 'manual', // WP redirects on success; treat any non-5xx as OK
    }).catch(() => null);

    if (lostPasswordRes && lostPasswordRes.status >= 500) {
      console.error(`Lost password request failed with status ${lostPasswordRes.status} for user ${user.id}`);
      await sendPlatformFailureAlert({
        failureType: 'PASSWORD_RESET_REQUEST_FAILED',
        errorMessage: `WordPress lost-password endpoint returned ${lostPasswordRes.status}`,
        operationName: 'auth.forgot-password',
      });
    } else {
      await sendPlatformEmailNotification({
        templateKey: 'PASSWORD_RESET_REQUESTED',
        to: user.email,
        variables: {
          userName: user?.name || user.email,
          appBaseUrl: configuredAppBaseUrl,
          loginUrl: new URL('/login', configuredAppBaseUrl).toString(),
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists with that email, a reset link has been sent.',
      redirect: '/login',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    await sendPlatformFailureAlert({
      failureType: 'PASSWORD_RESET_REQUEST_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      operationName: 'auth.forgot-password',
    });
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
