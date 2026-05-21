// Path: medicalend-mobile/app/(patient)/provider/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { fetchProviderById, type ProviderOut } from "../../_lib/provider";
import { clearToken } from "../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

function displayName(p: ProviderOut) {
  const n = p.name?.trim();
  return n && n.length > 0 ? n : `Provider #${p.id}`;
}

export default function PatientProviderDetails() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const providerId = Number(id);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProviderOut | null>(null);

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const p = await fetchProviderById(providerId);
      setData(p);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message || "Load failed";
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
    if (!Number.isFinite(providerId) || providerId <= 0) {
      setBusy(false);
      setErr("Invalid provider id");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
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
          <Text style={{ fontWeight: "900", color: COLORS.text }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          Provider #{Number.isFinite(providerId) ? providerId : "?"}
        </Text>

        <Pressable
          onPress={load}
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
          <Text style={{ fontWeight: "900", color: COLORS.text }}>Refresh</Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: COLORS.muted }}>Betöltés…</Text>
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
              Hiba
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.text }}>{err}</Text>
          </View>
        </View>
      ) : !data ? null : (
        <View style={{ padding: 16, gap: 12 }}>
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
              style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}
            >
              {displayName(data)}
            </Text>

            <Text style={{ marginTop: 10, color: COLORS.muted }}>
              Status: {data.status ?? "-"}
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Specialty: {data.specialty ?? "-"}
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Location:{" "}
              {[data.city, data.county].filter(Boolean).join(", ") || "-"}
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Phone: {data.phone ?? "-"}
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Email: {data.email ?? "-"}
            </Text>
          </View>

          {/* MVP: később ide jön:
              - Request referral / Contact / Booking
              - naptár-szerű időpont foglalás */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontWeight: "900", color: COLORS.text }}>
              Next steps (UI később)
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Ide jön majd: időpont foglalás, üzenet, referral kérés.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
