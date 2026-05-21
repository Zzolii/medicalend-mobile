// Path: medicalend-mobile/app/(provider)/(tabs)/index.tsx
import { router } from "expo-router";
import { useEffect } from "react";

export default function ProviderTabsIndex() {
  useEffect(() => {
    router.replace("/(provider)/(tabs)/dashboard");
  }, []);

  return null;
}
