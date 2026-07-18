// Path: medicalend-mobile/app/(provider)/patient/[id]/journey.tsx

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#16A34A",
  warning: "#D97706",

  softBlue: "#EEF4FF",
  softGreen: "#ECFDF5",
  softAmber: "#FFFBEB",
  softRed: "#FEF2F2",
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
  patient_name?: string | null;
  owner_provider_name?: string | null;
};

type TimelineAppointment = {
  id: number;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
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
  title?: string | null;
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

type EpisodeSummary = {
  episode: EpisodeRow;
  appointmentsCount: number;
  documentsCount: number;
  tasksCount: number;
  referralsCount: number;
  notesCount: number;
  totalEvents: number;
  lastActivityAt?: string | null;
  lastActivityLabel: string;
  nextAppointmentAt?: string | null;
};

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function patientName(patient?: PatientDetails | null) {
  const fullName = [patient?.first_name, patient?.last_name]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  return patient?.id ? `Pacient #${patient.id}` : "Pacient";
}

function patientLocation(patient?: PatientDetails | null) {
  return [cleanText(patient?.city), cleanText(patient?.county)]
    .filter(Boolean)
    .join(", ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Dată nespecificată";
  return formatWallClockDateTime(value);
}

function formatShortDate(value?: string | null) {
  if (!value) return "Dată nespecificată";

  const rawMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (rawMatch) {
    const [, year, month, day] = rawMatch;
    return `${day}.${month}.${year}`;
  }

  try {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function statusLabel(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
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
      return cleanText(status) || "Nespecificat";
  }
}

function statusMeta(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "open" || normalized === "active") {
    return {
      bg: COLORS.softGreen,
      text: COLORS.success,
    };
  }

  if (normalized === "in_progress") {
    return {
      bg: COLORS.softAmber,
      text: COLORS.warning,
    };
  }

  if (normalized === "canceled") {
    return {
      bg: COLORS.softRed,
      text: COLORS.error,
    };
  }

  return {
    bg: COLORS.softGray,
    text: COLORS.muted,
  };
}

function isActiveEpisode(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  return (
    normalized === "open" ||
    normalized === "active" ||
    normalized === "in_progress"
  );
}

function episodeTitle(episode: EpisodeRow) {
  return cleanText(episode.title) || "Episod medical";
}

function providerName(episode: EpisodeRow) {
  return (
    cleanText(episode.owner_provider_name) ||
    (episode.owner_provider_id
      ? `Furnizor #${episode.owner_provider_id}`
      : "Furnizor nespecificat")
  );
}

function latestActivityFromTimeline(timeline: EpisodeTimeline) {
  const candidates: {
    at?: string | null;
    label: string;
  }[] = [];

  for (const appointment of timeline.appointments ?? []) {
    candidates.push({
      at: appointment.start_time || appointment.created_at,
      label:
        cleanText(appointment.notes) ||
        cleanText(appointment.doctor_name) ||
        "Consultație medicală",
    });
  }

  for (const document of timeline.documents ?? []) {
    candidates.push({
      at: document.created_at,
      label:
        cleanText(document.title) ||
        cleanText(document.file_name) ||
        "Document medical",
    });
  }

  for (const note of timeline.notes ?? []) {
    candidates.push({
      at: note.created_at,
      label: "Notă de coordonare",
    });
  }

  for (const task of timeline.tasks ?? []) {
    candidates.push({
      at: task.due_at || task.created_at,
      label: cleanText(task.title) || "Sarcină",
    });
  }

  for (const referral of timeline.referrals ?? []) {
    candidates.push({
      at: referral.created_at,
      label: cleanText(referral.reason) || "Trimitere medicală",
    });
  }

  return candidates
    .filter((item) => Boolean(item.at))
    .sort(
      (first, second) =>
        wallClockTimestamp(second.at || "") -
        wallClockTimestamp(first.at || ""),
    )[0];
}

function nextAppointmentFromTimeline(timeline: EpisodeTimeline) {
  const now = Date.now();

  return (timeline.appointments ?? [])
    .filter((appointment) => {
      if (!appointment.start_time) return false;

      const timestamp = wallClockTimestamp(appointment.start_time);
      const status = String(appointment.status || "").toLowerCase();

      return (
        timestamp >= now && status !== "canceled" && status !== "completed"
      );
    })
    .sort(
      (first, second) =>
        wallClockTimestamp(first.start_time || "") -
        wallClockTimestamp(second.start_time || ""),
    )[0];
}

function StatusPill({ status }: { status?: string | null }) {
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
      <Text
        style={{
          color: meta.text,
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {statusLabel(status)}
      </Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: COLORS.card,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text
        style={{
          color: COLORS.muted,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          marginTop: 6,
          color: COLORS.text,
          fontSize: 25,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        style={{
          color: COLORS.muted,
          fontSize: 11,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          marginTop: 5,
          color: COLORS.text,
          fontSize: 14,
          fontWeight: "800",
          lineHeight: 20,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function EpisodeCard({
  summary,
  onPress,
}: {
  summary: EpisodeSummary;
  onPress: () => void;
}) {
  const { episode } = summary;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 17,
              lineHeight: 23,
            }}
          >
            {episodeTitle(episode)}
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            {providerName(episode)}
          </Text>
        </View>

        <StatusPill status={episode.status} />
      </View>

      <View
        style={{
          marginTop: 15,
          borderRadius: 16,
          backgroundColor: COLORS.softGray,
          padding: 14,
        }}
      >
        <Text
          style={{
            color: COLORS.muted,
            fontSize: 11,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Ultima activitate
        </Text>

        <Text
          style={{
            marginTop: 5,
            color: COLORS.text,
            fontWeight: "900",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {summary.lastActivityLabel}
        </Text>

        <Text
          style={{
            marginTop: 5,
            color: COLORS.muted,
            fontSize: 13,
          }}
        >
          {summary.lastActivityAt
            ? formatDateTime(summary.lastActivityAt)
            : `Episod început la ${formatShortDate(episode.created_at)}`}
        </Text>
      </View>

      {summary.nextAppointmentAt ? (
        <View
          style={{
            marginTop: 10,
            borderRadius: 14,
            backgroundColor: COLORS.softBlue,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            Următoarea consultație
          </Text>

          <Text
            style={{
              marginTop: 4,
              color: COLORS.text,
              fontWeight: "800",
              fontSize: 14,
            }}
          >
            {formatDateTime(summary.nextAppointmentAt)}
          </Text>
        </View>
      ) : null}

      <View
        style={{
          marginTop: 14,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <View
          style={{
            borderRadius: 999,
            backgroundColor: COLORS.softBlue,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "800",
              fontSize: 12,
            }}
          >
            {summary.appointmentsCount} consultații
          </Text>
        </View>

        <View
          style={{
            borderRadius: 999,
            backgroundColor: COLORS.softGreen,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              color: COLORS.success,
              fontWeight: "800",
              fontSize: 12,
            }}
          >
            {summary.documentsCount} documente
          </Text>
        </View>

        {summary.tasksCount > 0 ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: COLORS.softAmber,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: COLORS.warning,
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              {summary.tasksCount} sarcini
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: COLORS.muted,
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {summary.totalEvents} evenimente în istoricul episodului
        </Text>

        <Text
          style={{
            color: COLORS.primary,
            fontWeight: "900",
          }}
        >
          Deschide →
        </Text>
      </View>
    </Pressable>
  );
}

async function fetchPatient(patientId: number) {
  const response = await api.get(`/patients/${patientId}`);
  return response.data as PatientDetails;
}

async function fetchEpisodes() {
  const response = await api.get("/care-episodes/");
  return (response.data ?? []) as EpisodeRow[];
}

async function fetchTimeline(episodeId: number) {
  const response = await api.get(`/care-episodes/${episodeId}/timeline`);
  return response.data as EpisodeTimeline;
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

      const patientEpisodes = episodeRows.filter(
        (episode) => Number(episode.patient_id) === patientId,
      );

      const timelineRows = await Promise.all(
        patientEpisodes.map(async (episode) => {
          try {
            const timeline = await fetchTimeline(episode.id);

            return {
              episode: timeline.episode ?? episode,
              appointments: timeline.appointments ?? [],
              notes: timeline.notes ?? [],
              tasks: timeline.tasks ?? [],
              referrals: timeline.referrals ?? [],
              documents: timeline.documents ?? [],
            } satisfies EpisodeTimeline;
          } catch {
            return {
              episode,
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
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut încărca istoricul pacientului.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      if (responseStatus === 403) {
        setErr(
          "Nu ai acces la istoricul acestui pacient. Accesul este permis doar în contextul unei relații medicale active.",
        );
      } else {
        setErr(String(detail));
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const episodeSummaries = useMemo<EpisodeSummary[]>(() => {
    return timelines
      .map((timeline) => {
        const lastActivity = latestActivityFromTimeline(timeline);
        const nextAppointment = nextAppointmentFromTimeline(timeline);

        const appointmentsCount = timeline.appointments.length;
        const documentsCount = timeline.documents.length;
        const notesCount = timeline.notes.length;
        const tasksCount = timeline.tasks.length;
        const referralsCount = timeline.referrals.length;

        return {
          episode: timeline.episode,
          appointmentsCount,
          documentsCount,
          notesCount,
          tasksCount,
          referralsCount,
          totalEvents:
            appointmentsCount +
            documentsCount +
            notesCount +
            tasksCount +
            referralsCount,
          lastActivityAt:
            lastActivity?.at || timeline.episode.created_at || null,
          lastActivityLabel: lastActivity?.label || "Episod medical creat",
          nextAppointmentAt: nextAppointment?.start_time || null,
        };
      })
      .sort((first, second) => {
        const firstTimestamp = wallClockTimestamp(
          first.lastActivityAt || first.episode.created_at || "",
        );

        const secondTimestamp = wallClockTimestamp(
          second.lastActivityAt || second.episode.created_at || "",
        );

        return secondTimestamp - firstTimestamp;
      });
  }, [timelines]);

  const activeEpisodes = useMemo(
    () =>
      episodeSummaries.filter((summary) =>
        isActiveEpisode(summary.episode.status),
      ),
    [episodeSummaries],
  );

  const historicalEpisodes = useMemo(
    () =>
      episodeSummaries.filter(
        (summary) => !isActiveEpisode(summary.episode.status),
      ),
    [episodeSummaries],
  );

  const stats = useMemo(() => {
    return {
      totalEpisodes: episodeSummaries.length,
      activeEpisodes: activeEpisodes.length,
      appointments: episodeSummaries.reduce(
        (total, summary) => total + summary.appointmentsCount,
        0,
      ),
      documents: episodeSummaries.reduce(
        (total, summary) => total + summary.documentsCount,
        0,
      ),
    };
  }, [activeEpisodes.length, episodeSummaries]);

  function openEpisode(episodeId: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: {
        id: String(episodeId),
      },
    });
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
          <Text
            style={{
              fontWeight: "900",
              color: COLORS.text,
            }}
          >
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
          Istoric pacient
        </Text>

        <Pressable
          onPress={() => void load()}
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
            opacity: busy ? 0.55 : 1,
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              color: COLORS.text,
            }}
          >
            Reîncarcă
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />

          <Text
            style={{
              marginTop: 12,
              color: COLORS.muted,
              fontWeight: "700",
            }}
          >
            Se încarcă istoricul pacientului...
          </Text>
        </View>
      ) : err ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{
                color: COLORS.error,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              Istoricul nu a putut fi încărcat
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: COLORS.text,
                lineHeight: 21,
              }}
            >
              {err}
            </Text>

            <Pressable
              onPress={() => void load()}
              style={{
                marginTop: 14,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                }}
              >
                Încearcă din nou
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: COLORS.primaryDark,
              borderRadius: 26,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 190,
                height: 190,
                borderRadius: 999,
                right: -55,
                top: -70,
                backgroundColor: "rgba(47,107,255,0.28)",
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 170,
                height: 170,
                borderRadius: 999,
                left: -80,
                bottom: -100,
                backgroundColor: "rgba(79,179,232,0.16)",
              }}
            />

            <View style={{ zIndex: 2 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.68)",
                  fontWeight: "800",
                  fontSize: 12,
                  letterSpacing: 0.7,
                }}
              >
                PACIENT
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  color: "#fff",
                  fontSize: 27,
                  lineHeight: 33,
                  fontWeight: "900",
                }}
              >
                {patientName(patient)}
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 21,
                }}
              >
                Episoadele medicale sunt organizate separat, pentru ca istoricul
                fiecărei probleme de sănătate să poată fi urmărit rapid.
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <SummaryCard label="Episoade active" value={stats.activeEpisodes} />

            <SummaryCard label="Total episoade" value={stats.totalEpisodes} />

            <SummaryCard label="Consultații" value={stats.appointments} />

            <SummaryCard label="Documente" value={stats.documents} />
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{
                color: COLORS.text,
                fontSize: 17,
                fontWeight: "900",
              }}
            >
              Date de contact
            </Text>

            <View
              style={{
                marginTop: 14,
                gap: 14,
              }}
            >
              <ContactItem
                label="Telefon"
                value={cleanText(patient?.phone) || "Nedisponibil"}
              />

              <ContactItem
                label="E-mail"
                value={cleanText(patient?.email) || "Nedisponibil"}
              />

              <ContactItem
                label="Localitate"
                value={patientLocation(patient) || "Nespecificată"}
              />
            </View>
          </View>

          <View>
            <Text
              style={{
                color: COLORS.text,
                fontSize: 19,
                fontWeight: "900",
              }}
            >
              Episoade active
            </Text>

            <Text
              style={{
                marginTop: 6,
                color: COLORS.muted,
                lineHeight: 20,
              }}
            >
              Problemele medicale aflate în prezent în monitorizare sau
              tratament.
            </Text>

            {activeEpisodes.length === 0 ? (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: COLORS.card,
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: "900",
                  }}
                >
                  Nu există episoade active
                </Text>

                <Text
                  style={{
                    marginTop: 7,
                    color: COLORS.muted,
                    lineHeight: 20,
                  }}
                >
                  Episoadele finalizate rămân disponibile în istoricul de mai
                  jos.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  marginTop: 14,
                  gap: 10,
                }}
              >
                {activeEpisodes.map((summary) => (
                  <EpisodeCard
                    key={summary.episode.id}
                    summary={summary}
                    onPress={() => openEpisode(summary.episode.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {historicalEpisodes.length > 0 ? (
            <View>
              <Text
                style={{
                  color: COLORS.text,
                  fontSize: 19,
                  fontWeight: "900",
                }}
              >
                Istoric episoade
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.muted,
                  lineHeight: 20,
                }}
              >
                Episoade finalizate, închise sau arhivate.
              </Text>

              <View
                style={{
                  marginTop: 14,
                  gap: 10,
                }}
              >
                {historicalEpisodes.map((summary) => (
                  <EpisodeCard
                    key={summary.episode.id}
                    summary={summary}
                    onPress={() => openEpisode(summary.episode.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
