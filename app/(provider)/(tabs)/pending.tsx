import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { fetchProviderMe, ProviderMe } from "../../../_lib/provider";
import { clearToken } from "../../../_lib/session";

export default function ProviderPending() {
  const [p, setP] = useState<ProviderMe | null>(null);

  useEffect(() => {
    fetchProviderMe()
      .then(setP)
      .catch(async () => {
        await clearToken();
        router.replace("/(auth)/login");
      });
  }, []);

  async function logout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  const status = p?.status ?? "pending";
  const reason = p?.rejection_reason;

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Szolgáltatói fiók</Text>
      <Text style={{ marginTop: 8, fontSize: 16 }}>
        Állapot: <Text style={{ fontWeight: "700" }}>{status}</Text>
      </Text>

      {status === "rejected" && reason ? (
        <Text style={{ marginTop: 10, color: "#EF4444" }}>
          Elutasítás oka: {reason}
        </Text>
      ) : (
        <Text style={{ marginTop: 10, color: "#64748B" }}>
          A fiókod admin jóváhagyásra vár. Amint approved, automatikusan be
          tudsz lépni.
        </Text>
      )}

      <Pressable
        onPress={logout}
        style={{
          marginTop: 20,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#2F6BFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Kijelentkezés</Text>
      </Pressable>
    </View>
  );
}
