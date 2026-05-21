import { api } from "./api";

/**
 * Provider dashboard types
 * - Ezt használja a provider/(tabs)/dashboard.tsx és az appointments.tsx is
 */

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "canceled"
  | "no_show"
  | "in_progress"
  | string;

export type ProviderAppointmentOut = {
  id: number;
  patient_id: number;
  provider_id: number;
  episode_id?: number | null;
  start_time: string;
  end_time?: string | null;
  status: AppointmentStatus;
  notes?: string | null;
  created_at?: string;
};

export type ProviderReferralOut = {
  id: number;
  episode_id: number;
  from_provider_id: number;
  to_provider_id: number;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "completed" | string;
  rejection_reason?: string | null;
  created_at: string;
};

export type ProviderDashboard = {
  today_appointments: ProviderAppointmentOut[];
  pending_referrals: ProviderReferralOut[];
};

/**
 * Backward-compat export:
 * a dashboard.tsx-ed most ProviderDashboardOut-ot importál.
 * Ne törjön el.
 */
export type ProviderDashboardOut = ProviderDashboard;

export async function fetchProviderDashboard(): Promise<ProviderDashboard> {
  const res = await api.get("/dashboard/provider");
  return res.data as ProviderDashboard;
}
