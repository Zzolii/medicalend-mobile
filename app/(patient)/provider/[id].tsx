// Path: medicalend-mobile/app/(patient)/provider/[id].tsx

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { api } from "../../../_lib/api";
import { createAppointment } from "../../../_lib/appointments";
import { formatWallClockTime, toBackendNaiveIso } from "../../../_lib/datetime";
import { fetchPatientMe } from "../../../_lib/patient";
import {
  fetchProviderById,
  fetchProviderDoctors,
  type ProviderDoctorPublicOut,
  type ProviderOut,
} from "../../../_lib/provider";
import {
  fetchProviderAvailability,
  type ProviderAvailabilitySlot,
} from "../../../_lib/providerAvailability";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryLight: "#4FB3E8",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",

  softBlue: "#EEF4FF",
  softBlueStrong: "#E0ECFF",
  softGreen: "#ECFDF5",
  softGray: "#F8FAFC",
};

type HomeCareStaffOut = {
  membership_id: number;
  user_id: number;
  clinic_id: number;
  role: string;
  display_name?: string | null;
  email?: string | null;
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: COLORS.muted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontWeight: "800", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: COLORS.softBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: COLORS.primary,
          }}
        />
      </View>

      <Text
        style={{
          marginTop: 14,
          fontSize: 16,
          fontWeight: "900",
          color: COLORS.text,
        }}
      >
        {title}
      </Text>

      <Text style={{ marginTop: 8, color: COLORS.muted, lineHeight: 21 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function doctorDisplayName(d: ProviderDoctorPublicOut) {
  return `${d.title ? `${d.title} ` : ""}${d.name}`.trim();
}

function staffDisplayName(item: HomeCareStaffOut) {
  return (
    item.display_name?.trim() ||
    item.email?.split("@")[0]?.trim() ||
    `Asistent #${item.user_id}`
  );
}

function providerTypeLabel(value?: string | null) {
  if (value === "home_care") return "Home Care";
  if (value === "clinic") return "Clinică";
  return null;
}

function providerDisplayName(data?: ProviderOut | null, providerId?: number) {
  if (data?.name?.trim()) return data.name.trim();
  if (data?.provider_type === "clinic") return "Clinică medicală";
  if (data?.provider_type === "home_care") return "Serviciu Home Care";
  if (providerId && Number.isFinite(providerId)) {
    return `Furnizor #${providerId}`;
  }
  return "Furnizor medical";
}

function doctorSubtitle(d: ProviderDoctorPublicOut) {
  return d.specialty_name || `Specialitate #${d.specialty_id}`;
}

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function fetchHomeCareStaff(providerId: number) {
  const res = await api.get<HomeCareStaffOut[]>(
    `/home-care/providers/${providerId}/staff?role=assistant`,
  );
  return res.data;
}

export default function PatientProviderDetail() {
  const { id, doctorId } = useLocalSearchParams<{
    id?: string | string[];
    doctorId?: string | string[];
  }>();

  const providerId = Number(getSingleParam(id));
  const rawDoctorId = getSingleParam(doctorId);
  const initialDoctorId = Number(rawDoctorId);

  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProviderOut | null>(null);

  const [doctorsBusy, setDoctorsBusy] = useState(false);
  const [doctorsErr, setDoctorsErr] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<ProviderDoctorPublicOut[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  const [staffBusy, setStaffBusy] = useState(false);
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [homeCareStaff, setHomeCareStaff] = useState<HomeCareStaffOut[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<number | null>(
    null,
  );

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);

  const [slotsBusy, setSlotsBusy] = useState(false);
  const [slotsErr, setSlotsErr] = useState<string | null>(null);
  const [slots, setSlots] = useState<ProviderAvailabilitySlot[]>([]);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] =
    useState<ProviderAvailabilitySlot | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  const [bookingNotes, setBookingNotes] = useState("");

  const isHomeCare = data?.provider_type === "home_care";

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const selectedStaff = useMemo(
    () =>
      homeCareStaff.find((item) => item.user_id === selectedStaffUserId) ??
      null,
    [homeCareStaff, selectedStaffUserId],
  );

  async function loadProvider() {
    setErr(null);
    setBusy(true);
    try {
      const d = await fetchProviderById(providerId);
      setData(d);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Încărcarea a eșuat.";
      setErr(String(detail));
      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadDoctors() {
    setDoctorsErr(null);
    setDoctorsBusy(true);

    try {
      const rows = await fetchProviderDoctors(providerId);
      const nextDoctors = rows ?? [];

      setDoctors(nextDoctors);

      if (
        Number.isFinite(initialDoctorId) &&
        initialDoctorId > 0 &&
        nextDoctors.some((doctor) => doctor.id === initialDoctorId)
      ) {
        setSelectedDoctorId(initialDoctorId);
      } else if (selectedDoctorId === null && nextDoctors.length > 0) {
        setSelectedDoctorId(nextDoctors[0].id);
      }
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea medicilor a eșuat.";

      setDoctorsErr(String(detail));
      setDoctors([]);
    } finally {
      setDoctorsBusy(false);
    }
  }

  async function loadHomeCareStaff() {
    setStaffErr(null);
    setStaffBusy(true);

    try {
      const rows = await fetchHomeCareStaff(providerId);
      const nextStaff = rows ?? [];

      setHomeCareStaff(nextStaff);

      if (selectedStaffUserId === null && nextStaff.length > 0) {
        setSelectedStaffUserId(nextStaff[0].user_id);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea asistenților a eșuat.";

      setStaffErr(String(detail));
      setHomeCareStaff([]);

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setStaffBusy(false);
    }
  }

  async function loadAvailability(dateYmd: string) {
    setSlotsErr(null);
    setSlotsBusy(true);
    try {
      const res = await fetchProviderAvailability({
        providerId,
        date: dateYmd,
        doctorId: isHomeCare ? null : selectedDoctorId,
      });
      setSlots(res ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea disponibilității a eșuat.";
      setSlotsErr(String(detail));
      setSlots([]);
      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setSlotsBusy(false);
    }
  }

  async function openWebsite(url?: string | null) {
    if (!url?.trim()) return;
    let normalized = url.trim();
    if (
      !normalized.startsWith("http://") &&
      !normalized.startsWith("https://")
    ) {
      normalized = `https://${normalized}`;
    }

    const supported = await Linking.canOpenURL(normalized);
    if (!supported) {
      Alert.alert("Link invalid", "Website-ul nu poate fi deschis.");
      return;
    }

    await Linking.openURL(normalized);
  }

  useEffect(() => {
    if (!Number.isFinite(providerId) || providerId <= 0) {
      setBusy(false);
      setErr("ID de furnizor invalid.");
      return;
    }
    loadProvider();
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  useEffect(() => {
    if (data?.provider_type === "home_care") {
      loadHomeCareStaff();
      setSelectedDoctorId(null);
      return;
    }

    setHomeCareStaff([]);
    setSelectedStaffUserId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.provider_type, providerId]);

  useEffect(() => {
    if (!Number.isFinite(initialDoctorId) || initialDoctorId <= 0) return;
    if (doctors.length === 0) return;
    if (data?.provider_type === "home_care") return;

    const exists = doctors.some((doctor) => doctor.id === initialDoctorId);
    if (!exists) return;

    setSelectedDoctorId(initialDoctorId);
  }, [initialDoctorId, doctors, data?.provider_type]);

  useEffect(() => {
    if (!Number.isFinite(providerId) || providerId <= 0) return;
    loadAvailability(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, providerId, selectedDoctorId, data?.provider_type]);

  const markedDates = useMemo(() => {
    return {
      [selectedDate]: {
        selected: true,
        selectedColor: COLORS.primary,
        selectedTextColor: "#fff",
      },
    } as any;
  }, [selectedDate]);

  function onPickSlot(s: ProviderAvailabilitySlot) {
    if (!s.available) return;
    setSelectedSlot(s);
    setBookingNotes("");
    setConfirmVisible(true);
  }

  async function confirmBooking() {
    if (!selectedSlot) return;

    if (!isHomeCare && doctors.length > 0 && !selectedDoctorId) {
      Alert.alert(
        "Alege medicul",
        "Pentru această clinică trebuie să alegi medicul înainte de confirmarea programării.",
      );
      return;
    }

    setBookingBusy(true);
    try {
      const me = await fetchPatientMe();
      const patientId = me?.id;

      if (!patientId) {
        Alert.alert("Eroare", "Nu a fost găsit profilul pacientului.");
        return;
      }

      const assistantNote =
        isHomeCare && selectedStaff
          ? `Asistent selectat: ${staffDisplayName(selectedStaff)}${
              selectedStaff.email ? ` (${selectedStaff.email})` : ""
            }`
          : "";

      const finalNotes = [assistantNote, bookingNotes.trim()]
        .filter(Boolean)
        .join("\n\n");

      const payload = {
        patient_id: patientId,
        provider_id: providerId,
        doctor_id: isHomeCare ? null : selectedDoctorId,
        start_time: toBackendNaiveIso(selectedSlot.start_time),
        end_time: selectedSlot.end_time
          ? toBackendNaiveIso(selectedSlot.end_time)
          : null,
        status: "scheduled",
        notes: finalNotes || null,
      };

      const created = await createAppointment(payload);

      setConfirmVisible(false);
      setSelectedSlot(null);
      setBookingNotes("");

      await loadAvailability(selectedDate);

      const uiStart = formatWallClockTime(selectedSlot.start_time);
      const uiEnd = selectedSlot.end_time
        ? formatWallClockTime(selectedSlot.end_time)
        : "";

      Alert.alert(
        "Programare creată",
        `Programarea #${created.id} a fost creată cu succes.\n\nData: ${selectedDate}\nInterval: ${uiStart}${uiEnd ? `–${uiEnd}` : ""}${
          isHomeCare && selectedStaff
            ? `\nAsistent: ${staffDisplayName(selectedStaff)}`
            : selectedDoctor
              ? `\nMedic: ${doctorDisplayName(selectedDoctor)}`
              : ""
        }\nFurnizor: ${providerDisplayName(data, providerId)}`,
        [
          {
            text: "Vezi programările mele",
            onPress: () => router.push("/(patient)/(tabs)/appointments"),
          },
          { text: "OK" },
        ],
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Programarea a eșuat.";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare la programare", String(detail));
    } finally {
      setBookingBusy(false);
    }
  }

  const pageTitle = providerDisplayName(data, providerId);

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
            textAlign: "center",
            color: COLORS.muted,
            fontWeight: "700",
          }}
        >
          Se încarcă profilul furnizorului...
        </Text>
      </View>
    );
  }

  if (err || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <View
          style={{
            backgroundColor: COLORS.card,
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
          <Text style={{ marginTop: 8, color: COLORS.text, lineHeight: 21 }}>
            {err || "Furnizorul nu a putut fi încărcat."}
          </Text>

          <Pressable
            onPress={() => {
              loadProvider();
              loadDoctors();
              if (data?.provider_type === "home_care") {
                loadHomeCareStaff();
              }
              loadAvailability(selectedDate);
            }}
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
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 28,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: COLORS.primaryDark,
            borderRadius: 28,
            overflow: "hidden",
          }}
        >
          {data.image_url?.trim() ? (
            <Image
              source={{ uri: data.image_url }}
              style={{
                width: "100%",
                height: 190,
                backgroundColor: "#E2E8F0",
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: 150,
                backgroundColor: COLORS.primary,
              }}
            />
          )}

          <View
            style={{
              position: "absolute",
              right: -30,
              top: -15,
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
              bottom: -55,
              width: 180,
              height: 180,
              borderRadius: 999,
              backgroundColor: "rgba(47,107,255,0.16)",
            }}
          />

          <View style={{ padding: 20 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => router.back()}
                style={{
                  height: 38,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Înapoi</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  loadProvider();
                  loadDoctors();
                  if (isHomeCare) {
                    loadHomeCareStaff();
                  }
                  loadAvailability(selectedDate);
                }}
                style={{
                  height: 38,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  Reîncarcă
                </Text>
              </Pressable>
            </View>

            <Text
              style={{
                marginTop: 18,
                color: "rgba(255,255,255,0.78)",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              FURNIZOR MEDICAL
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: "#fff",
                fontSize: 26,
                lineHeight: 32,
                fontWeight: "900",
              }}
            >
              {pageTitle}
            </Text>

            {data.specialty ? (
              <Text style={{ marginTop: 8, color: "#E2E8F0", lineHeight: 21 }}>
                {data.specialty}
              </Text>
            ) : null}

            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {providerTypeLabel(data.provider_type) ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {providerTypeLabel(data.provider_type)}
                  </Text>
                </View>
              ) : null}

              {data.city || data.county ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    {[data.city, data.county].filter(Boolean).join(", ")}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionTitle
            title="Informații"
            subtitle="Datele publice disponibile despre acest furnizor."
          />

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Row label="Tip" value={providerTypeLabel(data.provider_type)} />
            <Row label="Specialitate" value={data.specialty ?? null} />
            <Row label="Servicii" value={data.services_offered ?? null} />
            <Row label="Oraș" value={data.city ?? null} />
            <Row label="Județ" value={data.county ?? null} />
            <Row label="Adresă" value={data.address_line ?? null} />
            <Row label="Telefon" value={data.phone ?? null} />
            <Row label="E-mail" value={data.email ?? null} />
            {data.provider_type === "home_care" ? (
              <Row label="Zonă acoperită" value={data.coverage_area ?? null} />
            ) : null}

            {data.public_description ? (
              <Text
                style={{ marginTop: 12, color: COLORS.muted, lineHeight: 21 }}
              >
                {data.public_description}
              </Text>
            ) : null}

            {data.website ? (
              <Pressable
                onPress={() => openWebsite(data.website)}
                style={{
                  marginTop: 16,
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
                  Deschide website-ul
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {isHomeCare ? (
          <View style={{ gap: 10 }}>
            <SectionTitle
              title="Alege asistentul"
              subtitle="Pentru Home Care, pacientul poate vedea asistentul care va merge la domiciliu."
              actionLabel="Reîncarcă"
              onPress={loadHomeCareStaff}
            />

            <View
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              {staffBusy ? (
                <View style={{ alignItems: "center", paddingVertical: 14 }}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={{ marginTop: 10, color: COLORS.muted }}>
                    Se încarcă asistenții...
                  </Text>
                </View>
              ) : staffErr ? (
                <Text style={{ color: COLORS.error }}>{staffErr}</Text>
              ) : homeCareStaff.length === 0 ? (
                <Text style={{ color: COLORS.muted, lineHeight: 21 }}>
                  Acest furnizor Home Care nu are încă asistenți vizibili pentru
                  programare.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => setSelectedStaffUserId(null)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        selectedStaffUserId === null
                          ? COLORS.primary
                          : COLORS.border,
                      backgroundColor:
                        selectedStaffUserId === null ? COLORS.softBlue : "#fff",
                      padding: 14,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      Oricare asistent disponibil
                    </Text>
                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Furnizorul va confirma intern asistentul disponibil.
                    </Text>
                  </Pressable>

                  {homeCareStaff.map((staff) => {
                    const active = selectedStaffUserId === staff.user_id;

                    return (
                      <Pressable
                        key={`${staff.membership_id}-${staff.user_id}`}
                        onPress={() => setSelectedStaffUserId(staff.user_id)}
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          backgroundColor: active ? COLORS.softBlue : "#fff",
                          padding: 14,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: COLORS.text }}>
                          {staffDisplayName(staff)}
                        </Text>
                        <Text style={{ marginTop: 6, color: COLORS.muted }}>
                          {staff.email || "Asistent Home Care"}
                        </Text>
                        {active ? (
                          <Text
                            style={{
                              marginTop: 8,
                              color: COLORS.primary,
                              fontWeight: "900",
                            }}
                          >
                            Selectat
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <SectionTitle
              title="Alege medicul"
              subtitle="Poți selecta un medic anume sau poți merge pe varianta „oricare disponibil”."
            />

            <View
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              {doctorsBusy ? (
                <View style={{ alignItems: "center", paddingVertical: 14 }}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={{ marginTop: 10, color: COLORS.muted }}>
                    Se încarcă medicii...
                  </Text>
                </View>
              ) : doctorsErr ? (
                <Text style={{ color: COLORS.error }}>{doctorsErr}</Text>
              ) : doctors.length === 0 ? (
                <Text style={{ color: COLORS.muted, lineHeight: 21 }}>
                  Acest furnizor nu are încă o listă separată de medici.
                  Programarea se poate face direct la nivel de furnizor.
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => setSelectedDoctorId(null)}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor:
                        selectedDoctorId === null
                          ? COLORS.primary
                          : COLORS.border,
                      backgroundColor:
                        selectedDoctorId === null ? COLORS.softBlue : "#fff",
                      padding: 14,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      Oricare disponibil
                    </Text>
                    <Text style={{ marginTop: 6, color: COLORS.muted }}>
                      Sistemul îți arată toate intervalele disponibile pentru
                      acest furnizor.
                    </Text>
                  </Pressable>

                  {doctors.map((doctor) => {
                    const active = selectedDoctorId === doctor.id;

                    return (
                      <Pressable
                        key={doctor.id}
                        onPress={() => setSelectedDoctorId(doctor.id)}
                        style={{
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          backgroundColor: active ? COLORS.softBlue : "#fff",
                          padding: 14,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: COLORS.text }}>
                          {doctorDisplayName(doctor)}
                        </Text>
                        <Text style={{ marginTop: 6, color: COLORS.muted }}>
                          {doctorSubtitle(doctor)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <SectionTitle
            title="Alege ziua"
            subtitle="Selectează data pentru care vrei să vezi intervalele disponibile."
          />

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Calendar
              current={selectedDate}
              minDate={todayYmd}
              markedDates={markedDates}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              enableSwipeMonths
              theme={{
                todayTextColor: COLORS.primary,
                arrowColor: COLORS.primary,
                textDayFontWeight: "700",
                textMonthFontWeight: "900",
                textDayHeaderFontWeight: "800",
              }}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionTitle
            title="Intervale disponibile"
            subtitle={
              isHomeCare
                ? selectedStaff
                  ? `Afișăm disponibilitatea furnizorului pentru asistentul ${staffDisplayName(selectedStaff)}.`
                  : "Afișăm disponibilitatea generală a furnizorului Home Care."
                : selectedDoctor
                  ? `Afișăm disponibilitatea pentru ${doctorDisplayName(selectedDoctor)}.`
                  : "Afișăm toate intervalele disponibile pentru furnizor."
            }
            actionLabel="Reîncarcă"
            onPress={() => loadAvailability(selectedDate)}
          />

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: COLORS.softBlue,
              }}
            >
              <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
                {selectedDate}
              </Text>
            </View>

            {slotsBusy ? (
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={{ marginTop: 10, color: COLORS.muted }}>
                  Se încarcă intervalele...
                </Text>
              </View>
            ) : slotsErr ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontWeight: "900", color: COLORS.error }}>
                  Eroare
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.text }}>
                  {slotsErr}
                </Text>
              </View>
            ) : slots.length === 0 ? (
              <View style={{ marginTop: 14 }}>
                <EmptyCard
                  title="Nu există disponibilitate pentru această zi"
                  subtitle="Încearcă o altă zi sau schimbă selecția pentru a vedea alte opțiuni."
                />
              </View>
            ) : (
              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {slots.map((s, idx) => {
                  const label = `${formatWallClockTime(s.start_time)}–${formatWallClockTime(s.end_time)}`;
                  const available = !!s.available;

                  return (
                    <Pressable
                      key={`${s.start_time}-${idx}`}
                      onPress={() => onPickSlot(s)}
                      disabled={!available}
                      style={{
                        minWidth: "30%",
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: available ? COLORS.border : "#CBD5E1",
                        backgroundColor: available ? "#fff" : COLORS.softGray,
                        opacity: available ? 1 : 0.55,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "900",
                          color: available ? COLORS.text : COLORS.muted,
                          textAlign: "center",
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: "800",
                          color: available ? COLORS.success : COLORS.muted,
                          textAlign: "center",
                        }}
                      >
                        {available ? "Disponibil" : "Ocupat"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !bookingBusy && setConfirmVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            padding: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}
            >
              Confirmă programarea
            </Text>

            <View
              style={{
                marginTop: 14,
                borderRadius: 16,
                backgroundColor: COLORS.softBlue,
                padding: 14,
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                {providerDisplayName(data, providerId)}
              </Text>

              <Text style={{ marginTop: 6, color: COLORS.muted }}>
                Data: {selectedDate}
              </Text>

              <Text style={{ marginTop: 6, color: COLORS.muted }}>
                {isHomeCare ? "Asistent" : "Medic"}:{" "}
                {isHomeCare
                  ? selectedStaff
                    ? staffDisplayName(selectedStaff)
                    : "Oricare asistent disponibil"
                  : selectedDoctor
                    ? doctorDisplayName(selectedDoctor)
                    : "Oricare disponibil"}
              </Text>

              <Text
                style={{ marginTop: 6, color: COLORS.text, fontWeight: "900" }}
              >
                {selectedSlot
                  ? `${formatWallClockTime(selectedSlot.start_time)}–${formatWallClockTime(selectedSlot.end_time)}`
                  : "-"}
              </Text>
            </View>

            <Text
              style={{ marginTop: 14, color: COLORS.muted, fontWeight: "800" }}
            >
              Motiv / detalii (opțional)
            </Text>

            <TextInput
              value={bookingNotes}
              onChangeText={setBookingNotes}
              placeholder={
                isHomeCare
                  ? "Ex.: pansament, injecție, control la domiciliu..."
                  : "Ex.: control, simptome, durere, consult..."
              }
              placeholderTextColor={COLORS.muted}
              multiline
              editable={!bookingBusy}
              style={{
                marginTop: 8,
                minHeight: 96,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 12,
                textAlignVertical: "top",
                color: COLORS.text,
                backgroundColor: "#fff",
                opacity: bookingBusy ? 0.7 : 1,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                disabled={bookingBusy}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  opacity: bookingBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Anulează
                </Text>
              </Pressable>

              <Pressable
                onPress={confirmBooking}
                disabled={bookingBusy}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: bookingBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {bookingBusy ? "Se rezervă..." : "Confirmă"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
