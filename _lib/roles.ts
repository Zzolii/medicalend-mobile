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
  providerDoctorId: number | null;
  provider_doctor_id: number | null;
  clinicId: number | null;
  clinic_id: number | null;
};

type MembershipLike = {
  id?: number | null;
  role?: string | null;
  clinic_role?: string | null;
  staff_role?: string | null;
  type?: string | null;
  is_active?: boolean | null;
  clinic_id?: number | null;
  clinicId?: number | null;
  provider_doctor_id?: number | null;
  providerDoctorId?: number | null;
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
  clinic_id?: number | null;
  clinicId?: number | null;
  provider_doctor_id?: number | null;
  providerDoctorId?: number | null;
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

function getMemberships(me: MeLike | null | undefined): MembershipLike[] {
  if (!me) return [];

  if (Array.isArray(me.clinic_memberships)) {
    return me.clinic_memberships;
  }

  if (Array.isArray(me.memberships)) {
    return me.memberships;
  }

  return [];
}

function getActiveMembership(
  me: MeLike | null | undefined,
): MembershipLike | null {
  const memberships = getMemberships(me);
  return memberships.find((m) => m?.is_active) ?? memberships[0] ?? null;
}

function extractMembershipRole(
  me: MeLike | null | undefined,
): ClinicRole | null {
  if (!me) return null;

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

  const activeMembership = getActiveMembership(me);

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

  const fallbackCandidates = [me.role, me.user_role, me.type];

  for (const candidate of fallbackCandidates) {
    const role = normalizeRole(candidate);
    if (role !== "unknown") return role;
  }

  return null;
}

function extractProviderDoctorId(me: MeLike | null | undefined): number | null {
  if (!me) return null;

  const direct = me.provider_doctor_id ?? me.providerDoctorId ?? null;
  if (typeof direct === "number") return direct;

  const activeMembership = getActiveMembership(me);
  const fromMembership =
    activeMembership?.provider_doctor_id ??
    activeMembership?.providerDoctorId ??
    null;

  if (typeof fromMembership === "number") return fromMembership;

  const doctorMembership = getMemberships(me).find((membership) => {
    const role = normalizeRole(
      membership.role ??
        membership.clinic_role ??
        membership.staff_role ??
        membership.type,
    );

    const providerDoctorId =
      membership.provider_doctor_id ?? membership.providerDoctorId ?? null;

    return role === "doctor" && typeof providerDoctorId === "number";
  });

  const providerDoctorId =
    doctorMembership?.provider_doctor_id ??
    doctorMembership?.providerDoctorId ??
    null;

  return typeof providerDoctorId === "number" ? providerDoctorId : null;
}

function extractClinicId(me: MeLike | null | undefined): number | null {
  if (!me) return null;

  const direct = me.clinic_id ?? me.clinicId ?? null;
  if (typeof direct === "number") return direct;

  const activeMembership = getActiveMembership(me);
  const fromMembership =
    activeMembership?.clinic_id ?? activeMembership?.clinicId ?? null;

  return typeof fromMembership === "number" ? fromMembership : null;
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

    const providerDoctorId = extractProviderDoctorId(me);
    const clinicId = extractClinicId(me);

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
      providerDoctorId,
      provider_doctor_id: providerDoctorId,
      clinicId,
      clinic_id: clinicId,
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
      providerDoctorId: null,
      provider_doctor_id: null,
      clinicId: null,
      clinic_id: null,
    };
  }
}
