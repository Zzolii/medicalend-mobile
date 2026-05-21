// Path: medicalend-mobile/app/(auth)/reset-password.tsx

import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { resetPassword } from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
};

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const routeToken = typeof params.token === "string" ? params.token : "";

  const [token, setToken] = useState(routeToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (busy) return;

    if (!token.trim()) {
      setError("Tokenul lipsește.");
      return;
    }

    if (password.length < 8) {
      setError("Parola trebuie să aibă minimum 8 caractere.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Parolele nu coincid.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const res = await resetPassword(token.trim(), password);
      Alert.alert("Succes", res.message);
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
          Setează o parolă nouă
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Dacă linkul nu a deschis automat aplicația, poți lipi manual tokenul.
        </Text>

        <Text style={{ marginTop: 16, marginBottom: 6, color: COLORS.muted }}>
          Token
        </Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Token resetare"
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

        <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
          Parolă nouă
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
          }}
        />

        <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
          Confirmă parola
        </Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {busy ? "Se salvează..." : "Salvează parola nouă"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
