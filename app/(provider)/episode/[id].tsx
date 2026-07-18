// Path: medicalend-mobile/app/(provider)/episode/[id].tsx

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { createAppointment } from "../../../_lib/appointments";
import {
  addEpisodeNote,
  addEpisodeTask,
  type EpisodeTimelinePayload,
  fetchEpisodeTimeline,
  updateCareEpisode,
  updateEpisodeTask,
} from "../../../_lib/careEpisodes";
import {
  formatWallClockDateTime,
  normalizeUserInputToNaiveIso,
  wallClockTimestamp,
} from "../../../_lib/datetime";
import {
  pickPdfDocument,
  uploadEpisodeDocument,
} from "../../../_lib/documents";
import { fetchProviderMe, type ProviderMe } from "../../../_lib/provider";
import { clearToken } from "../../../_lib/session";

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

const EPISODE_STATUS_OPTIONS = [
  "open",
  "in_progress",
  "completed",
  "closed",
  "archived",
] as const;

type EpisodeStatusValue = (typeof EPISODE_STATUS_OPTIONS)[number];

type AddMode = "menu" | "note" | "task" | "appointment";

type UnifiedEventKind =
  | "appointment"
  | "note"
  | "task"
  | "referral"
  | "document";

type UnifiedEvent = {
  kind: UnifiedEventKind;
  at: string;
  id: number;
  title: string;
  subtitle?: string;
  metadata?: string;
  status?: string | null;
  fileUrl?: string | null;
};

type GroupedEvents = {
  key: string;
  label: string;
  events: UnifiedEvent[];
};

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Dată nespecificată";
  return formatWallClockDateTime(value);
}

function formatTime(value?: string | null) {
  if (!value) return "";

  try {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      const match = value.match(/[T\s](\d{2}):(\d{2})/);
      return match ? `${match[1]}:${match[2]}` : "";
    }

    return parsed.toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function dateKey(value?: string | null) {
  if (!value) return "unknown";

  const rawMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (rawMatch) {
    return `${rawMatch[1]}-${rawMatch[2]}-${rawMatch[3]}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateGroupLabel(key: string) {
  if (key === "unknown") return "FĂRĂ DATĂ";

  const parsed = new Date(`${key}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return key.toUpperCase();
  }

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, "0"),
    String(yesterday.getDate()).padStart(2, "0"),
  ].join("-");

  if (key === todayKey) return "ASTĂZI";
  if (key === yesterdayKey) return "IERI";

  return parsed
    .toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}

function statusLabel(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "open":
    case "active":
      return "Activ";

    case "scheduled":
      return "Programată";

    case "in_progress":
      return "În desfășurare";

    case "completed":
    case "done":
      return "Finalizat";

    case "closed":
      return "Închis";

    case "archived":
      return "Arhivat";

    case "canceled":
      return "Anulat";

    case "pending":
      return "În așteptare";

    case "accepted":
      return "Acceptată";

    case "rejected":
      return "Respinsă";

    case "todo":
      return "De făcut";

    default:
      return cleanText(status) || "Nespecificat";
  }
}

function statusMeta(status?: string | null) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "open" ||
    normalized === "active" ||
    normalized === "scheduled" ||
    normalized === "accepted"
  ) {
    return {
      backgroundColor: COLORS.softGreen,
      color: COLORS.success,
    };
  }

  if (
    normalized === "in_progress" ||
    normalized === "pending" ||
    normalized === "todo"
  ) {
    return {
      backgroundColor: COLORS.softAmber,
      color: COLORS.warning,
    };
  }

  if (normalized === "canceled" || normalized === "rejected") {
    return {
      backgroundColor: COLORS.softRed,
      color: COLORS.error,
    };
  }

  return {
    backgroundColor: COLORS.softGray,
    color: COLORS.muted,
  };
}

function kindMeta(kind: UnifiedEventKind) {
  switch (kind) {
    case "appointment":
      return {
        icon: "✚",
        label: "Consultație",
        backgroundColor: COLORS.softBlue,
        color: COLORS.primary,
      };

    case "document":
      return {
        icon: "▤",
        label: "Document",
        backgroundColor: COLORS.softGreen,
        color: COLORS.success,
      };

    case "note":
      return {
        icon: "✎",
        label: "Notă",
        backgroundColor: COLORS.softGray,
        color: COLORS.muted,
      };

    case "task":
      return {
        icon: "✓",
        label: "Sarcină",
        backgroundColor: COLORS.softAmber,
        color: COLORS.warning,
      };

    case "referral":
      return {
        icon: "↗",
        label: "Trimitere",
        backgroundColor: COLORS.softBlue,
        color: COLORS.primaryDark,
      };
  }
}

function episodeStatusLabel(status?: string | null) {
  return statusLabel(status);
}

function patientDisplayName(episode: any) {
  return (
    cleanText(episode?.patient_name) ||
    (episode?.patient_id ? `Pacient #${episode.patient_id}` : "Pacient")
  );
}

function providerDisplayName(episode: any) {
  return (
    cleanText(episode?.owner_provider_name) ||
    (episode?.owner_provider_id
      ? `Furnizor #${episode.owner_provider_id}`
      : "Furnizor nespecificat")
  );
}

function appointmentTitle(appointment: any) {
  const notes = cleanText(appointment?.notes);

  if (notes) {
    return notes;
  }

  return "Consultație medicală";
}

function appointmentSubtitle(appointment: any) {
  const doctorName = cleanText(appointment?.doctor_name);
  const providerName = cleanText(appointment?.provider_name);

  if (doctorName && providerName) {
    return `${doctorName} • ${providerName}`;
  }

  return doctorName || providerName || "Clinică / specialist";
}

function readableDocumentTitle(document: any) {
  const explicitTitle = cleanText(document?.title);

  if (explicitTitle) {
    return explicitTitle;
  }

  const fileName = cleanText(document?.file_name);

  if (!fileName) {
    return "Document medical";
  }

  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function referralTitle(referral: any) {
  const reason = cleanText(referral?.reason);

  if (reason) {
    return reason;
  }

  return "Trimitere către alt furnizor";
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
        backgroundColor: meta.backgroundColor,
      }}
    >
      <Text
        style={{
          color: meta.color,
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {statusLabel(status)}
      </Text>
    </View>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: "46%" }}>
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
          fontWeight: "800",
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionChoice({
  title,
  subtitle,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#fff",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.softBlue,
        }}
      >
        <Text
          style={{
            color: COLORS.primary,
            fontSize: 18,
            fontWeight: "900",
          }}
        >
          {icon}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "900",
            fontSize: 15,
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            marginTop: 4,
            color: COLORS.muted,
            lineHeight: 19,
            fontSize: 13,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Text
        style={{
          color: COLORS.primary,
          fontWeight: "900",
          fontSize: 20,
        }}
      >
        ›
      </Text>
    </Pressable>
  );
}

function TaskStatusActions({
  taskId,
  currentStatus,
  saving,
  onChange,
}: {
  taskId: number;
  currentStatus?: string | null;
  saving: boolean;
  onChange: (taskId: number, status: string) => void;
}) {
  const normalized = String(currentStatus || "").toLowerCase();

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginTop: 12,
      }}
    >
      <Pressable
        onPress={() => onChange(taskId, "todo")}
        disabled={saving || normalized === "todo"}
        style={{
          flex: 1,
          minHeight: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: "#fff",
          opacity: saving || normalized === "todo" ? 0.55 : 1,
        }}
      >
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "800",
            fontSize: 12,
          }}
        >
          De făcut
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(taskId, "in_progress")}
        disabled={saving || normalized === "in_progress"}
        style={{
          flex: 1,
          minHeight: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.warning,
          opacity: saving || normalized === "in_progress" ? 0.55 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 12,
          }}
        >
          În lucru
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(taskId, "done")}
        disabled={saving || normalized === "done" || normalized === "completed"}
        style={{
          flex: 1,
          minHeight: 38,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLORS.success,
          opacity:
            saving || normalized === "done" || normalized === "completed"
              ? 0.55
              : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 12,
          }}
        >
          Finalizată
        </Text>
      </Pressable>
    </View>
  );
}

export default function ProviderEpisodeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const episodeId = Number(id);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<EpisodeTimelinePayload | null>(null);
  const [providerMe, setProviderMe] = useState<ProviderMe | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("menu");

  const [noteText, setNoteText] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");

  const [apptStart, setApptStart] = useState("");
  const [apptEnd, setApptEnd] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<EpisodeStatusValue>("open");
  const [statusSaving, setStatusSaving] = useState(false);

  const [taskSavingId, setTaskSavingId] = useState<number | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function loadProviderMe() {
    try {
      const provider = await fetchProviderMe();
      setProviderMe(provider);
    } catch (error: any) {
      const responseStatus = error?.response?.status;

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    }
  }

  async function loadTimeline() {
    setErr(null);
    setBusy(true);

    try {
      const timeline = await fetchEpisodeTimeline(episodeId);
      setData(timeline);
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut încărca episodul.";

      setErr(String(detail));

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadProviderMe(), loadTimeline()]);
  }

  useEffect(() => {
    if (!Number.isFinite(episodeId) || episodeId <= 0) {
      setBusy(false);
      setErr("ID-ul episodului este invalid.");
      return;
    }

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const events = useMemo<UnifiedEvent[]>(() => {
    if (!data) return [];

    const appointmentEvents: UnifiedEvent[] = (data.appointments ?? []).map(
      (appointment: any) => ({
        kind: "appointment",
        at: appointment.start_time || appointment.created_at,
        id: appointment.id,
        title: appointmentTitle(appointment),
        subtitle: appointmentSubtitle(appointment),
        metadata: appointment.end_time
          ? `${formatTime(appointment.start_time)}–${formatTime(
              appointment.end_time,
            )}`
          : formatTime(appointment.start_time),
        status: appointment.status,
      }),
    );

    const noteEvents: UnifiedEvent[] = (data.notes ?? []).map((note: any) => ({
      kind: "note",
      at: note.created_at,
      id: note.id,
      title: "Notă de coordonare",
      subtitle: cleanText(note.text) || "Fără conținut",
    }));

    const taskEvents: UnifiedEvent[] = (data.tasks ?? []).map((task: any) => ({
      kind: "task",
      at: task.due_at || task.created_at,
      id: task.id,
      title: cleanText(task.title) || "Sarcină",
      subtitle: task.due_at
        ? `Termen: ${formatDateTime(task.due_at)}`
        : "Fără termen stabilit",
      status: task.status,
    }));

    const referralEvents: UnifiedEvent[] = (data.referrals ?? []).map(
      (referral: any) => ({
        kind: "referral",
        at: referral.created_at,
        id: referral.id,
        title: referralTitle(referral),
        subtitle:
          cleanText(referral.to_provider_name) ||
          (referral.to_provider_id
            ? `Furnizor destinatar #${referral.to_provider_id}`
            : "Furnizor destinatar nespecificat"),
        status: referral.status,
      }),
    );

    const documentEvents: UnifiedEvent[] = ((data as any).documents ?? []).map(
      (document: any) => ({
        kind: "document",
        at: document.created_at,
        id: document.id,
        title: readableDocumentTitle(document),
        subtitle: document.appointment_id
          ? "Document asociat unei consultații"
          : "Document asociat episodului",
        fileUrl: document.file_url,
      }),
    );

    return [
      ...appointmentEvents,
      ...noteEvents,
      ...taskEvents,
      ...referralEvents,
      ...documentEvents,
    ].sort(
      (first, second) =>
        wallClockTimestamp(second.at) - wallClockTimestamp(first.at),
    );
  }, [data]);

  const groupedEvents = useMemo<GroupedEvents[]>(() => {
    const groups = new Map<string, UnifiedEvent[]>();

    for (const event of events) {
      const key = dateKey(event.at);
      const current = groups.get(key) ?? [];
      current.push(event);
      groups.set(key, current);
    }

    return Array.from(groups.entries())
      .map(([key, groupEvents]) => ({
        key,
        label: dateGroupLabel(key),
        events: groupEvents,
      }))
      .sort((first, second) => second.key.localeCompare(first.key));
  }, [events]);

  function resetForms() {
    setNoteText("");
    setTaskTitle("");
    setTaskDueAt("");
    setApptStart("");
    setApptEnd("");
    setApptNotes("");
  }

  function openAddMenu() {
    resetForms();
    setAddMode("menu");
    setAddOpen(true);
  }

  function closeAddModal() {
    if (saving || uploadingDoc) return;

    setAddOpen(false);
    setAddMode("menu");
    resetForms();
  }

  function openAppointment(appointmentId: number) {
    router.push({
      pathname: "/(provider)/appointment/[id]",
      params: {
        id: String(appointmentId),
      },
    });
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
      Alert.alert("Eroare", "Nu s-a putut deschide PDF-ul.");
    }
  }

  async function onUploadDocument() {
    if (uploadingDoc) return;

    try {
      const picked = await pickPdfDocument();

      if (!picked) return;

      setUploadingDoc(true);

      await uploadEpisodeDocument({
        episodeId,
        fileUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType,
      });

      setAddOpen(false);
      setAddMode("menu");

      Alert.alert(
        "Document adăugat",
        "Fișierul este acum disponibil în istoricul episodului.",
      );

      await loadTimeline();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Încărcarea documentului a eșuat.";

      Alert.alert("Eroare", String(detail));
    } finally {
      setUploadingDoc(false);
    }
  }

  async function submitNote() {
    const text = noteText.trim();

    if (text.length < 3) {
      Alert.alert("Text lipsă", "Nota trebuie să aibă cel puțin 3 caractere.");
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      await addEpisodeNote(episodeId, text);

      setAddOpen(false);
      setAddMode("menu");
      resetForms();

      await loadTimeline();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut adăuga nota.";

      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  async function submitTask() {
    const title = taskTitle.trim();

    if (title.length < 3) {
      Alert.alert(
        "Titlu lipsă",
        "Titlul sarcinii trebuie să aibă cel puțin 3 caractere.",
      );
      return;
    }

    if (saving) return;

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

    setSaving(true);

    try {
      await addEpisodeTask(episodeId, {
        title,
        due_at: dueAt,
        assigned_to_role: "provider",
      });

      setAddOpen(false);
      setAddMode("menu");
      resetForms();

      await loadTimeline();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut adăuga sarcina.";

      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  async function submitAppointment() {
    if (!data?.episode?.patient_id) {
      Alert.alert("Eroare", "Episodul nu are un pacient asociat.");
      return;
    }

    let currentProvider = providerMe;

    if (!currentProvider) {
      try {
        currentProvider = await fetchProviderMe();
        setProviderMe(currentProvider);
      } catch (error: any) {
        const detail =
          error?.response?.data?.detail ||
          error?.message ||
          "Nu am putut încărca profilul furnizorului.";

        Alert.alert("Eroare", String(detail));
        return;
      }
    }

    if (!currentProvider?.id) {
      Alert.alert("Eroare", "Profilul furnizorului nu este disponibil.");
      return;
    }

    if (currentProvider.status !== "approved") {
      Alert.alert(
        "Acțiune indisponibilă",
        "Profilul furnizorului nu este încă aprobat.",
      );
      return;
    }

    const rawStart = apptStart.trim();

    if (!rawStart) {
      Alert.alert("Date lipsă", "Data și ora începerii sunt obligatorii.");
      return;
    }

    let startTime = "";
    let endTime: string | null = null;

    try {
      startTime = normalizeUserInputToNaiveIso(rawStart);
    } catch {
      Alert.alert("Dată invalidă", "Folosește formatul 2026-07-20 14:30.");
      return;
    }

    const rawEnd = apptEnd.trim();

    if (rawEnd) {
      try {
        endTime = normalizeUserInputToNaiveIso(rawEnd);
      } catch {
        Alert.alert("Dată invalidă", "Folosește formatul 2026-07-20 15:00.");
        return;
      }
    }

    if (saving) return;

    setSaving(true);

    try {
      await createAppointment({
        patient_id: data.episode.patient_id,
        provider_id: currentProvider.id,
        episode_id: episodeId,
        start_time: startTime,
        end_time: endTime,
        status: "scheduled",
        notes: apptNotes.trim() || null,
      });

      setAddOpen(false);
      setAddMode("menu");
      resetForms();

      await loadTimeline();
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut crea programarea.";

      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  function openStatusModal() {
    const currentStatus = String(
      data?.episode?.status || "open",
    ) as EpisodeStatusValue;

    const supportedStatus = EPISODE_STATUS_OPTIONS.includes(currentStatus)
      ? currentStatus
      : "open";

    setSelectedStatus(supportedStatus);
    setStatusOpen(true);
  }

  async function saveStatus() {
    if (!data?.episode?.id || statusSaving) return;

    setStatusSaving(true);

    try {
      await updateCareEpisode(data.episode.id, {
        status: selectedStatus,
      });

      setStatusOpen(false);
      await loadTimeline();
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut actualiza statusul.";

      Alert.alert("Eroare", String(detail));

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setStatusSaving(false);
    }
  }

  async function setTaskStatus(taskId: number, nextStatus: string) {
    if (!taskId || taskSavingId === taskId) return;

    setTaskSavingId(taskId);

    try {
      await updateEpisodeTask(taskId, {
        status: nextStatus,
      });

      await loadTimeline();
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Nu am putut actualiza sarcina.";

      Alert.alert("Eroare", String(detail));

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setTaskSavingId(null);
    }
  }

  function renderEvent(event: UnifiedEvent, isLast: boolean) {
    const kind = kindMeta(event.kind);
    const isInteractive =
      event.kind === "appointment" || event.kind === "document";

    function handlePress() {
      if (event.kind === "appointment") {
        openAppointment(event.id);
        return;
      }

      if (event.kind === "document") {
        void openDocument(event.fileUrl);
      }
    }

    return (
      <View
        key={`${event.kind}-${event.id}`}
        style={{
          flexDirection: "row",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: kind.backgroundColor,
            }}
          >
            <Text
              style={{
                color: kind.color,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {kind.icon}
            </Text>
          </View>

          {!isLast ? (
            <View
              style={{
                width: 2,
                flex: 1,
                minHeight: 42,
                backgroundColor: COLORS.border,
                marginVertical: 5,
              }}
            />
          ) : null}
        </View>

        <Pressable
          onPress={handlePress}
          disabled={!isInteractive}
          style={{
            flex: 1,
            paddingBottom: isLast ? 0 : 18,
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
                  fontSize: 15,
                  lineHeight: 21,
                }}
              >
                {event.title}
              </Text>

              <Text
                style={{
                  marginTop: 4,
                  color: COLORS.muted,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {event.metadata || formatTime(event.at) || kind.label}
              </Text>
            </View>

            {event.status ? (
              <StatusPill status={event.status} />
            ) : isInteractive ? (
              <Text
                style={{
                  color: COLORS.primary,
                  fontWeight: "900",
                  fontSize: 20,
                }}
              >
                ›
              </Text>
            ) : null}
          </View>

          {event.subtitle ? (
            <Text
              style={{
                marginTop: 8,
                color: COLORS.muted,
                lineHeight: 20,
                fontSize: 14,
              }}
            >
              {event.subtitle}
            </Text>
          ) : null}

          {event.kind === "task" ? (
            <TaskStatusActions
              taskId={event.id}
              currentStatus={event.status}
              saving={taskSavingId === event.id}
              onChange={setTaskStatus}
            />
          ) : null}
        </Pressable>
      </View>
    );
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

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {cleanText((data as any)?.episode?.title) || "Episod medical"}
          </Text>
        </View>

        <Pressable
          onPress={() => void loadAll()}
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
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: COLORS.error,
              }}
            >
              Episodul nu a putut fi încărcat
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
      ) : !data ? null : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 110,
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
                  width: 170,
                  height: 170,
                  borderRadius: 999,
                  right: -45,
                  top: -65,
                  backgroundColor: "rgba(47,107,255,0.28)",
                }}
              />

              <View
                style={{
                  position: "absolute",
                  width: 150,
                  height: 150,
                  borderRadius: 999,
                  left: -70,
                  bottom: -90,
                  backgroundColor: "rgba(79,179,232,0.16)",
                }}
              />

              <View style={{ zIndex: 2 }}>
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
                        color: "rgba(255,255,255,0.68)",
                        fontWeight: "800",
                        fontSize: 12,
                        letterSpacing: 0.6,
                      }}
                    >
                      EPISOD MEDICAL
                    </Text>

                    <Text
                      style={{
                        marginTop: 8,
                        color: "#fff",
                        fontWeight: "900",
                        fontSize: 25,
                        lineHeight: 31,
                      }}
                    >
                      {cleanText(data.episode.title) || "Episod medical"}
                    </Text>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.16)",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "900",
                        fontSize: 12,
                      }}
                    >
                      {episodeStatusLabel(data.episode.status)}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 18,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <View style={{ minWidth: "45%", flex: 1 }}>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.64)",
                        fontSize: 11,
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      Pacient
                    </Text>

                    <Text
                      style={{
                        marginTop: 5,
                        color: "#fff",
                        fontWeight: "900",
                        fontSize: 15,
                        lineHeight: 21,
                      }}
                    >
                      {patientDisplayName(data.episode)}
                    </Text>
                  </View>

                  <View style={{ minWidth: "45%", flex: 1 }}>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.64)",
                        fontSize: 11,
                        fontWeight: "800",
                        textTransform: "uppercase",
                      }}
                    >
                      Furnizor responsabil
                    </Text>

                    <Text
                      style={{
                        marginTop: 5,
                        color: "#fff",
                        fontWeight: "900",
                        fontSize: 15,
                        lineHeight: 21,
                      }}
                    >
                      {providerDisplayName(data.episode)}
                    </Text>
                  </View>
                </View>
              </View>
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
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <InfoBlock
                  label="Început"
                  value={formatDateTime(data.episode.created_at)}
                />

                <InfoBlock
                  label="Status"
                  value={episodeStatusLabel(data.episode.status)}
                />
              </View>

              <Pressable
                onPress={openStatusModal}
                style={{
                  marginTop: 16,
                  minHeight: 42,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: "900",
                  }}
                >
                  Actualizează statusul
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
              }}
            >
              <Text
                style={{
                  color: COLORS.text,
                  fontWeight: "900",
                  fontSize: 19,
                }}
              >
                Istoricul episodului
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.muted,
                  lineHeight: 20,
                }}
              >
                Consultațiile, documentele și acțiunile importante, grupate
                cronologic.
              </Text>

              {groupedEvents.length === 0 ? (
                <View
                  style={{
                    marginTop: 16,
                    borderRadius: 16,
                    backgroundColor: COLORS.softGray,
                    padding: 16,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.text,
                      fontWeight: "900",
                    }}
                  >
                    Nu există încă evenimente
                  </Text>

                  <Text
                    style={{
                      marginTop: 7,
                      color: COLORS.muted,
                      lineHeight: 20,
                    }}
                  >
                    Adaugă o consultație, un document, o notă sau o sarcină.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 18, gap: 22 }}>
                  {groupedEvents.map((group) => (
                    <View key={group.key}>
                      <Text
                        style={{
                          color: COLORS.muted,
                          fontWeight: "900",
                          fontSize: 12,
                          letterSpacing: 0.7,
                        }}
                      >
                        {group.label}
                      </Text>

                      <View style={{ marginTop: 14 }}>
                        {group.events.map((event, index) =>
                          renderEvent(event, index === group.events.length - 1),
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              backgroundColor: "rgba(255,255,255,0.97)",
            }}
          >
            <Pressable
              onPress={openAddMenu}
              style={{
                minHeight: 52,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                + Adaugă în episod
              </Text>
            </Pressable>
          </View>

          <Modal
            visible={statusOpen}
            transparent
            animationType="slide"
            onRequestClose={() => !statusSaving && setStatusOpen(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(15,23,42,0.42)",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 18,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 19,
                    fontWeight: "900",
                  }}
                >
                  Statusul episodului
                </Text>

                <Text
                  style={{
                    marginTop: 6,
                    color: COLORS.muted,
                    lineHeight: 20,
                  }}
                >
                  Selectează starea actuală a episodului.
                </Text>

                <View style={{ marginTop: 16, gap: 9 }}>
                  {EPISODE_STATUS_OPTIONS.map((statusValue) => {
                    const active = selectedStatus === statusValue;

                    return (
                      <Pressable
                        key={statusValue}
                        onPress={() => setSelectedStatus(statusValue)}
                        style={{
                          minHeight: 48,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          backgroundColor: active ? COLORS.softBlue : "#fff",
                          paddingHorizontal: 14,
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? COLORS.primary : COLORS.text,
                            fontWeight: "900",
                          }}
                        >
                          {episodeStatusLabel(statusValue)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <Pressable
                    onPress={() => setStatusOpen(false)}
                    disabled={statusSaving}
                    style={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.text,
                        fontWeight: "900",
                      }}
                    >
                      Anulează
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={saveStatus}
                    disabled={statusSaving}
                    style={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: COLORS.primary,
                      opacity: statusSaving ? 0.65 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "900",
                      }}
                    >
                      {statusSaving ? "Se salvează..." : "Salvează"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={addOpen}
            transparent
            animationType="slide"
            onRequestClose={closeAddModal}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(15,23,42,0.42)",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  maxHeight: "90%",
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 18,
                }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
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
                          fontSize: 19,
                          fontWeight: "900",
                        }}
                      >
                        {addMode === "menu"
                          ? "Adaugă în episod"
                          : addMode === "note"
                            ? "Notă nouă"
                            : addMode === "task"
                              ? "Sarcină nouă"
                              : "Programare nouă"}
                      </Text>

                      <Text
                        style={{
                          marginTop: 6,
                          color: COLORS.muted,
                          lineHeight: 20,
                        }}
                      >
                        {cleanText(data.episode.title) || "Episod medical"}
                      </Text>
                    </View>

                    {addMode !== "menu" ? (
                      <Pressable
                        onPress={() => setAddMode("menu")}
                        disabled={saving}
                      >
                        <Text
                          style={{
                            color: COLORS.primary,
                            fontWeight: "900",
                          }}
                        >
                          Înapoi
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {addMode === "menu" ? (
                    <View style={{ marginTop: 18, gap: 10 }}>
                      <ActionChoice
                        title="Notă"
                        subtitle="Adaugă o observație de coordonare."
                        icon="✎"
                        onPress={() => setAddMode("note")}
                      />

                      <ActionChoice
                        title="Sarcină"
                        subtitle="Stabilește o acțiune de urmărit."
                        icon="✓"
                        onPress={() => setAddMode("task")}
                      />

                      <ActionChoice
                        title="Programare"
                        subtitle="Adaugă o consultație în acest episod."
                        icon="+"
                        onPress={() => setAddMode("appointment")}
                      />

                      <ActionChoice
                        title="Document PDF"
                        subtitle="Atașează un rezultat sau un document."
                        icon="▤"
                        onPress={() => void onUploadDocument()}
                        disabled={uploadingDoc}
                      />

                      <Pressable
                        onPress={closeAddModal}
                        disabled={uploadingDoc}
                        style={{
                          marginTop: 6,
                          minHeight: 46,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#fff",
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.text,
                            fontWeight: "900",
                          }}
                        >
                          {uploadingDoc
                            ? "Se încarcă documentul..."
                            : "Închide"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : addMode === "note" ? (
                    <View style={{ marginTop: 16 }}>
                      <Text
                        style={{
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Conținutul notei
                      </Text>

                      <TextInput
                        value={noteText}
                        onChangeText={setNoteText}
                        placeholder="Scrie o notă relevantă pentru acest episod..."
                        multiline
                        editable={!saving}
                        style={{
                          marginTop: 8,
                          minHeight: 120,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          padding: 12,
                          textAlignVertical: "top",
                          color: COLORS.text,
                          backgroundColor: "#fff",
                        }}
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          marginTop: 16,
                        }}
                      >
                        <Pressable
                          onPress={closeAddModal}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: COLORS.border,
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
                            Anulează
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={submitNote}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: COLORS.primary,
                            opacity: saving ? 0.65 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "900",
                            }}
                          >
                            {saving ? "Se salvează..." : "Salvează"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : addMode === "task" ? (
                    <View style={{ marginTop: 16 }}>
                      <Text
                        style={{
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Titlu
                      </Text>

                      <TextInput
                        value={taskTitle}
                        onChangeText={setTaskTitle}
                        placeholder="Ex.: Verifică rezultatele analizelor"
                        editable={!saving}
                        style={{
                          marginTop: 8,
                          height: 48,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          paddingHorizontal: 12,
                          color: COLORS.text,
                        }}
                      />

                      <Text
                        style={{
                          marginTop: 14,
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Termen opțional
                      </Text>

                      <TextInput
                        value={taskDueAt}
                        onChangeText={setTaskDueAt}
                        placeholder="2026-07-20 14:30"
                        editable={!saving}
                        autoCapitalize="none"
                        style={{
                          marginTop: 8,
                          height: 48,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          paddingHorizontal: 12,
                          color: COLORS.text,
                        }}
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          marginTop: 16,
                        }}
                      >
                        <Pressable
                          onPress={closeAddModal}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: COLORS.border,
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
                            Anulează
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={submitTask}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: COLORS.primary,
                            opacity: saving ? 0.65 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "900",
                            }}
                          >
                            {saving ? "Se salvează..." : "Salvează"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginTop: 16 }}>
                      <Text
                        style={{
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Data și ora începerii
                      </Text>

                      <TextInput
                        value={apptStart}
                        onChangeText={setApptStart}
                        placeholder="2026-07-20 14:30"
                        editable={!saving}
                        autoCapitalize="none"
                        style={{
                          marginTop: 8,
                          height: 48,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          paddingHorizontal: 12,
                          color: COLORS.text,
                        }}
                      />

                      <Text
                        style={{
                          marginTop: 14,
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Data și ora finalizării
                      </Text>

                      <TextInput
                        value={apptEnd}
                        onChangeText={setApptEnd}
                        placeholder="2026-07-20 15:00"
                        editable={!saving}
                        autoCapitalize="none"
                        style={{
                          marginTop: 8,
                          height: 48,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          paddingHorizontal: 12,
                          color: COLORS.text,
                        }}
                      />

                      <Text
                        style={{
                          marginTop: 14,
                          color: COLORS.muted,
                          fontWeight: "700",
                        }}
                      >
                        Scopul consultației
                      </Text>

                      <TextInput
                        value={apptNotes}
                        onChangeText={setApptNotes}
                        placeholder="Ex.: Control ortopedic"
                        editable={!saving}
                        multiline
                        style={{
                          marginTop: 8,
                          minHeight: 80,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          padding: 12,
                          textAlignVertical: "top",
                          color: COLORS.text,
                        }}
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          marginTop: 16,
                        }}
                      >
                        <Pressable
                          onPress={closeAddModal}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: COLORS.border,
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
                            Anulează
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={submitAppointment}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 46,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: COLORS.primary,
                            opacity: saving ? 0.65 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "900",
                            }}
                          >
                            {saving ? "Se creează..." : "Creează"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}
