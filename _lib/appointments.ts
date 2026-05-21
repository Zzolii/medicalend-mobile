// Path: medicalend-mobile/_lib/appointments.ts

import { api } from "./api";

export type AppointmentCreatePayload = {
  patient_id: number;
  provider_id: number;
  doctor_id?: number | null;
  episode_id?: number | null;
  start_time: string;
  end_time?: string | null;
  status?: string;
  notes?: string | null;
};

export type AppointmentOut = {
  id: number;
  patient_id: number;
  provider_id: number;
  doctor_id?: number | null;
  episode_id?: number | null;
  clinic_id?: number | null;
  created_by_user_id?: number | null;
  start_time: string;
  end_time?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;

  patient_name?: string | null;
  provider_name?: string | null;
  doctor_name?: string | null;
};

export type AppointmentUpdatePayload = {
  patient_id?: number;
  provider_id?: number;
  doctor_id?: number | null;
  episode_id?: number | null;
  start_time?: string;
  end_time?: string | null;
  status?: string;
  notes?: string | null;
};

export type AppointmentSearchParams = {
  patient_id?: number;
  provider_id?: number;
  doctor_id?: number;
  episode_id?: number;
  status_value?: string;
  start_from?: string;
  start_to?: string;
  skip?: number;
  limit?: number;
};

export type AppointmentTaskOut = {
  id: number;
  episode_id: number;
  appointment_id?: number | null;
  title: string;
  due_at?: string | null;
  status: string;
  assigned_to_role: string;
  created_at: string;
};

export type AppointmentTaskCreatePayload = {
  title: string;
  due_at?: string | null;
  assigned_to_role?: string | null;
};

export async function createAppointment(
  payload: AppointmentCreatePayload,
): Promise<AppointmentOut> {
  const res = await api.post("/appointments/", payload);
  return res.data as AppointmentOut;
}

export async function fetchAppointments(params?: {
  skip?: number;
  limit?: number;
}): Promise<AppointmentOut[]> {
  const res = await api.get("/appointments", { params });
  return res.data as AppointmentOut[];
}

export async function fetchAppointment(
  appointmentId: number,
): Promise<AppointmentOut> {
  const res = await api.get(`/appointments/${appointmentId}`);
  return res.data as AppointmentOut;
}

export async function updateAppointment(
  appointmentId: number,
  payload: AppointmentUpdatePayload,
): Promise<AppointmentOut> {
  const res = await api.put(`/appointments/${appointmentId}`, payload);
  return res.data as AppointmentOut;
}

export async function updateAppointmentStatus(
  appointmentId: number,
  status: string,
): Promise<AppointmentOut> {
  return updateAppointment(appointmentId, { status });
}

export async function cancelAppointment(
  appointmentId: number,
): Promise<AppointmentOut> {
  return updateAppointment(appointmentId, { status: "canceled" });
}

export async function deleteAppointment(appointmentId: number): Promise<void> {
  await api.delete(`/appointments/${appointmentId}`);
}

export async function searchAppointments(
  params: AppointmentSearchParams,
): Promise<AppointmentOut[]> {
  const res = await api.get("/appointments/search", { params });
  return res.data as AppointmentOut[];
}

export async function fetchAppointmentTasks(
  appointmentId: number,
): Promise<AppointmentTaskOut[]> {
  const res = await api.get(`/appointments/${appointmentId}/tasks`);
  return (res.data ?? []) as AppointmentTaskOut[];
}

export async function createAppointmentTask(
  appointmentId: number,
  payload: AppointmentTaskCreatePayload,
): Promise<AppointmentTaskOut> {
  const res = await api.post(`/appointments/${appointmentId}/tasks`, payload);
  return res.data as AppointmentTaskOut;
}

function toNaiveIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

export function getNowNaiveIso() {
  return toNaiveIso(new Date());
}

export function getTodayRangeNaive() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start_from: toNaiveIso(start), start_to: toNaiveIso(end) };
}
