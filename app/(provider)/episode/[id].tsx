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
  EpisodeTimelinePayload,
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
import { fetchProviderMe, ProviderMe } from "../../../_lib/provider";
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

function fmt(value: string) {
  return formatWallClockDateTime(value);
}

type UnifiedEvent =
  | {
      kind: "appointment";
      at: string;
      id: number;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "note";
      at: string;
      id: number;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "task";
      at: string;
      id: number;
      title: string;
      subtitle?: string;
      status: string;
    }
  | {
      kind: "referral";
      at: string;
      id: number;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "document";
      at: string;
      id: number;
      title: string;
      subtitle?: string;
      file_url?: string;
    };

function KindChip({ kind }: { kind: UnifiedEvent["kind"] }) {
  const meta =
    kind === "appointment"
      ? { label: "PROGRAMARE", color: COLORS.primary }
      : kind === "note"
        ? { label: "NOTĂ", color: COLORS.muted }
        : kind === "task"
          ? { label: "SARCINĂ", color: COLORS.warning }
          : kind === "referral"
            ? { label: "TRIMITERE", color: COLORS.success }
            : { label: "PDF", color: COLORS.primary };

  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontWeight: "900", color: meta.color }}>{meta.label}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const color =
    s === "completed" || s === "closed"
      ? COLORS.success
      : s === "in_progress"
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
        {String(status || "necunoscut").toUpperCase()}
      </Text>
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
  const [tab, setTab] = useState<"note" | "task" | "appointment">("note");

  const [noteText, setNoteText] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");

  const [apptStart, setApptStart] = useState("");
  const [apptEnd, setApptEnd] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const [taskSavingId, setTaskSavingId] = useState<number | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function loadProviderMe() {
    try {
      const p = await fetchProviderMe();
      setProviderMe(p);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut încărca profilul providerului.";

      Alert.alert("Eroare profil provider", String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    }
  }

  async function loadTimeline() {
    setErr(null);
    setBusy(true);
    try {
      const d = await fetchEpisodeTimeline(episodeId);
      setData(d);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut încărca timeline-ul episodului.";
      setErr(String(detail));

      if (status === 401) {
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
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const events = useMemo<UnifiedEvent[]>(() => {
    if (!data) return [];

    const appts: UnifiedEvent[] = (data.appointments ?? []).map((a: any) => ({
      kind: "appointment",
      at: a.start_time || a.created_at,
      id: a.id,
      title: `Programare #${a.id} • ${a.status}`,
      subtitle: `${a.patient_name || `Pacient ${a.patient_id}`} • ${
        a.provider_name || `Provider ${a.provider_id}`
      }${a.doctor_name ? ` • Medic ${a.doctor_name}` : ""}`,
    }));

    const notes: UnifiedEvent[] = (data.notes ?? []).map((n) => ({
      kind: "note",
      at: n.created_at,
      id: n.id,
      title: `Notă #${n.id}`,
      subtitle: n.text,
    }));

    const tasks: UnifiedEvent[] = (data.tasks ?? []).map((t) => ({
      kind: "task",
      at: t.created_at,
      id: t.id,
      title: `Sarcină #${t.id} • ${t.status}`,
      subtitle: `${t.title}${t.due_at ? ` • termen ${fmt(t.due_at)}` : ""}`,
      status: t.status ?? "open",
    }));

    const refs: UnifiedEvent[] = (data.referrals ?? []).map((r) => ({
      kind: "referral",
      at: r.created_at,
      id: r.id,
      title: `Trimitere #${r.id} • ${r.status}`,
      subtitle: `Către provider ${r.to_provider_id} • ${r.reason}`,
    }));

    const docs: UnifiedEvent[] = ((data as any).documents ?? []).map(
      (d: any) => ({
        kind: "document",
        at: d.created_at,
        id: d.id,
        title: d.file_name || `Document #${d.id}`,
        subtitle: d.appointment_id
          ? `Atașat la programarea #${d.appointment_id}`
          : "Document atașat episodului",
        file_url: d.file_url,
      }),
    );

    return [...appts, ...notes, ...tasks, ...refs, ...docs].sort(
      (x, y) => wallClockTimestamp(x.at) - wallClockTimestamp(y.at),
    );
  }, [data]);

  function openAddModal(which: "note" | "task" | "appointment") {
    setTab(which);
    setAddOpen(true);
  }

  function resetForms() {
    setNoteText("");
    setTaskTitle("");
    setTaskDueAt("");
    setApptStart("");
    setApptEnd("");
    setApptNotes("");
  }

  function openPatientJourney() {
    const patientId = data?.episode?.patient_id;

    if (!patientId) {
      Alert.alert("Eroare", "Acest episod nu are pacient asociat.");
      return;
    }

    router.push({
      pathname: "/(provider)/patient/[id]/journey",
      params: { id: String(patientId) },
    });
  }

  function openAppointment(appointmentId: number) {
    router.push({
      pathname: "/(provider)/appointment/[id]",
      params: { id: String(appointmentId) },
    });
  }

  async function openDocument(url?: string) {
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

      Alert.alert("Succes", "Documentul a fost încărcat.");
      await loadTimeline();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea documentului a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setUploadingDoc(false);
    }
  }

  async function submitNote() {
    const txt = noteText.trim();
    if (txt.length < 3) {
      Alert.alert("Text lipsă", "Nota trebuie să aibă cel puțin 3 caractere.");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      await addEpisodeNote(episodeId, txt);
      setAddOpen(false);
      resetForms();
      await loadTimeline();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "Nu am putut adăuga nota.";
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

    let dueIso: string | null = null;
    const raw = taskDueAt.trim();
    if (raw.length > 0) {
      try {
        dueIso = normalizeUserInputToNaiveIso(raw);
      } catch {
        Alert.alert(
          "Dată invalidă",
          "În câmpul „Termen limită” scrie, de exemplu: 2026-01-26 14:30 sau 2026-01-26T14:30:00",
        );
        return;
      }
    }

    setSaving(true);
    try {
      await addEpisodeTask(episodeId, {
        title,
        due_at: dueIso,
        assigned_to_role: "provider",
      });
      setAddOpen(false);
      resetForms();
      await loadTimeline();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut adăuga sarcina.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  async function submitAppointment() {
    if (!data?.episode?.patient_id) {
      Alert.alert("Eroare", "Episodul nu are patient_id.");
      return;
    }

    let p = providerMe;
    if (!p) {
      try {
        p = await fetchProviderMe();
        setProviderMe(p);
      } catch (e: any) {
        const detail =
          e?.response?.data?.detail ||
          e?.message ||
          "Nu am putut încărca profilul providerului.";
        Alert.alert("Eroare profil provider", String(detail));
        return;
      }
    }

    if (!p?.id) {
      Alert.alert(
        "Eroare",
        "Răspunsul profilului provider nu conține id. Verifică răspunsul backend /providers/me.",
      );
      return;
    }

    if (p.status !== "approved") {
      Alert.alert("Nepermis", "Profilul providerului nu este încă aprobat.");
      return;
    }

    const startRaw = apptStart.trim();
    if (!startRaw) {
      Alert.alert("Date lipsă", "Ora începerii este obligatorie.");
      return;
    }

    let startNaive = "";
    let endNaive: string | null = null;

    try {
      startNaive = normalizeUserInputToNaiveIso(startRaw);
    } catch {
      Alert.alert(
        "Dată invalidă",
        "În câmpul „Ora începerii” scrie, de exemplu: 2026-01-26 14:30 sau 2026-01-26T14:30:00",
      );
      return;
    }

    const endRaw = apptEnd.trim();
    if (endRaw.length > 0) {
      try {
        endNaive = normalizeUserInputToNaiveIso(endRaw);
      } catch {
        Alert.alert(
          "Dată invalidă",
          "În câmpul „Ora finalizării” scrie, de exemplu: 2026-01-26 15:00 sau 2026-01-26T15:00:00",
        );
        return;
      }
    }

    if (saving) return;
    setSaving(true);
    try {
      await createAppointment({
        patient_id: data.episode.patient_id,
        provider_id: p.id,
        episode_id: episodeId,
        start_time: startNaive,
        end_time: endNaive,
        status: "scheduled",
        notes: apptNotes.trim() ? apptNotes.trim() : null,
      });

      setAddOpen(false);
      resetForms();
      await loadTimeline();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut crea programarea.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  function openStatusModal() {
    const current = data?.episode?.status ?? "";
    setStatusText(String(current));
    setStatusOpen(true);
  }

  async function saveStatus() {
    const next = statusText.trim();
    if (next.length < 2) {
      Alert.alert("Eroare", "Statusul trebuie să aibă cel puțin 2 caractere.");
      return;
    }
    if (!data?.episode?.id) return;
    if (statusSaving) return;

    setStatusSaving(true);
    try {
      await updateCareEpisode(data.episode.id, { status: next });
      setStatusOpen(false);
      await loadTimeline();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut actualiza statusul.";
      Alert.alert("Eroare", String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setStatusSaving(false);
    }
  }

  async function setTaskStatus(taskId: number, nextStatus: string) {
    if (!taskId) return;
    if (taskSavingId === taskId) return;

    setTaskSavingId(taskId);
    try {
      await updateEpisodeTask(taskId, { status: nextStatus });
      await loadTimeline();
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Nu am putut actualiza sarcina.";
      Alert.alert("Eroare", String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setTaskSavingId(null);
    }
  }

  function SmallActionBtn({
    label,
    onPress,
    disabled,
    variant,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant?: "primary" | "success" | "warn" | "ghost";
  }) {
    const bg =
      variant === "success"
        ? COLORS.success
        : variant === "warn"
          ? COLORS.warning
          : variant === "primary"
            ? COLORS.primary
            : "#fff";

    const border =
      variant === "ghost" ? COLORS.border : variant ? bg : COLORS.border;

    const textColor = variant === "ghost" ? COLORS.text : "#fff";

    return (
      <Pressable
        onPress={onPress}
        disabled={!!disabled}
        style={{
          flex: 1,
          height: 40,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={{ fontWeight: "900", color: textColor }}>{label}</Text>
      </Pressable>
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
          Episod #{Number.isFinite(episodeId) ? episodeId : "?"}
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
          </View>
        </View>
      ) : !data ? null : (
        <View style={{ flex: 1 }}>
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
                style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
              >
                {data.episode.title}
              </Text>

              <View
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.muted }}>
                    Creat la: {fmt(data.episode.created_at)}
                  </Text>
                  <Text style={{ marginTop: 6, color: COLORS.muted }}>
                    Pacient: {data.episode.patient_id} • Provider responsabil:{" "}
                    {data.episode.owner_provider_id}
                  </Text>
                </View>

                <StatusChip status={data.episode.status} />
              </View>

              <Pressable
                onPress={openPatientJourney}
                style={{
                  marginTop: 12,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  Deschide Journey
                </Text>
              </Pressable>

              <Pressable
                onPress={openStatusModal}
                style={{
                  marginTop: 10,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Schimbă statusul
                </Text>
              </Pressable>

              <Pressable
                onPress={onUploadDocument}
                disabled={uploadingDoc}
                style={{
                  marginTop: 10,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: uploadingDoc ? 0.7 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {uploadingDoc ? "Se încarcă PDF..." : "Încarcă PDF"}
                </Text>
              </Pressable>

              <Text style={{ marginTop: 10, color: COLORS.muted }}>
                Profil provider:{" "}
                {providerMe
                  ? `id=${providerMe.id} status=${providerMe.status}`
                  : "neîncărcat"}
              </Text>
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
                Timeline
              </Text>
              <Text style={{ marginTop: 6, color: COLORS.muted }}>
                Sursă unică pentru programări, note, sarcini, trimiteri și
                documente, afișate în ordine cronologică.
              </Text>

              <View style={{ marginTop: 12, gap: 10 }}>
                {events.length === 0 ? (
                  <Text style={{ color: COLORS.muted }}>
                    Nu există evenimente.
                  </Text>
                ) : (
                  events.map((ev) => (
                    <View
                      key={`${ev.kind}-${ev.id}`}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        backgroundColor: "#fff",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "900",
                            color: COLORS.text,
                            flex: 1,
                          }}
                        >
                          {ev.title}
                        </Text>
                        <KindChip kind={ev.kind} />
                      </View>

                      <Text style={{ marginTop: 6, color: COLORS.muted }}>
                        {fmt(ev.at)}
                      </Text>

                      {ev.subtitle ? (
                        <Text style={{ marginTop: 8, color: COLORS.text }}>
                          {ev.subtitle}
                        </Text>
                      ) : null}

                      {ev.kind === "appointment" ? (
                        <Pressable
                          onPress={() => openAppointment(ev.id)}
                          style={{
                            marginTop: 10,
                            height: 40,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: "#fff",
                          }}
                        >
                          <Text
                            style={{ fontWeight: "900", color: COLORS.text }}
                          >
                            Deschide programarea
                          </Text>
                        </Pressable>
                      ) : null}

                      {ev.kind === "document" ? (
                        <Pressable
                          onPress={() => openDocument(ev.file_url)}
                          style={{
                            marginTop: 10,
                            height: 40,
                            borderRadius: 12,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: COLORS.primary,
                          }}
                        >
                          <Text style={{ fontWeight: "900", color: "#fff" }}>
                            Deschide PDF
                          </Text>
                        </Pressable>
                      ) : null}

                      {ev.kind === "task" ? (
                        <View
                          style={{
                            marginTop: 10,
                            flexDirection: "row",
                            gap: 8,
                          }}
                        >
                          <SmallActionBtn
                            label="Deschisă"
                            variant="ghost"
                            disabled={
                              taskSavingId === ev.id ||
                              String(ev.status || "").toLowerCase() === "open"
                            }
                            onPress={() => setTaskStatus(ev.id, "open")}
                          />
                          <SmallActionBtn
                            label="În lucru"
                            variant="warn"
                            disabled={
                              taskSavingId === ev.id ||
                              String(ev.status || "").toLowerCase() ===
                                "in_progress"
                            }
                            onPress={() => setTaskStatus(ev.id, "in_progress")}
                          />
                          <SmallActionBtn
                            label="Finalizată"
                            variant="success"
                            disabled={
                              taskSavingId === ev.id ||
                              ["done", "completed"].includes(
                                String(ev.status || "").toLowerCase(),
                              )
                            }
                            onPress={() => setTaskStatus(ev.id, "done")}
                          />
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              backgroundColor: "#fff",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Pressable
              onPress={() => openAddModal("note")}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>+ Notă</Text>
            </Pressable>

            <Pressable
              onPress={() => openAddModal("task")}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                + Sarcină
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openAddModal("appointment")}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                + Programare
              </Text>
            </Pressable>
          </View>

          <Modal
            visible={statusOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setStatusOpen(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.35)",
                justifyContent: "center",
                padding: 16,
              }}
            >
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
                    fontSize: 18,
                    fontWeight: "900",
                    color: COLORS.text,
                  }}
                >
                  Actualizează statusul episodului
                </Text>

                <Text style={{ marginTop: 6, color: COLORS.muted }}>
                  Scrie un status, de exemplu: open / in_progress / closed
                </Text>

                <TextInput
                  value={statusText}
                  onChangeText={setStatusText}
                  placeholder="open"
                  autoCapitalize="none"
                  style={{
                    marginTop: 12,
                    height: 48,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    paddingHorizontal: 12,
                    color: COLORS.text,
                    backgroundColor: "#fff",
                  }}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={() => setStatusOpen(false)}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      Anulează
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={saveStatus}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: COLORS.primary,
                      opacity: statusSaving ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#fff" }}>
                      {statusSaving ? "..." : "Salvează"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={addOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAddOpen(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.35)",
                justifyContent: "center",
                padding: 16,
              }}
            >
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
                    fontSize: 18,
                    fontWeight: "900",
                    color: COLORS.text,
                  }}
                >
                  Adaugă{" "}
                  {tab === "note"
                    ? "notă"
                    : tab === "task"
                      ? "sarcină"
                      : "programare"}
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.muted }}>
                  Episod #{episodeId}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => setTab("note")}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tab === "note" ? COLORS.primary : "#fff",
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        color: tab === "note" ? "#fff" : COLORS.text,
                      }}
                    >
                      Notă
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setTab("task")}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tab === "task" ? COLORS.primary : "#fff",
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        color: tab === "task" ? "#fff" : COLORS.text,
                      }}
                    >
                      Sarcină
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setTab("appointment")}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        tab === "appointment" ? COLORS.primary : "#fff",
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        color: tab === "appointment" ? "#fff" : COLORS.text,
                      }}
                    >
                      Programare
                    </Text>
                  </Pressable>
                </View>

                {tab === "note" ? (
                  <>
                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Text
                    </Text>
                    <TextInput
                      value={noteText}
                      onChangeText={setNoteText}
                      placeholder="Ex.: plagă verificată, pansament schimbat..."
                      multiline
                      style={{
                        marginTop: 8,
                        minHeight: 110,
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
                      style={{ flexDirection: "row", gap: 10, marginTop: 14 }}
                    >
                      <Pressable
                        onPress={() => setAddOpen(false)}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          backgroundColor: "#fff",
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: COLORS.text }}>
                          Anulează
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={submitNote}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: COLORS.primary,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: "#fff" }}>
                          {saving ? "..." : "Salvează"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : tab === "task" ? (
                  <>
                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Titlu
                    </Text>
                    <TextInput
                      value={taskTitle}
                      onChangeText={setTaskTitle}
                      placeholder="Ex.: control peste 3 zile"
                      style={{
                        marginTop: 8,
                        height: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        paddingHorizontal: 12,
                        color: COLORS.text,
                        backgroundColor: "#fff",
                      }}
                    />

                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Termen limită (opțional)
                    </Text>
                    <TextInput
                      value={taskDueAt}
                      onChangeText={setTaskDueAt}
                      placeholder="2026-01-26 14:30"
                      autoCapitalize="none"
                      style={{
                        marginTop: 8,
                        height: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        paddingHorizontal: 12,
                        color: COLORS.text,
                        backgroundColor: "#fff",
                      }}
                    />

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 14 }}
                    >
                      <Pressable
                        onPress={() => setAddOpen(false)}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          backgroundColor: "#fff",
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: COLORS.text }}>
                          Anulează
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={submitTask}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: COLORS.primary,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: "#fff" }}>
                          {saving ? "..." : "Salvează"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Ora începerii
                    </Text>
                    <TextInput
                      value={apptStart}
                      onChangeText={setApptStart}
                      placeholder="2026-01-26 14:30"
                      autoCapitalize="none"
                      style={{
                        marginTop: 8,
                        height: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        paddingHorizontal: 12,
                        color: COLORS.text,
                        backgroundColor: "#fff",
                      }}
                    />

                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Ora finalizării (opțional)
                    </Text>
                    <TextInput
                      value={apptEnd}
                      onChangeText={setApptEnd}
                      placeholder="2026-01-26 15:00"
                      autoCapitalize="none"
                      style={{
                        marginTop: 8,
                        height: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        paddingHorizontal: 12,
                        color: COLORS.text,
                        backgroundColor: "#fff",
                      }}
                    />

                    <Text style={{ marginTop: 12, color: COLORS.muted }}>
                      Note (opțional)
                    </Text>
                    <TextInput
                      value={apptNotes}
                      onChangeText={setApptNotes}
                      placeholder="Ex.: control, stare plagă..."
                      style={{
                        marginTop: 8,
                        minHeight: 80,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        padding: 12,
                        textAlignVertical: "top",
                        color: COLORS.text,
                        backgroundColor: "#fff",
                      }}
                      multiline
                    />

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 14 }}
                    >
                      <Pressable
                        onPress={() => setAddOpen(false)}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          backgroundColor: "#fff",
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: COLORS.text }}>
                          Anulează
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={submitAppointment}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 14,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: COLORS.primary,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: "#fff" }}>
                          {saving ? "..." : "Creează"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}
