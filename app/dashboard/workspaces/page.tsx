'use client';

import { useEffect, useMemo, useState } from 'react';

type OnboardingAction = 'start' | 'complete' | 'fail' | 'retry' | 'rollback';
type RolloutChannel = 'stable' | 'beta';

interface Workspace {
  id: string;
  name: string;
  businessType: string;
  country: string;
  businessModel: string;
  status: 'draft' | 'onboarding' | 'ready_for_launch' | 'launched' | 'blocked';
  onboardingSteps: Array<{
    step: number;
    key: string;
    status: string;
    retryCount: number;
    maxRetries: number;
    lastError?: string;
  }>;
  rollout: {
    pageSchemaVersion: number;
    componentSchemaVersion: number;
    channel: RolloutChannel;
  };
}

interface LaunchGuardResult {
  ready: boolean;
  deploymentReadiness: Record<string, boolean>;
  missingRequirements: string[];
  recoveryActions: string[];
}

interface ConnectorCommandRecord {
  id: string;
  type: 'content_mapping_sync' | 'module_activation';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  attempts: number;
  auditId: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Create Workspace',
  2: 'Install Connector Plugin',
  3: 'Connect Site',
  4: 'Site Detection',
  5: 'Onboarding Path',
  6: 'Architecture Selection',
  7: 'Module Selection',
  8: 'Brand Setup',
  9: 'Structure Generation',
  10: 'Validation',
  11: 'Launch',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  rolled_back: 'bg-amber-100 text-amber-700',
  onboarding: 'bg-blue-100 text-blue-700',
  ready_for_launch: 'bg-emerald-100 text-emerald-700',
  launched: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  queued: 'bg-slate-100 text-slate-700',
  processing: 'bg-blue-100 text-blue-700',
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function createStarterPageSchema(workspace: Workspace) {
  return {
    pages: [
      {
        id: 'home',
        title: `${workspace.name} Home`,
        slug: 'home',
        page_type: 'home',
        source: 'marveo_cloud',
        seo: {},
        components: [
          {
            key: 'hero',
            props: {
              title: workspace.name,
              subtitle: workspace.businessType,
              cta: 'Launch Commerce',
            },
          },
          { key: 'product_grid', props: { title: 'Featured Products', limit: 8 } },
          {
            key: 'cta',
            props: {
              title: 'Start Selling',
              description: 'Ready to launch your Commerce OS website?',
            },
          },
        ],
        navigation_visibility: true,
        frontend_visibility: true,
        template: 'default',
        status: 'publish',
      },
    ],
  };
}

function createStarterComponentSchema() {
  return {
    components: [
      {
        key: 'hero',
        name: 'Hero',
        category: 'layout',
        fields: ['title', 'subtitle', 'cta'],
        allowed_page_types: ['home', 'page'],
        data_source: 'settings',
        visibility: 'public',
      },
      {
        key: 'product_grid',
        name: 'Product Grid',
        category: 'commerce',
        fields: ['title', 'limit'],
        allowed_page_types: ['home', 'catalog'],
        data_source: 'products',
        visibility: 'public',
      },
      {
        key: 'cta',
        name: 'CTA',
        category: 'conversion',
        fields: ['title', 'description'],
        allowed_page_types: ['home', 'page'],
        data_source: 'settings',
        visibility: 'public',
      },
    ],
  };
}

function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cloud/workspaces', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load workspaces');
      }

      setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { workspaces, setWorkspaces, loading, error, reload: load };
}

export default function WorkspacesPage() {
  const { workspaces, setWorkspaces, loading, error, reload } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    businessType: '',
    country: '',
    businessModel: '',
  });
  const [busyAction, setBusyAction] = useState('');
  const [formError, setFormError] = useState('');
  const [launchGuard, setLaunchGuard] = useState<LaunchGuardResult | null>(null);

  const [schemaChannel, setSchemaChannel] = useState<RolloutChannel>('stable');
  const [activateSchema, setActivateSchema] = useState(true);
  const [pageSchemaText, setPageSchemaText] = useState('{}');
  const [componentSchemaText, setComponentSchemaText] = useState('{}');
  const [commands, setCommands] = useState<ConnectorCommandRecord[]>([]);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [isCommandsLoading, setIsCommandsLoading] = useState(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find((item) => item.id === selectedWorkspaceId) || null,
    [workspaces, selectedWorkspaceId],
  );

  useEffect(() => {
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!selectedWorkspace) {
      setCommands([]);
      return;
    }

    const loadWorkspaceSchemas = async () => {
      setIsSchemaLoading(true);
      try {
        const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/schemas`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load schema versions');
        }

        const latestPageSchema = Array.isArray(data.pageSchemas) && data.pageSchemas.length > 0
          ? data.pageSchemas[data.pageSchemas.length - 1]?.data
          : createStarterPageSchema(selectedWorkspace);

        const latestComponentSchema = Array.isArray(data.componentSchemas) && data.componentSchemas.length > 0
          ? data.componentSchemas[data.componentSchemas.length - 1]?.data
          : createStarterComponentSchema();

        setPageSchemaText(prettyJson(latestPageSchema));
        setComponentSchemaText(prettyJson(latestComponentSchema));
        setSchemaChannel(data?.rollout?.channel === 'beta' ? 'beta' : 'stable');
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsSchemaLoading(false);
      }
    };

    const loadCommandHistory = async () => {
      setIsCommandsLoading(true);
      try {
        const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/connector-commands`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load command history');
        }

        setCommands(Array.isArray(data.commands) ? data.commands : []);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsCommandsLoading(false);
      }
    };

    void loadWorkspaceSchemas();
    void loadCommandHistory();
  }, [selectedWorkspace]);

  const createWorkspace = async () => {
    setFormError('');
    setBusyAction('create-workspace');
    try {
      const res = await fetch('/api/cloud/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Workspace creation failed');
      }

      setCreateForm({ name: '', businessType: '', country: '', businessModel: '' });
      await reload();
      if (data.workspace?.id) {
        setSelectedWorkspaceId(data.workspace.id);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyAction('');
    }
  };

  const updateOnboardingStep = async (step: number, action: OnboardingAction) => {
    if (!selectedWorkspace) return;

    setBusyAction(`step-${step}-${action}`);
    setFormError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/onboarding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Step update failed');
      }

      setWorkspaces((current) =>
        current.map((item) => (item.id === selectedWorkspace.id ? data.workspace : item)),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyAction('');
    }
  };

  const loadCommands = async (workspaceId: string) => {
    const res = await fetch(`/api/cloud/workspaces/${workspaceId}/connector-commands`, {
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to load command history');
    }
    setCommands(Array.isArray(data.commands) ? data.commands : []);
  };

  const runCommand = async (type: 'content_mapping_sync' | 'module_activation') => {
    if (!selectedWorkspace) return;

    setBusyAction(`command-${type}`);
    setFormError('');

    const payload =
      type === 'content_mapping_sync'
        ? {
            mappings: [
              {
                source_id: 'home',
                source_type: 'page',
                target_key: 'homepage',
                overwrite: false,
              },
            ],
          }
        : {
            modules: selectedWorkspace.onboardingSteps.some(
              (item) => item.key === 'module_selection' && item.status === 'completed',
            )
              ? ['products', 'blog', 'pages']
              : ['products'],
          };

    try {
      const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/connector-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Command failed');
      }

      await reload();
      await loadCommands(selectedWorkspace.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyAction('');
    }
  };

  const applyStarterSchemas = () => {
    if (!selectedWorkspace) return;

    setPageSchemaText(prettyJson(createStarterPageSchema(selectedWorkspace)));
    setComponentSchemaText(prettyJson(createStarterComponentSchema()));
  };

  const publishSchemas = async () => {
    if (!selectedWorkspace) return;

    setBusyAction('publish-schemas');
    setFormError('');
    try {
      const pageSchema = JSON.parse(pageSchemaText) as Record<string, unknown>;
      const componentSchema = JSON.parse(componentSchemaText) as Record<string, unknown>;

      const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/schemas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSchema,
          componentSchema,
          activate: activateSchema,
          channel: schemaChannel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Schema publish failed');
      }

      await reload();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setFormError('Schema JSON is invalid. Please fix formatting and retry.');
      } else {
        setFormError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setBusyAction('');
    }
  };

  const runLaunchGuard = async (launch: boolean) => {
    if (!selectedWorkspace) return;

    setBusyAction(launch ? 'launch-now' : 'launch-validate');
    setFormError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${selectedWorkspace.id}/launch-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launch }),
      });
      const data = await res.json();

      setLaunchGuard({
        ready: !data.blocked,
        deploymentReadiness: data.deploymentReadiness || {},
        missingRequirements: data.missingRequirements || [],
        recoveryActions: data.recoveryActions || [],
      });

      if (!res.ok && res.status !== 409) {
        throw new Error(data?.error || 'Launch guard request failed');
      }

      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cloud Workspaces</h1>
        <p className="text-sm text-gray-500 mt-1">
          End-to-end orchestration for onboarding, connector commands, schema rollout, and launch guard.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Workspace</h2>
          <div className="space-y-3">
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Workspace name"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            <input
              value={createForm.businessType}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, businessType: event.target.value }))}
              placeholder="Business type"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            <input
              value={createForm.country}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, country: event.target.value }))}
              placeholder="Country"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            <input
              value={createForm.businessModel}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, businessModel: event.target.value }))}
              placeholder="Business model"
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm"
            />
            <button
              onClick={createWorkspace}
              disabled={busyAction === 'create-workspace'}
              className="w-full h-10 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
            >
              {busyAction === 'create-workspace' ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Workspace List</h3>
            {loading ? <p className="text-xs text-gray-400">Loading...</p> : null}
            {!loading && workspaces.length === 0 ? (
              <p className="text-xs text-gray-400">No workspaces yet.</p>
            ) : null}
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                  selectedWorkspaceId === workspace.id
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{workspace.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {workspace.businessType} · {workspace.country}
                </p>
                <span
                  className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_CLASSES[workspace.status] || 'bg-gray-100 text-gray-700'}`}
                >
                  {workspace.status.replace(/_/g, ' ')}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedWorkspace ? selectedWorkspace.name : 'Select a workspace'}
              </h2>
              {selectedWorkspace ? (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedWorkspace.businessType} · {selectedWorkspace.country} · {selectedWorkspace.businessModel}
                </p>
              ) : null}
            </div>
            <button
              onClick={reload}
              className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {selectedWorkspace ? (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Onboarding Steps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedWorkspace.onboardingSteps.map((step) => (
                    <div key={step.step} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">
                          {step.step}. {STEP_LABELS[step.step] || step.key}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_CLASSES[step.status] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {step.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Retries: {step.retryCount}/{step.maxRetries}
                      </p>
                      {step.lastError ? <p className="text-xs text-red-600 mt-1">{step.lastError}</p> : null}
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {(['start', 'complete', 'retry', 'rollback'] as OnboardingAction[]).map((action) => (
                          <button
                            key={action}
                            onClick={() => updateOnboardingStep(step.step, action)}
                            disabled={busyAction === `step-${step.step}-${action}`}
                            className="h-7 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {busyAction === `step-${step.step}-${action}` ? '...' : action}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => runCommand('content_mapping_sync')}
                  disabled={busyAction === 'command-content_mapping_sync'}
                  className="h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busyAction === 'command-content_mapping_sync'
                    ? 'Syncing...'
                    : 'Run Content Mapping Sync'}
                </button>
                <button
                  onClick={() => runCommand('module_activation')}
                  disabled={busyAction === 'command-module_activation'}
                  className="h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busyAction === 'command-module_activation' ? 'Activating...' : 'Activate Modules'}
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">Schema Rollout Editor</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={applyStarterSchemas}
                      className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Use Starter Schema
                    </button>
                    <button
                      onClick={publishSchemas}
                      disabled={busyAction === 'publish-schemas'}
                      className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busyAction === 'publish-schemas' ? 'Publishing...' : 'Publish Schema'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-gray-600">Channel</span>
                    <select
                      value={schemaChannel}
                      onChange={(event) => setSchemaChannel(event.target.value === 'beta' ? 'beta' : 'stable')}
                      className="h-8 rounded-lg border border-gray-200 px-2 text-gray-700"
                    >
                      <option value="stable">stable</option>
                      <option value="beta">beta</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={activateSchema}
                      onChange={(event) => setActivateSchema(event.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Activate on publish
                  </label>

                  <span className="text-gray-500">
                    Rollout: Page v{selectedWorkspace.rollout.pageSchemaVersion} · Component v
                    {selectedWorkspace.rollout.componentSchemaVersion} · {selectedWorkspace.rollout.channel}
                  </span>
                </div>

                {isSchemaLoading ? <p className="text-xs text-gray-400">Loading schema versions...</p> : null}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Page Schema JSON</p>
                    <textarea
                      value={pageSchemaText}
                      onChange={(event) => setPageSchemaText(event.target.value)}
                      className="w-full h-56 rounded-xl border border-gray-200 p-3 text-xs font-mono text-gray-800"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Component Schema JSON</p>
                    <textarea
                      value={componentSchemaText}
                      onChange={(event) => setComponentSchemaText(event.target.value)}
                      className="w-full h-56 rounded-xl border border-gray-200 p-3 text-xs font-mono text-gray-800"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Connector Command History</h3>
                  <button
                    onClick={() => selectedWorkspace && loadCommands(selectedWorkspace.id)}
                    className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Refresh History
                  </button>
                </div>

                {isCommandsLoading ? <p className="text-xs text-gray-400">Loading command history...</p> : null}
                {!isCommandsLoading && commands.length === 0 ? (
                  <p className="text-xs text-gray-400">No command records for this workspace yet.</p>
                ) : null}

                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {commands.map((command) => (
                    <div key={command.id} className="rounded-lg border border-gray-200 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{command.type}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CLASSES[command.status] || 'bg-gray-100 text-gray-700'}`}
                          >
                            {command.status}
                          </span>
                        </div>
                        <span className="text-gray-500">attempts: {command.attempts}</span>
                      </div>
                      <p className="text-gray-500 mt-1">audit: {command.auditId}</p>
                      <p className="text-gray-500">{new Date(command.createdAt).toLocaleString()}</p>
                      {command.lastError ? <p className="text-red-600 mt-1">{command.lastError}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Launch Guard</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => runLaunchGuard(false)}
                    disabled={busyAction === 'launch-validate'}
                    className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busyAction === 'launch-validate' ? 'Validating...' : 'Validate Launch'}
                  </button>
                  <button
                    onClick={() => runLaunchGuard(true)}
                    disabled={busyAction === 'launch-now'}
                    className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyAction === 'launch-now' ? 'Launching...' : 'Launch Site'}
                  </button>
                </div>

                {launchGuard ? (
                  <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {launchGuard.ready ? 'Launch Ready' : 'Launch Blocked'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                      {Object.entries(launchGuard.deploymentReadiness).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5">
                          <span>{key}</span>
                          <span className={value ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {value ? 'OK' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {launchGuard.missingRequirements.length > 0 ? (
                      <ul className="text-xs text-red-600 list-disc list-inside space-y-1">
                        {launchGuard.missingRequirements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {launchGuard.recoveryActions.length > 0 ? (
                      <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                        {launchGuard.recoveryActions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Create or select a workspace to begin orchestration.</p>
          )}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
        </section>
      </div>
    </div>
  );
}
