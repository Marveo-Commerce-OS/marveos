'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type AccountPlan = 'starter' | 'business' | 'enterprise';
type PaymentProvider = 'NONE' | 'PAYSTACK' | 'STRIPE';
type PaymentMode = 'sandbox' | 'live';
type GatewayProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'CUSTOM' | 'STRIPE' | 'PAYPAL';
type MarketKey = 'NG' | 'GB' | 'AE' | 'CA' | 'US' | 'AFRICA_OTHER';
type CurrencyCode = 'USD' | 'GBP' | 'NGN';
type EmailProvider = 'SMTP' | 'RESEND' | 'SES_SMTP' | 'WORDPRESS_MAILER';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type SetupType = 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
type MarveoRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SUPPORT_OFFICER'
  | 'DEPLOYMENT_MANAGER'
  | 'BILLING_MANAGER'
  | 'CLIENT_OWNER'
  | 'CLIENT_STAFF';

type AdminModuleKey =
  | 'overview'
  | 'clients'
  | 'workspaces'
  | 'deploymentQueue'
  | 'supportQueue'
  | 'launchReadiness'
  | 'connectors'
  | 'templates'
  | 'team'
  | 'plansBilling'
  | 'reports'
  | 'analytics'
  | 'auditLogs'
  | 'systemSettings';

type EmailTemplateKey =
  | 'CLIENT_SIGNUP'
  | 'CLIENT_DEPLOYED'
  | 'DEPLOYMENT_FAILED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'BILLING_NOTICE'
  | 'BILLING_SUSPENDED'
  | 'BILLING_REACTIVATED'
  | 'USER_INVITE'
  | 'USER_STATUS_CHANGED'
  | 'SUPPORT_ASSIGNED'
  | 'CONNECTOR_FAILED'
  | 'SYSTEM_FAILURE_ALERT';

type SettingsResponse = {
  accountPlan: AccountPlan;
  trialDefaults: {
    trialEnabled: boolean;
    trialDurationDays: number;
  };
  platformSettings: {
    trialDurationDays: number;
    pricingVisibility: 'PUBLIC' | 'INTERNAL';
    regionalPricingEnabled: boolean;
    paymentProvider: {
      provider: PaymentProvider;
      mode: PaymentMode;
      configured: boolean;
      publishableKeyRef: string;
      secretKeyRef: string;
      webhookSecretRef: string;
      webhookUrl: string;
      webhookConfigured: boolean;
      merchantDisplayName: string;
      settlementCurrency: string;
      autoCapture: boolean;
      require3DS: boolean;
    };
    paymentProviders: Record<GatewayProvider, {
      enabled: boolean;
      configured: boolean;
      mode: PaymentMode;
      priority: number;
      applicableMarkets: MarketKey[];
      settlementCurrencies: CurrencyCode[];
      publishableKeyRef: string;
      secretKeyRef: string;
      webhookSecretRef: string;
      webhookUrl: string;
      customEndpoint: string;
    }>;
    billingCurrencyPolicy: {
      basePricingCurrency: CurrencyCode;
      autoConvertFromBase: boolean;
      countryCurrencyMap: Record<MarketKey, CurrencyCode>;
      fxRates: {
        USD: number;
        GBP: number;
        NGN: number;
      };
    };
    demoMode: {
      enabled: boolean;
      allowOperationalMutations: boolean;
    };
    templatePublishRules: {
      requireArtifactValidation: boolean;
      requireSupportApproval: boolean;
    };
    supportDefaults: {
      defaultPriority: Priority;
      defaultSetupType: SetupType;
      defaultAssigneeId: string | null;
    };
    branding: {
      brandName: string;
      brandByline: string;
      logoUrl: string;
      dashboardLogoUrl: string;
      portalLoginLogoUrl: string;
      faviconUrl: string;
      footerLogoUrl: string;
      primaryColor: string;
      secondaryColor: string;
      websiteUrl: string;
      footerAddressLine: string;
      footerDescription: string;
      footerBadgeText: string;
      footerStatusLabel: string;
      footerStatusUrl: string;
      footerDocsLabel: string;
      footerDocsUrl: string;
      footerGdprLabel: string;
      footerGdprUrl: string;
      footerUnsubscribeLabel: string;
      footerUnsubscribeUrl: string;
    };
    email: {
      enabled: boolean;
      provider: EmailProvider;
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      fromEmail: string;
      fromName: string;
      replyToEmail: string;
      appBaseUrl: string;
      apiBaseUrl: string;
      supportPortalUrl: string;
      supportEmail: string;
      billingEmail: string;
      deploymentEmail: string;
      userOpsEmail: string;
      sendFailureAlerts: boolean;
      failureAlertRecipients: string[];
    };
    emailTemplates: Record<EmailTemplateKey, {
      enabled: boolean;
      subject: string;
      preheader: string;
      html: string;
      text: string;
    }>;
  };
  supportOfficerPoolSize: number;
};

type TeamUserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rawAuthRole?: string | null;
  assignedWorkspaceId?: string | null;
  assignedClientOrganizationId?: string | null;
  source?: 'native' | 'wordpress_bridge' | 'invite_scaffold';
  normalizedRole: MarveoRole | null;
  controlCenterAccess?: boolean;
  controlCenterModules?: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  active: boolean;
};

type UsersApiResponse = {
  users: TeamUserRow[];
  marveoRoles: MarveoRole[];
  error?: string;
};

type AccessControlResponse = {
  roles: MarveoRole[];
  modules: AdminModuleKey[];
  roleModuleVisibility: Record<MarveoRole, Record<AdminModuleKey, boolean>>;
  error?: string;
};

const MENU = [
  { key: 'general', label: 'General' },
  { key: 'payments', label: 'Payment Settings' },
  { key: 'email', label: 'Email Settings' },
  { key: 'access', label: 'Access Control' },
] as const;

const PROVIDER_KEYS: GatewayProvider[] = ['PAYSTACK', 'FLUTTERWAVE', 'CUSTOM', 'STRIPE', 'PAYPAL'];
const MARKET_KEYS: MarketKey[] = ['NG', 'GB', 'AE', 'CA', 'US', 'AFRICA_OTHER'];
const CURRENCY_KEYS: CurrencyCode[] = ['USD', 'GBP', 'NGN'];
const EMAIL_TEMPLATE_KEYS: EmailTemplateKey[] = [
  'CLIENT_SIGNUP',
  'CLIENT_DEPLOYED',
  'DEPLOYMENT_FAILED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_CHANGED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'BILLING_NOTICE',
  'BILLING_SUSPENDED',
  'BILLING_REACTIVATED',
  'USER_INVITE',
  'USER_STATUS_CHANGED',
  'SUPPORT_ASSIGNED',
  'CONNECTOR_FAILED',
  'SYSTEM_FAILURE_ALERT',
];

const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  CLIENT_SIGNUP: 'Client Signup',
  CLIENT_DEPLOYED: 'Client Deployment',
  DEPLOYMENT_FAILED: 'Deployment Failed',
  PASSWORD_RESET_REQUESTED: 'Password Reset Requested',
  PASSWORD_CHANGED: 'Password Changed',
  PAYMENT_RECEIVED: 'Payment Received',
  PAYMENT_FAILED: 'Payment Failed',
  BILLING_NOTICE: 'Billing Notice',
  BILLING_SUSPENDED: 'Billing Suspended',
  BILLING_REACTIVATED: 'Billing Reactivated',
  USER_INVITE: 'User Invite',
  USER_STATUS_CHANGED: 'User Status Changed',
  SUPPORT_ASSIGNED: 'Support Assigned',
  CONNECTOR_FAILED: 'Connector Failed',
  SYSTEM_FAILURE_ALERT: 'System Failure Alert',
};
const MARKET_LABELS: Record<MarketKey, string> = {
  NG: 'Nigeria',
  GB: 'United Kingdom',
  AE: 'UAE',
  CA: 'Canada',
  US: 'United States',
  AFRICA_OTHER: 'Other African Countries',
};

type SectionKey = (typeof MENU)[number]['key'];

function toLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function MasterSystemSettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('general');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [dashboardLogoUploading, setDashboardLogoUploading] = useState(false);
  const [portalLoginLogoUploading, setPortalLoginLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [footerLogoUploading, setFooterLogoUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<SettingsResponse | null>(null);

  const [accessLoading, setAccessLoading] = useState(true);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessNotice, setAccessNotice] = useState('');
  const [usersPayload, setUsersPayload] = useState<UsersApiResponse | null>(null);
  const [accessPayload, setAccessPayload] = useState<AccessControlResponse | null>(null);
  const [inviteRole, setInviteRole] = useState<MarveoRole>('SUPPORT_OFFICER');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [inviteClientOrgId, setInviteClientOrgId] = useState('');
  const [inviteAvatarUrl, setInviteAvatarUrl] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    email: '',
    assignedWorkspaceId: '',
    assignedClientOrganizationId: '',
    rawAuthRole: '',
    avatarUrl: '',
  });
  const [previewTemplateKey, setPreviewTemplateKey] = useState<EmailTemplateKey>('CLIENT_SIGNUP');
  const [previewVariablesJson, setPreviewVariablesJson] = useState('{\n  "clientName": "Acme Stores",\n  "workspaceName": "acme-main",\n  "appBaseUrl": "https://app.marveo.com"\n}');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewPayload, setPreviewPayload] = useState<{
    subject: string;
    preheader: string;
    html: string;
    text: string;
  } | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState('');
  const [testNotice, setTestNotice] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestError, setSmtpTestError] = useState('');
  const [smtpTestNotice, setSmtpTestNotice] = useState('');
  const [dbHealthLoading, setDbHealthLoading] = useState(false);
  const [dbSmokeLoading, setDbSmokeLoading] = useState(false);
  const [dbHealthError, setDbHealthError] = useState('');
  const [dbHealthNotice, setDbHealthNotice] = useState('');
  const [dbHealth, setDbHealth] = useState<{
    backend: string;
    postgresConfigured: boolean;
    postgresHost: string;
    postgresTable: string;
    postgresKey: string;
    hasPlatformSettings?: boolean;
    workspaceCount?: number;
    checkedAt?: string;
  } | null>(null);

  useEffect(() => {
    void loadSettings();
    void loadAccessControl();
    void loadDbHealth();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/master/system-settings', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as (SettingsResponse & { error?: string }) | null;
      if (!res.ok || !body) {
        throw new Error(body?.error || 'Failed to load system settings.');
      }
      setData(body);
      setTestRecipient((prev) => prev || body.platformSettings.email.fromEmail || body.platformSettings.email.username || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system settings.');
    } finally {
      setLoading(false);
    }
  }

  function parsePreviewVariables(): Record<string, string | number | boolean | null> {
    if (!previewVariablesJson.trim()) {
      return {};
    }

    const parsed = JSON.parse(previewVariablesJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Preview variables must be a JSON object.');
    }

    return parsed as Record<string, string | number | boolean | null>;
  }

  async function loadAccessControl() {
    setAccessLoading(true);
    setAccessError('');
    try {
      const [accessRes, usersRes] = await Promise.all([
        fetch('/api/master/access-control', { cache: 'no-store' }),
        fetch('/api/master/users', { cache: 'no-store' }),
      ]);

      const accessBody = (await accessRes.json().catch(() => null)) as AccessControlResponse | null;
      const usersBody = (await usersRes.json().catch(() => null)) as UsersApiResponse | null;

      if (!accessRes.ok || !accessBody) {
        throw new Error(accessBody?.error || 'Failed to load access control matrix.');
      }
      if (!usersRes.ok || !usersBody) {
        throw new Error(usersBody?.error || 'Failed to load users.');
      }

      setAccessPayload(accessBody);
      setUsersPayload(usersBody);
      if (usersBody.marveoRoles.length > 0) {
        setInviteRole(usersBody.marveoRoles[0]);
      }
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to load access control data.');
    } finally {
      setAccessLoading(false);
    }
  }

  async function saveSystemSettings() {
    if (!data) return;
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        accountPlan: data.accountPlan,
        trialDurationDays: data.platformSettings.trialDurationDays,
        pricingVisibility: data.platformSettings.pricingVisibility,
        regionalPricingEnabled: data.platformSettings.regionalPricingEnabled,
        paymentProvider: data.platformSettings.paymentProvider,
        paymentProviders: data.platformSettings.paymentProviders,
        billingCurrencyPolicy: data.platformSettings.billingCurrencyPolicy,
        demoMode: data.platformSettings.demoMode,
        templatePublishRules: data.platformSettings.templatePublishRules,
        supportDefaults: data.platformSettings.supportDefaults,
        branding: data.platformSettings.branding,
        email: data.platformSettings.email,
        emailTemplates: data.platformSettings.emailTemplates,
        trialDefaults: data.trialDefaults,
      };

      const res = await fetch('/api/master/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as (SettingsResponse & { ok?: boolean; error?: string }) | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to save system settings.');
      }

      setData((prev) => (prev ? {
        ...prev,
        accountPlan: body.accountPlan,
        platformSettings: body.platformSettings,
        trialDefaults: body.trialDefaults,
      } : prev));
      setNotice('System settings saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save system settings.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAccessControl() {
    if (!accessPayload) return;
    setAccessSaving(true);
    setAccessError('');
    setAccessNotice('');

    try {
      const res = await fetch('/api/master/access-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleModuleVisibility: accessPayload.roleModuleVisibility }),
      });
      const body = (await res.json().catch(() => null)) as AccessControlResponse & { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to save access control settings.');
      }

      setAccessPayload({
        roles: body.roles,
        modules: body.modules,
        roleModuleVisibility: body.roleModuleVisibility,
      });
      setAccessNotice('Access control matrix updated.');
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to save access control settings.');
    } finally {
      setAccessSaving(false);
    }
  }

  async function updateUser(userId: string, patch: { masterRole?: MarveoRole | null; status?: 'ACTIVE' | 'INVITED' | 'DISABLED' }) {
    setBusyUserId(userId);
    setAccessError('');
    setAccessNotice('');

    try {
      const res = await fetch('/api/master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...(patch.masterRole ? { masterRole: patch.masterRole } : {}),
          ...(patch.status ? { status: patch.status } : {}),
        }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to update user role/status.');
      }

      setAccessNotice('User role/status updated.');
      await loadAccessControl();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to update user role/status.');
    } finally {
      setBusyUserId('');
    }
  }

  async function createPendingUser() {
    setBusyUserId('invite');
    setAccessError('');
    setAccessNotice('');

    try {
      const name = inviteName.trim();
      const email = inviteEmail.trim();
      if (!name) throw new Error('Name is required.');
      if (!email) throw new Error('Email is required.');

      const res = await fetch('/api/master/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterRole: inviteRole,
          name,
          email,
          avatarUrl: inviteAvatarUrl.trim() || undefined,
          assignedWorkspaceId: inviteWorkspaceId.trim() || undefined,
          assignedClientOrganizationId: inviteClientOrgId.trim() || undefined,
        }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; inviteId?: string } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to create pending user.');
      }

      setAccessNotice(`Staged user created and invite sent to ${email.toLowerCase()}.`);
      setInviteName('');
      setInviteEmail('');
      setInviteWorkspaceId('');
      setInviteClientOrgId('');
      setInviteAvatarUrl('');
      await loadAccessControl();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to create pending user.');
    } finally {
      setBusyUserId('');
    }
  }

  async function uploadMedia(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || 'Upload failed');
    }
    const media = (await res.json().catch(() => null)) as { source_url?: string } | null;
    if (!media?.source_url) throw new Error('Upload failed');
    return media.source_url;
  }

  async function saveUserProfile(userId: string) {
    setBusyUserId(userId);
    setAccessError('');
    setAccessNotice('');

    try {
      const name = editDraft.name.trim();
      const email = editDraft.email.trim();
      if (!name) throw new Error('Name is required.');
      if (!email) throw new Error('Email is required.');

      const res = await fetch('/api/master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name,
          email,
          rawAuthRole: editDraft.rawAuthRole.trim() || undefined,
          assignedWorkspaceId: editDraft.assignedWorkspaceId.trim() || undefined,
          assignedClientOrganizationId: editDraft.assignedClientOrganizationId.trim() || undefined,
          avatarUrl: editDraft.avatarUrl.trim() || undefined,
        }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to update user profile.');
      }

      setAccessNotice('User profile updated.');
      setEditUserId(null);
      await loadAccessControl();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to update user profile.');
    } finally {
      setBusyUserId('');
    }
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm('Delete this user record? This cannot be undone.');
    if (!confirmed) return;

    setBusyUserId(userId);
    setAccessError('');
    setAccessNotice('');

    try {
      const res = await fetch('/api/master/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to delete user.');
      }

      setAccessNotice('User record deleted.');
      if (editUserId === userId) setEditUserId(null);
      await loadAccessControl();
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setBusyUserId('');
    }
  }

  async function runEmailPreview() {
    setPreviewLoading(true);
    setPreviewError('');
    setTestError('');
    setTestNotice('');

    try {
      const variables = parsePreviewVariables();

      const res = await fetch('/api/master/system-settings/email-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: previewTemplateKey, variables }),
      });

      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        subject?: string;
        preheader?: string;
        html?: string;
        text?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to render preview.');
      }

      setPreviewPayload({
        subject: body.subject || '',
        preheader: body.preheader || '',
        html: body.html || '',
        text: body.text || '',
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to render preview.');
      setPreviewPayload(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendPreviewTestEmail(recipientOverride?: string) {
    setTestSending(true);
    setTestError('');
    setTestNotice('');
    setPreviewError('');

    try {
      const recipient = (recipientOverride ?? testRecipient).trim().toLowerCase();
      if (!recipient) {
        throw new Error('Enter a recipient email for test sending.');
      }

      const variables = parsePreviewVariables();

      const res = await fetch('/api/master/system-settings/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: previewTemplateKey,
          to: recipient,
          variables,
          emailConfig: data?.platformSettings.email,
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to send test email.');
      }

      setTestNotice(body.message || `Test email sent to ${recipient}.`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to send test email.');
    } finally {
      setTestSending(false);
    }
  }

  async function testSmtpConnection() {
    if (!data) return;

    setSmtpTesting(true);
    setSmtpTestError('');
    setSmtpTestNotice('');

    try {
      const res = await fetch('/api/master/system-settings/email-connection-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfig: data.platformSettings.email }),
      });

      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        rawError?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        const detail = body?.rawError ? ` (raw: ${body.rawError})` : '';
        throw new Error((body?.error || 'SMTP connection test failed.') + detail);
      }

      setSmtpTestNotice(body.message || 'SMTP connection verified successfully.');
    } catch (err) {
      setSmtpTestError(err instanceof Error ? err.message : 'SMTP connection test failed.');
    } finally {
      setSmtpTesting(false);
    }
  }

  async function loadDbHealth() {
    setDbHealthLoading(true);
    setDbHealthError('');
    setDbHealthNotice('');

    try {
      const res = await fetch('/api/master/system-settings/db-health', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        backend?: string;
        postgresConfigured?: boolean;
        postgresHost?: string;
        postgresTable?: string;
        postgresKey?: string;
        hasPlatformSettings?: boolean;
        workspaceCount?: number;
        checkedAt?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to check database health.');
      }

      setDbHealth({
        backend: body.backend || 'unknown',
        postgresConfigured: Boolean(body.postgresConfigured),
        postgresHost: body.postgresHost || '',
        postgresTable: body.postgresTable || '',
        postgresKey: body.postgresKey || '',
        hasPlatformSettings: body.hasPlatformSettings,
        workspaceCount: body.workspaceCount,
        checkedAt: body.checkedAt,
      });
      setDbHealthNotice('Database connection check passed.');
    } catch (err) {
      setDbHealthError(err instanceof Error ? err.message : 'Failed to check database health.');
      setDbHealth(null);
    } finally {
      setDbHealthLoading(false);
    }
  }

  async function runDbSmokeWriteTest() {
    setDbSmokeLoading(true);
    setDbHealthError('');
    setDbHealthNotice('');

    try {
      const res = await fetch('/api/master/system-settings/db-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        backend?: string;
        postgresConfigured?: boolean;
        postgresHost?: string;
        postgresTable?: string;
        postgresKey?: string;
        checkedAt?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Database smoke write failed.');
      }

      setDbHealth((prev) => ({
        backend: body.backend || prev?.backend || 'unknown',
        postgresConfigured: Boolean(body.postgresConfigured ?? prev?.postgresConfigured),
        postgresHost: body.postgresHost || prev?.postgresHost || '',
        postgresTable: body.postgresTable || prev?.postgresTable || '',
        postgresKey: body.postgresKey || prev?.postgresKey || '',
        hasPlatformSettings: prev?.hasPlatformSettings,
        workspaceCount: prev?.workspaceCount,
        checkedAt: body.checkedAt || prev?.checkedAt,
      }));
      setDbHealthNotice('Database smoke write passed.');
    } catch (err) {
      setDbHealthError(err instanceof Error ? err.message : 'Database smoke write failed.');
    } finally {
      setDbSmokeLoading(false);
    }
  }

  const users = useMemo(() => usersPayload?.users ?? [], [usersPayload]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading system settings...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'System settings could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Centralized control plane aligned with global SaaS standards for policy, payments, and access governance.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void saveSystemSettings()}
            disabled={saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving settings...' : 'Save settings'}
          </button>
          {activeSection === 'access' ? (
            <button
              onClick={() => void saveAccessControl()}
              disabled={accessSaving || !accessPayload}
              className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {accessSaving ? 'Saving access...' : 'Save access control'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {MENU.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeSection === item.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {activeSection === 'general' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Database connection</h2>
                <p className="mt-1 text-xs text-slate-500">Verify active backend and run a safe read/write smoke test.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void loadDbHealth()}
                  disabled={dbHealthLoading}
                  className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                  {dbHealthLoading ? 'Checking...' : 'Check connection'}
                </button>
                <button
                  onClick={() => void runDbSmokeWriteTest()}
                  disabled={dbSmokeLoading}
                  className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {dbSmokeLoading ? 'Testing write...' : 'Run smoke write'}
                </button>
              </div>
            </div>

            {dbHealthError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dbHealthError}</div>
            ) : null}
            {dbHealthNotice ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{dbHealthNotice}</div>
            ) : null}

            {dbHealth ? (
              <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 lg:grid-cols-2">
                <p><span className="font-semibold text-slate-900">Backend:</span> {dbHealth.backend}</p>
                <p><span className="font-semibold text-slate-900">Postgres configured:</span> {dbHealth.postgresConfigured ? 'Yes' : 'No'}</p>
                <p><span className="font-semibold text-slate-900">Host:</span> {dbHealth.postgresHost || 'n/a'}</p>
                <p><span className="font-semibold text-slate-900">Table:</span> {dbHealth.postgresTable || 'n/a'}</p>
                <p><span className="font-semibold text-slate-900">Key:</span> {dbHealth.postgresKey || 'n/a'}</p>
                <p><span className="font-semibold text-slate-900">Workspace records:</span> {dbHealth.workspaceCount ?? 'n/a'}</p>
                <p className="lg:col-span-2"><span className="font-semibold text-slate-900">Checked at:</span> {dbHealth.checkedAt || 'n/a'}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
            <p className="mt-1 text-xs text-slate-500">Manage brand identity used in Control Center notifications and generated communications.</p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="text-sm text-slate-700">
                Brand name
                <input
                  value={data.platformSettings.branding.brandName}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        brandName: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Brand byline
                <input
                  value={data.platformSettings.branding.brandByline}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        brandByline: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Commerce Operations Cloud"
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Logo URL
                <input
                  value={data.platformSettings.branding.logoUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        logoUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://cdn.marveo.com/brand/logo.png"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={logoUploading || saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void (async () => {
                          try {
                            setLogoUploading(true);
                            const url = await uploadMedia(file);
                            setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                branding: {
                                  ...prev.platformSettings.branding,
                                  logoUrl: url,
                                },
                              },
                            } : prev);
                            setNotice('Logo uploaded. Save to apply.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Logo upload failed.');
                          } finally {
                            setLogoUploading(false);
                            e.target.value = '';
                          }
                        })();
                      }}
                    />
                    {logoUploading ? 'Uploading…' : 'Upload logo'}
                  </label>
                  {data.platformSettings.branding.logoUrl ? (
                    <span className="text-xs text-slate-500">Using uploaded logo URL.</span>
                  ) : (
                    <span className="text-xs text-slate-500">No logo set.</span>
                  )}
                </div>
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Dashboard logo
                <input
                  value={data.platformSettings.branding.dashboardLogoUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        dashboardLogoUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://cdn.marveo.com/brand/dashboard-logo.png"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={dashboardLogoUploading || saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void (async () => {
                          try {
                            setDashboardLogoUploading(true);
                            const url = await uploadMedia(file);
                            setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                branding: {
                                  ...prev.platformSettings.branding,
                                  dashboardLogoUrl: url,
                                },
                              },
                            } : prev);
                            setNotice('Dashboard logo uploaded. Save to apply.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Dashboard logo upload failed.');
                          } finally {
                            setDashboardLogoUploading(false);
                            e.target.value = '';
                          }
                        })();
                      }}
                    />
                    {dashboardLogoUploading ? 'Uploading…' : 'Upload dashboard logo'}
                  </label>
                  {data.platformSettings.branding.dashboardLogoUrl ? (
                    <span className="text-xs text-slate-500">Used in the Control Center sidebar header.</span>
                  ) : (
                    <span className="text-xs text-slate-500">Falls back to the default brand logo.</span>
                  )}
                </div>
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Portal login logo
                <input
                  value={data.platformSettings.branding.portalLoginLogoUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        portalLoginLogoUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://cdn.marveo.com/brand/portal-login-logo.png"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={portalLoginLogoUploading || saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void (async () => {
                          try {
                            setPortalLoginLogoUploading(true);
                            const url = await uploadMedia(file);
                            setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                branding: {
                                  ...prev.platformSettings.branding,
                                  portalLoginLogoUrl: url,
                                },
                              },
                            } : prev);
                            setNotice('Portal login logo uploaded. Save to apply.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Portal login logo upload failed.');
                          } finally {
                            setPortalLoginLogoUploading(false);
                            e.target.value = '';
                          }
                        })();
                      }}
                    />
                    {portalLoginLogoUploading ? 'Uploading…' : 'Upload portal login logo'}
                  </label>
                  {data.platformSettings.branding.portalLoginLogoUrl ? (
                    <span className="text-xs text-slate-500">Used on both login screens.</span>
                  ) : (
                    <span className="text-xs text-slate-500">Falls back to the default brand logo.</span>
                  )}
                </div>
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Favicon URL
                <input
                  value={data.platformSettings.branding.faviconUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        faviconUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://cdn.marveo.com/brand/favicon.ico"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="file"
                      accept="image/x-icon,image/png,image/svg+xml,image/*"
                      className="hidden"
                      disabled={faviconUploading || saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void (async () => {
                          try {
                            setFaviconUploading(true);
                            const url = await uploadMedia(file);
                            setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                branding: {
                                  ...prev.platformSettings.branding,
                                  faviconUrl: url,
                                },
                              },
                            } : prev);
                            setNotice('Favicon uploaded. Save to apply.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Favicon upload failed.');
                          } finally {
                            setFaviconUploading(false);
                            e.target.value = '';
                          }
                        })();
                      }}
                    />
                    {faviconUploading ? 'Uploading…' : 'Upload favicon'}
                  </label>
                  {data.platformSettings.branding.faviconUrl ? (
                    <span className="text-xs text-slate-500">Used for browser tabs and app shortcuts after saving.</span>
                  ) : (
                    <span className="text-xs text-slate-500">Falls back to the generated Marveo icon.</span>
                  )}
                </div>
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Footer Logo URL
                <input
                  value={data.platformSettings.branding.footerLogoUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerLogoUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://cdn.marveo.com/brand/footer-logo.png"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={footerLogoUploading || saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void (async () => {
                          try {
                            setFooterLogoUploading(true);
                            const url = await uploadMedia(file);
                            setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                branding: {
                                  ...prev.platformSettings.branding,
                                  footerLogoUrl: url,
                                },
                              },
                            } : prev);
                            setNotice('Footer logo uploaded. Save to apply.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Footer logo upload failed.');
                          } finally {
                            setFooterLogoUploading(false);
                            e.target.value = '';
                          }
                        })();
                      }}
                    />
                    {footerLogoUploading ? 'Uploading…' : 'Upload footer logo'}
                  </label>
                  {data.platformSettings.branding.footerLogoUrl ? (
                    <span className="text-xs text-slate-500">Using footer logo URL.</span>
                  ) : (
                    <span className="text-xs text-slate-500">Falls back to header logo.</span>
                  )}
                </div>
              </label>

              <label className="text-sm text-slate-700">
                Primary color
                <input
                  value={data.platformSettings.branding.primaryColor}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        primaryColor: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="#0f172a"
                />
              </label>

              <label className="text-sm text-slate-700">
                Secondary color
                <input
                  value={data.platformSettings.branding.secondaryColor}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        secondaryColor: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="#0ea5e9"
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Website URL
                <input
                  value={data.platformSettings.branding.websiteUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        websiteUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://www.marveo.com"
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Footer address line
                <input
                  value={data.platformSettings.branding.footerAddressLine}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerAddressLine: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="548 Market St, Suite 94104, San Francisco, CA"
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Footer description
                <input
                  value={data.platformSettings.branding.footerDescription}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerDescription: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Marveo unifies WordPress, headless CMS, and commerce orchestration."
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Footer badge text
                <input
                  value={data.platformSettings.branding.footerBadgeText}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerBadgeText: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Built for developers and agencies"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer status label
                <input
                  value={data.platformSettings.branding.footerStatusLabel}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerStatusLabel: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Status"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer status URL
                <input
                  value={data.platformSettings.branding.footerStatusUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerStatusUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://status.marveo.com"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer docs label
                <input
                  value={data.platformSettings.branding.footerDocsLabel}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerDocsLabel: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Documentation"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer docs URL
                <input
                  value={data.platformSettings.branding.footerDocsUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerDocsUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://www.marveo.com/docs"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer GDPR label
                <input
                  value={data.platformSettings.branding.footerGdprLabel}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerGdprLabel: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="GDPR"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer GDPR URL
                <input
                  value={data.platformSettings.branding.footerGdprUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerGdprUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://www.marveo.com/privacy"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer unsubscribe label
                <input
                  value={data.platformSettings.branding.footerUnsubscribeLabel}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerUnsubscribeLabel: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Unsubscribe"
                />
              </label>

              <label className="text-sm text-slate-700">
                Footer unsubscribe URL
                <input
                  value={data.platformSettings.branding.footerUnsubscribeUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      branding: {
                        ...prev.platformSettings.branding,
                        footerUnsubscribeUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://www.marveo.com/unsubscribe"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Platform defaults</h2>
            <p className="mt-1 text-xs text-slate-500">Support officers available: {data.supportOfficerPoolSize}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="text-sm text-slate-700">
                Default account plan
                <select
                  value={data.accountPlan}
                  onChange={(e) => setData((prev) => prev ? { ...prev, accountPlan: e.target.value as AccountPlan } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="starter">Starter</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Platform trial duration (days)
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={data.platformSettings.trialDurationDays}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: { ...prev.platformSettings, trialDurationDays: Number(e.target.value || 14) },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.trialDefaults.trialEnabled}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    trialDefaults: { ...prev.trialDefaults, trialEnabled: e.target.checked },
                  } : prev)}
                />
                Enable default commercial trials
              </label>
              <label className="text-sm text-slate-700">
                Commercial trial default (days)
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={data.trialDefaults.trialDurationDays}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    trialDefaults: { ...prev.trialDefaults, trialDurationDays: Number(e.target.value || 14) },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Operations safety</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.demoMode.enabled}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      demoMode: { ...prev.platformSettings.demoMode, enabled: e.target.checked },
                    },
                  } : prev)}
                />
                Demo mode enabled
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.demoMode.allowOperationalMutations}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      demoMode: { ...prev.platformSettings.demoMode, allowOperationalMutations: e.target.checked },
                    },
                  } : prev)}
                />
                Allow mutations in demo mode
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.templatePublishRules.requireArtifactValidation}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      templatePublishRules: {
                        ...prev.platformSettings.templatePublishRules,
                        requireArtifactValidation: e.target.checked,
                      },
                    },
                  } : prev)}
                />
                Require artifact validation for template publish
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.templatePublishRules.requireSupportApproval}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      templatePublishRules: {
                        ...prev.platformSettings.templatePublishRules,
                        requireSupportApproval: e.target.checked,
                      },
                    },
                  } : prev)}
                />
                Require support approval for template publish
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'payments' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Payment platform configuration</h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure multi-provider payments in-app for global environments instead of manual environment-level setup.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="text-sm text-slate-700">
                Legacy primary provider
                <select
                  value={data.platformSettings.paymentProvider.provider}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        provider: e.target.value as PaymentProvider,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="NONE">None</option>
                  <option value="PAYSTACK">Paystack</option>
                  <option value="STRIPE">Stripe</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Provider mode
                <select
                  value={data.platformSettings.paymentProvider.mode}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        mode: e.target.value as PaymentMode,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Merchant display name
                <input
                  value={data.platformSettings.paymentProvider.merchantDisplayName}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        merchantDisplayName: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Settlement currency (ISO code)
                <input
                  value={data.platformSettings.paymentProvider.settlementCurrency}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        settlementCurrency: e.target.value.toUpperCase(),
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Base plan pricing currency
                <select
                  value={data.platformSettings.billingCurrencyPolicy.basePricingCurrency}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      billingCurrencyPolicy: {
                        ...prev.platformSettings.billingCurrencyPolicy,
                        basePricingCurrency: e.target.value as CurrencyCode,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {CURRENCY_KEYS.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Publishable key reference
                <input
                  value={data.platformSettings.paymentProvider.publishableKeyRef}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        publishableKeyRef: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="kv://payments/stripe/publishable_key"
                />
              </label>
              <label className="text-sm text-slate-700">
                Secret key reference
                <input
                  value={data.platformSettings.paymentProvider.secretKeyRef}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        secretKeyRef: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="kv://payments/stripe/secret_key"
                />
              </label>
              <label className="text-sm text-slate-700 lg:col-span-2">
                Webhook URL
                <input
                  value={data.platformSettings.paymentProvider.webhookUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        webhookUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="https://api.marveo.com/payments/webhook"
                />
              </label>
              <label className="text-sm text-slate-700">
                Webhook secret reference
                <input
                  value={data.platformSettings.paymentProvider.webhookSecretRef}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      paymentProvider: {
                        ...prev.platformSettings.paymentProvider,
                        webhookSecretRef: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="kv://payments/stripe/webhook_secret"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.billingCurrencyPolicy.autoConvertFromBase}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      billingCurrencyPolicy: {
                        ...prev.platformSettings.billingCurrencyPolicy,
                        autoConvertFromBase: e.target.checked,
                      },
                    },
                  } : prev)}
                />
                Auto-convert billing from base plan pricing
              </label>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.platformSettings.paymentProvider.configured}
                    onChange={(e) => setData((prev) => prev ? {
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        paymentProvider: {
                          ...prev.platformSettings.paymentProvider,
                          configured: e.target.checked,
                        },
                      },
                    } : prev)}
                  />
                  Provider configured
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.platformSettings.paymentProvider.webhookConfigured}
                    onChange={(e) => setData((prev) => prev ? {
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        paymentProvider: {
                          ...prev.platformSettings.paymentProvider,
                          webhookConfigured: e.target.checked,
                        },
                      },
                    } : prev)}
                  />
                  Webhook configured
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.platformSettings.paymentProvider.autoCapture}
                    onChange={(e) => setData((prev) => prev ? {
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        paymentProvider: {
                          ...prev.platformSettings.paymentProvider,
                          autoCapture: e.target.checked,
                        },
                      },
                    } : prev)}
                  />
                  Auto-capture successful payments
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={data.platformSettings.paymentProvider.require3DS}
                    onChange={(e) => setData((prev) => prev ? {
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        paymentProvider: {
                          ...prev.platformSettings.paymentProvider,
                          require3DS: e.target.checked,
                        },
                      },
                    } : prev)}
                  />
                  Require 3DS where available
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Provider activation and country applicability</h3>
            <p className="mt-1 text-xs text-slate-500">
              Supported providers: Paystack, Flutterwave, Custom, Stripe, PayPal. Priority controls fallback order.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Provider', 'Enabled', 'Configured', 'Mode', 'Priority', 'Markets', 'Currencies'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROVIDER_KEYS.map((providerKey) => {
                    const row = data.platformSettings.paymentProviders[providerKey];
                    return (
                      <tr key={providerKey} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-2 text-sm font-semibold text-slate-900">{toLabel(providerKey)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) => setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                paymentProviders: {
                                  ...prev.platformSettings.paymentProviders,
                                  [providerKey]: {
                                    ...prev.platformSettings.paymentProviders[providerKey],
                                    enabled: e.target.checked,
                                  },
                                },
                              },
                            } : prev)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.configured}
                            onChange={(e) => setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                paymentProviders: {
                                  ...prev.platformSettings.paymentProviders,
                                  [providerKey]: {
                                    ...prev.platformSettings.paymentProviders[providerKey],
                                    configured: e.target.checked,
                                  },
                                },
                              },
                            } : prev)}
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          <select
                            value={row.mode}
                            onChange={(e) => setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                paymentProviders: {
                                  ...prev.platformSettings.paymentProviders,
                                  [providerKey]: {
                                    ...prev.platformSettings.paymentProviders[providerKey],
                                    mode: e.target.value as PaymentMode,
                                  },
                                },
                              },
                            } : prev)}
                            className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="sandbox">Sandbox</option>
                            <option value="live">Live</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={row.priority}
                            onChange={(e) => setData((prev) => prev ? {
                              ...prev,
                              platformSettings: {
                                ...prev.platformSettings,
                                paymentProviders: {
                                  ...prev.platformSettings.paymentProviders,
                                  [providerKey]: {
                                    ...prev.platformSettings.paymentProviders[providerKey],
                                    priority: Number(e.target.value || 1),
                                  },
                                },
                              },
                            } : prev)}
                            className="w-20 rounded-xl border border-slate-300 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <div className="grid grid-cols-2 gap-1">
                            {MARKET_KEYS.map((marketKey) => {
                              const checked = row.applicableMarkets.includes(marketKey);
                              return (
                                <label key={`${providerKey}-${marketKey}`} className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => setData((prev) => {
                                      if (!prev) return prev;
                                      const current = prev.platformSettings.paymentProviders[providerKey].applicableMarkets;
                                      const nextMarkets = e.target.checked
                                        ? Array.from(new Set([...current, marketKey]))
                                        : current.filter((item) => item !== marketKey);
                                      return {
                                        ...prev,
                                        platformSettings: {
                                          ...prev.platformSettings,
                                          paymentProviders: {
                                            ...prev.platformSettings.paymentProviders,
                                            [providerKey]: {
                                              ...prev.platformSettings.paymentProviders[providerKey],
                                              applicableMarkets: nextMarkets,
                                            },
                                          },
                                        },
                                      };
                                    })}
                                  />
                                  {MARKET_LABELS[marketKey]}
                                </label>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <div className="flex flex-wrap gap-2">
                            {CURRENCY_KEYS.map((currencyKey) => {
                              const checked = row.settlementCurrencies.includes(currencyKey);
                              return (
                                <label key={`${providerKey}-${currencyKey}`} className="inline-flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => setData((prev) => {
                                      if (!prev) return prev;
                                      const current = prev.platformSettings.paymentProviders[providerKey].settlementCurrencies;
                                      const nextCurrencies = e.target.checked
                                        ? Array.from(new Set([...current, currencyKey]))
                                        : current.filter((item) => item !== currencyKey);
                                      return {
                                        ...prev,
                                        platformSettings: {
                                          ...prev.platformSettings,
                                          paymentProviders: {
                                            ...prev.platformSettings.paymentProviders,
                                            [providerKey]: {
                                              ...prev.platformSettings.paymentProviders[providerKey],
                                              settlementCurrencies: nextCurrencies,
                                            },
                                          },
                                        },
                                      };
                                    })}
                                  />
                                  {currencyKey}
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Market currency mapping and FX rates</h3>
            <p className="mt-1 text-xs text-slate-500">
              Billing currency is selected by market, and conversion is applied from base plan pricing using FX rates.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country/market currency mapping</p>
                <div className="mt-3 grid gap-2">
                  {MARKET_KEYS.map((marketKey) => (
                    <label key={marketKey} className="text-sm text-slate-700">
                      {MARKET_LABELS[marketKey]}
                      <select
                        value={data.platformSettings.billingCurrencyPolicy.countryCurrencyMap[marketKey]}
                        onChange={(e) => setData((prev) => prev ? {
                          ...prev,
                          platformSettings: {
                            ...prev.platformSettings,
                            billingCurrencyPolicy: {
                              ...prev.platformSettings.billingCurrencyPolicy,
                              countryCurrencyMap: {
                                ...prev.platformSettings.billingCurrencyPolicy.countryCurrencyMap,
                                [marketKey]: e.target.value as CurrencyCode,
                              },
                            },
                          },
                        } : prev)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      >
                        {CURRENCY_KEYS.map((currency) => (
                          <option key={`${marketKey}-${currency}`} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FX rates relative to USD</p>
                <div className="mt-3 grid gap-2">
                  <label className="text-sm text-slate-700">
                    USD
                    <input
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      value={data.platformSettings.billingCurrencyPolicy.fxRates.USD}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          billingCurrencyPolicy: {
                            ...prev.platformSettings.billingCurrencyPolicy,
                            fxRates: {
                              ...prev.platformSettings.billingCurrencyPolicy.fxRates,
                              USD: Number(e.target.value || 1),
                            },
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    GBP
                    <input
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      value={data.platformSettings.billingCurrencyPolicy.fxRates.GBP}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          billingCurrencyPolicy: {
                            ...prev.platformSettings.billingCurrencyPolicy,
                            fxRates: {
                              ...prev.platformSettings.billingCurrencyPolicy.fxRates,
                              GBP: Number(e.target.value || 0.79),
                            },
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    NGN
                    <input
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      value={data.platformSettings.billingCurrencyPolicy.fxRates.NGN}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          billingCurrencyPolicy: {
                            ...prev.platformSettings.billingCurrencyPolicy,
                            fxRates: {
                              ...prev.platformSettings.billingCurrencyPolicy.fxRates,
                              NGN: Number(e.target.value || 1550),
                            },
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
              Priority regions preconfigured: Nigeria (NGN), UK (GBP), UAE (USD), Canada (USD), US (USD), Other African Countries (USD).
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'email' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Email transport and environment parameters</h2>
            <p className="mt-1 text-xs text-slate-500">
              Keep all operational email parameters in one place for signup, deployment, billing, user lifecycle, and failure flows.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void testSmtpConnection()}
                disabled={smtpTesting}
                className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {smtpTesting ? 'Testing SMTP...' : 'Test SMTP / SES connection'}
              </button>
              <p className="text-xs text-slate-500">Uses current SMTP form values (including unsaved edits).</p>
            </div>

            {smtpTestError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{smtpTestError}</div>
            ) : null}
            {smtpTestNotice ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{smtpTestNotice}</div>
            ) : null}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Email sender logo</p>
              <p className="mt-1 text-xs text-slate-500">
                This logo is shown to email recipients. If empty, Marveo falls back to text initials (MO).
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading || saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void (async () => {
                        try {
                          setLogoUploading(true);
                          const url = await uploadMedia(file);
                          setData((prev) => prev ? {
                            ...prev,
                            platformSettings: {
                              ...prev.platformSettings,
                              branding: {
                                ...prev.platformSettings.branding,
                                logoUrl: url,
                              },
                            },
                          } : prev);
                          setNotice('Email sender logo uploaded. Save settings to apply.');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Email logo upload failed.');
                        } finally {
                          setLogoUploading(false);
                          e.target.value = '';
                        }
                      })();
                    }}
                  />
                  {logoUploading ? 'Uploading...' : 'Upload sender logo'}
                </label>
                {data.platformSettings.branding.logoUrl ? (
                  <span className="text-xs text-slate-500">Current email logo is set.</span>
                ) : (
                  <span className="text-xs text-slate-500">No sender logo set yet.</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={data.platformSettings.email.enabled}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        enabled: e.target.checked,
                      },
                    },
                  } : prev)}
                />
                Email notifications enabled
              </label>

              <label className="text-sm text-slate-700">
                Provider
                <select
                  value={data.platformSettings.email.provider === 'WORDPRESS_MAILER' ? 'SMTP' : data.platformSettings.email.provider}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        provider: e.target.value as EmailProvider,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="SMTP">SMTP</option>
                  <option value="RESEND">Resend</option>
                  <option value="SES_SMTP">Amazon SES SMTP</option>
                </select>
              </label>

              {data.platformSettings.email.provider === 'RESEND' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 lg:col-span-2">
                  Resend delivery uses the server-side environment variable RESEND_API_KEY. Keep it on the server only.
                </div>
              ) : null}

              {data.platformSettings.email.provider === 'WORDPRESS_MAILER' ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800 lg:col-span-2">
                  Legacy WordPress mailer was detected. Select SMTP, Resend, or Amazon SES SMTP and save to migrate.
                </div>
              ) : null}

              {data.platformSettings.email.provider !== 'RESEND' ? (
                <>
                  <label className="text-sm text-slate-700">
                    SMTP host
                    <input
                      value={data.platformSettings.email.host}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          email: {
                            ...prev.platformSettings.email,
                            host: e.target.value,
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      placeholder="smtp-relay.brevo.com"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    SMTP port
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={data.platformSettings.email.port}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          email: {
                            ...prev.platformSettings.email,
                            port: Number(e.target.value || 587),
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={data.platformSettings.email.secure}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          email: {
                            ...prev.platformSettings.email,
                            secure: e.target.checked,
                          },
                        },
                      } : prev)}
                    />
                    Use TLS/secure SMTP
                  </label>

                  <label className="text-sm text-slate-700">
                    SMTP username
                    <input
                      value={data.platformSettings.email.username}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          email: {
                            ...prev.platformSettings.email,
                            username: e.target.value,
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="text-sm text-slate-700">
                    SMTP password / app password
                    <input
                      type="password"
                      value={data.platformSettings.email.password}
                      onChange={(e) => setData((prev) => prev ? {
                        ...prev,
                        platformSettings: {
                          ...prev.platformSettings,
                          email: {
                            ...prev.platformSettings.email,
                            password: e.target.value,
                          },
                        },
                      } : prev)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                </>
              ) : null}

              <label className="text-sm text-slate-700">
                From email
                <input
                  value={data.platformSettings.email.fromEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        fromEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                From name
                <input
                  value={data.platformSettings.email.fromName}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        fromName: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Reply-to email
                <input
                  value={data.platformSettings.email.replyToEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        replyToEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                App base URL
                <input
                  value={data.platformSettings.email.appBaseUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        appBaseUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                API base URL
                <input
                  value={data.platformSettings.email.apiBaseUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        apiBaseUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Support portal URL
                <input
                  value={data.platformSettings.email.supportPortalUrl}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        supportPortalUrl: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Support notifications email
                <input
                  value={data.platformSettings.email.supportEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        supportEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Billing notifications email
                <input
                  value={data.platformSettings.email.billingEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        billingEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Deployment notifications email
                <input
                  value={data.platformSettings.email.deploymentEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        deploymentEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                User lifecycle notifications email
                <input
                  value={data.platformSettings.email.userOpsEmail}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        userOpsEmail: e.target.value,
                      },
                    },
                  } : prev)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 lg:col-span-2">
                <input
                  type="checkbox"
                  checked={data.platformSettings.email.sendFailureAlerts}
                  onChange={(e) => setData((prev) => prev ? {
                    ...prev,
                    platformSettings: {
                      ...prev.platformSettings,
                      email: {
                        ...prev.platformSettings.email,
                        sendFailureAlerts: e.target.checked,
                      },
                    },
                  } : prev)}
                />
                Send failure alert emails when deployment/payment/billing/user operations fail
              </label>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Failure alert recipients (comma separated)
                <textarea
                  value={data.platformSettings.email.failureAlertRecipients.join(', ')}
                  onChange={(e) => setData((prev) => {
                    if (!prev) return prev;
                    const recipients = e.target.value
                      .split(',')
                      .map((item) => item.trim().toLowerCase())
                      .filter(Boolean);
                    return {
                      ...prev,
                      platformSettings: {
                        ...prev.platformSettings,
                        email: {
                          ...prev.platformSettings.email,
                          failureAlertRecipients: Array.from(new Set(recipients)),
                        },
                      },
                    };
                  })}
                  className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="ops@marveo.com, billing@marveo.com"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Email templates by task</h2>
            <p className="mt-1 text-xs text-slate-500">
              Configure subject/body templates for key flows: signup, deploy, password, payment, billing, user invite, and failure alerts.
            </p>

            <div className="mt-4 space-y-4">
              {EMAIL_TEMPLATE_KEYS.map((templateKey) => {
                const template = data.platformSettings.emailTemplates[templateKey];
                return (
                  <div key={templateKey} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{EMAIL_TEMPLATE_LABELS[templateKey]}</p>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={template.enabled}
                          onChange={(e) => setData((prev) => prev ? {
                            ...prev,
                            platformSettings: {
                              ...prev.platformSettings,
                              emailTemplates: {
                                ...prev.platformSettings.emailTemplates,
                                [templateKey]: {
                                  ...prev.platformSettings.emailTemplates[templateKey],
                                  enabled: e.target.checked,
                                },
                              },
                            },
                          } : prev)}
                        />
                        Enabled
                      </label>
                    </div>

                    <label className="mt-3 block text-sm text-slate-700">
                      Subject
                      <input
                        value={template.subject}
                        onChange={(e) => setData((prev) => prev ? {
                          ...prev,
                          platformSettings: {
                            ...prev.platformSettings,
                            emailTemplates: {
                              ...prev.platformSettings.emailTemplates,
                              [templateKey]: {
                                ...prev.platformSettings.emailTemplates[templateKey],
                                subject: e.target.value,
                              },
                            },
                          },
                        } : prev)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="mt-3 block text-sm text-slate-700">
                      Preheader (inbox preview text)
                      <input
                        value={template.preheader}
                        onChange={(e) => setData((prev) => prev ? {
                          ...prev,
                          platformSettings: {
                            ...prev.platformSettings,
                            emailTemplates: {
                              ...prev.platformSettings.emailTemplates,
                              [templateKey]: {
                                ...prev.platformSettings.emailTemplates[templateKey],
                                preheader: e.target.value,
                              },
                            },
                          },
                        } : prev)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <label className="text-sm text-slate-700">
                        HTML body
                        <textarea
                          value={template.html}
                          onChange={(e) => setData((prev) => prev ? {
                            ...prev,
                            platformSettings: {
                              ...prev.platformSettings,
                              emailTemplates: {
                                ...prev.platformSettings.emailTemplates,
                                [templateKey]: {
                                  ...prev.platformSettings.emailTemplates[templateKey],
                                  html: e.target.value,
                                },
                              },
                            },
                          } : prev)}
                          className="mt-1 min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        Text body
                        <textarea
                          value={template.text}
                          onChange={(e) => setData((prev) => prev ? {
                            ...prev,
                            platformSettings: {
                              ...prev.platformSettings,
                              emailTemplates: {
                                ...prev.platformSettings.emailTemplates,
                                [templateKey]: {
                                  ...prev.platformSettings.emailTemplates[templateKey],
                                  text: e.target.value,
                                },
                              },
                            },
                          } : prev)}
                          className="mt-1 min-h-[110px] w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Template preview</h2>
            <p className="mt-1 text-xs text-slate-500">
              Render a final branded email preview with variables before sending to users.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="text-sm text-slate-700">
                Template
                <select
                  value={previewTemplateKey}
                  onChange={(e) => setPreviewTemplateKey(e.target.value as EmailTemplateKey)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  {EMAIL_TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>{EMAIL_TEMPLATE_LABELS[key]}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-700">
                Test recipient email
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="ops@marveo.com"
                />
              </label>

              <div className="flex flex-wrap items-end gap-2 lg:col-span-2">
                <button
                  onClick={() => void runEmailPreview()}
                  disabled={previewLoading}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {previewLoading ? 'Rendering preview...' : 'Render preview'}
                </button>
                <button
                  onClick={() => void sendPreviewTestEmail()}
                  disabled={testSending || !testRecipient.trim()}
                  className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {testSending ? 'Sending test email...' : 'Send test email'}
                </button>
                <button
                  onClick={() => {
                    const configured = (data?.platformSettings.email.fromEmail || data?.platformSettings.email.username || '').trim().toLowerCase();
                    if (!configured) {
                      setTestError('Set a sender email first, then try quick send.');
                      return;
                    }
                    setTestRecipient(configured);
                    void sendPreviewTestEmail(configured);
                  }}
                  disabled={testSending}
                  className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                >
                  {testSending ? 'Sending...' : 'Send to from email'}
                </button>
              </div>

              <label className="text-sm text-slate-700 lg:col-span-2">
                Variables JSON
                <textarea
                  value={previewVariablesJson}
                  onChange={(e) => setPreviewVariablesJson(e.target.value)}
                  className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
                />
              </label>
            </div>

            {previewError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{previewError}</div>
            ) : null}
            {testError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{testError}</div>
            ) : null}
            {testNotice ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{testNotice}</div>
            ) : null}

            {previewPayload ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p><span className="font-semibold text-slate-900">Subject:</span> {previewPayload.subject}</p>
                  <p className="mt-1"><span className="font-semibold text-slate-900">Preheader:</span> {previewPayload.preheader || 'n/a'}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <iframe
                    title="Marveo email preview"
                    srcDoc={previewPayload.html}
                    className="h-[580px] w-full bg-white"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeSection === 'access' ? (
        <div className="space-y-4">
          {accessError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{accessError}</div>
          ) : null}
          {accessNotice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{accessNotice}</div>
          ) : null}

          {accessLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading access control...
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">Role privileges matrix</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Define module-level rights for each role, similar to enterprise RBAC controls used by products like GitHub and Zoho.
                </p>
                {accessPayload ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                          {accessPayload.modules.map((moduleKey) => (
                            <th key={moduleKey} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {toLabel(moduleKey)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {accessPayload.roles.map((role) => (
                          <tr key={role} className="border-b border-slate-100">
                            <td className="px-3 py-2 text-sm font-semibold text-slate-800">{toLabel(role)}</td>
                            {accessPayload.modules.map((moduleKey) => (
                              <td key={`${role}-${moduleKey}`} className="px-3 py-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(accessPayload.roleModuleVisibility[role]?.[moduleKey])}
                                  onChange={(e) => setAccessPayload((prev) => {
                                    if (!prev) return prev;
                                    return {
                                      ...prev,
                                      roleModuleVisibility: {
                                        ...prev.roleModuleVisibility,
                                        [role]: {
                                          ...prev.roleModuleVisibility[role],
                                          [moduleKey]: e.target.checked,
                                        },
                                      },
                                    };
                                  })}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">User provisioning</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Manage internal role assignment and account status. Creating a staged user record sends an invite email immediately.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Full name"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      disabled={busyUserId === 'invite'}
                    />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      disabled={busyUserId === 'invite'}
                    />
                    <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={busyUserId === 'invite'}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void (async () => {
                            try {
                              setBusyUserId('invite');
                              const url = await uploadMedia(file);
                              setInviteAvatarUrl(url);
                              setAccessNotice('Avatar uploaded.');
                            } catch (err) {
                              setAccessError(err instanceof Error ? err.message : 'Avatar upload failed');
                            } finally {
                              setBusyUserId('');
                            }
                          })();
                        }}
                      />
                      Upload avatar
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as MarveoRole)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      disabled={busyUserId === 'invite'}
                    >
                      {(usersPayload?.marveoRoles ?? [inviteRole]).map((role) => (
                        <option key={role} value={role}>{toLabel(role)}</option>
                      ))}
                    </select>
                    <input
                      value={inviteWorkspaceId}
                      onChange={(e) => setInviteWorkspaceId(e.target.value)}
                      placeholder="Workspace ID (optional)"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      disabled={busyUserId === 'invite'}
                    />
                    <input
                      value={inviteClientOrgId}
                      onChange={(e) => setInviteClientOrgId(e.target.value)}
                      placeholder="Client org ID (optional)"
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      disabled={busyUserId === 'invite'}
                    />
                    <button
                      onClick={() => void createPendingUser()}
                      disabled={busyUserId === 'invite'}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Create staged user
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {['User', 'Role', 'Control Center Access', 'Status', 'Actions'].map((header) => (
                          <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const rowBusy = busyUserId === user.id;
                        const editing = editUserId === user.id;
                        return (
                          <Fragment key={user.id}>
                            <tr className="border-b border-slate-100">
                              <td className="px-3 py-2 text-sm text-slate-700">
                                <p className="font-semibold text-slate-900">{user.name}</p>
                                <p className="text-xs text-slate-500">{user.email || user.username}</p>
                                {(user.assignedWorkspaceId || user.assignedClientOrganizationId) ? (
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    {user.assignedWorkspaceId ? `WS: ${user.assignedWorkspaceId}` : null}
                                    {user.assignedWorkspaceId && user.assignedClientOrganizationId ? ' · ' : null}
                                    {user.assignedClientOrganizationId ? `Org: ${user.assignedClientOrganizationId}` : null}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                <select
                                  value={user.normalizedRole || ''}
                                  onChange={(e) => {
                                    const role = e.target.value as MarveoRole;
                                    if (!role) return;
                                    void updateUser(user.id, { masterRole: role });
                                  }}
                                  className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                                  disabled={rowBusy}
                                >
                                  <option value="">Unassigned</option>
                                  {(usersPayload?.marveoRoles ?? []).map((role) => (
                                    <option key={`${user.id}-${role}`} value={role}>{toLabel(role)}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700">
                                {user.controlCenterAccess ? (
                                  <div>
                                    <p className="font-semibold text-emerald-700">Enabled</p>
                                    <p className="mt-1 text-slate-600">
                                      {(user.controlCenterModules && user.controlCenterModules.length > 0)
                                        ? user.controlCenterModules.map(toLabel).join(', ')
                                        : 'No modules assigned'}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">No control center access</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">{toLabel(user.status)}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => void updateUser(user.id, { status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' })}
                                    disabled={rowBusy}
                                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                                  >
                                    {user.status === 'DISABLED' ? 'Re-enable' : 'Disable'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editing) {
                                        setEditUserId(null);
                                        return;
                                      }
                                      setEditUserId(user.id);
                                      setEditDraft({
                                        name: user.name || '',
                                        email: user.email || '',
                                        avatarUrl: user.avatarUrl || '',
                                        assignedWorkspaceId: user.assignedWorkspaceId || '',
                                        assignedClientOrganizationId: user.assignedClientOrganizationId || '',
                                        rawAuthRole: user.rawAuthRole || '',
                                      });
                                    }}
                                    disabled={rowBusy}
                                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                                  >
                                    {editing ? 'Close' : 'Edit'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteUser(user.id)}
                                    disabled={rowBusy}
                                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {editing ? (
                              <tr className="border-b border-slate-100 bg-slate-50/50">
                                <td colSpan={5} className="px-3 py-4">
                                  <div className="grid gap-3 md:grid-cols-6">
                                    <input
                                      value={editDraft.name}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                                      placeholder="Full name"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                      disabled={rowBusy}
                                    />
                                    <input
                                      type="email"
                                      value={editDraft.email}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, email: e.target.value }))}
                                      placeholder="Email"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                      disabled={rowBusy}
                                    />
                                    <div className="flex items-center gap-2">
                                      <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          disabled={rowBusy}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            void (async () => {
                                              try {
                                                setBusyUserId(user.id);
                                                const url = await uploadMedia(file);
                                                setEditDraft((prev) => ({ ...prev, avatarUrl: url }));
                                                setAccessNotice('Avatar uploaded.');
                                              } catch (err) {
                                                setAccessError(err instanceof Error ? err.message : 'Avatar upload failed');
                                              } finally {
                                                setBusyUserId('');
                                              }
                                            })();
                                          }}
                                        />
                                        Avatar
                                      </label>
                                      <input
                                        value={editDraft.avatarUrl}
                                        onChange={(e) => setEditDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                                        placeholder="Avatar URL"
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                        disabled={rowBusy}
                                      />
                                    </div>
                                    <input
                                      value={editDraft.assignedWorkspaceId}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, assignedWorkspaceId: e.target.value }))}
                                      placeholder="Workspace ID"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                      disabled={rowBusy}
                                    />
                                    <input
                                      value={editDraft.assignedClientOrganizationId}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, assignedClientOrganizationId: e.target.value }))}
                                      placeholder="Client org ID"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                      disabled={rowBusy}
                                    />
                                    <input
                                      value={editDraft.rawAuthRole}
                                      onChange={(e) => setEditDraft((prev) => ({ ...prev, rawAuthRole: e.target.value }))}
                                      placeholder="Raw auth role"
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                      disabled={rowBusy}
                                    />
                                  </div>
                                  <div className="mt-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveUserProfile(user.id)}
                                      disabled={rowBusy}
                                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    >
                                      Save profile
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditUserId(null)}
                                      disabled={rowBusy}
                                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
