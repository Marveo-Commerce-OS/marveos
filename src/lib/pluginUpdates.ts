const DEFAULT_OWNER = 'Marveo-Commerce-OS';
const DEFAULT_REPO = 'marveo-connector';

export interface PluginReleaseInfo {
  tag: string;
  version: string;
  detailsUrl: string;
  changelog: string;
  publishedAt: string;
}

function repoOwner(): string {
  return process.env.MARVEO_CONNECTOR_UPDATE_OWNER || DEFAULT_OWNER;
}

function repoName(): string {
  return process.env.MARVEO_CONNECTOR_UPDATE_REPO || DEFAULT_REPO;
}

export function pluginUpdateToken(): string {
  return process.env.GITHUB_PLUGIN_UPDATES_TOKEN || process.env.GITHUB_TOKEN || '';
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Marveo-Plugin-Updater',
  };

  const token = pluginUpdateToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export async function fetchLatestPluginRelease(): Promise<PluginReleaseInfo | null> {
  let latestRelease: PluginReleaseInfo | null = null;

  const releaseRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repoOwner())}/${encodeURIComponent(repoName())}/releases/latest`,
    {
      headers: githubHeaders(),
      cache: 'no-store',
    },
  );

  if (releaseRes.ok) {
    const release = await releaseRes.json();
    if (release?.tag_name) {
      latestRelease = {
        tag: String(release.tag_name),
        version: normalizeVersion(String(release.tag_name)),
        detailsUrl: String(release.html_url || ''),
        changelog: String(release.body || ''),
        publishedAt: String(release.published_at || ''),
      };
    }
  }

  const tagsRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(repoOwner())}/${encodeURIComponent(repoName())}/tags?per_page=1`,
    {
      headers: githubHeaders(),
      cache: 'no-store',
    },
  );

  if (!tagsRes.ok) {
    return null;
  }

  const tags = await tagsRes.json();
  const tag = tags?.[0]?.name;
  if (!tag) {
    return latestRelease;
  }

  const tagRelease: PluginReleaseInfo = {
    tag: String(tag),
    version: normalizeVersion(String(tag)),
    detailsUrl: `https://github.com/${repoOwner()}/${repoName()}/releases/tag/${encodeURIComponent(String(tag))}`,
    changelog: `Version ${normalizeVersion(String(tag))}`,
    publishedAt: '',
  };

  if (!latestRelease) {
    return tagRelease;
  }

  return compareVersions(tagRelease.version, latestRelease.version) > 0 ? tagRelease : latestRelease;
}

export async function fetchPluginZip(tag: string): Promise<Response> {
  return fetch(
    `https://api.github.com/repos/${encodeURIComponent(repoOwner())}/${encodeURIComponent(repoName())}/zipball/${encodeURIComponent(tag)}`,
    {
      headers: githubHeaders(),
      cache: 'no-store',
      redirect: 'follow',
    },
  );
}
