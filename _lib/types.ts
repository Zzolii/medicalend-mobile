export type UserRole = "patient" | "provider" | "provider_pending" | "admin";

export type MeResponse = {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};
