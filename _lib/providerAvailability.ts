// Path: medicalend-mobile/_lib/providerAvailability.ts

import { api } from "./api";

export type ProviderAvailabilitySlot = {
  start_time: string;
  end_time: string;
  available: boolean;
};

export type ProviderWeeklyAvailabilityOut = {
  id: number;
  provider_id: number;
  doctor_id?: number | null;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type ProviderWeeklyAvailabilityCreatePayload = {
  doctor_id?: number | null;
  weekday: number;
  start_time: string;
  end_time: string;
};

export type ProviderAvailabilityExceptionOut = {
  id: number;
  provider_id: number;
  doctor_id?: number | null;
  date: string;
  is_closed: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
};

export type ProviderAvailabilityExceptionCreatePayload = {
  doctor_id?: number | null;
  date: string;
  is_closed?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
};

export async function fetchProviderAvailability(params: {
  providerId: number;
  date: string;
  doctorId?: number | null;
}): Promise<ProviderAvailabilitySlot[]> {
  const { providerId, date, doctorId } = params;

  const res = await api.get(`/providers/${providerId}/free-slots`, {
    params: {
      date,
      doctor_id: doctorId || undefined,
    },
  });

  return (res.data ?? []) as ProviderAvailabilitySlot[];
}

export async function fetchMyWeeklyAvailability(params?: {
  doctorId?: number | null;
}): Promise<ProviderWeeklyAvailabilityOut[]> {
  const res = await api.get("/providers/me/availability", {
    params: {
      doctor_id: params?.doctorId || undefined,
    },
  });

  return (res.data ?? []) as ProviderWeeklyAvailabilityOut[];
}

export async function upsertMyWeeklyAvailability(
  payload: ProviderWeeklyAvailabilityCreatePayload,
): Promise<ProviderWeeklyAvailabilityOut> {
  const res = await api.post("/providers/me/availability", payload);
  return res.data as ProviderWeeklyAvailabilityOut;
}

export async function deleteMyWeeklyAvailability(
  availabilityId: number,
): Promise<{ ok: boolean; id: number }> {
  const res = await api.delete(`/providers/me/availability/${availabilityId}`);
  return res.data as { ok: boolean; id: number };
}

export async function fetchMyAvailabilityExceptions(params?: {
  doctorId?: number | null;
}): Promise<ProviderAvailabilityExceptionOut[]> {
  const res = await api.get("/providers/me/availability/exceptions", {
    params: {
      doctor_id: params?.doctorId || undefined,
    },
  });

  return (res.data ?? []) as ProviderAvailabilityExceptionOut[];
}

export async function upsertMyAvailabilityException(
  payload: ProviderAvailabilityExceptionCreatePayload,
): Promise<ProviderAvailabilityExceptionOut> {
  const res = await api.post("/providers/me/availability/exceptions", payload);
  return res.data as ProviderAvailabilityExceptionOut;
}

export async function deleteMyAvailabilityException(
  exceptionId: number,
): Promise<{ ok: boolean; id: number; deleted_at: string }> {
  const res = await api.delete(
    `/providers/me/availability/exceptions/${exceptionId}`,
  );
  return res.data as { ok: boolean; id: number; deleted_at: string };
}
