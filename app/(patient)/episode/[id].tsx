// Path: medicalend-mobile/app/(patient)/episode/[id].tsx

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

import {
  fetchEpisodeTimeline,
  type EpisodeTimelinePayload,
} from "../../../_lib/careEpisodes";
import {
  pickPdfDocument,
  uploadEpisodeDocument,
} from "../../../_lib/documents";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryLight: "#4FB3E8",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",

  softBlue: "#EEF4FF",
  softBlueStrong: "#E0ECFF",
  softGreen: "#ECFDF5",
  softAmber: "#FFFBEB",
  softRed: "#FEF2F2",
  softPurple: "#F3E8FF",
  softCyan: "#ECFEFF",
  softGray: "#F8FAFC",
};

type UnifiedEventKind =
  | "appointment"
  | "document"
  | "note"
  | "task"
  | "referral";

type UnifiedEvent = {
  kind: UnifiedEventKind;
  at: string;
  id: number;
  title: string;
  subtitle?: string;
  status?: string | null;
  fileUrl?: string;
  appointmentId?: number | null;
};

type EventGroup = {
  key: string;
  label: string;
  events: UnifiedEvent[];
};

function fmt(iso?: string | null) {
  if (!iso) return "-";

  try {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function longDate(iso?: string | null) {
  if (!iso) return "Fără dată";

  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function timeOnly(iso?: string | null) {
  if (!iso) return "Oră nespecificată";

  try {
    return new Date(iso).toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Oră nespecificată";
  }
}

function dateKey(iso?: string | null) {
  if (!iso) return "unknown";

  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso || "unknown";
  }
}

function isFutureDate(iso?: string | null) {
  if (!iso) return false;

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() > Date.now();
}

function isCompletedStatus(status?: string | null) {
  return (
    status === "completed" ||
    status === "done" ||
    status === "closed" ||
    status === "archived"
  );
}

function episodeStatusLabel(status?: string | null) {
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
    case "canceled":
      return "Anulat";
    default:
      return status || "-";
  }
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

function taskStatusLabel(status?: string | null) {
  switch (status) {
    case "todo":
      return "De făcut";
    case "doing":
    case "in_progress":
      return "În lucru";
    case "done":
    case "completed":
      return "Finalizată";
    case "canceled":
      return "Anulată";
    default:
      return status || "-";
  }
}

function referralStatusLabel(status?: string | null) {
  switch (status) {
    case "pending":
      return "În așteptare";
    case "accepted":
      return "Acceptată";
    case "rejected":
      return "Respinsă";
    case "completed":
      return "Finalizată";
    case "in_progress":
      return "În desfășurare";
    default:
      return status || "-";
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
    case "doing":
      return { bg: COLORS.softBlue, text: COLORS.primary };
    case "completed":
    case "done":
    case "closed":
    case "archived":
      return { bg: COLORS.softGray, text: COLORS.muted };
    case "canceled":
    case "rejected":
      return { bg: COLORS.softRed, text: COLORS.error };
    default:
      return { bg: COLORS.softAmber, text: COLORS.warning };
  }
}

function kindMeta(kind: UnifiedEventKind) {
  switch (kind) {
    case "appointment":
      return {
        icon: "📅",
        label: "Programare",
        bg: COLORS.softBlue,
        text: COLORS.primary,
        dot: COLORS.primary,
        border: COLORS.primary,
      };
    case "document":
      return {
        icon: "📄",
        label: "Document",
        bg: COLORS.softPurple,
        text: "#7C3AED",
        dot: "#7C3AED",
        border: "#7C3AED",
      };
    case "note":
      return {
        icon: "📝",
        label: "Notă",
        bg: COLORS.softAmber,
        text: "#F97316",
        dot: "#F97316",
        border: "#F97316",
      };
    case "task":
      return {
        icon: "✅",
        label: "Sarcină",
        bg: COLORS.softGreen,
        text: COLORS.success,
        dot: COLORS.success,
        border: COLORS.success,
      };
    case "referral":
      return {
        icon: "🔄",
        label: "Trimitere",
        bg: COLORS.softCyan,
        text: "#0891B2",
        dot: "#0891B2",
        border: "#0891B2",
      };
    default:
      return {
        icon: "•",
        label: "Eveniment",
        bg: COLORS.softGray,
        text: COLORS.muted,
        dot: COLORS.muted,
        border: COLORS.border,
      };
  }
}

function Pill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color, fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#fff",
        padding: 16,
      }}
    >
      <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 15 }}>
        {title}
      </Text>
      <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 20 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function appointmentTitle(a: { notes?: string | null }) {
  if (a.notes?.trim()) return a.notes.trim();
  return "Consultație medicală";
}

function providerLabelFromAppointment(a: {
  provider_name?: string | null;
  doctor_name?: string | null;
}) {
  if (a.doctor_name?.trim() && a.provider_name?.trim()) {
    return `${a.doctor_name.trim()} • ${a.provider_name.trim()}`;
  }

  if (a.doctor_name?.trim()) return a.doctor_name.trim();
  if (a.provider_name?.trim()) return a.provider_name.trim();

  return "Clinică / specialist";
}

function groupEventsByDate(events: UnifiedEvent[]): EventGroup[] {
  const map = new Map<string, EventGroup>();

  for (const ev of events) {
    const key = dateKey(ev.at);
    const label = longDate(ev.at);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        events: [],
      });
    }

    map.get(key)?.events.push(ev);
  }

  return Array.from(map.values());
}

function completedProgress(events: UnifiedEvent[]) {
  const total = events.length;

  if (total === 0) {
    return {
      total,
      completed: 0,
      future: 0,
      percent: 0,
    };
  }

  const completed = events.filter((ev) => {
    if (ev.kind === "document" || ev.kind === "note") return true;
    return isCompletedStatus(ev.status);
  }).length;

  const future = events.filter((ev) => isFutureDate(ev.at)).length;

  return {
    total,
    completed,
    future,
    percent: Math.round((completed / total) * 100),
  };
}

function eventStatusLabel(ev: UnifiedEvent) {
  if (!ev.status) return null;

  if (ev.kind === "appointment") return appointmentStatusLabel(ev.status);
  if (ev.kind === "task") return taskStatusLabel(ev.status);
  if (ev.kind === "referral") return referralStatusLabel(ev.status);

  return ev.status;
}

export default function PatientEpisodeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const episodeId = Number(id);

  const [busy, setBusy] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<EpisodeTimelinePayload | null>(null);

  async function load() {
    if (!Number.isFinite(episodeId) || episodeId <= 0) {
      setBusy(false);
      setErr("ID-ul episodului este invalid.");
      return;
    }

    setErr(null);
    setBusy(true);

    try {
      const timeline = await fetchEpisodeTimeline(episodeId);
      setData(timeline);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Eroare la încărcarea episodului.";

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const appointments = useMemo(() => data?.appointments ?? [], [data]);
  const documents = useMemo(() => data?.documents ?? [], [data]);
  const notes = useMemo(() => data?.notes ?? [], [data]);
  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const referrals = useMemo(() => data?.referrals ?? [], [data]);

  const events = useMemo<UnifiedEvent[]>(() => {
    if (!data) return [];

    const appointmentEvents: UnifiedEvent[] = appointments.map((a) => ({
      kind: "appointment",
      at: a.start_time || a.created_at,
      id: a.id,
      title: appointmentTitle(a),
      subtitle: providerLabelFromAppointment(a),
      status: a.status,
      appointmentId: a.id,
    }));

    const documentEvents: UnifiedEvent[] = documents.map((d) => ({
      kind: "document",
      at: d.created_at,
      id: d.id,
      title: d.file_name || `Document #${d.id}`,
      subtitle: d.appointment_id
        ? `Fișier PDF atașat la programarea #${d.appointment_id}`
        : "Fișier PDF atașat episodului",
      status: null,
      fileUrl: d.file_url,
      appointmentId: d.appointment_id,
    }));

    const noteEvents: UnifiedEvent[] = notes.map((n) => ({
      kind: "note",
      at: n.created_at,
      id: n.id,
      title: "Notă de coordonare",
      subtitle: n.text,
      status: null,
    }));

    const taskEvents: UnifiedEvent[] = tasks.map((t) => ({
      kind: "task",
      at: t.due_at || t.created_at,
      id: t.id,
      title: t.title || `Sarcină #${t.id}`,
      subtitle: t.due_at ? `Termen: ${fmt(t.due_at)}` : "Fără termen",
      status: t.status,
    }));

    const referralEvents: UnifiedEvent[] = referrals.map((r) => ({
      kind: "referral",
      at: r.created_at,
      id: r.id,
      title: "Trimitere",
      subtitle: r.reason || "Fără detalii",
      status: r.status,
    }));

    return [
      ...appointmentEvents,
      ...documentEvents,
      ...noteEvents,
      ...taskEvents,
      ...referralEvents,
    ].sort((a, b) => {
      const aTime = a.at ? new Date(a.at).getTime() : 0;
      const bTime = b.at ? new Date(b.at).getTime() : 0;
      return bTime - aTime;
    });
  }, [appointments, data, documents, notes, referrals, tasks]);

  const eventGroups = useMemo(() => groupEventsByDate(events), [events]);
  const progress = useMemo(() => completedProgress(events), [events]);

  const latestEvent = useMemo(() => events[0] ?? null, [events]);

  const stats = useMemo(
    () => [
      { label: "Programări", value: appointments.length },
      { label: "PDF-uri", value: documents.length },
      { label: "Note", value: notes.length },
      { label: "Sarcini", value: tasks.length },
    ],
    [appointments.length, documents.length, notes.length, tasks.length],
  );

  async function openPdf(url?: string | null) {
    if (!url) {
      Alert.alert("Eroare", "Linkul documentului lipsește.");
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", "Documentul nu a putut fi deschis.");
    }
  }

  async function onUploadDocument() {
    if (!Number.isFinite(episodeId) || episodeId <= 0 || uploading) return;

    try {
      const picked = await pickPdfDocument();
      if (!picked) return;

      setUploading(true);

      await uploadEpisodeDocument({
        episodeId,
        fileUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType,
      });

      await load();

      Alert.alert(
        "Document încărcat",
        "Fișierul PDF a fost atașat acestui episod.",
      );
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
      setUploading(false);
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
          <Pressable
            onPress={() => router.back()}
            style={{
              height: 38,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
            }}
          >
            <Text style={{ fontWeight: "900", color: COLORS.text }}>
              Înapoi
            </Text>
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
            Journey episod
          </Text>

          <Pressable
            onPress={load}
            disabled={busy}
            style={{
              height: 38,
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
              Refresh
            </Text>
          </Pressable>
        </View>
      </View>

      {busy ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text
            style={{ marginTop: 12, color: COLORS.muted, fontWeight: "700" }}
          >
            Se încarcă episodul...
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

            <Pressable
              onPress={load}
              style={{
                marginTop: 14,
                height: 44,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                Încearcă din nou
              </Text>
            </Pressable>
          </View>
        </View>
      ) : !data ? null : (
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
              backgroundColor: COLORS.primaryDark,
              borderRadius: 28,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -42,
                top: -32,
                width: 190,
                height: 190,
                borderRadius: 999,
                backgroundColor: "rgba(79,179,232,0.20)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: -55,
                bottom: -70,
                width: 210,
                height: 210,
                borderRadius: 999,
                backgroundColor: "rgba(47,107,255,0.18)",
              }}
            />

            <View style={{ zIndex: 2 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontWeight: "800",
                  fontSize: 13,
                }}
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
                {data.episode.title || `Episod #${episodeId}`}
              </Text>

              <View style={{ marginTop: 12 }}>
                <Pill
                  label={episodeStatusLabel(data.episode.status)}
                  bg="rgba(255,255,255,0.16)"
                  color="#fff"
                />
              </View>

              <Text
                style={{
                  marginTop: 14,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 21,
                }}
              >
                Istoricul episodului este afișat obiectiv: programări,
                documente, note, sarcini și trimiteri. MediCalend nu
                interpretează documentele și nu prezice pașii medicali următori.
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 14,
            }}
          >
            <SectionTitle
              title="Rezumat Journey"
              subtitle="O vedere rapidă asupra episodului, bazată doar pe datele existente."
            />

            <View
              style={{
                borderRadius: 18,
                backgroundColor: COLORS.softBlue,
                padding: 14,
              }}
            >
              <Text
                style={{
                  color: COLORS.text,
                  fontWeight: "900",
                  fontSize: 26,
                }}
              >
                {progress.percent}%
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: COLORS.muted,
                  lineHeight: 20,
                }}
              >
                {progress.completed} evenimente finalizate din {progress.total}
              </Text>

              <View
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(148,163,184,0.26)",
                  overflow: "hidden",
                  marginTop: 12,
                }}
              >
                <View
                  style={{
                    width: `${progress.percent}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: COLORS.primary,
                  }}
                />
              </View>
            </View>

            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
                padding: 14,
              }}
            >
              <Text style={{ color: COLORS.muted, fontWeight: "800" }}>
                Ultimul eveniment
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.text,
                  fontWeight: "900",
                  lineHeight: 21,
                }}
              >
                {latestEvent
                  ? `${kindMeta(latestEvent.kind).label} • ${latestEvent.title}`
                  : "Nu există evenimente încă"}
              </Text>
              <Text style={{ marginTop: 6, color: COLORS.muted }}>
                {latestEvent ? fmt(latestEvent.at) : "-"}
              </Text>
            </View>

            <View
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
                padding: 14,
              }}
            >
              <Text style={{ color: COLORS.muted, fontWeight: "800" }}>
                Evenimente viitoare înregistrate
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.text,
                  fontWeight: "900",
                  fontSize: 22,
                }}
              >
                {progress.future}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {stats.map((item) => (
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
              gap: 12,
            }}
          >
            <SectionTitle
              title="Atașează un PDF"
              subtitle="Fișierul va fi legat direct de acest episod. Pentru MVP păstrăm documentele ca PDF-uri, fără structurare sau analiză medicală."
            />

            <Pressable
              onPress={onUploadDocument}
              disabled={uploading}
              style={{
                height: 48,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
                opacity: uploading ? 0.65 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {uploading ? "Se încarcă PDF..." : "Încarcă document PDF"}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 12,
            }}
          >
            <SectionTitle
              title="Timeline vizual"
              subtitle="Evenimente grupate pe date, de la cele mai recente la cele mai vechi."
            />

            {eventGroups.length === 0 ? (
              <EmptyCard
                title="Nu există evenimente"
                subtitle="Când apar programări, documente sau note, vor fi afișate aici."
              />
            ) : (
              <View style={{ gap: 18 }}>
                {eventGroups.map((group) => (
                  <View key={group.key}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          backgroundColor: COLORS.primary,
                        }}
                      />
                      <Text
                        style={{
                          color: COLORS.text,
                          fontWeight: "900",
                          fontSize: 16,
                        }}
                      >
                        {group.label}
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 1,
                          backgroundColor: COLORS.border,
                        }}
                      />
                    </View>

                    <View
                      style={{
                        borderLeftWidth: 2,
                        borderLeftColor: COLORS.border,
                        paddingLeft: 14,
                        gap: 10,
                      }}
                    >
                      {group.events.map((ev) => {
                        const meta = kindMeta(ev.kind);
                        const evStatusLabel = eventStatusLabel(ev);
                        const evStatusMeta = statusMeta(ev.status);
                        const future = isFutureDate(ev.at);

                        return (
                          <View
                            key={`${ev.kind}-${ev.id}`}
                            style={{
                              position: "relative",
                              borderRadius: 18,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              borderLeftWidth: 4,
                              borderLeftColor: meta.border,
                              backgroundColor:
                                future && ev.kind === "appointment"
                                  ? COLORS.softBlue
                                  : "#fff",
                              padding: 14,
                            }}
                          >
                            <View
                              style={{
                                position: "absolute",
                                left: -24,
                                top: 20,
                                width: 14,
                                height: 14,
                                borderRadius: 999,
                                backgroundColor: meta.dot,
                                borderWidth: 3,
                                borderColor: "#fff",
                              }}
                            />

                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                gap: 10,
                                alignItems: "flex-start",
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Pill
                                  label={`${meta.icon} ${meta.label}`}
                                  bg={meta.bg}
                                  color={meta.text}
                                />

                                <Text
                                  style={{
                                    marginTop: 10,
                                    color: COLORS.text,
                                    fontWeight: "900",
                                    fontSize: 15,
                                    lineHeight: 21,
                                  }}
                                >
                                  {ev.title}
                                </Text>

                                <Text
                                  style={{
                                    marginTop: 6,
                                    color: COLORS.muted,
                                    fontWeight: "800",
                                  }}
                                >
                                  {timeOnly(ev.at)}
                                </Text>
                              </View>

                              <View style={{ gap: 6, alignItems: "flex-end" }}>
                                {future ? (
                                  <Pill
                                    label="Viitor"
                                    bg={COLORS.softAmber}
                                    color={COLORS.warning}
                                  />
                                ) : null}

                                {evStatusLabel ? (
                                  <Pill
                                    label={evStatusLabel}
                                    bg={evStatusMeta.bg}
                                    color={evStatusMeta.text}
                                  />
                                ) : null}
                              </View>
                            </View>

                            {ev.subtitle ? (
                              <Text
                                style={{
                                  marginTop: 10,
                                  color: COLORS.text,
                                  lineHeight: 20,
                                }}
                              >
                                {ev.subtitle}
                              </Text>
                            ) : null}

                            {ev.kind === "document" ? (
                              <Pressable
                                onPress={() => openPdf(ev.fileUrl)}
                                style={{
                                  marginTop: 12,
                                  height: 40,
                                  borderRadius: 13,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: COLORS.primary,
                                }}
                              >
                                <Text
                                  style={{ color: "#fff", fontWeight: "900" }}
                                >
                                  Deschide PDF
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 12,
            }}
          >
            <SectionTitle
              title="Programări în acest episod"
              subtitle="Consultațiile și vizitele sunt afișate în contextul episodului."
            />

            {appointments.length === 0 ? (
              <EmptyCard
                title="Nu există programări"
                subtitle="Când o programare va fi legată de acest episod, va apărea aici."
              />
            ) : (
              <View style={{ gap: 10 }}>
                {appointments.map((a) => {
                  const meta = statusMeta(a.status);

                  return (
                    <View
                      key={a.id}
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
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: COLORS.text,
                              fontWeight: "900",
                              fontSize: 15,
                              lineHeight: 21,
                            }}
                          >
                            {appointmentTitle(a)}
                          </Text>

                          <Text
                            style={{
                              marginTop: 6,
                              color: COLORS.muted,
                              lineHeight: 20,
                            }}
                          >
                            {providerLabelFromAppointment(a)}
                          </Text>

                          <Text
                            style={{
                              marginTop: 6,
                              color: COLORS.muted,
                              lineHeight: 20,
                            }}
                          >
                            {fmt(a.start_time)}
                          </Text>
                        </View>

                        <Pill
                          label={appointmentStatusLabel(a.status)}
                          bg={meta.bg}
                          color={meta.text}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 22,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 12,
            }}
          >
            <SectionTitle
              title="Documente PDF"
              subtitle="Rezultatele și fișierele încărcate sunt păstrate ca documente atașate episodului."
            />

            {documents.length === 0 ? (
              <EmptyCard
                title="Nu există documente"
                subtitle="Poți încărca primul PDF folosind butonul de mai sus."
              />
            ) : (
              <View style={{ gap: 10 }}>
                {documents.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: "#fff",
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.text,
                        fontWeight: "900",
                        fontSize: 15,
                        lineHeight: 21,
                      }}
                    >
                      {doc.file_name || `Document #${doc.id}`}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Încărcat: {fmt(doc.created_at)}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      {doc.appointment_id
                        ? `Atașat și la programarea #${doc.appointment_id}`
                        : "Atașat direct la episod"}
                    </Text>

                    <Pressable
                      onPress={() => openPdf(doc.file_url)}
                      style={{
                        marginTop: 12,
                        height: 42,
                        borderRadius: 14,
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
        </ScrollView>
      )}
    </View>
  );
}
