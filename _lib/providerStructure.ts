import { api } from "./api";

export type ProviderSpecialtyOut = {
  id: number;
  provider_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type ProviderDoctorOut = {
  id: number;
  provider_id: number;
  specialty_id: number;
  name: string;
  title?: string | null;
  license_number?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  specialty_name?: string | null;
};

export type ProviderStructureOut = {
  specialties: ProviderSpecialtyOut[];
  doctors: ProviderDoctorOut[];
};

export type ProviderSpecialtyCreatePayload = {
  name: string;
};

export type ProviderSpecialtyUpdatePayload = {
  name?: string;
  is_active?: boolean;
};

export type ProviderDoctorCreatePayload = {
  specialty_id: number;
  name: string;
  title?: string | null;
  license_number?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type ProviderDoctorUpdatePayload = {
  specialty_id?: number;
  name?: string;
  title?: string | null;
  license_number?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
};

export async function fetchProviderStructure(): Promise<ProviderStructureOut> {
  const res = await api.get("/providers/me/structure");
  return res.data as ProviderStructureOut;
}

export async function createProviderSpecialty(
  payload: ProviderSpecialtyCreatePayload,
): Promise<ProviderSpecialtyOut> {
  const res = await api.post("/providers/me/structure/specialties", payload);
  return res.data as ProviderSpecialtyOut;
}

export async function updateProviderSpecialty(
  specialtyId: number,
  payload: ProviderSpecialtyUpdatePayload,
): Promise<ProviderSpecialtyOut> {
  const res = await api.put(
    `/providers/me/structure/specialties/${specialtyId}`,
    payload,
  );
  return res.data as ProviderSpecialtyOut;
}

export async function deleteProviderSpecialty(
  specialtyId: number,
): Promise<void> {
  await api.delete(`/providers/me/structure/specialties/${specialtyId}`);
}

export async function createProviderDoctor(
  payload: ProviderDoctorCreatePayload,
): Promise<ProviderDoctorOut> {
  const res = await api.post("/providers/me/structure/doctors", payload);
  return res.data as ProviderDoctorOut;
}

export async function updateProviderDoctor(
  doctorId: number,
  payload: ProviderDoctorUpdatePayload,
): Promise<ProviderDoctorOut> {
  const res = await api.put(
    `/providers/me/structure/doctors/${doctorId}`,
    payload,
  );
  return res.data as ProviderDoctorOut;
}

export async function deleteProviderDoctor(doctorId: number): Promise<void> {
  await api.delete(`/providers/me/structure/doctors/${doctorId}`);
}
