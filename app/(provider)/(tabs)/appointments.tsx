import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  fetchAppointments,
  getNowNaiveIso,
  getTodayRangeNaive,
  searchAppointments,
  type AppointmentOut,
} from "../../../_lib/appointments";
import {
  formatWallClockDateTime,
  wallClockTimestamp,
} from "../../../_lib/datetime";
import { getRoleContext, type RoleContext } from "../../../_lib/roles";
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
  softRed: "#FEF2F2",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

type Mode = "today" | "upcoming" | "all";

function statusMeta(status: string) {
  const s = String(status || "").toLowerCase();

  if (s === "scheduled") {
    return {
      label: "Programată",
      bg: COLORS.softAmber,
      text: COLORS.warning,
    };
  }
  if (s === "completed") {
    return {
      label: "Finalizată",
      bg: COLORS.softGreen,
      text: COLORS.success,
    };
  }
  if (s === "canceled") {
    return {
      label: "Anulată",
      bg: COLORS.softRed,
      text: COLORS.error,
    };
  }
  if (s === "no_show") {
    return {
      label: "Neprezentare",
      bg: COLORS.softRed,
      text: COLORS.error,
    };
  }
  if (s === "in_progress") {
    return {
      label: "În desfășurare",
      bg: COLORS.softBlue,
      text: COLORS.primary,
    };
  }

  return {
    label: String(status || "necunoscut"),
    bg: COLORS.softGray,
    text: COLORS.muted,
  };
}

function doctorLabel(a: AppointmentOut) {
  if (a.doctor_name?.trim()) return a.doctor_name.trim();
  return "Medic disponibil";
}

function providerLabel(a: AppointmentOut) {
  if (a.provider_name?.trim()) return a.provider_name.trim();
  return `Clinică #${a.provider_id}`;
}

function patientLabel(a: AppointmentOut) {
  if (a.patient_name?.trim()) return a.patient_name.trim();
  return `Pacient #${a.patient_id}`;
}

function roleSubtitle(roleCtx: RoleContext | null) {
  if (!roleCtx) return "Se încarcă rolul utilizatorului.";

  if (roleCtx.isClinicAdmin) {
    return "Vizualizare completă a programărilor clinicii și a fluxului medical.";
  }
  if (roleCtx.isDoctor) {
    return "Vezi programările relevante pentru activitatea ta medicală.";
  }
  if (roleCtx.isAssistant) {
    return "Urmărește programările și sarcinile clinice relevante.";
  }
  if (roleCtx.isReception) {
    return "Gestionează programările și vizualizează activitatea administrativă.";
  }

  return "Programările disponibile pentru contul curent.";
}

function modeTitle(mode: Mode) {
  if (mode === "today") return "Programările de azi";
  if (mode === "upcoming") return "Programările următoare";
  return "Toate programările";
}

function modeDescription(mode: Mode) {
  if (mode === "today") {
    return "Vezi rapid consultațiile și intervențiile programate pentru astăzi.";
  }
  if (mode === "upcoming") {
    return "Urmărește tot ce urmează și intră rapid în detaliile unei programări.";
  }
  return "Ai o privire completă asupra programărilor disponibile în contul curent.";
}

function emptyMessage(mode: Mode) {
  if (mode === "today") return "Nu există programări pentru astăzi.";
  if (mode === "upcoming") return "Nu există programări viitoare.";
  return "Nu există programări disponibile.";
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
          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? COLORS.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          color: active ? "#fff" : COLORS.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          marginTop: 6,
          color: COLORS.text,
          fontSize: 24,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
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

      <Text
        style={{
          marginTop: 8,
          color: COLORS.muted,
          lineHeight: 21,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function AppointmentCard({
  item,
  onOpenAppointment,
  onOpenEpisode,
}: {
  item: AppointmentOut;
  onOpenAppointment: (appointmentId: number) => void;
  onOpenEpisode: (episodeId: number) => void;
}) {
  const badge = statusMeta(item.status);

  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Pressable onPress={() => onOpenAppointment(item.id)}>
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
                fontSize: 16,
                lineHeight: 22,
              }}
            >
              {patientLabel(item)}
            </Text>

            <Text
              style={{
                marginTop: 6,
                color: COLORS.muted,
                lineHeight: 20,
              }}
            >
              {providerLabel(item)}
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: badge.bg,
            }}
          >
            <Text
              style={{
                color: badge.text,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {badge.label}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 14,
            borderRadius: 16,
            backgroundColor: COLORS.softGray,
            padding: 14,
          }}
        >
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 14,
            }}
          >
            Început: {formatWallClockDateTime(item.start_time)}
          </Text>

          {item.end_time ? (
            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Sfârșit: {formatWallClockDateTime(item.end_time)}
            </Text>
          ) : null}

          <Text style={{ marginTop: 6, color: COLORS.muted }}>
            Medic: {doctorLabel(item)}
          </Text>

          <Text style={{ marginTop: 6, color: COLORS.muted }}>
            Programare #{item.id}
            {item.episode_id ? ` • Episod #${item.episode_id}` : ""}
          </Text>
        </View>

        {item.notes?.trim() ? (
          <Text
            style={{
              marginTop: 12,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            Detalii: {item.notes.trim()}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text style={{ color: COLORS.muted, fontSize: 12 }}>
            Apasă pentru detalii complete
          </Text>

          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            Vezi programarea →
          </Text>
        </View>
      </Pressable>

      {item.episode_id ? (
        <Pressable
          onPress={() => onOpenEpisode(item.episode_id as number)}
          style={{
            marginTop: 14,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>
            Deschide episodul
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ProviderAppointmentsScreen() {
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AppointmentOut[]>([]);
  const [mode, setMode] = useState<Mode>("upcoming");
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);

  const load = useCallback(
    async (nextMode?: Mode) => {
      const currentMode = nextMode ?? mode;

      setErr(null);
      setBusy(true);

      try {
        const ctx = await getRoleContext();
        setRoleCtx(ctx);

        if (currentMode === "today") {
          const { start_from, start_to } = getTodayRangeNaive();
          const list = await searchAppointments({
            start_from,
            start_to,
            limit: 200,
            skip: 0,
          });
          setItems(list ?? []);
        } else if (currentMode === "upcoming") {
          const list = await searchAppointments({
            start_from: getNowNaiveIso(),
            limit: 200,
            skip: 0,
          });
          setItems(list ?? []);
        } else {
          const list = await fetchAppointments({ limit: 200, skip: 0 });
          setItems(list ?? []);
        }
      } catch (e: any) {
        const status = e?.response?.status;
        const detail =
          e?.response?.data?.detail ||
          e?.message ||
          "Încărcarea programărilor a eșuat.";

        if (String(detail).toLowerCase().includes("provider")) {
          setErr("Acest utilizator nu este asociat unei clinici.");
          setItems([]);
        } else {
          setErr(String(detail));
        }

        if (status === 401) {
          await clearToken();
          router.replace("/(auth)/login");
        }
      } finally {
        setBusy(false);
      }
    },
    [mode],
  );

  useFocusEffect(
    useCallback(() => {
      load(mode);
    }, [load, mode]),
  );

  const sorted = useMemo(() => {
    return (items ?? [])
      .slice()
      .sort(
        (a, b) =>
          wallClockTimestamp(a.start_time) - wallClockTimestamp(b.start_time),
      );
  }, [items]);

  const totalCount = sorted.length;
  const inProgressCount = useMemo(
    () =>
      sorted.filter(
        (item) => String(item.status || "").toLowerCase() === "in_progress",
      ).length,
    [sorted],
  );
  const withEpisodeCount = useMemo(
    () => sorted.filter((item) => !!item.episode_id).length,
    [sorted],
  );
  const summaryText = useMemo(() => {
    if (totalCount === 0) return emptyMessage(mode);
    if (totalCount === 1) return "Ai 1 programare în categoria selectată.";
    return `Ai ${totalCount} programări în categoria selectată.`;
  }, [mode, totalCount]);

  function openEpisode(episodeId: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(episodeId) },
    });
  }

  function openAppointment(appointmentId: number) {
    router.push({
      pathname: "/(provider)/appointment/[id]",
      params: { id: String(appointmentId) },
    });
  }

  function setModeAndLoad(nextMode: Mode) {
    setMode(nextMode);
    load(nextMode);
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
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
              PROGRAMĂRI
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
              Activitatea ta
              {"\n"}
              medicală, clară.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              {roleSubtitle(roleCtx)}
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
          <SummaryCard label="Rezultate" value={totalCount} />
          <SummaryCard label="În desfășurare" value={inProgressCount} />
          <SummaryCard label="Cu episod" value={withEpisodeCount} />
          <SummaryCard label="Rol activ" value={roleCtx?.labelRo || "-"} />
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
            title="Filtrare programări"
            subtitle={modeDescription(mode)}
            actionLabel="Reîncarcă"
            onPress={() => load(mode)}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <FilterChip
              active={mode === "upcoming"}
              label="Următoarele"
              onPress={() => setModeAndLoad("upcoming")}
            />
            <FilterChip
              active={mode === "today"}
              label="Astăzi"
              onPress={() => setModeAndLoad("today")}
            />
            <FilterChip
              active={mode === "all"}
              label="Toate"
              onPress={() => setModeAndLoad("all")}
            />
          </View>
        </View>

        <SectionHeader title={modeTitle(mode)} subtitle={summaryText} />

        {busy ? (
          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
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
              Se încarcă programările...
            </Text>
          </View>
        ) : err ? (
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
              style={{
                color: COLORS.error,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              A apărut o eroare
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
          </View>
        ) : sorted.length === 0 ? (
          <EmptyCard
            title={emptyMessage(mode)}
            subtitle="Poți schimba filtrul sau poți continua din ecranul episodului, dacă există unul asociat."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {sorted.map((item) => (
              <AppointmentCard
                key={item.id}
                item={item}
                onOpenAppointment={openAppointment}
                onOpenEpisode={openEpisode}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
