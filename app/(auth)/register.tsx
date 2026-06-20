// Path: medicalend-mobile/app/(auth)/register.tsx

import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
};

export default function RegisterChooseRole() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: "#fff",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>Înapoi</Text>
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          Înregistrare
        </Text>

        <View style={{ width: 60 }} />
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>
            Ce tip de cont dorești?
          </Text>

          <Text style={{ marginTop: 6, color: COLORS.muted }}>
            Alege dacă te înregistrezi ca pacient sau ca Clinic/Medic.
          </Text>

          <Pressable
            onPress={() => router.push("/(auth)/register-patient")}
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
              Înregistrare ca pacient
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/register-provider")}
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
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>
              Clinic/Medic
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
