// Path: medicalend-mobile/app/(provider)/(tabs)/_layout.tsx

import { Tabs } from "expo-router";
import {
  Activity,
  CalendarDays,
  FileText,
  Home,
  User,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { fetchMe } from "../../../_lib/me";

function getActiveClinicRole(memberships?: any[] | null) {
  const active = (memberships ?? []).find((m) => m?.is_active);
  return active?.role ?? null;
}

export default function ProviderTabsLayout() {
  const [busy, setBusy] = useState(true);
  const [clinicRole, setClinicRole] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const me = await fetchMe();
        if (!alive) return;

        const role = getActiveClinicRole((me as any)?.clinic_memberships ?? []);
        setClinicRole(role);
      } catch {
        if (!alive) return;
        setClinicRole(null);
      } finally {
        if (!alive) return;
        setBusy(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  if (busy) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2F6BFF",
        tabBarInactiveTintColor: "#64748B",
      }}
      initialRouteName="dashboard"
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Acasă",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="episodes"
        options={{
          title: "Episoade",
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="referrals"
        options={{
          title: "Trimiteri",
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="appointments"
        options={{
          title: "Programări",
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="staff"
        options={{
          title: "Personal",
          href: clinicRole === "clinic_admin" ? undefined : null,
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />

      <Tabs.Screen name="pending" options={{ href: null }} />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
