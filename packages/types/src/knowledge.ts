export interface KnowledgePage {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  workspaceId: string;
  categoryId: string | null;
  authorId: string;
  parentId: string | null;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
  description: string | null;
  color: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}
