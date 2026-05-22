export type ActivityType =
  | "project_created"
  | "project_updated"
  | "task_created"
  | "task_updated"
  | "task_moved"
  | "task_assigned"
  | "comment_added"
  | "member_joined"
  | "member_left"
  | "channel_created"
  | "message_sent";

export interface Activity {
  id: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
