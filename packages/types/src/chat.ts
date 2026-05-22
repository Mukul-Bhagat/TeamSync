export interface Channel {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  isAI: boolean;
  createdAt: string;
  updatedAt: string;
}
