// Path: medicalend-mobile/app/(patient)/appointment/[id].tsx

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  cancelAppointment,
  fetchAppointment,
  type AppointmentOut,
} from "../../../_lib/appointments";
import { formatWallClockDateTime } from "../../../_lib/datetime";
import {
  fetchAppointmentDocuments,
  pickPdfDocument,
  uploadAppointmentDocument,
  type EpisodeDocumentOut,
} from "../../../_lib/documents";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: COLORS.muted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function appointmentTitle(a: AppointmentOut) {
  if (a.notes?.trim()) return a.notes.trim();
  return "Consultație medicală";
}

function appointmentDoctorLabel(a: AppointmentOut) {
  if (a.doctor_name?.trim()) return a.doctor_name.trim();
  return "Medic nespecificat";
}

function appointmentProviderLabel(a: AppointmentOut) {
  if (a.provider_name?.trim()) return a.provider_name.trim();
  return `Furnizor #${a.provider_id}`;
}

function appointmentStatusLabel(status?: string | null) {
  switch (status) {
    case "scheduled":
      return "Programată";
    case "in_progress":
      return "În desfășurare";
    case "completed":
      return "Finalizată";
    case "canceled":
      return "Anulată";
    default:
      return status || "-";
  }
}

function statusColor(status?: string | null) {
  switch (status) {
    case "completed":
      return COLORS.success;
    case "canceled":
      return COLORS.error;
    case "in_progress":
      return COLORS.primary;
    default:
      return COLORS.warning;
  }
}

export default function PatientAppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const appointmentId = Number(id);

  const [busy, setBusy] = useState(true);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [documentsErr, setDocumentsErr] = useState<string | null>(null);

  const [data, setData] = useState<AppointmentOut | null>(null);
  const [documents, setDocuments] = useState<EpisodeDocumentOut[]>([]);

  const episodeId = useMemo(() => {
    if (!data?.episode_id || !Number.isFinite(Number(data.episode_id))) {
      return null;
    }

    return Number(data.episode_id);
  }, [data?.episode_id]);

  const canCancel = useMemo(() => {
    if (!data) return false;
    return data.status === "scheduled" || data.status === "in_progress";
  }, [data]);

  const loadDocuments = useCallback(
    async (nextAppointment: AppointmentOut | null) => {
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        setDocuments([]);
        return;
      }

      const nextEpisodeId = nextAppointment?.episode_id
        ? Number(nextAppointment.episode_id)
        : null;

      if (
        !nextEpisodeId ||
        !Number.isFinite(nextEpisodeId) ||
        nextEpisodeId <= 0
      ) {
        setDocuments([]);
        setDocumentsErr(null);
        return;
      }

      setDocumentsBusy(true);
      setDocumentsErr(null);

      try {
        const rows = await fetchAppointmentDocuments(
          appointmentId,
          nextEpisodeId,
        );
        setDocuments(rows ?? []);
      } catch (e: any) {
        const status = e?.response?.status;
        const detail =
          e?.response?.data?.detail ||
          e?.message ||
          "Încărcarea documentelor a eșuat.";

        setDocumentsErr(String(detail));

        if (status === 401) {
          await clearToken();
          router.replace("/(auth)/login");
        }
      } finally {
        setDocumentsBusy(false);
      }
    },
    [appointmentId],
  );

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      setErr("ID-ul programării este invalid.");
      setBusy(false);
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const appointment = await fetchAppointment(appointmentId);
      setData(appointment);
      await loadDocuments(appointment);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea programării a eșuat.";

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, [appointmentId, loadDocuments]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCancelAppointment() {
    if (!data || !canCancel) return;

    Alert.alert(
      "Anulare programare",
      "Sigur vrei să anulezi această programare?",
      [
        { text: "Nu", style: "cancel" },
        {
          text: "Da, anulează",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelBusy(true);

              const updated = await cancelAppointment(data.id);
              setData(updated);
              await loadDocuments(updated);

              Alert.alert(
                "Programare anulată",
                "Programarea a fost anulată cu succes.",
              );
            } catch (e: any) {
              const status = e?.response?.status;
              const detail =
                e?.response?.data?.detail || e?.message || "Anularea a eșuat.";

              if (status === 401) {
                await clearToken();
                router.replace("/(auth)/login");
                return;
              }

              Alert.alert("Eroare", String(detail));
            } finally {
              setCancelBusy(false);
            }
          },
        },
      ],
    );
  }

  async function openDocument(url?: string | null) {
    if (!url) {
      Alert.alert("Eroare", "Linkul documentului lipsește.");
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", "Nu s-a putut deschide documentul.");
    }
  }

  async function onUploadDocument() {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0 || uploadBusy) {
      return;
    }

    if (!data || !episodeId) {
      Alert.alert(
        "Eroare",
        "Această programare nu are încă un episod asociat, deci PDF-ul nu poate fi încărcat.",
      );
      return;
    }

    try {
      const picked = await pickPdfDocument();
      if (!picked) return;

      setUploadBusy(true);

      await uploadAppointmentDocument({
        appointmentId,
        episodeId,
        fileUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType,
      });

      await loadDocuments(data);

      Alert.alert("Succes", "Documentul a fost încărcat.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea documentului a eșuat.";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: "#fff",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>Înapoi</Text>
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          Programare
        </Text>

        <Pressable
          onPress={loadAll}
          disabled={busy}
          style={{
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Reîncarcă
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: COLORS.muted }}>
            Se încarcă…
          </Text>
        </View>
      ) : err ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "900", color: COLORS.error }}
            >
              Eroare
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.text }}>{err}</Text>

            <Pressable
              onPress={loadAll}
              style={{
                marginTop: 14,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                Încearcă din nou
              </Text>
            </Pressable>
          </View>
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}
            >
              {appointmentTitle(data)}
            </Text>

            <Text style={{ marginTop: 8, color: COLORS.muted }}>
              {appointmentProviderLabel(data)}
            </Text>

            <Text style={{ marginTop: 10, color: COLORS.muted }}>
              Status:{" "}
              <Text
                style={{
                  fontWeight: "900",
                  color: statusColor(data.status),
                }}
              >
                {appointmentStatusLabel(data.status)}
              </Text>
            </Text>

            <Row label="Medic" value={appointmentDoctorLabel(data)} />
            <Row
              label="Început"
              value={formatWallClockDateTime(data.start_time)}
            />
            <Row
              label="Sfârșit"
              value={
                data.end_time ? formatWallClockDateTime(data.end_time) : null
              }
            />
            <Row label="Detalii" value={data.notes ?? null} />
            <Row label="ID programare" value={String(data.id)} />
            <Row
              label="ID episod"
              value={data.episode_id ? String(data.episode_id) : null}
            />
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}
              >
                Documente PDF
              </Text>

              <Pressable
                onPress={onUploadDocument}
                disabled={uploadBusy || !episodeId}
                style={{
                  height: 36,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: uploadBusy || !episodeId ? 0.65 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {uploadBusy ? "Se încarcă..." : "+ PDF"}
                </Text>
              </Pressable>
            </View>

            {!episodeId ? (
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                PDF-urile pot fi încărcate doar după ce programarea are episod
                asociat.
              </Text>
            ) : null}

            {documentsBusy ? (
              <View style={{ marginTop: 14, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: COLORS.muted }}>
                  Se încarcă documentele…
                </Text>
              </View>
            ) : documentsErr ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                  Eroare
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.text }}>
                  {documentsErr}
                </Text>
              </View>
            ) : documents.length === 0 ? (
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                Nu există documente pentru această programare.
              </Text>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                {documents.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 14,
                      padding: 12,
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      {doc.file_name}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Încărcat la: {formatWallClockDateTime(doc.created_at)}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Programare #{doc.appointment_id ?? "-"} • Episod #
                      {doc.episode_id}
                    </Text>

                    <Pressable
                      onPress={() => openDocument(doc.file_url)}
                      style={{
                        marginTop: 10,
                        height: 40,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: COLORS.primary,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900" }}>
                        Deschide PDF
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}
            >
              Acțiuni
            </Text>

            <Pressable
              onPress={handleCancelAppointment}
              disabled={!canCancel || cancelBusy}
              style={{
                marginTop: 14,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.error,
                opacity: !canCancel || cancelBusy ? 0.55 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {cancelBusy ? "Se anulează..." : "Anulează programarea"}
              </Text>
            </Pressable>

            {!canCancel ? (
              <Text style={{ marginTop: 10, color: COLORS.muted }}>
                Programările finalizate sau deja anulate nu mai pot fi anulate.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
