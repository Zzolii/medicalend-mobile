// Path: medicalend-mobile/app/(provider)/patient/[id]/journey.tsx

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { api } from "../../../../_lib/api";
import {
  formatWallClockDateTime,
  wallClockTimestamp,
} from "../../../../_lib/datetime";
import { clearToken } from "../../../../_lib/session";

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
  softBlue: "#EEF4FF",
  softGreen: "#ECFDF5",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

type PatientDetails = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  county?: string | null;
  address_line?: string | null;
};

type EpisodeRow = {
  id: number;
  patient_id?: number | null;
  owner_provider_id?: number | null;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type TimelineAppointment = {
  id: number;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  notes?: string | null;
  provider_name?: string | null;
  doctor_name?: string | null;
};

type TimelineNote = {
  id: number;
  text?: string | null;
  created_at?: string | null;
};

type TimelineTask = {
  id: number;
  title?: string | null;
  status?: string | null;
  due_at?: string | null;
  created_at?: string | null;
};

type TimelineReferral = {
  id: number;
  status?: string | null;
  reason?: string | null;
  created_at?: string | null;
  from_provider_id?: number | null;
  to_provider_id?: number | null;
};

type TimelineDocument = {
  id: number;
  file_name?: string | null;
  file_url?: string | null;
  appointment_id?: number | null;
  created_at?: string | null;
};

type EpisodeTimeline = {
  episode: EpisodeRow;
  appointments: TimelineAppointment[];
  notes: TimelineNote[];
  tasks: TimelineTask[];
  referrals: TimelineReferral[];
  documents: TimelineDocument[];
};

type JourneyItem = {
  key: string;
  kind: "episode" | "appointment" | "note" | "task" | "referral" | "document";
  at?: string | null;
  title: string;
  subtitle?: string;
  status?: string | null;
  fileUrl?: string | null;
  appointmentId?: number | null;
  episodeId?: number | null;
};

function patientName(patient?: PatientDetails | null) {
  const full = [patient?.first_name, patient?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || (patient?.id ? `Pacient #${patient.id}` : "Pacient");
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "open":
    case "active":
      return "Activ";
    case "in_progress":
      return "În desfășurare";
    case "completed":
      return "Finalizat";
    case "closed":
      return "Închis";
    case "archived":
      return "Arhivat";
    case "scheduled":
      return "Programată";
    case "canceled":
      return "Anulată";
    case "pending":
      return "În așteptare";
    case "accepted":
      return "Acceptată";
    case "rejected":
      return "Respinsă";
    case "todo":
      return "De făcut";
    case "done":
      return "Finalizată";
    default:
      return status || "Necunoscut";
  }
}

function statusMeta(status?: string | null) {
  switch (status) {
    case "open":
    case "active":
    case "scheduled":
    case "accepted":
      return { bg: COLORS.softGreen, text: COLORS.success };
    case "in_progress":
    case "todo":
      return { bg: COLORS.softAmber, text: COLORS.warning };
    case "completed":
    case "done":
    case "closed":
    case "archived":
      return { bg: COLORS.softGray, text: COLORS.muted };
    case "canceled":
    case "rejected":
      return { bg: "#FEF2F2", text: COLORS.error };
    default:
      return { bg: COLORS.softBlue, text: COLORS.primary };
  }
}

function kindLabel(kind: JourneyItem["kind"]) {
  switch (kind) {
    case "episode":
      return "Episod";
    case "appointment":
      return "Programare";
    case "note":
      return "Notă";
    case "task":
      return "Sarcină";
    case "referral":
      return "Trimitere";
    case "document":
      return "PDF";
    default:
      return "Eveniment";
  }
}

function fmt(value?: string | null) {
  if (!value) return "Nespecificat";
  return formatWallClockDateTime(value);
}

function Pill({ label, status }: { label: string; status?: string | null }) {
  const meta = statusMeta(status);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: meta.bg,
      }}
    >
      <Text style={{ color: meta.text, fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

async function fetchPatient(patientId: number) {
  const res = await api.get(`/patients/${patientId}`);
  return res.data as PatientDetails;
}

async function fetchEpisodes() {
  const res = await api.get("/care-episodes/");
  return (res.data ?? []) as EpisodeRow[];
}

async function fetchTimeline(episodeId: number) {
  const res = await api.get(`/care-episodes/${episodeId}/timeline`);
  return res.data as EpisodeTimeline;
}

export default function ProviderPatientJourneyScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const patientId = Number(id);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [timelines, setTimelines] = useState<EpisodeTimeline[]>([]);

  async function load() {
    if (!Number.isFinite(patientId) || patientId <= 0) {
      setBusy(false);
      setErr("ID-ul pacientului este invalid.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const [patientData, episodeRows] = await Promise.all([
        fetchPatient(patientId),
        fetchEpisodes(),
      ]);

      const patientEpisodes = (episodeRows ?? []).filter(
        (ep) => Number(ep.patient_id) === patientId,
      );

      const timelineRows = await Promise.all(
        patientEpisodes.map(async (ep) => {
          try {
            const timeline = await fetchTimeline(ep.id);
            return {
              episode: timeline.episode ?? ep,
              appointments: timeline.appointments ?? [],
              notes: timeline.notes ?? [],
              tasks: timeline.tasks ?? [],
              referrals: timeline.referrals ?? [],
              documents: timeline.documents ?? [],
            } satisfies EpisodeTimeline;
          } catch {
            return {
              episode: ep,
              appointments: [],
              notes: [],
              tasks: [],
              referrals: [],
              documents: [],
            } satisfies EpisodeTimeline;
          }
        }),
      );

      setPatient(patientData);
      setTimelines(timelineRows);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut încărca Journey-ul pacientului.";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      if (status === 403) {
        setErr(
          "Nu ai acces la Journey-ul acestui pacient. Accesul este permis doar dacă pacientul are o programare sau un episod asociat contului tău.",
        );
      } else {
        setErr(String(detail));
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const journeyItems = useMemo<JourneyItem[]>(() => {
    const rows: JourneyItem[] = [];

    for (const entry of timelines) {
      const ep = entry.episode;

      rows.push({
        key: `episode-${ep.id}`,
        kind: "episode",
        at: ep.created_at,
        title: ep.title || `Episod #${ep.id}`,
        subtitle: `Episod creat pentru pacient`,
        status: ep.status,
        episodeId: ep.id,
      });

      for (const appt of entry.appointments) {
        rows.push({
          key: `appointment-${appt.id}`,
          kind: "appointment",
          at: appt.start_time,
          title:
            appt.doctor_name || appt.provider_name || `Programare #${appt.id}`,
          subtitle: appt.notes || fmt(appt.start_time),
          status: appt.status,
          appointmentId: appt.id,
          episodeId: ep.id,
        });
      }

      for (const note of entry.notes) {
        rows.push({
          key: `note-${note.id}`,
          kind: "note",
          at: note.created_at,
          title: "Notă clinică",
          subtitle: note.text || "Fără conținut",
          episodeId: ep.id,
        });
      }

      for (const task of entry.tasks) {
        rows.push({
          key: `task-${task.id}`,
          kind: "task",
          at: task.due_at || task.created_at,
          title: task.title || `Sarcină #${task.id}`,
          subtitle: task.due_at ? `Termen: ${fmt(task.due_at)}` : "Fără termen",
          status: task.status,
          episodeId: ep.id,
        });
      }

      for (const referral of entry.referrals) {
        rows.push({
          key: `referral-${referral.id}`,
          kind: "referral",
          at: referral.created_at,
          title: "Trimitere medicală",
          subtitle:
            referral.reason ||
            `De la provider ${referral.from_provider_id ?? "—"} către provider ${
              referral.to_provider_id ?? "—"
            }`,
          status: referral.status,
          episodeId: ep.id,
        });
      }

      for (const doc of entry.documents) {
        rows.push({
          key: `document-${doc.id}`,
          kind: "document",
          at: doc.created_at,
          title: doc.file_name || `Document #${doc.id}`,
          subtitle: doc.appointment_id
            ? `Atașat la programarea #${doc.appointment_id}`
            : "Atașat direct la episod",
          fileUrl: doc.file_url,
          appointmentId: doc.appointment_id,
          episodeId: ep.id,
        });
      }
    }

    return rows.sort(
      (a, b) => wallClockTimestamp(b.at || "") - wallClockTimestamp(a.at || ""),
    );
  }, [timelines]);

  const stats = useMemo(() => {
    return {
      episodes: timelines.length,
      appointments: journeyItems.filter((item) => item.kind === "appointment")
        .length,
      documents: journeyItems.filter((item) => item.kind === "document").length,
      notes: journeyItems.filter((item) => item.kind === "note").length,
    };
  }, [journeyItems, timelines.length]);

  async function openPdf(url?: string | null) {
    if (!url) {
      Alert.alert("Eroare", "Linkul documentului lipsește.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Eroare", "Documentul nu poate fi deschis.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", "Nu s-a putut deschide PDF-ul.");
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

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 17,
            fontWeight: "900",
            color: COLORS.text,
          }}
        >
          Journey pacient
        </Text>

        <Pressable
          onPress={load}
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
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text
            style={{ marginTop: 12, color: COLORS.muted, fontWeight: "700" }}
          >
            Se încarcă Journey-ul pacientului...
          </Text>
        </View>
      ) : err ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ color: COLORS.error, fontWeight: "900", fontSize: 16 }}
            >
              A apărut o eroare
            </Text>
            <Text style={{ marginTop: 8, color: COLORS.text, lineHeight: 21 }}>
              {err}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 30,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 24,
              padding: 18,
            }}
          >
            <Text
              style={{ color: "rgba(255,255,255,0.78)", fontWeight: "800" }}
            >
              PATIENT JOURNEY
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: "#fff",
                fontSize: 26,
                lineHeight: 32,
                fontWeight: "900",
              }}
            >
              {patientName(patient)}
            </Text>
            <Text
              style={{
                marginTop: 10,
                color: "rgba(255,255,255,0.86)",
                lineHeight: 21,
              }}
            >
              Istoric medical organizat pe episoade, programări, note, sarcini,
              trimiteri și documente PDF.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Episoade", value: stats.episodes },
              { label: "Programări", value: stats.appointments },
              { label: "PDF-uri", value: stats.documents },
              { label: "Note", value: stats.notes },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flexGrow: 1,
                  minWidth: "47%",
                  backgroundColor: COLORS.card,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.muted, fontWeight: "800" }}>
                  {item.label}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    color: COLORS.text,
                    fontSize: 26,
                    fontWeight: "900",
                  }}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}
            >
              Date pacient
            </Text>

            <Text style={{ marginTop: 10, color: COLORS.muted }}>
              Email: {patient?.email || "Nedisponibil"}
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Telefon: {patient?.phone || "Nedisponibil"}
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Locație:{" "}
              {[patient?.city, patient?.county].filter(Boolean).join(", ") ||
                "Nespecificată"}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}
            >
              Timeline medical
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
              Evenimentele sunt afișate de la cele mai recente la cele mai
              vechi.
            </Text>

            {journeyItems.length === 0 ? (
              <Text style={{ marginTop: 14, color: COLORS.muted }}>
                Nu există încă evenimente disponibile pentru acest pacient.
              </Text>
            ) : (
              <View style={{ marginTop: 14, gap: 10 }}>
                {journeyItems.map((item) => (
                  <View
                    key={item.key}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: "#fff",
                      padding: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: COLORS.text,
                            fontWeight: "900",
                            lineHeight: 21,
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text style={{ marginTop: 6, color: COLORS.muted }}>
                          {kindLabel(item.kind)} • {fmt(item.at)}
                        </Text>
                      </View>

                      <Pill
                        label={
                          item.status
                            ? statusLabel(item.status)
                            : kindLabel(item.kind)
                        }
                        status={item.status}
                      />
                    </View>

                    {item.subtitle ? (
                      <Text
                        style={{
                          marginTop: 10,
                          color: COLORS.text,
                          lineHeight: 20,
                        }}
                      >
                        {item.subtitle}
                      </Text>
                    ) : null}

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                    >
                      {item.episodeId ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/(provider)/episode/[id]",
                              params: { id: String(item.episodeId) },
                            })
                          }
                          style={{
                            flex: 1,
                            height: 40,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{ color: COLORS.text, fontWeight: "900" }}
                          >
                            Deschide episodul
                          </Text>
                        </Pressable>
                      ) : null}

                      {item.kind === "appointment" && item.appointmentId ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/(provider)/appointment/[id]",
                              params: { id: String(item.appointmentId) },
                            })
                          }
                          style={{
                            flex: 1,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: COLORS.primary,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "900" }}>
                            Programare
                          </Text>
                        </Pressable>
                      ) : null}

                      {item.kind === "document" ? (
                        <Pressable
                          onPress={() => openPdf(item.fileUrl)}
                          style={{
                            flex: 1,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: COLORS.primary,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "900" }}>
                            Deschide PDF
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
