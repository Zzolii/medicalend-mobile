// Path: medicalend-mobile/app/(auth)/check-email.tsx

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { resendVerification } from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

function cleanEmail(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export default function CheckEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === "string" ? params.email : "";

  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);

  const safeEmail = useMemo(() => cleanEmail(email), [email]);
  const canResend = safeEmail.length >= 5 && safeEmail.includes("@") && !busy;

  async function onResend() {
    if (!canResend) {
      Alert.alert(
        "E-mail necesar",
        "Introdu adresa de e-mail pentru retrimitere.",
      );
      return;
    }

    try {
      setBusy(true);
      const res = await resendVerification(safeEmail);
      Alert.alert("E-mail retrimis", res.message);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "A apărut o eroare";
      Alert.alert("Eroare", String(detail));
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
          Confirmă e-mailul
        </Text>

        <Text style={{ marginTop: 10, color: COLORS.muted, lineHeight: 20 }}>
          Am trimis un e-mail de confirmare. Dacă nu îl găsești, introdu adresa
          și retrimite mesajul.
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
          placeholderTextColor="#94A3B8"
          editable={!busy}
          style={{
            height: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
            backgroundColor: "#fff",
            color: COLORS.text,
          }}
        />

        <Pressable
          onPress={onResend}
          disabled={!canResend}
          style={{
            marginTop: 16,
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: !canResend ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {busy ? "Se retrimite..." : "Retrimite e-mailul de confirmare"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/(auth)/login")}
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
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: COLORS.text, fontWeight: "900" }}>
            Înapoi la autentificare
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
