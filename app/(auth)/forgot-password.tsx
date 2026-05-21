// Path: medicalend-mobile/app/(auth)/forgot-password.tsx

import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { forgotPassword } from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (busy) return;

    try {
      setBusy(true);
      setError(null);
      const res = await forgotPassword(email.trim());
      Alert.alert("Cerere trimisă", res.message);
      router.replace("/(auth)/login");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "A apărut o eroare";
      setError(String(detail));
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
        <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text }}>
          Ai uitat parola?
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Introdu adresa de e-mail și îți vom trimite instrucțiuni pentru
          resetare.
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
          }}
        />

        {error ? (
          <Text style={{ marginTop: 10, color: COLORS.error }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={busy || !email.trim()}
          style={{
            marginTop: 16,
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || !email.trim() ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {busy ? "Se trimite..." : "Trimite instrucțiunile"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 12,
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>Înapoi</Text>
        </Pressable>
      </View>
    </View>
  );
}
