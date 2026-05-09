'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface DeploymentLink {
  id: string;
  plan: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  workspaceId?: string;
  provisioning: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
  };
}

interface DeploymentResponse {
  accountPlan: string;
  workspaceCount: number;
  workspaceLimit: number;
  links: DeploymentLink[];
}

interface GenerateResponse {
  success: boolean;
  linkId: string;
  workspaceId: string;
  provisioningUrl: string;
  deploymentLink: DeploymentLink;
}

export default function DeploymentPage() {
  const [plan, setPlan] = useState<string>('starter');
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [workspaceLimit, setWorkspaceLimit] = useState(1);
  const [links, setLinks] = useState<DeploymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    businessType: 'Retail',
    country: 'US',
    businessModel: 'B2C',
    contentSource: 'wordpress',
    contentBaseUrl: '',
  });

  const businessTypes = ['Retail', 'Wholesale', 'Manufacturing', 'Services', 'Healthcare', 'Education', 'Hospitality', 'Technology'];
  const businessModels = ['B2C', 'B2B', 'B2B2C', 'Marketplace', 'Subscription', 'Hybrid'];
  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'KE', name: 'Kenya' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'IN', name: 'India' },
  ];

  useEffect(() => {
    fetchDeploymentLinks();
  }, []);

  async function fetchDeploymentLinks() {
    try {
      setLoading(true);
      const res = await fetch('/api/cloud/deployment-links');
      if (!res.ok) throw new Error('Failed to fetch deployment links');
      const data: DeploymentResponse = await res.json();
      setPlan(data.accountPlan);
      setWorkspaceCount(data.workspaceCount);
      setWorkspaceLimit(data.workspaceLimit);
      setLinks(data.links);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading deployment links');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLink(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.contentBaseUrl.trim()) {
      setError('Workspace name and content base URL are required');
      return;
    }

    if (workspaceCount >= workspaceLimit) {
      setError(`Workspace limit reached (${plan}: ${workspaceLimit} max)`);
      return;
    }

    try {
      setGeneratingLink(true);
      setError(null);

      const res = await fetch('/api/cloud/deployment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          businessType: formData.businessType,
          country: formData.country,
          businessModel: formData.businessModel,
          contentSource: formData.contentSource,
          contentBaseUrl: formData.contentBaseUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate deployment link');
      }

      const data: GenerateResponse = await res.json();

      setSuccessMessage(`Deployment link generated! Copy the URL to share with your team.`);
      setFormData({
        name: '',
        businessType: 'Retail',
        country: 'US',
        businessModel: 'B2C',
        contentSource: 'wordpress',
        contentBaseUrl: '',
      });

      // Refresh links
      await fetchDeploymentLinks();

      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating deployment link');
    } finally {
      setGeneratingLink(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const remainingWorkspaces = Math.max(0, workspaceLimit - workspaceCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployment Links</h1>
          <p className="text-gray-600 mt-1">Generate deployment links to provision new workspaces</p>
        </div>
        <Link href="/dashboard/workspaces" className="text-blue-600 hover:text-blue-700 underline">
          View Workspaces
        </Link>
      </div>

      {/* Plan Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Current Plan</p>
            <p className="text-2xl font-bold capitalize text-blue-900">{plan}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Workspaces</p>
            <p className="text-2xl font-bold text-blue-900">
              {workspaceCount}/{workspaceLimit}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Remaining</p>
            <p className={`text-2xl font-bold ${remainingWorkspaces > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remainingWorkspaces}
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-green-900">Success</p>
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Generate Link Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Generate New Deployment Link</h2>

        {remainingWorkspaces === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-900">
              You've reached your workspace limit for the <span className="font-semibold capitalize">{plan}</span> plan. Upgrade your plan to create more workspaces.
            </p>
          </div>
        ) : (
          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Acme Corp Workspace"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                >
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Model</label>
                <select
                  value={formData.businessModel}
                  onChange={(e) => setFormData({ ...formData, businessModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                >
                  {businessModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Source</label>
                <select
                  value={formData.contentSource}
                  onChange={(e) => setFormData({ ...formData, contentSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                >
                  <option value="wordpress">WordPress</option>
                  <option value="nextjs">Next.js</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Base URL *</label>
                <input
                  type="url"
                  value={formData.contentBaseUrl}
                  onChange={(e) => setFormData({ ...formData, contentBaseUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={generatingLink}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generatingLink}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {generatingLink ? 'Generating...' : 'Generate Deployment Link'}
            </button>
          </form>
        )}
      </div>

      {/* Deployment Links List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Deployment Links ({links.length})</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading deployment links...</div>
        ) : links.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No deployment links generated yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Link ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Expires</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const isExpired = new Date() > new Date(link.expiresAt);
                  const createdDate = new Date(link.createdAt).toLocaleString();
                  const expiresDate = new Date(link.expiresAt).toLocaleString();

                  return (
                    <tr key={link.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{link.id.substring(0, 8)}...</code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                              <AlertCircle size={14} /> Expired
                            </span>
                          ) : link.used ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              <CheckCircle size={14} /> Used
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              <Clock size={14} /> Pending
                            </span>
                          )}
                          {link.provisioning.status === 'in_progress' && (
                            <span className="text-xs text-gray-500">
                              ({link.provisioning.currentStep}/{link.provisioning.totalSteps})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{createdDate}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{expiresDate}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => copyToClipboard(link.id, link.id)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                          title="Copy link ID"
                        >
                          {copiedId === link.id ? (
                            <>
                              <CheckCircle size={16} /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={16} /> Copy
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
