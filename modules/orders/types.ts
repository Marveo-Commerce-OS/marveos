export interface UpdateOrderStatusInput {
  id: number;
  status: string;
  token: string;
  actorEmail: string;
}

export interface WorkspaceScopedOrderMutation {
  workspaceId: string;
  subscriptionId?: string;
  order: {
    id: number;
    status: string;
  };
}
