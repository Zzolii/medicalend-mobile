// Path: medicalend-mobile/app/(patient)/(tabs)/index.tsx
import { router } from "expo-router";
import { useEffect } from "react";

export default function PatientTabsIndex() {
  useEffect(() => {
    router.replace("/(patient)/(tabs)/dashboard");
  }, []);

  return null;
}
