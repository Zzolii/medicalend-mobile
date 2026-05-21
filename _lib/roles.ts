// Path: medicalend-mobile/_lib/roles.ts

import { fetchMe } from "./me";

export type ClinicRole =
  | "clinic_admin"
  | "doctor"
  | "assistant"
  | "reception"
  | "provider"
  | "patient"
  | "admin"
  | "unknown";

export type RoleContext = {
  appRole: ClinicRole;
  labelRo: string;
  isClinicAdmin: boolean;
  isDoctor: boolean;
  isAssistant: boolean;
  isReception: boolean;
  hasClinicalAccess: boolean;
  canSeeOrganizationTools: boolean;
  canManageProviderProfile: boolean;
};

type MembershipLike = {
  role?: string | null;
  clinic_role?: string | null;
  staff_role?: string | null;
  type?: string | null;
  is_active?: boolean | null;
};

type MeLike = {
  role?: string | null;
  user_role?: string | null;
  type?: string | null;
  clinic_role?: string | null;
  active_clinic_role?: string | null;
  membership_role?: string | null;
  staff_role?: string | null;
  provider_role?: string | null;
  clinic_memberships?: MembershipLike[] | null;
  memberships?: MembershipLike[] | null;
};

function normalizeRole(raw?: string | null): ClinicRole {
  const value = String(raw || "")
    .trim()
    .toLowerCase();

  if (!value) return "unknown";
  if (value === "clinic_admin") return "clinic_admin";
  if (value === "doctor") return "doctor";
  if (value === "assistant") return "assistant";
  if (value === "reception" || value === "receptionist") return "reception";
  if (value === "provider") return "provider";
  if (value === "patient") return "patient";
  if (value === "admin") return "admin";

  return "unknown";
}

function extractMembershipRole(
  me: MeLike | null | undefined,
): ClinicRole | null {
  if (!me) return null;

  // 1) Először az explicit clinic/staff role mezőket nézzük
  const explicitClinicCandidates = [
    me.clinic_role,
    me.active_clinic_role,
    me.membership_role,
    me.staff_role,
    me.provider_role,
  ];

  for (const candidate of explicitClinicCandidates) {
    const role = normalizeRole(candidate);
    if (role !== "unknown") return role;
  }

  // 2) Utána a membership listát nézzük
  const memberships = Array.isArray(me.clinic_memberships)
    ? me.clinic_memberships
    : Array.isArray(me.memberships)
      ? me.memberships
      : [];

  const activeMembership =
    memberships.find((m) => m?.is_active) ?? memberships[0] ?? null;

  if (activeMembership) {
    const membershipCandidates = [
      activeMembership.role,
      activeMembership.clinic_role,
      activeMembership.staff_role,
      activeMembership.type,
    ];

    for (const candidate of membershipCandidates) {
      const role = normalizeRole(candidate);
      if (role !== "unknown") return role;
    }
  }

  // 3) Csak legvégén essen vissza a globális user role-ra
  const fallbackCandidates = [me.role, me.user_role, me.type];

  for (const candidate of fallbackCandidates) {
    const role = normalizeRole(candidate);
    if (role !== "unknown") return role;
  }

  return null;
}

function roleLabelRo(appRole: ClinicRole) {
  if (appRole === "clinic_admin") return "Administrator clinică";
  if (appRole === "doctor") return "Medic";
  if (appRole === "assistant") return "Asistent medical";
  if (appRole === "reception") return "Recepție";
  if (appRole === "provider") return "Furnizor medical";
  if (appRole === "admin") return "Administrator";
  if (appRole === "patient") return "Pacient";
  return "Utilizator";
}

export async function getRoleContext(): Promise<RoleContext> {
  try {
    const me = (await fetchMe()) as MeLike;
    const appRole =
      extractMembershipRole(me) ?? normalizeRole(me?.role) ?? "unknown";

    const isClinicAdmin = appRole === "clinic_admin";
    const isDoctor = appRole === "doctor";
    const isAssistant = appRole === "assistant";
    const isReception = appRole === "reception";

    const hasClinicalAccess =
      isClinicAdmin || isDoctor || isAssistant || isReception;

    const canSeeOrganizationTools = isClinicAdmin;
    const canManageProviderProfile = isClinicAdmin || appRole === "provider";

    return {
      appRole,
      labelRo: roleLabelRo(appRole),
      isClinicAdmin,
      isDoctor,
      isAssistant,
      isReception,
      hasClinicalAccess,
      canSeeOrganizationTools,
      canManageProviderProfile,
    };
  } catch {
    return {
      appRole: "unknown",
      labelRo: "Utilizator",
      isClinicAdmin: false,
      isDoctor: false,
      isAssistant: false,
      isReception: false,
      hasClinicalAccess: false,
      canSeeOrganizationTools: false,
      canManageProviderProfile: false,
    };
  }
}
