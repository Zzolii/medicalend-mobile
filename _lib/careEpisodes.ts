// Path: medicalend-mobile/_lib/careEpisodes.ts

import { api } from "./api";

/** ---- Core types (minimal, dar compatibil cu ecranele existente) ---- */

export type CareEpisodeOut = {
  id: number;
  patient_id: number;
  owner_provider_id: number;
  title: string;
  status: string;
  created_at: string;
};

export type EpisodeNoteOut = {
  id: number;
  episode_id: number;
  text: string;
  created_at: string;
};

export type EpisodeTaskOut = {
  id: number;
  episode_id: number;
  title: string;
  status: string;
  due_at?: string | null;
  assigned_to_role?: string | null;
  created_at: string;
};

export type EpisodeAppointmentOut = {
  id: number;
  patient_id: number;
  provider_id: number;
  provider_name?: string | null;
  doctor_id?: number | null;
  doctor_name?: string | null;
  episode_id?: number | null;
  start_time: string;
  end_time?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type EpisodeReferralOut = {
  id: number;
  episode_id: number;
  from_provider_id: number;
  to_provider_id: number;
  from_provider_name?: string | null;
  to_provider_name?: string | null;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "completed" | "in_progress";
  rejection_reason?: string | null;
  created_at: string;
};

export type EpisodeDocumentOut = {
  id: number;
  episode_id: number;
  appointment_id?: number | null;
  uploaded_by_user_id?: number | null;
  file_name: string;
  stored_name: string;
  file_url: string;
  mime_type: string;
  created_at: string;
};

export type EpisodeTimelinePayload = {
  episode: CareEpisodeOut;
  appointments: EpisodeAppointmentOut[];
  notes: EpisodeNoteOut[];
  tasks: EpisodeTaskOut[];
  referrals: EpisodeReferralOut[];
  documents: EpisodeDocumentOut[];
};

/** ---- Timeline ---- */
export async function fetchEpisodeTimeline(
  episodeId: number,
): Promise<EpisodeTimelinePayload> {
  const res = await api.get(`/care-episodes/${episodeId}/timeline`);
  return res.data as EpisodeTimelinePayload;
}

/** ---- Notes ---- */
export async function addEpisodeNote(episodeId: number, text: string) {
  const res = await api.post(`/care-episodes/${episodeId}/notes`, { text });
  return res.data as EpisodeNoteOut;
}

/** ---- Tasks ---- */
export type EpisodeTaskCreatePayload = {
  title: string;
  due_at?: string | null;
  assigned_to_role?: string | null;
};

export async function addEpisodeTask(
  episodeId: number,
  payload: EpisodeTaskCreatePayload,
) {
  const res = await api.post(`/care-episodes/${episodeId}/tasks`, payload);
  return res.data as EpisodeTaskOut;
}

export type EpisodeTaskUpdatePayload = {
  title?: string;
  status?: string;
  due_at?: string | null;
  assigned_to_role?: string | null;
};

export async function updateEpisodeTask(
  taskId: number,
  payload: EpisodeTaskUpdatePayload,
) {
  const res = await api.put(`/care-episodes/tasks/${taskId}`, payload);
  return res.data as EpisodeTaskOut;
}

/** ---- Episode update ---- */
export type CareEpisodeUpdatePayload = {
  patient_id?: number;
  title?: string;
  status?: string;
};

export async function updateCareEpisode(
  episodeId: number,
  payload: CareEpisodeUpdatePayload,
): Promise<CareEpisodeOut> {
  const res = await api.put(`/care-episodes/${episodeId}`, payload);
  return res.data as CareEpisodeOut;
}
