// Path: medicalend-mobile/app/(auth)/register-provider.tsx

import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  registerProvider,
  registerProviderWithImage,
  type ProviderImageAsset,
  type RegisterProviderPayload,
} from "../../_lib/auth";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
  successBg: "#EEF4FF",
};

function FieldLabel({
  children,
  required,
}: {
  children: string;
  required?: boolean;
}) {
  return (
    <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
      {children}
      {required ? " *" : ""}
    </Text>
  );
}

function cleanText(v: string) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

function cleanPostal(v: string) {
  return (v ?? "").replace(/\s+/g, "").trim();
}

function onlyDigits(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatDateInput(value: string) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
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

function normalizeOptionalDate(input: string): string | null {
  const raw = cleanText(input);
  if (!raw.length) return null;

  const formatted = formatDateInput(raw);
  if (!isValidYmd(formatted)) return null;

  return formatted;
}

function normalizeSpecialties(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values) {
    const cleaned = cleanText(raw);
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

function specialtiesToBackendString(values: string[]) {
  return normalizeSpecialties(values).join(", ");
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

function inferMimeType(fileName?: string | null) {
  const lower = (fileName || "").toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

  return "image/jpeg";
}

export default function RegisterProviderScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [providerType, setProviderType] = useState<"clinic" | "home_care">(
    "clinic",
  );

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [publicDescription, setPublicDescription] = useState("");

  const [selectedImage, setSelectedImage] = useState<ProviderImageAsset | null>(
    null,
  );

  const [specialties, setSpecialties] = useState<string[]>([""]);
  const [servicesOffered, setServicesOffered] = useState("");

  const [cui, setCui] = useState("");
  const [tradeRegisterNumber, setTradeRegisterNumber] = useState("");

  const [contactPersonName, setContactPersonName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [phone, setPhone] = useState("");

  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [coverageArea, setCoverageArea] = useState("");

  const [sanitaryAuthorizationNumber, setSanitaryAuthorizationNumber] =
    useState("");
  const [sanitaryAuthorizationExpiresAt, setSanitaryAuthorizationExpiresAt] =
    useState("");

  const [healthcareComplianceConfirmed, setHealthcareComplianceConfirmed] =
    useState(false);
  const [providerAgreementAccepted, setProviderAgreementAccepted] =
    useState(false);

  const normalizedAuthorizationExpiry = useMemo(() => {
    return normalizeOptionalDate(sanitaryAuthorizationExpiresAt);
  }, [sanitaryAuthorizationExpiresAt]);

  const authorizationExpiryLooksInvalid = useMemo(() => {
    return (
      sanitaryAuthorizationExpiresAt.trim().length > 0 &&
      !normalizedAuthorizationExpiry
    );
  }, [sanitaryAuthorizationExpiresAt, normalizedAuthorizationExpiry]);

  const canSubmit = useMemo(() => {
    const expiryOk =
      !sanitaryAuthorizationExpiresAt.trim().length ||
      !!normalizedAuthorizationExpiry;

    return (
      cleanText(email).length >= 5 &&
      password.length >= 8 &&
      cleanText(name).length >= 2 &&
      cleanText(cui).length >= 2 &&
      cleanText(contactPersonName).length >= 2 &&
      cleanText(contactEmail).length >= 5 &&
      cleanText(contactPhone).length >= 3 &&
      cleanText(addressLine).length >= 3 &&
      cleanText(city).length >= 2 &&
      cleanText(county).length >= 2 &&
      cleanText(sanitaryAuthorizationNumber).length >= 2 &&
      expiryOk &&
      healthcareComplianceConfirmed &&
      providerAgreementAccepted
    );
  }, [
    email,
    password,
    name,
    cui,
    contactPersonName,
    contactEmail,
    contactPhone,
    addressLine,
    city,
    county,
    sanitaryAuthorizationNumber,
    sanitaryAuthorizationExpiresAt,
    normalizedAuthorizationExpiry,
    healthcareComplianceConfirmed,
    providerAgreementAccepted,
  ]);

  function updateSpecialtyAt(index: number, value: string) {
    setSpecialties((prev) =>
      prev.map((item, i) => (i === index ? value : item)),
    );
  }

  function addSpecialtyField() {
    setSpecialties((prev) => [...prev, ""]);
  }

  function removeSpecialtyField(index: number) {
    setSpecialties((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleAuthorizationExpiryChange(value: string) {
    setSanitaryAuthorizationExpiresAt(formatDateInput(value));
  }

  async function onPickImage() {
    if (busy) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permisiune necesară",
        "Permite accesul la galerie pentru a încărca logo-ul sau imaginea clinicii.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileName =
      asset.fileName ||
      asset.uri.split("/").pop() ||
      `provider-${Date.now()}.jpg`;

    setSelectedImage({
      uri: asset.uri,
      name: fileName,
      type: asset.mimeType || inferMimeType(fileName),
    });
  }

  function removeSelectedImage() {
    setSelectedImage(null);
  }

  async function onSubmit() {
    if (busy) return;

    if (!canSubmit) {
      Alert.alert(
        "Date lipsă",
        "Completează toate câmpurile obligatorii și confirmă declarațiile cerute.",
      );
      return;
    }

    if (
      sanitaryAuthorizationExpiresAt.trim().length &&
      !normalizedAuthorizationExpiry
    ) {
      Alert.alert(
        "Dată invalidă",
        "Scrie expirarea autorizației în format AAAA-LL-ZZ. Exemplu: 2027-12-31.",
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const normalizedSpecialty = specialtiesToBackendString(specialties);

      const payload: RegisterProviderPayload = {
        email: cleanText(email),
        password,

        name: cleanText(name),
        provider_type: providerType,

        website: cleanText(website) || null,
        image_url: null,
        public_description: cleanText(publicDescription) || null,

        specialty: normalizedSpecialty ? normalizedSpecialty : null,
        services_offered: cleanText(servicesOffered) || null,

        cui: cleanText(cui),
        trade_register_number: cleanText(tradeRegisterNumber) || null,

        contact_person_name: cleanText(contactPersonName),
        contact_email: cleanText(contactEmail),
        contact_phone: cleanText(contactPhone),

        phone: cleanText(phone) || null,

        address_line: cleanText(addressLine),
        city: cleanText(city),
        county: cleanText(county),
        postal_code: cleanPostal(postalCode) || null,
        country: "RO",

        coverage_area: cleanText(coverageArea) || null,

        sanitary_authorization_number: cleanText(sanitaryAuthorizationNumber),
        sanitary_authorization_expires_at: normalizedAuthorizationExpiry,

        healthcare_compliance_confirmed: healthcareComplianceConfirmed,
        provider_agreement_accepted: providerAgreementAccepted,
      };

      if (selectedImage?.uri) {
        await registerProviderWithImage(payload, selectedImage);
      } else {
        await registerProvider(payload);
      }

      Alert.alert(
        "Cerere trimisă",
        "Contul Clinic/Medic a fost creat și este în așteptarea aprobării de către administratorul MediCalend. Vei putea intra în aplicație după aprobare.",
      );

      router.replace("/(auth)/login");
    } catch (e: any) {
      const msg = extractApiError(e);
      setError(msg);
      Alert.alert("Eroare la înregistrare", msg);
    } finally {
      setBusy(false);
    }
  }

  function ToggleRow({
    value,
    onPress,
    label,
  }: {
    value: boolean;
    onPress: () => void;
    label: string;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          marginTop: 10,
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-start",
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: value ? COLORS.successBg : "#fff",
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value ? COLORS.primary : "#fff",
            marginTop: 2,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
            {value ? "✓" : ""}
          </Text>
        </View>
        <Text style={{ flex: 1, color: COLORS.text }}>{label}</Text>
      </Pressable>
    );
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
          Înregistrare Clinic/Medic
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
            Date de autentificare
          </Text>

          <FieldLabel required>E-mail</FieldLabel>
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

          <FieldLabel required>Parolă (minim 8 caractere)</FieldLabel>
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

          <FieldLabel required>Tip profil</FieldLabel>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setProviderType("clinic")}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  providerType === "clinic" ? COLORS.primary : "#fff",
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color: providerType === "clinic" ? "#fff" : COLORS.text,
                }}
              >
                Clinică
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setProviderType("home_care")}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  providerType === "home_care" ? COLORS.primary : "#fff",
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color: providerType === "home_care" ? "#fff" : COLORS.text,
                }}
              >
                Home Care
              </Text>
            </Pressable>
          </View>

          <FieldLabel required>Nume clinică / Medic </FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Clinica Exemplu"
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

          <FieldLabel>Website</FieldLabel>
          <TextInput
            value={website}
            onChangeText={setWebsite}
            placeholder="https://clinica-ta.ro"
            autoCapitalize="none"
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

          <FieldLabel>Imagine clinică / logo</FieldLabel>

          {selectedImage?.uri ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              <Image
                source={{ uri: selectedImage.uri }}
                style={{
                  width: "100%",
                  height: 180,
                  backgroundColor: "#F1F5F9",
                }}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 14,
                backgroundColor: "#fff",
              }}
            >
              <Text style={{ color: COLORS.muted }}>
                Nu ai selectat încă nicio imagine.
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable
              onPress={onPickImage}
              disabled={busy}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                {selectedImage ? "Schimbă imaginea" : "Alege imagine"}
              </Text>
            </Pressable>

            <Pressable
              onPress={removeSelectedImage}
              disabled={busy || !selectedImage}
              style={{
                minWidth: 120,
                height: 46,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                opacity: busy || !selectedImage ? 0.5 : 1,
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                Elimină
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
            Poți continua și fără imagine, dar la înregistrare se poate încărca
            direct din galerie.
          </Text>

          <FieldLabel>Descriere publică</FieldLabel>
          <TextInput
            value={publicDescription}
            onChangeText={setPublicDescription}
            placeholder="Scurtă descriere publică a clinicii sau a serviciilor."
            editable={!busy}
            multiline
            style={{
              minHeight: 90,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
              textAlignVertical: "top",
            }}
          />

          <FieldLabel>Specialități</FieldLabel>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
            Poți adăuga mai multe specialități.
          </Text>

          <View style={{ gap: 10 }}>
            {specialties.map((item, index) => (
              <View
                key={`specialty-${index}`}
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <TextInput
                  value={item}
                  onChangeText={(value) => updateSpecialtyAt(index, value)}
                  placeholder={`Specialitate #${index + 1}`}
                  editable={!busy}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    paddingHorizontal: 12,
                    backgroundColor: "#fff",
                    color: COLORS.text,
                  }}
                />

                <Pressable
                  onPress={() => removeSpecialtyField(index)}
                  disabled={busy}
                  style={{
                    height: 48,
                    minWidth: 48,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                    −
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            onPress={addSpecialtyField}
            disabled={busy}
            style={{
              marginTop: 10,
              height: 44,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>
              + Adaugă specialitate
            </Text>
          </Pressable>

          <FieldLabel>Servicii oferite</FieldLabel>
          <TextInput
            value={servicesOffered}
            onChangeText={setServicesOffered}
            placeholder="Ex.: consultații, pansamente, recoltări..."
            editable={!busy}
            multiline
            style={{
              minHeight: 90,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
              textAlignVertical: "top",
            }}
          />

          <FieldLabel required>CUI</FieldLabel>
          <TextInput
            value={cui}
            onChangeText={setCui}
            placeholder="RO12345678"
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

          <FieldLabel>Nr. registrul comerțului</FieldLabel>
          <TextInput
            value={tradeRegisterNumber}
            onChangeText={setTradeRegisterNumber}
            placeholder="J12/1234/2024"
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

          <FieldLabel required>Persoană de contact</FieldLabel>
          <TextInput
            value={contactPersonName}
            onChangeText={setContactPersonName}
            placeholder="Nume persoană de contact"
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

          <FieldLabel required>E-mail contact</FieldLabel>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="contact@clinica.ro"
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

          <FieldLabel required>Telefon contact</FieldLabel>
          <TextInput
            value={contactPhone}
            onChangeText={setContactPhone}
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

          <FieldLabel>Telefon principal</FieldLabel>
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

          <FieldLabel required>Adresă</FieldLabel>
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
              <FieldLabel required>Oraș</FieldLabel>
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
              <FieldLabel required>Județ</FieldLabel>
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

          <FieldLabel>Cod poștal</FieldLabel>
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

          {providerType === "home_care" ? (
            <>
              <FieldLabel>Zonă de acoperire</FieldLabel>
              <TextInput
                value={coverageArea}
                onChangeText={setCoverageArea}
                placeholder="Ex.: Cluj-Napoca și împrejurimi"
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
            </>
          ) : null}

          <FieldLabel required>Nr. autorizație sanitară</FieldLabel>
          <TextInput
            value={sanitaryAuthorizationNumber}
            onChangeText={setSanitaryAuthorizationNumber}
            placeholder="Nr. autorizației"
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

          <FieldLabel>Expirare autorizație</FieldLabel>
          <TextInput
            value={sanitaryAuthorizationExpiresAt}
            onChangeText={handleAuthorizationExpiryChange}
            placeholder="AAAA-LL-ZZ, ex: 2027-12-31"
            keyboardType="number-pad"
            maxLength={10}
            editable={!busy}
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: authorizationExpiryLooksInvalid
                ? COLORS.error
                : COLORS.border,
              paddingHorizontal: 12,
              backgroundColor: "#fff",
              color: COLORS.text,
            }}
          />

          <Text
            style={{
              marginTop: 6,
              color: authorizationExpiryLooksInvalid
                ? COLORS.error
                : COLORS.muted,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            Scrie doar cifrele, iar aplicația pune automat cratimele. Format:
            AAAA-LL-ZZ.
          </Text>

          <ToggleRow
            value={healthcareComplianceConfirmed}
            onPress={() => setHealthcareComplianceConfirmed((prev) => !prev)}
            label="Confirm că furnizorul respectă cerințele legale și de conformitate medicală."
          />

          <ToggleRow
            value={providerAgreementAccepted}
            onPress={() => setProviderAgreementAccepted((prev) => !prev)}
            label="Accept termenii și condițiile pentru furnizori."
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

          <Text style={{ marginTop: 10, color: COLORS.muted, fontSize: 12 }}>
            După înregistrare, cererea va fi trimisă pentru verificare. Un
            administrator MediCalend va analiza documentele și va aproba sau
            respinge solicitarea. Vei primi o notificare după finalizarea
            verificării.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
