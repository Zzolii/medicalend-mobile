// Path: medicalend-mobile/app/(patient)/index.tsx
import { Redirect } from "expo-router";

export default function PatientIndex() {
  return <Redirect href="/(patient)/(tabs)/dashboard" />;
}
