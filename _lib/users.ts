// Path: medicalend-mobile/_lib/users.ts

import { api } from "./api";

export type ClinicStaffRole =
  | "clinic_admin"
  | "doctor"
  | "assistant"
  | "reception";

export type ClinicStaffRow = {
  user_id: number;
  email: string;
  global_role: string;
  user_is_active: boolean;

  membership_id: number;
  clinic_id: number;
  clinic_role: string;
  provider_doctor_id?: number | null;
  provider_doctor_name?: string | null;
  membership_is_active: boolean;

  created_at: string;
};

export type ClinicStaffCreatePayload = {
  email: string;
  password: string;
  clinic_role: ClinicStaffRole;
  provider_doctor_id?: number | null;
  is_active?: boolean;
};

export type ClinicStaffUpdatePayload = {
  clinic_role?: ClinicStaffRole;
  provider_doctor_id?: number | null;
  is_active?: boolean;
  password?: string;
};

export async function fetchClinicStaff(): Promise<ClinicStaffRow[]> {
  const res = await api.get("/users/clinic/staff");
  return (res.data ?? []) as ClinicStaffRow[];
}

export async function createClinicStaff(
  payload: ClinicStaffCreatePayload,
): Promise<ClinicStaffRow> {
  const res = await api.post("/users/clinic/staff", payload);
  return res.data as ClinicStaffRow;
}

export async function updateClinicStaff(
  userId: number,
  payload: ClinicStaffUpdatePayload,
): Promise<ClinicStaffRow> {
  const res = await api.put(`/users/clinic/staff/${userId}`, payload);
  return res.data as ClinicStaffRow;
}

export async function deleteClinicStaff(userId: number): Promise<void> {
  await api.delete(`/users/clinic/staff/${userId}`);
}
