// Path: medicalend-mobile/app/(admin)/index.tsx
import { router } from "expo-router";
import { useEffect } from "react";

export default function AdminIndex() {
  useEffect(() => {
    router.replace("/(admin)/dashboard");
  }, []);

  return null;
}
