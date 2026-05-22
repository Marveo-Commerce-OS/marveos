import { redirect } from 'next/navigation';

export default async function DashboardMvpDeploymentsDetailRedirectPage(
  props: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await props.params;
  redirect(`/master/mvp-deployments/${workspaceId}`);
}
