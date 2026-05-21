// Path: medicalend-mobile/app/(patient)/(tabs)/profile.tsx

import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  deletePatientMe,
  fetchPatientMe,
  updatePatientMe,
  type PatientMe,
  type PatientMeUpdatePayload,
} from "../../../_lib/patient";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#22C55E",

  softBlue: "#EEF4FF",
  softRed: "#FEF2F2",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View>
      <Text
        style={{
          marginBottom: 6,
          color: COLORS.muted,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
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
  );
}

export default function PatientProfile() {
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<PatientMe | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const hydrate = useCallback((p: PatientMe) => {
    setFirstName(p.first_name ?? "");
    setLastName(p.last_name ?? "");
    setCountry(p.country ?? "");
    setCounty(p.county ?? "");
    setCity(p.city ?? "");
    setAddressLine(p.address_line ?? "");
    setPostalCode(p.postal_code ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);

    try {
      const p = await fetchPatientMe();
      setMe(p);
      hydrate(p);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea profilului a eșuat.";

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasChanges = useMemo(() => {
    if (!me) return false;

    const norm = (v?: string | null) => (v ?? "").trim();

    return (
      norm(firstName) !== norm(me.first_name) ||
      norm(lastName) !== norm(me.last_name) ||
      norm(country) !== norm(me.country) ||
      norm(county) !== norm(me.county) ||
      norm(city) !== norm(me.city) ||
      norm(addressLine) !== norm(me.address_line) ||
      norm(postalCode) !== norm(me.postal_code) ||
      norm(email) !== norm(me.email) ||
      norm(phone) !== norm(me.phone)
    );
  }, [
    me,
    firstName,
    lastName,
    country,
    county,
    city,
    addressLine,
    postalCode,
    email,
    phone,
  ]);

  function validate(): string | null {
    if (!firstName.trim()) return "Prenumele este obligatoriu.";
    if (!lastName.trim()) return "Numele este obligatoriu.";
    if (!country.trim()) return "Țara este obligatorie.";
    if (!county.trim()) return "Județul este obligatoriu.";
    if (!city.trim()) return "Orașul este obligatoriu.";
    if (!addressLine.trim()) return "Adresa este obligatorie.";
    if (postalCode.trim() && postalCode.trim().length < 3) {
      return "Codul poștal este prea scurt.";
    }
    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      Alert.alert("Date incomplete", validationError);
      return;
    }

    if (!hasChanges) {
      Alert.alert("Nicio modificare", "Nu există modificări de salvat.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const payload: PatientMeUpdatePayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country: country.trim(),
        county: county.trim(),
        city: city.trim(),
        address_line: addressLine.trim(),
        postal_code: postalCode.trim() ? postalCode.trim() : null,
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
      };

      const updated = await updatePatientMe(payload);
      setMe(updated);
      hydrate(updated);

      Alert.alert("Succes", "Profilul a fost actualizat.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Actualizarea profilului a eșuat.";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      setErr(String(detail));
      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  function confirmDeleteAccount() {
    if (deleting) return;

    Alert.alert(
      "Ștergere cont pacient",
      "Această acțiune îți va dezactiva contul de pacient. Datele operaționale deja asociate programărilor și episoadelor pot rămâne păstrate pentru trasabilitate și obligații legale, dar profilul tău va fi deconectat de la cont.",
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Continuă",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmare finală",
              "Ești sigur că vrei să ștergi contul? După confirmare vei fi deconectat și nu vei mai putea intra cu acest cont.",
              [
                { text: "Nu", style: "cancel" },
                {
                  text: "Da, șterge contul",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setDeleting(true);
                      setErr(null);

                      await deletePatientMe();
                      await clearToken();

                      Alert.alert(
                        "Cont șters",
                        "Contul tău de pacient a fost dezactivat.",
                        [
                          {
                            text: "OK",
                            onPress: () => router.replace("/(auth)/login"),
                          },
                        ],
                      );
                    } catch (e: any) {
                      const detail =
                        e?.response?.data?.detail ||
                        e?.message ||
                        "Ștergerea contului a eșuat.";

                      setErr(String(detail));
                      Alert.alert("Eroare", String(detail));
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  if (busy) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text
          style={{
            marginTop: 12,
            color: COLORS.muted,
            fontWeight: "700",
          }}
        >
          Se încarcă profilul...
        </Text>
      </View>
    );
  }

  if (err && !me) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.error,
            }}
          >
            A apărut o eroare
          </Text>

          <Text
            style={{
              marginTop: 8,
              color: COLORS.text,
              lineHeight: 21,
            }}
          >
            {err}
          </Text>

          <Pressable
            onPress={load}
            style={{
              marginTop: 16,
              height: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.primary,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Reîncearcă</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 14,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: COLORS.primaryDark,
            borderRadius: 24,
            padding: 20,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              right: -30,
              top: -10,
              width: 160,
              height: 160,
              borderRadius: 999,
              backgroundColor: "rgba(79,179,232,0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -35,
              bottom: -45,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: "rgba(47,107,255,0.16)",
            }}
          />

          <View style={{ zIndex: 2 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              PROFIL PACIENT
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: "#fff",
                fontSize: 24,
                lineHeight: 30,
                fontWeight: "900",
              }}
            >
              {firstName || "Pacient"} {lastName}
            </Text>

            <Text style={{ marginTop: 8, color: "#E2E8F0" }}>
              ID pacient: {me?.id ?? "-"}
            </Text>
          </View>
        </View>

        {err ? (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: "#FECACA",
            }}
          >
            <Text style={{ color: COLORS.error, fontWeight: "900" }}>
              Atenție
            </Text>
            <Text style={{ marginTop: 6, color: COLORS.text }}>{err}</Text>
          </View>
        ) : null}

        <Section title="Date personale">
          <Input
            label="Prenume"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ex.: Andrei"
          />
          <Input
            label="Nume"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Ex.: Popescu"
          />
        </Section>

        <Section title="Adresă">
          <Input
            label="Țară"
            value={country}
            onChangeText={setCountry}
            placeholder="Ex.: RO"
          />
          <Input
            label="Județ"
            value={county}
            onChangeText={setCounty}
            placeholder="Ex.: Cluj"
          />
          <Input
            label="Oraș"
            value={city}
            onChangeText={setCity}
            placeholder="Ex.: Cluj-Napoca"
          />
          <Input
            label="Adresă"
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="Ex.: Str. Exemplu nr. 10"
          />
          <Input
            label="Cod poștal"
            value={postalCode}
            onChangeText={setPostalCode}
            placeholder="Ex.: 400000"
          />
        </Section>

        <Section title="Contact">
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="Ex.: nume@email.ro"
            keyboardType="email-address"
          />
          <Input
            label="Telefon"
            value={phone}
            onChangeText={setPhone}
            placeholder="Ex.: 0712345678"
            keyboardType="phone-pad"
          />
        </Section>

        <Pressable
          onPress={onSave}
          disabled={!hasChanges || saving || deleting}
          style={{
            height: 52,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.primary,
            opacity: !hasChanges || saving || deleting ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {saving ? "Se salvează..." : "Salvează modificările"}
          </Text>
        </Pressable>

        {!hasChanges ? (
          <Text
            style={{
              textAlign: "center",
              color: COLORS.muted,
              fontWeight: "600",
            }}
          >
            Nu există modificări nesalvate.
          </Text>
        ) : null}

        <Section title="Ștergere cont pacient">
          <Text style={{ color: COLORS.muted, lineHeight: 21 }}>
            Poți solicita ștergerea/dezactivarea contului tău de pacient. Contul
            va fi deconectat, iar profilul pacientului va fi separat de
            utilizator. Datele deja asociate programărilor sau episoadelor pot
            fi păstrate unde este necesar pentru trasabilitate și obligații
            legale.
          </Text>

          <Pressable
            onPress={confirmDeleteAccount}
            disabled={deleting || saving}
            style={{
              height: 52,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.softRed,
              borderWidth: 1,
              borderColor: "#FECACA",
              opacity: deleting || saving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: COLORS.error, fontWeight: "900" }}>
              {deleting ? "Se șterge contul..." : "Șterge contul pacient"}
            </Text>
          </Pressable>
        </Section>

        <Pressable
          onPress={logout}
          disabled={deleting}
          style={{
            height: 52,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            opacity: deleting ? 0.6 : 1,
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Deconectare
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
