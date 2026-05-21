// Path: medicalend-mobile/app/index.tsx

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { fetchMe } from "../_lib/me";
import { fetchProviderMe } from "../_lib/provider";
import { clearToken, getToken } from "../_lib/session";

type ClinicMembership = {
  id: number;
  clinic_id: number;
  role: string;
  is_active: boolean;
  created_at: string;
};

function getActiveClinicRole(memberships?: ClinicMembership[] | null) {
  const active = (memberships ?? []).find((m) => m?.is_active);
  return active?.role ?? null;
}

export default function Index() {
  const [msg, setMsg] = useState("Booting...");

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const token = await getToken();
        if (!alive) return;

        if (!token) {
          router.replace("/(auth)/login");
          return;
        }

        const me = await fetchMe();
        if (!alive) return;

        if (me.role === "admin") {
          router.replace("/(admin)/dashboard");
          return;
        }

        if (me.role === "patient") {
          router.replace("/(patient)/(tabs)/dashboard");
          return;
        }

        if (me.role === "provider") {
          const clinicRole = getActiveClinicRole(
            (me as any)?.clinic_memberships ?? [],
          );

          if (clinicRole) {
            router.replace("/(provider)/(tabs)/dashboard");
            return;
          }

          try {
            const p = await fetchProviderMe();
            const status = String(
              (p as any)?.status ?? "pending",
            ).toLowerCase();

            if (status === "approved") {
              router.replace("/(provider)/(tabs)/dashboard");
              return;
            }

            router.replace("/(provider)/pending");
            return;
          } catch (e: any) {
            console.log(
              "[BOOT] fetchProviderMe failed -> pending",
              e?.message,
              e?.response?.data,
            );
            router.replace("/(provider)/pending");
            return;
          }
        }

        await clearToken();
        router.replace("/(auth)/login");
      } catch (e: any) {
        console.log("[BOOT] error:", e?.message, e?.response?.data);
        setMsg(e?.message || "Boot error");

        await clearToken();

        setTimeout(() => {
          router.replace("/(auth)/login");
        }, 600);
      }
    }

    boot();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 12 }}>{msg}</Text>
    </View>
  );
}
