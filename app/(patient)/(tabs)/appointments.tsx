// Path: medicalend-mobile/app/(patient)/(tabs)/appointments.tsx

import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  deleteAppointment,
  searchAppointments,
  type AppointmentOut,
} from "../../../_lib/appointments";
import {
  formatWallClockDateTime,
  nowLocalNaiveIso,
  wallClockTimestamp,
} from "../../../_lib/datetime";
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

type Mode = "upcoming" | "past" | "canceled";

function appointmentDoctorLabel(a: AppointmentOut) {
  if (a.doctor_name?.trim()) return a.doctor_name.trim();
  return "Medic nespecificat";
}

function appointmentProviderLabel(a: AppointmentOut) {
  if (a.provider_name?.trim()) return a.provider_name.trim();
  return "Clinică / specialist";
}

function appointmentMainTitle(a: AppointmentOut) {
  if (a.notes?.trim()) return a.notes.trim();
  return "Consultație medicală";
}

function appointmentSubtitle(a: AppointmentOut) {
  if (a.doctor_name?.trim() && a.provider_name?.trim()) {
    return `${a.doctor_name.trim()} • ${a.provider_name.trim()}`;
  }

  if (a.doctor_name?.trim()) return a.doctor_name.trim();
  if (a.provider_name?.trim()) return a.provider_name.trim();

  return "Clinică / specialist";
}

function statusLabel(status?: string | null) {
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

function statusMeta(status?: string | null) {
  switch (status) {
    case "completed":
      return {
        bg: COLORS.softGreen,
        text: COLORS.success,
      };
    case "canceled":
      return {
        bg: COLORS.softRed,
        text: COLORS.error,
      };
    case "in_progress":
      return {
        bg: COLORS.softBlue,
        text: COLORS.primary,
      };
    default:
      return {
        bg: COLORS.softAmber,
        text: COLORS.warning,
      };
  }
}

function modeLabel(mode: Mode) {
  switch (mode) {
    case "upcoming":
      return "Programări viitoare";
    case "past":
      return "Programări anterioare";
    case "canceled":
      return "Programări anulate";
    default:
      return "Programări";
  }
}

function modeDescription(mode: Mode) {
  switch (mode) {
    case "upcoming":
      return "Vezi ce urmează și deschide rapid detaliile programării.";
    case "past":
      return "Programările trecute sunt păstrate pentru Journey.";
    case "canceled":
      return "Poți revizui sau șterge definitiv programările anulate.";
    default:
      return "";
  }
}

function emptyMessage(mode: Mode) {
  switch (mode) {
    case "upcoming":
      return "Nu ai programări viitoare în acest moment.";
    case "past":
      return "Nu ai încă programări anterioare.";
    case "canceled":
      return "Nu ai programări anulate.";
    default:
      return "Nu există programări.";
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

function AppointmentCard({
  appointment,
  mode,
  deleting,
  onDelete,
}: {
  appointment: AppointmentOut;
  mode: Mode;
  deleting: boolean;
  onDelete: (a: AppointmentOut) => void;
}) {
  const badge = statusMeta(appointment.status);
  const subtitle = appointmentSubtitle(appointment);

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
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(patient)/appointment/[id]",
            params: { id: String(appointment.id) },
          })
        }
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
                fontSize: 16,
                lineHeight: 22,
              }}
            >
              {appointmentMainTitle(appointment)}
            </Text>

            <Text
              style={{
                marginTop: 6,
                color: COLORS.muted,
                lineHeight: 20,
              }}
            >
              {subtitle}
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
              {statusLabel(appointment.status)}
            </Text>
          </View>
        </View>

        <Text style={{ marginTop: 10, color: COLORS.muted }}>
          Medic: {appointmentDoctorLabel(appointment)}
        </Text>

        <Text style={{ marginTop: 4, color: COLORS.muted }}>
          Furnizor: {appointmentProviderLabel(appointment)}
        </Text>

        <View
          style={{
            marginTop: 14,
            borderRadius: 16,
            backgroundColor:
              mode === "upcoming" ? COLORS.softBlue : COLORS.softGray,
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
            Început: {formatWallClockDateTime(appointment.start_time)}
          </Text>

          {appointment.end_time ? (
            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Sfârșit: {formatWallClockDateTime(appointment.end_time)}
            </Text>
          ) : null}
        </View>

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
            ID programare: {appointment.id}
          </Text>

          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            Vezi detalii →
          </Text>
        </View>
      </Pressable>

      {mode === "canceled" ? (
        <Pressable
          onPress={() => onDelete(appointment)}
          disabled={deleting}
          style={{
            marginTop: 14,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#FECACA",
            backgroundColor: "#FFF5F5",
            alignItems: "center",
            justifyContent: "center",
            opacity: deleting ? 0.65 : 1,
          }}
        >
          <Text style={{ color: COLORS.error, fontWeight: "900" }}>
            {deleting ? "Se șterge..." : "Șterge definitiv"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PatientAppointments() {
  const [mode, setMode] = useState<Mode>("upcoming");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<AppointmentOut[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (which: Mode) => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setErr(null);
    setBusy(true);

    try {
      const nowIso = nowLocalNaiveIso();

      let params:
        | { start_from: string; limit: number }
        | { start_to: string; limit: number }
        | { status_value: string; limit: number };

      if (which === "upcoming") {
        params = { start_from: nowIso, limit: 100 };
      } else if (which === "past") {
        params = { start_to: nowIso, limit: 100 };
      } else {
        params = { status_value: "canceled", limit: 100 };
      }

      const res = await searchAppointments(params);
      let filtered = [...(res ?? [])];

      if (which === "upcoming") {
        filtered = filtered.filter(
          (a) =>
            a.status !== "canceled" &&
            wallClockTimestamp(a.start_time) >= wallClockTimestamp(nowIso),
        );
      } else if (which === "past") {
        filtered = filtered.filter(
          (a) =>
            a.status !== "canceled" &&
            wallClockTimestamp(a.start_time) < wallClockTimestamp(nowIso),
        );
      } else {
        filtered = filtered.filter((a) => a.status === "canceled");
      }

      const sorted = filtered.sort((a, b) => {
        const ta = wallClockTimestamp(a.start_time);
        const tb = wallClockTimestamp(b.start_time);

        if (which === "upcoming") return ta - tb;
        return tb - ta;
      });

      setItems(sorted);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Încărcarea a eșuat.";

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      loadingRef.current = false;
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(mode);
    }, [mode, load]),
  );

  const handleDelete = useCallback((appointment: AppointmentOut) => {
    Alert.alert(
      "Ștergere programare",
      "Sigur vrei să ștergi definitiv această programare anulată?",
      [
        {
          text: "Renunță",
          style: "cancel",
        },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(appointment.id);
              await deleteAppointment(appointment.id);
              setItems((prev) =>
                prev.filter((item) => item.id !== appointment.id),
              );
            } catch (e: any) {
              const status = e?.response?.status;
              const detail =
                e?.response?.data?.detail ||
                e?.message ||
                "Ștergerea programării a eșuat.";

              if (status === 401) {
                await clearToken();
                router.replace("/(auth)/login");
                return;
              }

              Alert.alert("Eroare", String(detail));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, []);

  const summaryText = useMemo(() => {
    if (items.length === 0) return emptyMessage(mode);
    if (items.length === 1) return "Ai 1 element în categoria selectată.";
    return `Ai ${items.length} elemente în categoria selectată.`;
  }, [items.length, mode]);

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
              right: -30,
              top: -10,
              width: 170,
              height: 170,
              borderRadius: 999,
              backgroundColor: "rgba(79,179,232,0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -40,
              bottom: -50,
              width: 190,
              height: 190,
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
              Totul despre{"\n"}vizitele tale.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              Urmărește ce urmează, revizuiește istoricul în Journey și
              gestionează rapid programările anulate.
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
          <View style={{ flexDirection: "row", gap: 10 }}>
            <FilterChip
              active={mode === "upcoming"}
              label="Viitoare"
              onPress={() => setMode("upcoming")}
            />
            <FilterChip
              active={mode === "past"}
              label="Anterioare"
              onPress={() => setMode("past")}
            />
            <FilterChip
              active={mode === "canceled"}
              label="Anulate"
              onPress={() => setMode("canceled")}
            />
          </View>

          <Text
            style={{
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            {modeDescription(mode)}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title={modeLabel(mode)}
            subtitle={summaryText}
            actionLabel="Reîncarcă"
            onPress={() => load(mode)}
          />

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
          ) : items.length === 0 ? (
            <EmptyCard
              title={emptyMessage(mode)}
              subtitle="Când vor exista elemente în această categorie, le vei vedea aici într-o listă clară și ușor de urmărit."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {items.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  mode={mode}
                  deleting={deletingId === appointment.id}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
