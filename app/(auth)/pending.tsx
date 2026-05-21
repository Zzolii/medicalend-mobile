// Path: medicalend-mobile/app/(auth)/pending.tsx
import { router } from "expo-router";
import { Text, View } from "react-native";
import { clearToken } from "../../_lib/session";

export default function PendingScreen() {
  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>
        Fiók ellenőrzés alatt
      </Text>
      <Text style={{ opacity: 0.7 }}>
        A szolgáltatói profilod még nincs jóváhagyva. Kérlek, próbáld később.
      </Text>

      <Text
        style={{ marginTop: 20, color: "blue" }}
        onPress={async () => {
          await clearToken();
          router.replace("/(auth)/login");
        }}
      >
        Kijelentkezés
      </Text>
    </View>
  );
}
