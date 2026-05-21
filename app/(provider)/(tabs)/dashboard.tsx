import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

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
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("ro-RO");
  } catch {
    return iso;
  }
}

function roleSubtitle(roleCtx: RoleContext | null) {
  if (!roleCtx) return "Se încarcă rolul utilizatorului.";

  if (roleCtx.isClinicAdmin)
    return "Vizualizare organizațională a activității clinicii.";
  if (roleCtx.isDoctor)
    return "Programările și referral-urile relevante pentru activitatea medicală.";
  if (roleCtx.isAssistant)
    return "Activități și programări relevante pentru sarcinile alocate.";
  if (roleCtx.isReception)
    return "Acces administrativ și orientat pe programări.";

  return "Dashboard disponibil pentru contul curent.";
}

export default function ProviderDashboardScreen() {
  const [busy, setBusy] = useState(true);
  const [roleBusy, setRoleBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProviderDashboard | null>(null);
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);

  async function load() {
    setErr(null);
    setBusy(true);

    try {
      const ctx = await getRoleContext();
      setRoleCtx(ctx);
      setRoleBusy(false);

      const d = await fetchProviderDashboard();
      setData(d);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea dashboard-ului a eșuat";

      if (String(detail).toLowerCase().includes("provider")) {
        setErr("Acest utilizator nu este asociat unei clinici.");
        setData(null);
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

  useEffect(() => {
    load();
  }, []);

  // ✅ FIXED: stable memo values
  const todayAppointments = useMemo(
    () => data?.today_appointments ?? [],
    [data?.today_appointments],
  );

  const pendingReferrals = useMemo(
    () => data?.pending_referrals ?? [],
    [data?.pending_referrals],
  );

  function openEpisode(id: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(id) },
    });
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* HEADER */}
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

          <Text style={{ marginTop: 6, color: "#ffffffcc" }}>
            {roleSubtitle(roleCtx)}
          </Text>
        </View>

        {/* TODAY APPOINTMENTS */}
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Programări de astăzi
          </Text>

          {todayAppointments.length === 0 ? (
            <Text style={{ marginTop: 8, color: COLORS.muted }}>
              Nu există programări astăzi.
            </Text>
          ) : (
            todayAppointments.map((a) => (
              <Pressable
                key={a.id}
                onPress={() =>
                  a.episode_id ? openEpisode(a.episode_id) : undefined
                }
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  #{a.id} • {a.status}
                </Text>

                <Text style={{ marginTop: 4, color: COLORS.muted }}>
                  {fmt(a.start_time)}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* REFERRALS */}
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 16,
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

        {/* LOGOUT */}
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
