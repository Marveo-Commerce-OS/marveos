export interface WorkspaceModel {
  id: string;
  tenantId: string;
  name: string;
  professionKey?: string;
  status: 'DRAFT' | 'PROVISIONING' | 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}
