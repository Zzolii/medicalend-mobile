// Path: medicalend-mobile/app/(auth)/register-patient.tsx

import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { registerPatient, type RegisterPatientPayload } from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
  softBlue: "#EEF4FF",
};

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
      {children}
    </Text>
  );
}

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPostal(value: string) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function onlyDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || year < 1900 || year > 2100) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
  );
}

function formatDateInput(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function normalizeBirthDate(input: string): string | null {
  const raw = cleanText(input);
  if (!raw.length) return null;

  const formatted = formatDateInput(raw);

  if (!isValidYmd(formatted)) return null;

  return formatted;
}

function extractApiError(e: any): string {
  const detail = e?.response?.data?.detail;

  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const loc = Array.isArray(first?.loc) ? first.loc.join(".") : "field";
    const msg = String(first?.msg ?? "Validation error");
    return `${loc}: ${msg}`;
  }

  if (typeof detail === "string") return detail;

  return String(e?.message || "Înregistrarea a eșuat");
}

export default function RegisterPatientScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const normalizedBirthDate = useMemo(() => {
    return normalizeBirthDate(birthDate);
  }, [birthDate]);

  const birthDateLooksInvalid = useMemo(() => {
    return birthDate.trim().length > 0 && !normalizedBirthDate;
  }, [birthDate, normalizedBirthDate]);

  const canSubmit = useMemo(() => {
    const addressOk =
      cleanText(addressLine).length >= 3 &&
      cleanText(city).length >= 2 &&
      cleanText(county).length >= 2 &&
      cleanPostal(postalCode).length >= 3;

    const birthOk = !birthDate.trim().length || !!normalizedBirthDate;

    return (
      cleanText(email).length >= 5 &&
      password.length >= 8 &&
      cleanText(firstName).length >= 1 &&
      cleanText(lastName).length >= 1 &&
      addressOk &&
      birthOk
    );
  }, [
    email,
    password,
    firstName,
    lastName,
    addressLine,
    city,
    county,
    postalCode,
    birthDate,
    normalizedBirthDate,
  ]);

  function handleBirthDateChange(value: string) {
    setBirthDate(formatDateInput(value));
  }

  async function onSubmit() {
    if (busy) return;

    if (!canSubmit) {
      Alert.alert("Date lipsă", "Completează toate câmpurile obligatorii.");
      return;
    }

    if (birthDate.trim().length && !normalizedBirthDate) {
      Alert.alert(
        "Dată invalidă",
        "Scrie data în format AAAA-LL-ZZ. Exemplu: 1995-04-26.",
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload: RegisterPatientPayload = {
        email: cleanText(email),
        password,

        first_name: cleanText(firstName),
        last_name: cleanText(lastName),

        birth_date: normalizedBirthDate,
        gender: cleanText(gender) || null,
        phone: cleanText(phone) || null,

        address_line: cleanText(addressLine),
        city: cleanText(city),
        county: cleanText(county),
        postal_code: cleanPostal(postalCode),
        country: "RO",
      };

      await registerPatient(payload);

      Alert.alert(
        "Cont creat",
        "Ți-am trimis un e-mail de confirmare. Deschide mesajul și apasă pe linkul de confirmare pentru a activa contul.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace({
                pathname: "/(auth)/check-email",
                params: { email: payload.email },
              }),
          },
        ],
      );
    } catch (e: any) {
      const msg = extractApiError(e);
      setError(msg);
      Alert.alert("Eroare la înregistrare", msg);
    } finally {
      setBusy(false);
    }
  }

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
          disabled={busy}
          style={{
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>Înapoi</Text>
        </Pressable>

        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          Înregistrare pacient
        </Text>

        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
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
            Date obligatorii
          </Text>

          <FieldLabel>E-mail *</FieldLabel>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@exemplu.ro"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <FieldLabel>Parolă (minim 8 caractere) *</FieldLabel>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <FieldLabel>Prenume *</FieldLabel>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Andrei"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <FieldLabel>Nume *</FieldLabel>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Popescu"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <FieldLabel>Adresă *</FieldLabel>
          <TextInput
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="Str. Exemplu 12"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>Oraș *</FieldLabel>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Cluj-Napoca"
                editable={!busy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />
            </View>

            <View style={{ flex: 1 }}>
              <FieldLabel>Județ *</FieldLabel>
              <TextInput
                value={county}
                onChangeText={setCounty}
                placeholder="Cluj"
                editable={!busy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />
            </View>
          </View>

          <FieldLabel>Cod poștal *</FieldLabel>
          <TextInput
            value={postalCode}
            onChangeText={setPostalCode}
            placeholder="400000"
            keyboardType="number-pad"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />
        </View>

        <View style={{ height: 12 }} />

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
            Alte date (opțional)
          </Text>

          <FieldLabel>Data nașterii</FieldLabel>
          <TextInput
            value={birthDate}
            onChangeText={handleBirthDateChange}
            placeholder="AAAA-LL-ZZ, ex: 1995-04-26"
            keyboardType="number-pad"
            maxLength={10}
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: birthDateLooksInvalid ? COLORS.error : COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />
          <Text
            style={{
              marginTop: 6,
              color: birthDateLooksInvalid ? COLORS.error : COLORS.muted,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            Scrie doar cifrele, iar aplicația pune automat cratimele. Format:
            AAAA-LL-ZZ.
          </Text>

          <FieldLabel>Gen</FieldLabel>
          <TextInput
            value={gender}
            onChangeText={setGender}
            placeholder="male / female / other"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <FieldLabel>Telefon</FieldLabel>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+40..."
            keyboardType="phone-pad"
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          {error ? (
            <Text style={{ marginTop: 12, color: COLORS.error }}>{error}</Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || busy}
            style={{
              marginTop: 16,
              height: 48,
              borderRadius: 14,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: !canSubmit || busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {busy ? "Se înregistrează..." : "Creează contul"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
