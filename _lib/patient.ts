// Path: medicalend-mobile/_lib/patient.ts
import { api } from "./api";

/**
 * Backend: GET /api/v1/patients/me
 */
export type PatientMe = {
  id: number;
  user_id?: number | null;

  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender?: string | null;

  phone?: string | null;
  email?: string | null;

  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  postal_code?: string | null;
  country?: string | null;

  fhir_id?: string | null;
  created_at?: string;
};

export type PatientMeUpdatePayload = {
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  gender?: string | null;

  phone?: string | null;
  email?: string | null;

  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type DeletePatientMeResponse = {
  ok: boolean;
  patient_id: number;
  message: string;
};

export async function fetchPatientMe(): Promise<PatientMe> {
  const res = await api.get("/patients/me");
  return res.data as PatientMe;
}

/**
 * Backend: PUT /api/v1/patients/me
 */
export async function updatePatientMe(
  payload: PatientMeUpdatePayload,
): Promise<PatientMe> {
  const res = await api.put("/patients/me", payload);
  return res.data as PatientMe;
}

/**
 * Backend: DELETE /api/v1/patients/me
 */
export async function deletePatientMe(): Promise<DeletePatientMeResponse> {
  const res = await api.delete("/patients/me");
  return res.data as DeletePatientMeResponse;
}

/**
 * Backend: GET /api/v1/patients/me/dashboard
 */
export type PatientDashboardOut = {
  next_appointment?: {
    id: number;
    start_time: string;
    provider_name?: string | null;
    status: string;
  } | null;

  active_episodes: {
    id: number;
    title: string;
    status: string;
  }[];
};

export async function fetchPatientDashboard(): Promise<PatientDashboardOut> {
  const res = await api.get("/patients/me/dashboard");
  return res.data as PatientDashboardOut;
}
