// Path: medicalend-mobile/app/(provider)/pending.tsx
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { fetchProviderMe } from "../../_lib/provider";
import { clearToken } from "../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
  success: "#22C55E",
};

export default function ProviderPendingScreen() {
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState<string>("pending");
  const [reason, setReason] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const me = await fetchProviderMe();
      const s = String(me?.status ?? "pending").toLowerCase();
      setStatus(s);
      setReason((me as any)?.rejection_reason ?? null);

      if (s === "approved") {
        // ✅ now we can enter the normal app
        router.replace("/");
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || "Load failed";
      setErr(String(detail));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onLogout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  const title =
    status === "approved"
      ? "Jóváhagyva ✅"
      : status === "rejected"
        ? "Elutasítva ❌"
        : "Jóváhagyásra vár ⏳";

  const desc =
    status === "approved"
      ? "A fiókod aktív. Beléptetünk…"
      : status === "rejected"
        ? "A provider fiókod el lett utasítva."
        : "A regisztráció sikerült. Az admin jóváhagyása szükséges a belépéshez.";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
        padding: 16,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}>
          {title}
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 20 }}>
          {desc}
        </Text>

        {status === "rejected" && reason ? (
          <Text
            style={{ marginTop: 10, color: COLORS.error, fontWeight: "800" }}
          >
            Indok: {reason}
          </Text>
        ) : null}

        {err ? (
          <Text style={{ marginTop: 10, color: COLORS.error }}>{err}</Text>
        ) : null}

        {busy ? (
          <View style={{ marginTop: 14, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: COLORS.muted }}>
              Ellenőrzés…
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 14, gap: 10 }}>
            <Pressable
              onPress={load}
              style={{
                height: 46,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                Frissítés / Ellenőrzés
              </Text>
            </Pressable>

            <Pressable
              onPress={onLogout}
              style={{
                height: 46,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                Kijelentkezés
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
