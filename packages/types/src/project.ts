export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  workspaceId: string;
  ownerId: string;
  color: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}
