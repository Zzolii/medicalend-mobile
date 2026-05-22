// Path: medicalend-mobile/app/(provider)/(tabs)/dashboard.tsx

import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { api } from "../../../_lib/api";
import {
  fetchProviderDashboard,
  type ProviderDashboard,
} from "../../../_lib/dashboard";
import { getRoleContext, type RoleContext } from "../../../_lib/roles";
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
  warning: "#F59E0B",
  success: "#16A34A",
};

type TodayAppointment = {
  id: number;
  patient_id?: number | null;
  provider_id?: number | null;
  doctor_id?: number | null;
  episode_id?: number | null;
  clinic_id?: number | null;
  start_time?: string;
  end_time?: string | null;
  status?: string;
  notes?: string | null;
  patient_name?: string | null;
  provider_name?: string | null;
  doctor_name?: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "Nespecificat";

  try {
    return new Date(iso).toLocaleString("ro-RO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtTime(iso?: string | null) {
  if (!iso) return null;

  try {
    return new Date(iso).toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function appointmentTimeRange(item: TodayAppointment) {
  const start = fmt(item.start_time);
  const end = fmtTime(item.end_time);

  if (!end) return start;
  return `${start} - ${end}`;
}

function statusLabel(status?: string | null) {
  if (!status) return "Necunoscut";
  if (status === "scheduled") return "Programată";
  if (status === "in_progress") return "În desfășurare";
  if (status === "completed") return "Finalizată";
  if (status === "canceled") return "Anulată";
  if (status === "pending") return "În așteptare";
  return status;
}

function statusColor(status?: string | null) {
  if (status === "scheduled" || status === "completed") return COLORS.success;
  if (status === "in_progress" || status === "pending") return COLORS.warning;
  if (status === "canceled") return COLORS.muted;
  return COLORS.primary;
}

function appointmentTitle(item: TodayAppointment) {
  if (item.patient_name?.trim()) return item.patient_name.trim();

  if (typeof item.patient_id === "number") {
    return `Pacient #${item.patient_id}`;
  }

  return "Pacient nespecificat";
}

function appointmentSubtitle(item: TodayAppointment) {
  const notes = item.notes?.trim();
  if (notes) return notes;

  return "Consultație medicală";
}

function appointmentProviderLine(item: TodayAppointment) {
  const doctor = item.doctor_name?.trim();
  const provider = item.provider_name?.trim();

  if (doctor && provider) return `${doctor} • ${provider}`;
  if (doctor) return doctor;
  if (provider) return provider;

  return "Clinică / specialist";
}

function roleSubtitle(roleCtx: RoleContext | null) {
  if (!roleCtx) return "Se încarcă rolul utilizatorului.";

  if (roleCtx.isClinicAdmin) {
    return "Vizualizare organizațională a activității clinicii.";
  }

  if (roleCtx.isDoctor) {
    return "Programările de astăzi și referral-urile relevante pentru activitatea medicală.";
  }

  if (roleCtx.isAssistant) {
    return "Activități, programări și episoade relevante pentru suportul clinic.";
  }

  if (roleCtx.isReception) {
    return "Lista operațională a programărilor și pacienților de astăzi.";
  }

  return "Dashboard disponibil pentru contul curent.";
}

function todayTitle(roleCtx: RoleContext | null) {
  if (roleCtx?.isDoctor) return "Programările mele de astăzi";
  return "Programările de astăzi";
}

async function fetchTodayAppointments() {
  const response = await api.get<TodayAppointment[]>("/appointments/today");
  return response.data ?? [];
}

export default function ProviderDashboardScreen() {
  const [busy, setBusy] = useState(true);
  const [roleBusy, setRoleBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProviderDashboard | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<
    TodayAppointment[]
  >([]);
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);

  async function load() {
    setErr(null);
    setBusy(true);

    try {
      const ctx = await getRoleContext();
      setRoleCtx(ctx);
      setRoleBusy(false);

      const [dashboardData, todayData] = await Promise.all([
        fetchProviderDashboard(),
        fetchTodayAppointments().catch(() => null),
      ]);

      setData(dashboardData);

      if (todayData) {
        setTodayAppointments(todayData);
      } else {
        setTodayAppointments(
          (dashboardData?.today_appointments ?? []) as TodayAppointment[],
        );
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea dashboard-ului a eșuat";

      if (String(detail).toLowerCase().includes("provider")) {
        setErr("Acest utilizator nu este asociat unei clinici.");
        setData(null);
        setTodayAppointments([]);
        return;
      }

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }
    } finally {
      setRoleBusy(false);
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshing(true);

    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visibleTodayAppointments = useMemo(() => {
    return [...todayAppointments].sort((a, b) => {
      const aTime = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bTime = b.start_time ? new Date(b.start_time).getTime() : 0;
      return aTime - bTime;
    });
  }, [todayAppointments]);

  const pendingReferrals = useMemo(
    () => data?.pending_referrals ?? [],
    [data?.pending_referrals],
  );

  const visiblePatientsToday = useMemo(() => {
    return new Set(
      visibleTodayAppointments
        .map((item) => item.patient_id)
        .filter((value): value is number => typeof value === "number"),
    ).size;
  }, [visibleTodayAppointments]);

  function openEpisode(id: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(id) },
    });
  }

  function openAppointments() {
    router.push("/(provider)/(tabs)/appointments");
  }

  async function logout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  if (roleBusy || busy) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.muted }}>
          Se încarcă dashboard-ul...
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <Text style={{ color: COLORS.error, fontWeight: "900" }}>{err}</Text>

        <Pressable
          onPress={refresh}
          style={{
            height: 48,
            borderRadius: 14,
            marginTop: 16,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Reîncearcă</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        <View
          style={{
            backgroundColor: COLORS.primaryDark,
            borderRadius: 24,
            padding: 18,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>
            Dashboard
          </Text>

          <Text style={{ marginTop: 6, color: "#ffffffcc", lineHeight: 20 }}>
            {roleSubtitle(roleCtx)}
          </Text>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.14)",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: "#ffffffaa", fontSize: 12 }}>
                Programări azi
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>
                {visibleTodayAppointments.length}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.14)",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: "#ffffffaa", fontSize: 12 }}>
                Pacienți azi
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>
                {visiblePatientsToday}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.14)",
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ color: "#ffffffaa", fontSize: 12 }}>
                Referral-uri
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>
                {pendingReferrals.length}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: COLORS.text }}>
                {todayTitle(roleCtx)}
              </Text>

              <Text style={{ marginTop: 4, color: COLORS.muted, fontSize: 13 }}>
                Listă rapidă pentru activitatea clinică din ziua curentă.
              </Text>
            </View>

            <Pressable
              onPress={openAppointments}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: "#EEF4FF",
              }}
            >
              <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
                Toate
              </Text>
            </Pressable>
          </View>

          {visibleTodayAppointments.length === 0 ? (
            <Text style={{ marginTop: 12, color: COLORS.muted }}>
              Nu există programări astăzi.
            </Text>
          ) : (
            visibleTodayAppointments.map((a) => (
              <Pressable
                key={a.id}
                onPress={() =>
                  a.episode_id ? openEpisode(a.episode_id) : openAppointments()
                }
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#FBFDFF",
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
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      {appointmentTitle(a)}
                    </Text>

                    <Text style={{ marginTop: 4, color: COLORS.muted }}>
                      {appointmentSubtitle(a)}
                    </Text>

                    <Text style={{ marginTop: 4, color: COLORS.muted }}>
                      {appointmentProviderLine(a)}
                    </Text>

                    <Text style={{ marginTop: 6, color: COLORS.text }}>
                      {appointmentTimeRange(a)}
                    </Text>
                  </View>

                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      paddingVertical: 5,
                      paddingHorizontal: 9,
                      backgroundColor: `${statusColor(a.status)}18`,
                    }}
                  >
                    <Text
                      style={{
                        color: statusColor(a.status),
                        fontSize: 12,
                        fontWeight: "900",
                      }}
                    >
                      {statusLabel(a.status)}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  {a.episode_id ? (
                    <View
                      style={{
                        borderRadius: 999,
                        backgroundColor: "#EEF4FF",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.primary,
                          fontSize: 12,
                          fontWeight: "900",
                        }}
                      >
                        Deschide episodul
                      </Text>
                    </View>
                  ) : null}

                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: "#F8FAFC",
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.muted,
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      Appointment #{a.id}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Referral-uri în așteptare
          </Text>

          {pendingReferrals.length === 0 ? (
            <Text style={{ marginTop: 8, color: COLORS.muted }}>
              Nu există referral-uri.
            </Text>
          ) : (
            pendingReferrals.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => openEpisode(r.episode_id)}
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Referral #{r.id}
                </Text>

                <Text style={{ marginTop: 6, color: COLORS.muted }}>
                  {r.reason}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          onPress={logout}
          style={{
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.card,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Deconectare
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
