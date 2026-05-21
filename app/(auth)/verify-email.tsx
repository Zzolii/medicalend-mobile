// Path: medicalend-mobile/app/(auth)/verify-email.tsx

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { verifyEmail } from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const routeToken = typeof params.token === "string" ? params.token : "";

  const [token, setToken] = useState(routeToken);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    if (busy || !token.trim()) return;

    try {
      setBusy(true);
      setError(null);
      const res = await verifyEmail(token.trim());
      setDone(true);
      Alert.alert("Succes", res.message);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "A apărut o eroare";
      setError(String(detail));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (routeToken) {
      onVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToken]);

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
        <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text }}>
          Confirmare e-mail
        </Text>

        {done ? (
          <>
            <Text style={{ marginTop: 10, color: COLORS.muted }}>
              E-mailul a fost confirmat. Acum te poți autentifica.
            </Text>

            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={{
                marginTop: 16,
                height: 48,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                Mergi la autentificare
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ marginTop: 8, color: COLORS.muted }}>
              Dacă linkul nu a deschis automat aplicația, poți lipi tokenul
              manual.
            </Text>

            <Text
              style={{ marginTop: 16, marginBottom: 6, color: COLORS.muted }}
            >
              Token
            </Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Token confirmare"
              editable={!busy}
              style={{
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                paddingHorizontal: 12,
                backgroundColor: "#fff",
              }}
            />

            {error ? (
              <Text style={{ marginTop: 10, color: COLORS.error }}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={onVerify}
              disabled={busy || !token.trim()}
              style={{
                marginTop: 16,
                height: 48,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy || !token.trim() ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {busy ? "Se confirmă..." : "Confirmă e-mailul"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
