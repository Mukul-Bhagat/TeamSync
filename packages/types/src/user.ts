import type { UserRole } from "./auth";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  organizationId: string | null;
  status: "online" | "offline" | "away";
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  updatedAt: string;
}
