export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  ownerId: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string;
  color?: string;
}
