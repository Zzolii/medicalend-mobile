// Path: medicalend-mobile/app/(patient)/(tabs)/_layout.tsx

import { Tabs } from "expo-router";
import {
  Activity,
  CalendarDays,
  Home,
  Search,
  User,
} from "lucide-react-native";

const COLORS = {
  primary: "#2F6BFF",
  muted: "#64748B",
};

export default function PatientTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
        tabBarStyle: {
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopColor: "#E6EAF2",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Acasă",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Căutare",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
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
        name="appointments"
        options={{
          title: "Programări",
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
