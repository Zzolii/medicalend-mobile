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
  softGreen: "#ECFDF5",
  softRed: "#FEF2F2",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

function fmt(value?: string | null) {
  if (!value) return "-";
  return formatWallClockDateTime(value);
}

function doctorLabel(data: AppointmentOut) {
  if (data.doctor_name?.trim()) return data.doctor_name.trim();
  return "Oricare medic disponibil";
}

function patientLabel(data: AppointmentOut) {
  if (data.patient_name?.trim()) return data.patient_name.trim();
  return `Pacient #${data.patient_id}`;
}

function statusMeta(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return {
        label: "Finalizată",
        bg: COLORS.softGreen,
        text: COLORS.success,
      };
    case "canceled":
      return {
        label: "Anulată",
        bg: COLORS.softRed,
        text: COLORS.error,
      };
    case "in_progress":
      return {
        label: "În desfășurare",
        bg: COLORS.softBlue,
        text: COLORS.primary,
      };
    default:
      return {
        label: "Programată",
        bg: COLORS.softAmber,
        text: COLORS.warning,
      };
  }
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
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
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: COLORS.softBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: COLORS.primary,
          }}
        />
      </View>

      <Text
        style={{
          marginTop: 14,
          fontSize: 16,
          fontWeight: "900",
          color: COLORS.text,
        }}
      >
        {title}
      </Text>

      <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 21 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  color,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={{
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function SmallBtn({
  label,
  onPress,
  disabled,
  variant = "ghost",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "ghost" | "warn" | "success";
}) {
  const backgroundColor =
    variant === "warn"
      ? COLORS.warning
      : variant === "success"
        ? COLORS.success
        : "#fff";

  const borderColor =
    variant === "ghost"
      ? COLORS.border
      : variant === "warn"
        ? COLORS.warning
        : COLORS.success;

  const textColor = variant === "ghost" ? COLORS.text : "#fff";

  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={{
        flex: 1,
        height: 38,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor,
        backgroundColor,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ fontWeight: "900", color: textColor }}>{label}</Text>
    </Pressable>
  );
}

function TaskStatusChip({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();

  const color =
    s === "done" || s === "completed"
      ? COLORS.success
      : s === "doing" || s === "in_progress"
        ? COLORS.warning
        : COLORS.primary;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontWeight: "900", color }}>
        {String(status || "todo").toUpperCase()}
      </Text>
    </View>
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

  const currentStatus = String(data?.status ?? "").toLowerCase();
  const appointmentBadge = statusMeta(data?.status);

  const validEpisodeId =
    typeof data?.episode_id === "number" && Number.isFinite(data.episode_id)
      ? data.episode_id
      : null;

  const loadTasks = useCallback(async () => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;

    setTasksBusy(true);
    setTasksErr(null);

    try {
      const rows = await fetchAppointmentTasks(appointmentId);
      setTasks(rows ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea taskurilor a eșuat.";
      setTasksErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setTasksBusy(false);
    }
  }, [appointmentId]);

  const loadDocuments = useCallback(
    async (episodeId?: number | null) => {
      if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;

      setDocumentsBusy(true);
      setDocumentsErr(null);

      try {
        let rows: MedicalDocumentOut[] = [];

        if (typeof episodeId === "number" && Number.isFinite(episodeId)) {
          rows = await fetchAppointmentDocuments(appointmentId, episodeId);
        }

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

  const load = useCallback(async () => {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      setBusy(false);
      setErr("ID programare invalid.");
      return null;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await fetchAppointment(appointmentId);
      setData(res);
      return res;
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

      return null;
    } finally {
      setBusy(false);
    }
  }, [appointmentId]);

  const loadAll = useCallback(async () => {
    const appointment = await load();

    const resolvedEpisodeId =
      appointment &&
      typeof appointment.episode_id === "number" &&
      Number.isFinite(appointment.episode_id)
        ? appointment.episode_id
        : typeof data?.episode_id === "number" &&
            Number.isFinite(data.episode_id)
          ? data.episode_id
          : null;

    await Promise.all([loadTasks(), loadDocuments(resolvedEpisodeId)]);
  }, [data?.episode_id, load, loadDocuments, loadTasks]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setStatus = useCallback(
    async (nextStatus: string) => {
      if (!data) return;

      const next = String(nextStatus).toLowerCase();
      const curr = String(data.status ?? "").toLowerCase();

      if (next === curr) {
        Alert.alert(
          "Info",
          `Programarea este deja în statusul "${data.status}".`,
        );
        return;
      }

      setActionBusy(true);
      try {
        const updated = await updateAppointmentStatus(data.id, next);
        setData(updated);
        await loadAll();
      } catch (e: any) {
        const status = e?.response?.status;
        const detail =
          e?.response?.data?.detail ||
          e?.message ||
          "Actualizarea statusului a eșuat.";

        if (status === 401) {
          await clearToken();
          router.replace("/(auth)/login");
          return;
        }

        Alert.alert("Eroare", String(detail));
      } finally {
        setActionBusy(false);
      }
    },
    [data, loadAll],
  );

  async function setTaskStatus(taskId: number, nextStatus: string) {
    if (!taskId) return;
    if (taskActionId === taskId) return;

    setTaskActionId(taskId);
    try {
      await updateEpisodeTask(taskId, { status: nextStatus });
      await loadTasks();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Actualizarea taskului a eșuat.";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setTaskActionId(null);
    }
  }

  function openEpisode(episodeIdValue: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(episodeIdValue) },
    });
  }

  function openPatientJourney() {
    if (!data?.patient_id) {
      Alert.alert("Eroare", "Această programare nu are pacient asociat.");
      return;
    }

    router.push({
      pathname: "/(provider)/patient/[id]/journey",
      params: { id: String(data.patient_id) },
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
        "Lipsește titlul",
        "Titlul taskului trebuie să aibă minim 3 caractere.",
      );
      return;
    }

    let dueIso: string | null = null;
    const raw = taskDueAt.trim();

    if (raw.length > 0) {
      try {
        dueIso = normalizeUserInputToNaiveIso(raw);
      } catch {
        Alert.alert(
          "Dată invalidă",
          "În câmpul „Due at” scrie, de exemplu: 2026-03-10 14:30 sau 2026-03-10T14:30:00.",
        );
        return;
      }
    }

    setTaskSaving(true);
    try {
      await createAppointmentTask(appointmentId, {
        title,
        due_at: dueIso,
        assigned_to_role: "provider",
      });

      setTaskModalOpen(false);
      setTaskTitle("");
      setTaskDueAt("");

      await loadAll();

      Alert.alert("Succes", "Taskul a fost adăugat la programare.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Crearea taskului a eșuat.";

      if (status === 401) {
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
      Alert.alert("Eroare", "Nu s-a putut deschide documentul.");
    }
  }

  async function onUploadDocument() {
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;
    if (documentUploading) return;

    if (validEpisodeId === null) {
      Alert.alert(
        "Episod lipsă",
        "Această programare nu are încă episod asociat, deci PDF-ul nu poate fi încărcat.",
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
      setDocumentUploading(false);
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
          Programare #{Number.isFinite(appointmentId) ? appointmentId : "?"}
        </Text>

        <Pressable
          onPress={loadAll}
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
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
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
              textAlign: "center",
            }}
          >
            Se încarcă programarea...
          </Text>
        </View>
      ) : err ? (
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 18,
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
      ) : !data ? null : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 18,
            paddingBottom: 28,
            gap: 16,
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
                right: -40,
                top: -10,
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: "rgba(79,179,232,0.18)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: -30,
                bottom: -40,
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: "rgba(47,107,255,0.16)",
              }}
            />

            <View style={{ zIndex: 2 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                PROGRAMARE
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  color: "#fff",
                  fontSize: 28,
                  lineHeight: 34,
                  fontWeight: "900",
                }}
              >
                {patientLabel(data)}
              </Text>

              <Text
                style={{
                  marginTop: 12,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 21,
                  maxWidth: "88%",
                }}
              >
                Furnizor: {data.provider_name || `#${data.provider_id}`}
                {"\n"}
                Medic: {doctorLabel(data)}
              </Text>

              <View
                style={{
                  marginTop: 16,
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: appointmentBadge.bg,
                }}
              >
                <Text
                  style={{
                    color: appointmentBadge.text,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  {appointmentBadge.label}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: "47%",
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Start</Text>
              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.text,
                  fontWeight: "900",
                  fontSize: 15,
                }}
              >
                {fmt(data.start_time)}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minWidth: "47%",
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.muted, fontSize: 12 }}>Sfârșit</Text>
              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.text,
                  fontWeight: "900",
                  fontSize: 15,
                }}
              >
                {data.end_time ? fmt(data.end_time) : "-"}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 12,
            }}
          >
            <SectionHeader
              title="Profil pacient"
              subtitle="Acces rapid la profil, Journey și episodul asociat acestei programări."
            />

            <Text style={{ color: COLORS.muted }}>
              Programare #{data.id}
              {validEpisodeId !== null ? ` • Episod #${validEpisodeId}` : ""}
            </Text>

            <Pressable
              onPress={openPatientJourney}
              style={{
                height: 44,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: "#fff" }}>
                Deschide Journey
              </Text>
            </Pressable>

            {validEpisodeId !== null ? (
              <Pressable
                onPress={() => openEpisode(validEpisodeId)}
                style={{
                  height: 44,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Deschide episodul
                </Text>
              </Pressable>
            ) : (
              <Text style={{ color: COLORS.warning, fontWeight: "800" }}>
                Această programare nu are episod asociat.
              </Text>
            )}
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
            <SectionHeader
              title="Cererea pacientului / Note"
              subtitle="Observațiile lăsate la creare sau ulterior."
            />

            {data.notes?.trim() ? (
              <Text
                style={{
                  marginTop: 12,
                  color: COLORS.text,
                  lineHeight: 21,
                }}
              >
                {data.notes}
              </Text>
            ) : (
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                Nu există observații introduse.
              </Text>
            )}
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
            <SectionHeader
              title="Documente PDF"
              subtitle="Documentele încărcate pentru această programare."
              actionLabel={documentUploading ? "Se încarcă..." : "+ PDF"}
              onPress={documentUploading ? undefined : onUploadDocument}
            />

            {documentsBusy ? (
              <View style={{ marginTop: 14, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={{ marginTop: 8, color: COLORS.muted }}>
                  Se încarcă documentele...
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
              <View style={{ marginTop: 12 }}>
                <EmptyCard
                  title="Nu există documente încărcate"
                  subtitle={
                    validEpisodeId !== null
                      ? "Poți adăuga un PDF folosind butonul de sus."
                      : "Mai întâi programarea trebuie să aibă un episod asociat."
                  }
                />
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                {documents.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 16,
                      padding: 12,
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      {doc.file_name}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Încărcat la: {fmt(doc.created_at)}
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
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionHeader
              title="Taskuri programare"
              subtitle="Sarcini rapide legate de această programare."
              actionLabel="+ Task"
              onPress={openAddTask}
            />

            {tasksBusy ? (
              <View style={{ marginTop: 14, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={{ marginTop: 8, color: COLORS.muted }}>
                  Se încarcă taskurile...
                </Text>
              </View>
            ) : tasksErr ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                  Eroare
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.text }}>
                  {tasksErr}
                </Text>
              </View>
            ) : tasks.length === 0 ? (
              <View style={{ marginTop: 12 }}>
                <EmptyCard
                  title="Nu există taskuri pentru această programare"
                  subtitle="Poți adăuga rapid un task nou din butonul de sus."
                />
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                {tasks.map((task) => {
                  const taskStatus = String(task.status || "").toLowerCase();
                  const busyThis = taskActionId === task.id;

                  return (
                    <View
                      key={task.id}
                      style={{
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 16,
                        padding: 12,
                        backgroundColor: "#fff",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ fontWeight: "900", color: COLORS.text }}
                          >
                            {task.title}
                          </Text>

                          <Text style={{ marginTop: 6, color: COLORS.muted }}>
                            Task #{task.id}
                            {task.episode_id
                              ? ` • Episod ${task.episode_id}`
                              : ""}
                          </Text>

                          {task.due_at ? (
                            <Text style={{ marginTop: 6, color: COLORS.muted }}>
                              Termen: {fmt(task.due_at)}
                            </Text>
                          ) : null}
                        </View>

                        <TaskStatusChip status={task.status} />
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        <SmallBtn
                          label="De făcut"
                          variant="ghost"
                          disabled={busyThis || taskStatus === "todo"}
                          onPress={() => setTaskStatus(task.id, "todo")}
                        />
                        <SmallBtn
                          label="În lucru"
                          variant="warn"
                          disabled={
                            busyThis ||
                            taskStatus === "doing" ||
                            taskStatus === "in_progress"
                          }
                          onPress={() => setTaskStatus(task.id, "doing")}
                        />
                        <SmallBtn
                          label="Gata"
                          variant="success"
                          disabled={
                            busyThis ||
                            taskStatus === "done" ||
                            taskStatus === "completed"
                          }
                          onPress={() => setTaskStatus(task.id, "done")}
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
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 10,
            }}
          >
            <SectionHeader
              title="Schimbă statusul"
              subtitle="Actualizează rapid starea curentă a programării."
            />

            <PrimaryButton
              label={
                currentStatus === "in_progress"
                  ? "În desfășurare ✓"
                  : "În desfășurare"
              }
              color={COLORS.warning}
              disabled={actionBusy}
              onPress={() => setStatus("in_progress")}
            />
            <PrimaryButton
              label={
                currentStatus === "completed" ? "Finalizată ✓" : "Finalizată"
              }
              color={COLORS.success}
              disabled={actionBusy}
              onPress={() => setStatus("completed")}
            />
            <PrimaryButton
              label={currentStatus === "canceled" ? "Anulată ✓" : "Anulată"}
              color={COLORS.error}
              disabled={actionBusy}
              onPress={() => setStatus("canceled")}
            />
          </View>
        </ScrollView>
      )}

      <Modal
        visible={taskModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !taskSaving && setTaskModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}
            >
              Adaugă task
            </Text>

            <Text style={{ marginTop: 10, color: COLORS.muted }}>
              Programare #{appointmentId}
            </Text>

            <Text
              style={{ marginTop: 12, color: COLORS.muted, fontWeight: "800" }}
            >
              Titlu
            </Text>
            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Ex.: control, analiză, verificare..."
              editable={!taskSaving}
              style={{
                marginTop: 8,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 12,
                color: COLORS.text,
                backgroundColor: "#fff",
                opacity: taskSaving ? 0.7 : 1,
              }}
            />

            <Text
              style={{ marginTop: 12, color: COLORS.muted, fontWeight: "800" }}
            >
              Due at (opțional)
            </Text>
            <TextInput
              value={taskDueAt}
              onChangeText={setTaskDueAt}
              placeholder="2026-03-10 14:30"
              editable={!taskSaving}
              style={{
                marginTop: 8,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 12,
                color: COLORS.text,
                backgroundColor: "#fff",
                opacity: taskSaving ? 0.7 : 1,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setTaskModalOpen(false)}
                disabled={taskSaving}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  opacity: taskSaving ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Anulează
                </Text>
              </Pressable>

              <Pressable
                onPress={submitTask}
                disabled={taskSaving}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: taskSaving ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {taskSaving ? "Se salvează..." : "Creează"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
