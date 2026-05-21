// Path: medicalend-mobile/_lib/admin.ts

import { api } from "./api";

export type AdminProviderRow = {
  id: number;
  user_id?: number | null;
  clinic_id?: number | null;

  status?: "pending" | "approved" | "rejected" | null;
  rejection_reason?: string | null;

  provider_type?: "clinic" | "home_care" | null;

  name?: string | null;
  specialty?: string | null;
  services_offered?: string | null;
  license_number?: string | null;

  cui?: string | null;
  trade_register_number?: string | null;

  contact_person_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  phone?: string | null;
  email?: string | null;

  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  postal_code?: string | null;
  country?: string | null;

  coverage_area?: string | null;

  sanitary_authorization_number?: string | null;
  sanitary_authorization_expires_at?: string | null;

  healthcare_compliance_confirmed?: boolean | null;
  provider_agreement_accepted?: boolean | null;

  is_active?: boolean | null;
  fhir_id?: string | null;

  created_at?: string;
};

export type AdminReferralRow = {
  id: number;
  episode_id: number;
  from_provider_id: number;
  to_provider_id: number;
  status: string;
  reason?: string | null;
  created_at?: string;
};

export type AdminStats = {
  total_users: number;
  total_patients: number;
  total_providers: number;

  pending_providers: number;
  approved_providers: number;
  rejected_providers: number;

  total_clinics: number;
  active_clinics: number;

  total_referrals: number;

  total_subscription_plans?: number;
  active_subscription_plans?: number;

  total_clinic_subscriptions?: number;
  active_subscriptions?: number;
  trialing_subscriptions?: number;
  expired_subscriptions?: number;
  canceled_subscriptions?: number;
  subscriptions_expiring_soon?: number;

  active_users_30d?: number;
  new_patients_30d?: number;
  appointments_7d?: number;
  appointments_total?: number;
  timeline_entries?: number;
  documents_total?: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isDeletedAdminProvider(item: AdminProviderRow): boolean {
  const rejectionReason = normalizeText(item.rejection_reason);

  return (
    item.is_active === false &&
    item.status === "rejected" &&
    rejectionReason.includes("deleted/deactivated by platform admin")
  );
}

function visibleAdminProviders(items: AdminProviderRow[]): AdminProviderRow[] {
  return items.filter((item) => !isDeletedAdminProvider(item));
}

export async function fetchAdminPendingProviders(): Promise<
  AdminProviderRow[]
> {
  const res = await api.get("/admin/providers/pending");
  return visibleAdminProviders((res.data ?? []) as AdminProviderRow[]);
}

export async function fetchAdminProviders(): Promise<AdminProviderRow[]> {
  const res = await api.get("/admin/providers");
  return visibleAdminProviders((res.data ?? []) as AdminProviderRow[]);
}

export async function approveAdminProvider(
  providerId: number,
): Promise<AdminProviderRow> {
  const res = await api.post(`/admin/providers/${providerId}/approve`);
  return res.data as AdminProviderRow;
}

export async function rejectAdminProvider(
  providerId: number,
  reason: string,
): Promise<AdminProviderRow> {
  const res = await api.post(`/admin/providers/${providerId}/reject`, {
    reason,
  });
  return res.data as AdminProviderRow;
}

export async function deleteAdminProvider(
  providerId: number,
): Promise<{ ok: boolean; provider_id: number }> {
  const res = await api.delete(`/admin/providers/${providerId}`);
  return res.data as { ok: boolean; provider_id: number };
}

export async function fetchAdminRecentReferrals(): Promise<AdminReferralRow[]> {
  const res = await api.get("/admin/referrals/recent");
  return (res.data ?? []) as AdminReferralRow[];
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await api.get("/admin/stats");
  return res.data as AdminStats;
}
