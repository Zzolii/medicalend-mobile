// Path: medicalend-mobile/app/(provider)/appointment/[id].tsx

import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createAppointmentTask,
  fetchAppointment,
  fetchAppointmentTasks,
  updateAppointmentStatus,
  type AppointmentOut,
  type AppointmentTaskOut,
} from "../../../_lib/appointments";
import { updateEpisodeTask } from "../../../_lib/careEpisodes";
import {
  formatWallClockDateTime,
  normalizeUserInputToNaiveIso,
} from "../../../_lib/datetime";
import {
  fetchAppointmentDocuments,
  pickPdfDocument,
  uploadAppointmentDocument,
  type MedicalDocumentOut,
} from "../../../_lib/documents";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",

  softBlue: "#EEF4FF",
  softGreen: "#ECFDF5",
  softRed: "#FEF2F2",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

type AppointmentStatus = "scheduled" | "in_progress" | "completed" | "canceled";

type TaskStatus = "todo" | "doing" | "done";

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Dată nespecificată";
  return formatWallClockDateTime(value);
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  const match = String(value).match(/T(\d{2}):(\d{2})/);

  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  try {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Dată nespecificată";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;

    try {
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));

      return parsed.toLocaleDateString("ro-RO", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return `${day}.${month}.${year}`;
    }
  }

  return formatDateTime(value);
}

function patientLabel(data: AppointmentOut) {
  return cleanText(data.patient_name) || "Pacient";
}

function providerLabel(data: AppointmentOut) {
  return cleanText(data.provider_name) || "Furnizor medical";
}

function doctorLabel(data: AppointmentOut) {
  return cleanText(data.doctor_name) || "Medic nespecificat";
}

function appointmentStatusMeta(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "in_progress":
      return {
        label: "În desfășurare",
        backgroundColor: COLORS.softBlue,
        color: COLORS.primary,
      };

    case "completed":
      return {
        label: "Finalizată",
        backgroundColor: COLORS.softGreen,
        color: COLORS.success,
      };

    case "canceled":
      return {
        label: "Anulată",
        backgroundColor: COLORS.softRed,
        color: COLORS.error,
      };

    default:
      return {
        label: "Programată",
        backgroundColor: COLORS.softAmber,
        color: COLORS.warning,
      };
  }
}

function taskStatusMeta(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "doing":
    case "in_progress":
      return {
        label: "În lucru",
        backgroundColor: COLORS.softAmber,
        color: COLORS.warning,
      };

    case "done":
    case "completed":
      return {
        label: "Finalizată",
        backgroundColor: COLORS.softGreen,
        color: COLORS.success,
      };

    default:
      return {
        label: "De făcut",
        backgroundColor: COLORS.softBlue,
        color: COLORS.primary,
      };
  }
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
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
            fontSize: 17,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            style={{
              marginTop: 5,
              color: COLORS.muted,
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled}
          style={{
            minHeight: 36,
            paddingHorizontal: 12,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.softBlue,
            opacity: actionDisabled ? 0.55 : 1,
          }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontSize: 13,
              fontWeight: "900",
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPill({
  label,
  backgroundColor,
  color,
}: {
  label: string;
  backgroundColor: string;
  color: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor,
      }}
    >
      <Text
        style={{
          color,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLORS.border,
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
          marginTop: 5,
          color: COLORS.text,
          fontSize: 15,
          fontWeight: "800",
          lineHeight: 21,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: 16,
        padding: 14,
        backgroundColor: COLORS.softGray,
      }}
    >
      <Text
        style={{
          color: COLORS.text,
          fontWeight: "900",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 6,
          color: COLORS.muted,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function StatusAction({
  label,
  active,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  tone: "primary" | "success" | "danger";
  disabled?: boolean;
  onPress: () => void;
}) {
  const backgroundColor = active
    ? tone === "success"
      ? COLORS.softGreen
      : tone === "danger"
        ? COLORS.softRed
        : COLORS.softBlue
    : COLORS.card;

  const borderColor = active
    ? tone === "success"
      ? COLORS.success
      : tone === "danger"
        ? COLORS.error
        : COLORS.primary
    : COLORS.border;

  const textColor =
    tone === "success"
      ? COLORS.success
      : tone === "danger"
        ? COLORS.error
        : COLORS.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || active}
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 13,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 13,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        {active ? `${label} ✓` : label}
      </Text>
    </Pressable>
  );
}

function TaskStatusAction({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || active}
      style={{
        flex: 1,
        minHeight: 38,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
        backgroundColor: active ? COLORS.softBlue : COLORS.card,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text
        style={{
          color: active ? COLORS.primary : COLORS.muted,
          fontSize: 12,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProviderAppointmentDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const appointmentId = useMemo(() => Number(id), [id]);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentOut | null>(null);

  const [actionBusy, setActionBusy] = useState(false);

  const [tasksBusy, setTasksBusy] = useState(false);
  const [tasksErr, setTasksErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AppointmentTaskOut[]>([]);
  const [taskActionId, setTaskActionId] = useState<number | null>(null);

  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [documentsErr, setDocumentsErr] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MedicalDocumentOut[]>([]);
  const [documentUploading, setDocumentUploading] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  const validEpisodeId =
    typeof data?.episode_id === "number" &&
    Number.isFinite(data.episode_id) &&
    data.episode_id > 0
      ? data.episode_id
      : null;

  const currentStatus = String(
    data?.status || "scheduled",
  ).toLowerCase() as AppointmentStatus;

  const appointmentBadge = appointmentStatusMeta(data?.status);

  const loadTasks = useCallback(async () => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return;
    }

    setTasksBusy(true);
    setTasksErr(null);

    try {
      const rows = await fetchAppointmentTasks(appointmentId);
      setTasks(rows ?? []);
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Încărcarea sarcinilor a eșuat.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      setTasksErr(String(detail));
    } finally {
      setTasksBusy(false);
    }
  }, [appointmentId]);

  const loadDocuments = useCallback(
    async (episodeId?: number | null) => {
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
        return;
      }

      setDocumentsBusy(true);
      setDocumentsErr(null);

      try {
        if (
          typeof episodeId !== "number" ||
          !Number.isFinite(episodeId) ||
          episodeId <= 0
        ) {
          setDocuments([]);
          return;
        }

        const rows = await fetchAppointmentDocuments(appointmentId, episodeId);

        setDocuments(rows ?? []);
      } catch (error: any) {
        const responseStatus = error?.response?.status;
        const detail =
          error?.response?.data?.detail ||
          error?.message ||
          "Încărcarea documentelor a eșuat.";

        if (responseStatus === 401) {
          await clearToken();
          router.replace("/(auth)/login");
          return;
        }

        setDocumentsErr(String(detail));
      } finally {
        setDocumentsBusy(false);
      }
    },
    [appointmentId],
  );

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      setBusy(false);
      setErr("ID-ul programării este invalid.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const appointment = await fetchAppointment(appointmentId);
      setData(appointment);

      const episodeId =
        typeof appointment.episode_id === "number" &&
        Number.isFinite(appointment.episode_id) &&
        appointment.episode_id > 0
          ? appointment.episode_id
          : null;

      await Promise.all([loadTasks(), loadDocuments(episodeId)]);
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Programarea nu a putut fi încărcată.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      setErr(String(detail));
    } finally {
      setBusy(false);
    }
  }, [appointmentId, loadDocuments, loadTasks]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const setStatus = useCallback(
    async (nextStatus: AppointmentStatus) => {
      if (!data || actionBusy) return;

      if (currentStatus === nextStatus) {
        return;
      }

      setActionBusy(true);

      try {
        const updated = await updateAppointmentStatus(data.id, nextStatus);

        setData(updated);
      } catch (error: any) {
        const responseStatus = error?.response?.status;
        const detail =
          error?.response?.data?.detail ||
          error?.message ||
          "Actualizarea statusului a eșuat.";

        if (responseStatus === 401) {
          await clearToken();
          router.replace("/(auth)/login");
          return;
        }

        Alert.alert("Eroare", String(detail));
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, currentStatus, data],
  );

  async function setTaskStatus(taskId: number, nextStatus: TaskStatus) {
    if (!taskId || taskActionId === taskId) return;

    setTaskActionId(taskId);

    try {
      await updateEpisodeTask(taskId, {
        status: nextStatus,
      });

      await loadTasks();
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Actualizarea sarcinii a eșuat.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setTaskActionId(null);
    }
  }

  function openPatientHistory() {
    if (!data?.patient_id) {
      Alert.alert(
        "Pacient lipsă",
        "Această programare nu are un pacient asociat.",
      );
      return;
    }

    router.push({
      pathname: "/(provider)/patient/[id]/journey",
      params: {
        id: String(data.patient_id),
      },
    });
  }

  function openEpisode() {
    if (validEpisodeId === null) {
      Alert.alert(
        "Episod lipsă",
        "Această programare nu are un episod asociat.",
      );
      return;
    }

    router.push({
      pathname: "/(provider)/episode/[id]",
      params: {
        id: String(validEpisodeId),
      },
    });
  }

  function openAddTask() {
    setTaskTitle("");
    setTaskDueAt("");
    setTaskModalOpen(true);
  }

  async function submitTask() {
    const title = taskTitle.trim();

    if (title.length < 3) {
      Alert.alert(
        "Titlu incomplet",
        "Titlul sarcinii trebuie să conțină cel puțin 3 caractere.",
      );
      return;
    }

    let dueAt: string | null = null;
    const rawDueAt = taskDueAt.trim();

    if (rawDueAt) {
      try {
        dueAt = normalizeUserInputToNaiveIso(rawDueAt);
      } catch {
        Alert.alert("Dată invalidă", "Folosește formatul 2026-07-20 14:30.");
        return;
      }
    }

    setTaskSaving(true);

    try {
      await createAppointmentTask(appointmentId, {
        title,
        due_at: dueAt,
        assigned_to_role: "provider",
      });

      setTaskModalOpen(false);
      setTaskTitle("");
      setTaskDueAt("");

      await loadTasks();
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Sarcina nu a putut fi creată.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setTaskSaving(false);
    }
  }

  async function openDocument(url?: string | null) {
    if (!url) {
      Alert.alert("Document indisponibil", "Linkul documentului lipsește.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          "Document indisponibil",
          "Documentul nu poate fi deschis pe acest dispozitiv.",
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", "Documentul nu a putut fi deschis.");
    }
  }

  async function uploadDocument() {
    if (
      !Number.isFinite(appointmentId) ||
      appointmentId <= 0 ||
      documentUploading
    ) {
      return;
    }

    if (validEpisodeId === null) {
      Alert.alert(
        "Episod lipsă",
        "Pentru încărcarea unui document, programarea trebuie asociată unui episod.",
      );
      return;
    }

    try {
      const picked = await pickPdfDocument();

      if (!picked) return;

      setDocumentUploading(true);

      await uploadAppointmentDocument({
        appointmentId,
        episodeId: validEpisodeId,
        fileUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType,
      });

      await loadDocuments(validEpisodeId);
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Documentul nu a putut fi încărcat.";

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setDocumentUploading(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
      }}
    >
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: COLORS.card,
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
            backgroundColor: COLORS.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
            }}
          >
            Înapoi
          </Text>
        </Pressable>

        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: COLORS.text,
            fontSize: 17,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          Detalii programare
        </Text>

        <Pressable
          onPress={() => void loadAll()}
          disabled={busy}
          style={{
            height: 38,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.55 : 1,
          }}
        >
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
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
            padding: 24,
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
            Se încarcă programarea...
          </Text>
        </View>
      ) : err ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <Text
              style={{
                color: COLORS.error,
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              Programarea nu a putut fi încărcată
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
              onPress={() => void loadAll()}
              style={{
                marginTop: 14,
                height: 44,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "900",
                }}
              >
                Încearcă din nou
              </Text>
            </Pressable>
          </View>
        </View>
      ) : !data ? null : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 34,
            gap: 14,
          }}
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
                width: 180,
                height: 180,
                borderRadius: 999,
                top: -70,
                right: -45,
                backgroundColor: "rgba(47,107,255,0.30)",
              }}
            />

            <View
              style={{
                position: "absolute",
                width: 160,
                height: 160,
                borderRadius: 999,
                bottom: -105,
                left: -50,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            />

            <View style={{ zIndex: 2 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.68)",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 0.6,
                }}
              >
                PROGRAMARE MEDICALĂ
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  color: "#FFFFFF",
                  fontSize: 27,
                  lineHeight: 33,
                  fontWeight: "900",
                }}
              >
                {patientLabel(data)}
              </Text>

              <Text
                style={{
                  marginTop: 16,
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                {formatTime(data.start_time)}
                {data.end_time ? ` – ${formatTime(data.end_time)}` : ""}
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {formatDate(data.start_time)}
              </Text>

              <View style={{ marginTop: 16 }}>
                <StatusPill
                  label={appointmentBadge.label}
                  backgroundColor={appointmentBadge.backgroundColor}
                  color={appointmentBadge.color}
                />
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 16,
            }}
          >
            <InfoRow label="Furnizor" value={providerLabel(data)} />

            <InfoRow label="Medic" value={doctorLabel(data)} last />
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <SectionHeader
              title="Dosarul pacientului"
              subtitle="Acces la episoadele și istoricul medical disponibil."
            />

            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Pressable
                onPress={openPatientHistory}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 13,
                  backgroundColor: COLORS.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  Istoric pacient
                </Text>
              </Pressable>

              <Pressable
                onPress={openEpisode}
                disabled={validEpisodeId === null}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.card,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  opacity: validEpisodeId === null ? 0.45 : 1,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 13,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  Episod asociat
                </Text>
              </Pressable>
            </View>

            {validEpisodeId === null ? (
              <Text
                style={{
                  marginTop: 10,
                  color: COLORS.warning,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                Programarea nu este asociată încă unui episod medical.
              </Text>
            ) : null}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <SectionHeader
              title="Motivul programării"
              subtitle="Observațiile introduse la rezervarea programării."
            />

            <Text
              style={{
                marginTop: 14,
                color: data.notes?.trim() ? COLORS.text : COLORS.muted,
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {data.notes?.trim() ||
                "Pacientul nu a introdus observații pentru această programare."}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <SectionHeader
              title="Documente"
              subtitle="Fișiere PDF asociate consultației."
              actionLabel={documentUploading ? "Se încarcă..." : "Adaugă PDF"}
              onAction={() => void uploadDocument()}
              actionDisabled={documentUploading || validEpisodeId === null}
            />

            {documentsBusy ? (
              <View
                style={{
                  marginTop: 16,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator color={COLORS.primary} />

                <Text
                  style={{
                    marginTop: 8,
                    color: COLORS.muted,
                    fontSize: 13,
                  }}
                >
                  Se încarcă documentele...
                </Text>
              </View>
            ) : documentsErr ? (
              <Text
                style={{
                  marginTop: 14,
                  color: COLORS.error,
                  lineHeight: 20,
                }}
              >
                {documentsErr}
              </Text>
            ) : documents.length === 0 ? (
              <EmptyState
                title="Nu există documente"
                subtitle={
                  validEpisodeId === null
                    ? "Asociază programarea unui episod pentru a putea adăuga documente."
                    : "Poți încărca primul document folosind butonul de mai sus."
                }
              />
            ) : (
              <View
                style={{
                  marginTop: 14,
                  gap: 8,
                }}
              >
                {documents.map((document) => (
                  <Pressable
                    key={document.id}
                    onPress={() => void openDocument(document.file_url)}
                    style={{
                      borderRadius: 15,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.card,
                      padding: 13,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: COLORS.softRed,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.error,
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        PDF
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: COLORS.text,
                          fontWeight: "900",
                          lineHeight: 20,
                        }}
                      >
                        {cleanText(document.file_name) || "Document medical"}
                      </Text>

                      <Text
                        style={{
                          marginTop: 4,
                          color: COLORS.muted,
                          fontSize: 12,
                        }}
                      >
                        {formatDateTime(document.created_at)}
                      </Text>
                    </View>

                    <Text
                      style={{
                        color: COLORS.primary,
                        fontSize: 18,
                        fontWeight: "900",
                      }}
                    >
                      ›
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <SectionHeader
              title="Sarcini"
              subtitle="Acțiuni care trebuie realizate după consultație."
              actionLabel="Adaugă"
              onAction={openAddTask}
            />

            {tasksBusy ? (
              <View
                style={{
                  marginTop: 16,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator color={COLORS.primary} />

                <Text
                  style={{
                    marginTop: 8,
                    color: COLORS.muted,
                    fontSize: 13,
                  }}
                >
                  Se încarcă sarcinile...
                </Text>
              </View>
            ) : tasksErr ? (
              <Text
                style={{
                  marginTop: 14,
                  color: COLORS.error,
                  lineHeight: 20,
                }}
              >
                {tasksErr}
              </Text>
            ) : tasks.length === 0 ? (
              <EmptyState
                title="Nu există sarcini"
                subtitle="Adaugă o sarcină numai dacă este necesară o acțiune ulterioară."
              />
            ) : (
              <View
                style={{
                  marginTop: 14,
                  gap: 10,
                }}
              >
                {tasks.map((task) => {
                  const normalizedStatus = String(
                    task.status || "todo",
                  ).toLowerCase();

                  const taskBadge = taskStatusMeta(task.status);
                  const busyThisTask = taskActionId === task.id;

                  return (
                    <View
                      key={task.id}
                      style={{
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        backgroundColor: COLORS.card,
                        padding: 13,
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
                              lineHeight: 20,
                            }}
                          >
                            {cleanText(task.title) || "Sarcină"}
                          </Text>

                          {task.due_at ? (
                            <Text
                              style={{
                                marginTop: 5,
                                color: COLORS.muted,
                                fontSize: 12,
                              }}
                            >
                              Termen: {formatDateTime(task.due_at)}
                            </Text>
                          ) : null}
                        </View>

                        <StatusPill
                          label={taskBadge.label}
                          backgroundColor={taskBadge.backgroundColor}
                          color={taskBadge.color}
                        />
                      </View>

                      <View
                        style={{
                          marginTop: 12,
                          flexDirection: "row",
                          gap: 8,
                        }}
                      >
                        <TaskStatusAction
                          label="De făcut"
                          active={normalizedStatus === "todo"}
                          disabled={busyThisTask}
                          onPress={() => void setTaskStatus(task.id, "todo")}
                        />

                        <TaskStatusAction
                          label="În lucru"
                          active={
                            normalizedStatus === "doing" ||
                            normalizedStatus === "in_progress"
                          }
                          disabled={busyThisTask}
                          onPress={() => void setTaskStatus(task.id, "doing")}
                        />

                        <TaskStatusAction
                          label="Gata"
                          active={
                            normalizedStatus === "done" ||
                            normalizedStatus === "completed"
                          }
                          disabled={busyThisTask}
                          onPress={() => void setTaskStatus(task.id, "done")}
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
              borderRadius: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              padding: 16,
            }}
          >
            <SectionHeader
              title="Statusul programării"
              subtitle="Actualizează starea consultației pe măsură ce aceasta avansează."
            />

            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <StatusAction
                label="În desfășurare"
                tone="primary"
                active={currentStatus === "in_progress"}
                disabled={actionBusy}
                onPress={() => void setStatus("in_progress")}
              />

              <StatusAction
                label="Finalizată"
                tone="success"
                active={currentStatus === "completed"}
                disabled={actionBusy}
                onPress={() => void setStatus("completed")}
              />
            </View>

            <View style={{ marginTop: 8 }}>
              <StatusAction
                label="Anulează programarea"
                tone="danger"
                active={currentStatus === "canceled"}
                disabled={actionBusy}
                onPress={() => {
                  Alert.alert(
                    "Anulezi programarea?",
                    "Programarea va fi marcată ca anulată.",
                    [
                      {
                        text: "Renunță",
                        style: "cancel",
                      },
                      {
                        text: "Anulează programarea",
                        style: "destructive",
                        onPress: () => void setStatus("canceled"),
                      },
                    ],
                  );
                }}
              />
            </View>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={taskModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!taskSaving) {
            setTaskModalOpen(false);
          }
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15,23,42,0.45)",
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.card,
              padding: 18,
            }}
          >
            <Text
              style={{
                color: COLORS.text,
                fontSize: 20,
                fontWeight: "900",
              }}
            >
              Adaugă o sarcină
            </Text>

            <Text
              style={{
                marginTop: 7,
                color: COLORS.muted,
                lineHeight: 20,
              }}
            >
              Creează o acțiune de urmărit după consultație.
            </Text>

            <Text
              style={{
                marginTop: 16,
                color: COLORS.text,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              Titlu
            </Text>

            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Ex.: Verifică rezultatul analizelor"
              placeholderTextColor="#94A3B8"
              editable={!taskSaving}
              style={{
                marginTop: 7,
                minHeight: 48,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.card,
                paddingHorizontal: 12,
                color: COLORS.text,
              }}
            />

            <Text
              style={{
                marginTop: 14,
                color: COLORS.text,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              Termen opțional
            </Text>

            <TextInput
              value={taskDueAt}
              onChangeText={setTaskDueAt}
              placeholder="2026-07-20 14:30"
              placeholderTextColor="#94A3B8"
              editable={!taskSaving}
              autoCapitalize="none"
              style={{
                marginTop: 7,
                minHeight: 48,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.card,
                paddingHorizontal: 12,
                color: COLORS.text,
              }}
            />

            <View
              style={{
                marginTop: 18,
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Pressable
                onPress={() => setTaskModalOpen(false)}
                disabled={taskSaving}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 13,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.card,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: taskSaving ? 0.55 : 1,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: "900",
                  }}
                >
                  Renunță
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void submitTask()}
                disabled={taskSaving}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 13,
                  backgroundColor: COLORS.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: taskSaving ? 0.55 : 1,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "900",
                  }}
                >
                  {taskSaving ? "Se salvează..." : "Salvează"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
