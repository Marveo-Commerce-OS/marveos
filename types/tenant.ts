export interface TenantModel {
  id: string;
  organizationId: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}
