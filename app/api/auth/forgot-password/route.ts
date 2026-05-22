import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/src/config/client';
import nodemailer from 'nodemailer';

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
    }

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists with that email, a reset link has been sent.',
      redirect: '/login',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
