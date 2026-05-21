// Path: medicalend-mobile/_lib/documents.ts

import * as DocumentPicker from "expo-document-picker";

import { api } from "./api";

export type MedicalDocumentOut = {
  id: number;
  episode_id: number;
  appointment_id?: number | null;
  uploaded_by_user_id?: number | null;
  uploader_role?: string | null;
  file_name: string;
  stored_name: string;
  file_url: string;
  mime_type: string;
  created_at: string;
};

export type EpisodeDocumentOut = MedicalDocumentOut;

function safeFileName(name?: string | null) {
  const fallback = "document.pdf";
  const raw = String(name || fallback).trim() || fallback;

  if (raw.toLowerCase().endsWith(".pdf")) return raw;

  return `${raw}.pdf`;
}

function normalizeMimeType(value?: string | null) {
  if (!value?.trim()) return "application/pdf";
  return value.trim();
}

export async function fetchEpisodeDocuments(
  episodeId: number,
): Promise<MedicalDocumentOut[]> {
  const res = await api.get(`/documents/episodes/${episodeId}`);
  return (res.data ?? []) as MedicalDocumentOut[];
}

export async function fetchAppointmentDocuments(
  appointmentId: number,
  episodeId: number,
): Promise<MedicalDocumentOut[]> {
  const docs = await fetchEpisodeDocuments(episodeId);
  return docs.filter((doc) => doc.appointment_id === appointmentId);
}

export async function pickPdfDocument(): Promise<{
  uri: string;
  name: string;
  mimeType: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    name: safeFileName(asset.name),
    mimeType: normalizeMimeType(asset.mimeType),
  };
}

export async function uploadEpisodeDocument(params: {
  episodeId: number;
  appointmentId?: number | null;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
}): Promise<MedicalDocumentOut> {
  const form = new FormData();

  form.append("episode_id", String(params.episodeId));

  if (params.appointmentId != null) {
    form.append("appointment_id", String(params.appointmentId));
  }

  form.append("file", {
    uri: params.fileUri,
    name: safeFileName(params.fileName),
    type: normalizeMimeType(params.mimeType),
  } as any);

  const res = await api.post("/documents/upload", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    transformRequest: (data) => data,
  });

  return res.data as MedicalDocumentOut;
}

export async function uploadAppointmentDocument(params: {
  appointmentId: number;
  episodeId: number;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
}): Promise<MedicalDocumentOut> {
  return uploadEpisodeDocument({
    episodeId: params.episodeId,
    appointmentId: params.appointmentId,
    fileUri: params.fileUri,
    fileName: params.fileName,
    mimeType: params.mimeType,
  });
}
