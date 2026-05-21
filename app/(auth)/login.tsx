// Path: medicalend-mobile/app/(auth)/login.tsx
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { login } from "../../_lib/auth";
import { getToken, setToken } from "../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

function normalizeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String(
            (item as { msg?: unknown }).msg ?? "Eroare de validare",
          );
        }
        return JSON.stringify(item);
      })
      .join(", ");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return "Credentiale invalide";
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeEmail = email.trim();

  async function onSubmit() {
    if (busy) return;

    if (!safeEmail || !password) {
      setError("Introdu e-mailul și parola.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      console.log("[LOGIN] submit:", safeEmail);

      const data = await login({
        email: safeEmail,
        password,
      });

      console.log("[LOGIN] ok, token len:", data.access_token?.length);

      await setToken(data.access_token);

      const saved = await getToken();
      console.log("[LOGIN] token saved?", !!saved, "len:", saved?.length);

      router.replace("/");
    } catch (e: any) {
      console.log("[LOGIN] error:", e?.message, e?.response?.data);

      const detail =
        e?.response?.data?.detail ?? e?.message ?? "Credentiale invalide";

      setError(normalizeDetail(detail));
    } finally {
      setBusy(false);
    }
  }

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
        <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text }}>
          Autentificare
        </Text>
        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Intră în contul tău
        </Text>

        <Text style={{ marginTop: 16, marginBottom: 6, color: COLORS.muted }}>
          E-mail
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@exemplu.ro"
          editable={!busy}
          style={{
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
            backgroundColor: "#fff",
            opacity: busy ? 0.8 : 1,
          }}
        />

        <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
          Parolă
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          editable={!busy}
          style={{
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
            backgroundColor: "#fff",
            opacity: busy ? 0.8 : 1,
          }}
        />

        {error ? (
          <Text style={{ marginTop: 10, color: COLORS.error }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: 16,
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {busy ? "Se autentifică..." : "Autentificare"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/forgot-password")}
          disabled={busy}
          style={{
            marginTop: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: "800" }}>
            Ai uitat parola?
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(auth)/check-email",
              params: { email: safeEmail },
            })
          }
          disabled={busy || !safeEmail}
          style={{
            marginTop: 10,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || !safeEmail ? 0.5 : 1,
          }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: "800" }}>
            Retrimite e-mailul de confirmare
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/register")}
          disabled={busy}
          style={{
            marginTop: 12,
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Text style={{ color: COLORS.text, fontWeight: "800" }}>
            Înregistrare
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
