// Path: medicalend-mobile/app/(provider)/(tabs)/profile.tsx

import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  fetchProviderMe,
  updateProviderMe,
  type ProviderMe,
  type ProviderUpdatePayload,
} from "../../../_lib/provider";
import {
  deleteMyAvailabilityException,
  deleteMyWeeklyAvailability,
  fetchMyAvailabilityExceptions,
  fetchMyWeeklyAvailability,
  SLOT_DURATION_OPTIONS,
  upsertMyAvailabilityException,
  upsertMyWeeklyAvailability,
  type ProviderAvailabilityExceptionOut,
  type ProviderWeeklyAvailabilityOut,
  type SlotDurationMinutes,
} from "../../../_lib/providerAvailability";
import {
  createProviderDoctor,
  createProviderSpecialty,
  deleteProviderDoctor,
  deleteProviderSpecialty,
  fetchProviderStructure,
  type ProviderDoctorOut,
  type ProviderSpecialtyOut,
} from "../../../_lib/providerStructure";
import { getRoleContext, type RoleContext } from "../../../_lib/roles";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",
  text: "#0F172A",
  muted: "#64748B",
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
};

const WEEKDAYS = [
  { value: 0, label: "Luni" },
  { value: 1, label: "Marți" },
  { value: 2, label: "Miercuri" },
  { value: 3, label: "Joi" },
  { value: 4, label: "Vineri" },
  { value: 5, label: "Sâmbătă" },
  { value: 6, label: "Duminică" },
] as const;

type ProviderTypeValue = "clinic" | "home_care";

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

function ReadonlyRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: COLORS.muted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: COLORS.text, fontWeight: "800" }}>
        {value?.trim() ? value : "-"}
      </Text>
    </View>
  );
}

function cleanText(v: string) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

function normalizeDateInput(value: string) {
  const raw = cleanText(value);
  if (!raw) return "";
  return raw.replace(/[.\s/]+/g, "-");
}

function normalizeTimeInput(value: string) {
  const raw = cleanText(value);
  if (!raw) return "";
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 5);
}

function splitSpecialties(v?: string | null) {
  if (!v?.trim()) return [""];
  const parts = v
    .split(",")
    .map((x) => cleanText(x))
    .filter(Boolean);

  return parts.length ? parts : [""];
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

function doctorLabel(doctor: ProviderDoctorOut) {
  return `${doctor.title ? `${doctor.title} ` : ""}${doctor.name}`.trim();
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function providerTypeLabel(value?: string | null) {
  if (value === "home_care") return "Furnizor Home Care";
  return "Clinică / cabinet";
}

function boolLabel(value?: boolean | null) {
  if (value === true) return "Da";
  if (value === false) return "Nu";
  return "-";
}

function roleDescription(roleCtx: RoleContext | null) {
  if (!roleCtx) return "Se încarcă rolul utilizatorului.";

  if (roleCtx.isClinicAdmin && roleCtx.isDoctor) {
    return "Ai acces de administrator clinică și medic. Poți gestiona clinica, structura și propriul program medical.";
  }

  if (roleCtx.isClinicAdmin) {
    return "Ai acces la administrarea clinicii: profil organizațional, specializări, medici și program.";
  }

  if (roleCtx.isDoctor) {
    return "Ai acces de medic. Poți gestiona propriul program, sloturile și zilele de excepție.";
  }

  if (roleCtx.isAssistant) {
    return "Ai acces clinic orientat pe activități. Setările clinicii sunt gestionate de administratorul clinicii.";
  }

  if (roleCtx.isReception) {
    return "Ai acces administrativ și de programări. Setările clinicii sunt gestionate de administratorul clinicii.";
  }

  return "Rolul activ nu permite administrarea profilului clinicii.";
}

function extractDoctorIdFromRoleContext(
  ctx: RoleContext | null,
): number | null {
  const raw = ctx as any;

  const direct =
    raw?.providerDoctorId ??
    raw?.provider_doctor_id ??
    raw?.doctorId ??
    raw?.doctor_id ??
    null;

  if (typeof direct === "number") return direct;

  const memberships =
    raw?.clinic_memberships ?? raw?.clinicMemberships ?? raw?.memberships ?? [];

  if (Array.isArray(memberships)) {
    const doctorMembership = memberships.find((membership) => {
      const role = membership?.role;
      const providerDoctorId =
        membership?.provider_doctor_id ?? membership?.providerDoctorId;
      return role === "doctor" && typeof providerDoctorId === "number";
    });

    const providerDoctorId =
      doctorMembership?.provider_doctor_id ??
      doctorMembership?.providerDoctorId ??
      null;

    if (typeof providerDoctorId === "number") return providerDoctorId;
  }

  return null;
}

export default function ProviderProfileScreen() {
  const [roleBusy, setRoleBusy] = useState(true);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);

  const [provider, setProvider] = useState<ProviderMe | null>(null);
  const [specialtyRows, setSpecialtyRows] = useState<ProviderSpecialtyOut[]>(
    [],
  );
  const [doctorRows, setDoctorRows] = useState<ProviderDoctorOut[]>([]);
  const [ownDoctorId, setOwnDoctorId] = useState<number | null>(null);

  const [weeklyRows, setWeeklyRows] = useState<ProviderWeeklyAvailabilityOut[]>(
    [],
  );
  const [exceptionRows, setExceptionRows] = useState<
    ProviderAvailabilityExceptionOut[]
  >([]);

  const [selectedCalendarDoctorId, setSelectedCalendarDoctorId] = useState<
    number | null
  >(null);

  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderTypeValue>("clinic");
  const [specialties, setSpecialties] = useState<string[]>([""]);
  const [servicesOffered, setServicesOffered] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [cui, setCui] = useState("");
  const [tradeRegisterNumber, setTradeRegisterNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [coverageArea, setCoverageArea] = useState("");
  const [sanitaryAuthorizationNumber, setSanitaryAuthorizationNumber] =
    useState("");
  const [sanitaryAuthorizationExpiresAt, setSanitaryAuthorizationExpiresAt] =
    useState("");
  const [healthcareComplianceConfirmed, setHealthcareComplianceConfirmed] =
    useState(false);
  const [providerAgreementAccepted, setProviderAgreementAccepted] =
    useState(false);
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("RO");

  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [structureBusy, setStructureBusy] = useState(false);

  const [newSpecialtyName, setNewSpecialtyName] = useState("");

  const [doctorName, setDoctorName] = useState("");
  const [doctorTitle, setDoctorTitle] = useState("");
  const [doctorLicenseNumber, setDoctorLicenseNumber] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(
    null,
  );

  const [selectedWeekday, setSelectedWeekday] = useState<number>(0);
  const [availabilityStart, setAvailabilityStart] = useState("08:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("16:00");
  const [slotDurationMinutes, setSlotDurationMinutes] =
    useState<SlotDurationMinutes>(30);

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionClosed, setExceptionClosed] = useState(true);
  const [exceptionStart, setExceptionStart] = useState("08:00");
  const [exceptionEnd, setExceptionEnd] = useState("16:00");
  const [exceptionNote, setExceptionNote] = useState("");

  const canManageClinicProfile = useMemo(() => {
    return roleCtx?.isClinicAdmin === true || roleCtx?.appRole === "provider";
  }, [roleCtx]);

  const canManageStructure = canManageClinicProfile;

  const canManageAvailability = useMemo(() => {
    return (
      roleCtx?.isClinicAdmin === true ||
      roleCtx?.isDoctor === true ||
      roleCtx?.appRole === "provider"
    );
  }, [roleCtx]);

  const canAccessProfileScreen =
    canManageClinicProfile ||
    canManageAvailability ||
    roleCtx?.isAssistant === true ||
    roleCtx?.isReception === true;

  const canSave = useMemo(() => {
    return (
      cleanText(name).length >= 2 &&
      cleanText(addressLine).length >= 3 &&
      cleanText(city).length >= 2 &&
      cleanText(county).length >= 2 &&
      cleanText(postalCode).length >= 3
    );
  }, [name, addressLine, city, county, postalCode]);

  const selectedCalendarDoctor = useMemo(
    () =>
      doctorRows.find((doctor) => doctor.id === selectedCalendarDoctorId) ??
      null,
    [doctorRows, selectedCalendarDoctorId],
  );

  const activeDoctorIdForAvailability = useMemo(() => {
    if (canManageStructure) return selectedCalendarDoctorId;

    if (roleCtx?.isDoctor === true) {
      return ownDoctorId;
    }

    return null;
  }, [canManageStructure, selectedCalendarDoctorId, ownDoctorId, roleCtx]);

  const activeCalendarLabel = useMemo(() => {
    if (canManageStructure) {
      return selectedCalendarDoctor
        ? doctorLabel(selectedCalendarDoctor)
        : "Calendar clinică";
    }

    const ownDoctor = doctorRows.find((doctor) => doctor.id === ownDoctorId);

    if (ownDoctor) {
      return doctorLabel(ownDoctor);
    }

    if (roleCtx?.isDoctor === true) {
      return "Calendarul meu";
    }

    return "Calendar clinică";
  }, [
    canManageStructure,
    selectedCalendarDoctor,
    doctorRows,
    ownDoctorId,
    roleCtx,
  ]);

  const hydrateForm = useCallback((p: ProviderMe) => {
    setName(p.name ?? "");
    setProviderType(p.provider_type === "home_care" ? "home_care" : "clinic");
    setSpecialties(splitSpecialties(p.specialty));
    setServicesOffered(p.services_offered ?? "");
    setLicenseNumber(p.license_number ?? "");
    setCui(p.cui ?? "");
    setTradeRegisterNumber(p.trade_register_number ?? "");
    setPhone(p.phone ?? "");
    setEmail(p.email ?? "");
    setContactPersonName(p.contact_person_name ?? "");
    setContactEmail(p.contact_email ?? "");
    setContactPhone(p.contact_phone ?? "");
    setCoverageArea(p.coverage_area ?? "");
    setSanitaryAuthorizationNumber(p.sanitary_authorization_number ?? "");
    setSanitaryAuthorizationExpiresAt(
      p.sanitary_authorization_expires_at ?? "",
    );
    setHealthcareComplianceConfirmed(
      p.healthcare_compliance_confirmed === true,
    );
    setProviderAgreementAccepted(p.provider_agreement_accepted === true);
    setAddressLine(p.address_line ?? "");
    setCity(p.city ?? "");
    setCounty(p.county ?? "");
    setPostalCode(p.postal_code ?? "");
    setCountry(p.country ?? "RO");
  }, []);

  const loadAvailabilityData = useCallback(async (doctorId?: number | null) => {
    const [weekly, exceptions] = await Promise.all([
      fetchMyWeeklyAvailability({ doctorId }),
      fetchMyAvailabilityExceptions({ doctorId }),
    ]);

    setWeeklyRows(weekly ?? []);
    setExceptionRows(exceptions ?? []);
  }, []);

  const loadClinicAdminData = useCallback(async () => {
    const [me, structure] = await Promise.all([
      fetchProviderMe(),
      fetchProviderStructure(),
    ]);

    setProvider(me);
    hydrateForm(me);
    setSpecialtyRows(structure.specialties ?? []);
    setDoctorRows(structure.doctors ?? []);
  }, [hydrateForm]);

  const loadDoctorData = useCallback(async (ctx: RoleContext) => {
    const doctorId = extractDoctorIdFromRoleContext(ctx);
    setOwnDoctorId(doctorId);
    setProvider(null);
    setSpecialtyRows([]);
    setEditing(false);

    try {
      const structure = await fetchProviderStructure();
      const doctors = structure.doctors ?? [];
      setDoctorRows(doctors);

      const resolvedDoctorId =
        doctorId ??
        doctors.find((doctor) => doctor.email?.trim())?.id ??
        doctors[0]?.id ??
        null;

      setOwnDoctorId(resolvedDoctorId);
      setSelectedCalendarDoctorId(resolvedDoctorId);
    } catch {
      setDoctorRows([]);
      setSelectedCalendarDoctorId(doctorId);
    }
  }, []);

  const load = useCallback(async () => {
    setRoleBusy(true);
    setBusy(true);
    setErr(null);

    try {
      const ctx = await getRoleContext();
      setRoleCtx(ctx);

      if (
        !ctx.isClinicAdmin &&
        !ctx.isDoctor &&
        !ctx.isAssistant &&
        !ctx.isReception &&
        ctx.appRole !== "provider"
      ) {
        setProvider(null);
        setSpecialtyRows([]);
        setDoctorRows([]);
        setWeeklyRows([]);
        setExceptionRows([]);
        setEditing(false);
        return;
      }

      if (ctx.isClinicAdmin || ctx.appRole === "provider") {
        await loadClinicAdminData();
        const doctorId = extractDoctorIdFromRoleContext(ctx);
        setOwnDoctorId(doctorId);
      } else if (ctx.isDoctor) {
        await loadDoctorData(ctx);
      } else {
        setProvider(null);
        setSpecialtyRows([]);
        setDoctorRows([]);
        setWeeklyRows([]);
        setExceptionRows([]);
        setEditing(false);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea profilului a eșuat";

      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }
    } finally {
      setRoleBusy(false);
      setBusy(false);
    }
  }, [loadClinicAdminData, loadDoctorData]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (busy) return;
    if (!canManageAvailability) return;

    loadAvailabilityData(activeDoctorIdForAvailability).catch((e: any) => {
      console.log("[AVAILABILITY LOAD ERROR]", e?.message, e?.response?.data);
    });
  }, [
    busy,
    canManageAvailability,
    activeDoctorIdForAvailability,
    loadAvailabilityData,
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

  async function onSave() {
    if (!provider) return;

    if (!canSave) {
      Alert.alert(
        "Date lipsă",
        "Te rog completează câmpurile obligatorii: Nume, Adresă, Oraș, Județ și Cod poștal.",
      );
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const normalizedExpiry = normalizeDateInput(
        sanitaryAuthorizationExpiresAt,
      );

      const payload: ProviderUpdatePayload = {
        name: cleanText(name),
        provider_type: providerType,
        specialty: specialtiesToBackendString(specialties) || null,
        services_offered: cleanText(servicesOffered) || null,
        license_number: cleanText(licenseNumber) || null,
        cui: cleanText(cui) || null,
        trade_register_number: cleanText(tradeRegisterNumber) || null,
        phone: cleanText(phone) || null,
        email: cleanText(email) || null,
        contact_person_name: cleanText(contactPersonName) || null,
        contact_email: cleanText(contactEmail) || null,
        contact_phone: cleanText(contactPhone) || null,
        coverage_area: cleanText(coverageArea) || null,
        sanitary_authorization_number:
          cleanText(sanitaryAuthorizationNumber) || null,
        sanitary_authorization_expires_at: normalizedExpiry || null,
        healthcare_compliance_confirmed: healthcareComplianceConfirmed,
        provider_agreement_accepted: providerAgreementAccepted,
        address_line: cleanText(addressLine),
        city: cleanText(city),
        county: cleanText(county),
        postal_code: cleanText(postalCode),
        country: cleanText(country) || "RO",
      };

      const updated = await updateProviderMe(payload);
      setProvider(updated);
      hydrateForm(updated);
      setEditing(false);

      Alert.alert("Succes", "Datele clinicii au fost actualizate.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Actualizarea profilului clinicii a eșuat";
      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setSaving(false);
    }
  }

  function onCancelEdit() {
    if (provider) {
      hydrateForm(provider);
    }
    setEditing(false);
    setErr(null);
  }

  function resetDoctorForm() {
    setDoctorName("");
    setDoctorTitle("");
    setDoctorLicenseNumber("");
    setDoctorPhone("");
    setDoctorEmail("");
    setSelectedSpecialtyId(
      specialtyRows.length > 0 ? specialtyRows[0].id : null,
    );
  }

  async function openDoctorModal() {
    if (specialtyRows.length === 0) {
      Alert.alert(
        "Nu există specializări",
        "Adaugă mai întâi cel puțin o specializare.",
      );
      return;
    }

    resetDoctorForm();
    setDoctorModalOpen(true);
  }

  async function handleAddSpecialty() {
    const cleaned = cleanText(newSpecialtyName);
    if (cleaned.length < 2) {
      Alert.alert(
        "Date lipsă",
        "Numele specializării trebuie să aibă cel puțin 2 caractere.",
      );
      return;
    }

    setStructureBusy(true);
    try {
      await createProviderSpecialty({ name: cleaned });
      setNewSpecialtyName("");
      setSpecialtyModalOpen(false);
      await loadClinicAdminData();
      Alert.alert("Succes", "Specializarea a fost adăugată.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Crearea specializării a eșuat";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setStructureBusy(false);
    }
  }

  async function handleDeleteSpecialty(item: ProviderSpecialtyOut) {
    Alert.alert(
      "Ștergere specializare",
      `Ștergi "${item.name}"? Și medicii asociați pot fi afectați.`,
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              setStructureBusy(true);
              await deleteProviderSpecialty(item.id);
              await loadClinicAdminData();
            } catch (e: any) {
              const detail =
                e?.response?.data?.detail ||
                e?.message ||
                "Ștergerea specializării a eșuat";
              Alert.alert("Eroare", String(detail));
            } finally {
              setStructureBusy(false);
            }
          },
        },
      ],
    );
  }

  async function handleAddDoctor() {
    const cleanedName = cleanText(doctorName);

    if (!selectedSpecialtyId) {
      Alert.alert("Date lipsă", "Selectează o specializare.");
      return;
    }

    if (cleanedName.length < 2) {
      Alert.alert(
        "Date lipsă",
        "Numele medicului trebuie să aibă cel puțin 2 caractere.",
      );
      return;
    }

    setStructureBusy(true);
    try {
      await createProviderDoctor({
        specialty_id: selectedSpecialtyId,
        name: cleanedName,
        title: cleanText(doctorTitle) || null,
        license_number: cleanText(doctorLicenseNumber) || null,
        phone: cleanText(doctorPhone) || null,
        email: cleanText(doctorEmail) || null,
      });

      resetDoctorForm();
      setDoctorModalOpen(false);
      await loadClinicAdminData();
      Alert.alert("Succes", "Medicul a fost adăugat.");
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail || e?.message || "Crearea medicului a eșuat";

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      Alert.alert("Eroare", String(detail));
    } finally {
      setStructureBusy(false);
    }
  }

  async function handleDeleteDoctor(item: ProviderDoctorOut) {
    Alert.alert("Ștergere medic", `Ștergi "${item.name}"?`, [
      { text: "Renunță", style: "cancel" },
      {
        text: "Șterge",
        style: "destructive",
        onPress: async () => {
          try {
            setStructureBusy(true);
            await deleteProviderDoctor(item.id);
            await loadClinicAdminData();

            if (selectedCalendarDoctorId === item.id) {
              setSelectedCalendarDoctorId(null);
            }

            if (ownDoctorId === item.id) {
              setOwnDoctorId(null);
            }
          } catch (e: any) {
            const detail =
              e?.response?.data?.detail ||
              e?.message ||
              "Ștergerea medicului a eșuat";
            Alert.alert("Eroare", String(detail));
          } finally {
            setStructureBusy(false);
          }
        },
      },
    ]);
  }

  async function handleSaveWeeklyAvailability() {
    const start = normalizeTimeInput(availabilityStart);
    const end = normalizeTimeInput(availabilityEnd);

    if (!start || !end) {
      Alert.alert(
        "Date lipsă",
        "Completează ora de început și ora de sfârșit.",
      );
      return;
    }

    if (start >= end) {
      Alert.alert(
        "Interval invalid",
        "Ora de început trebuie să fie înaintea orei de sfârșit.",
      );
      return;
    }

    try {
      setStructureBusy(true);
      await upsertMyWeeklyAvailability({
        doctor_id: activeDoctorIdForAvailability,
        weekday: selectedWeekday,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        slot_duration_minutes: slotDurationMinutes,
      });
      setAvailabilityModalOpen(false);
      await loadAvailabilityData(activeDoctorIdForAvailability);
      Alert.alert("Succes", "Programul săptămânal a fost salvat.");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Salvarea programului săptămânal a eșuat";
      Alert.alert("Eroare", String(detail));
    } finally {
      setStructureBusy(false);
    }
  }

  async function handleDeleteWeeklyAvailability(
    item: ProviderWeeklyAvailabilityOut,
  ) {
    Alert.alert(
      "Ștergere interval săptămânal",
      "Ștergi acest interval de program săptămânal?",
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              setStructureBusy(true);
              await deleteMyWeeklyAvailability(item.id);
              await loadAvailabilityData(activeDoctorIdForAvailability);
            } catch (e: any) {
              const detail =
                e?.response?.data?.detail ||
                e?.message ||
                "Ștergerea programului săptămânal a eșuat";
              Alert.alert("Eroare", String(detail));
            } finally {
              setStructureBusy(false);
            }
          },
        },
      ],
    );
  }

  async function handleSaveException() {
    const normalizedExceptionDate = normalizeDateInput(exceptionDate);
    const start = normalizeTimeInput(exceptionStart);
    const end = normalizeTimeInput(exceptionEnd);

    if (!normalizedExceptionDate) {
      Alert.alert("Date lipsă", "Introdu data în formatul YYYY-MM-DD.");
      return;
    }

    if (!exceptionClosed) {
      if (!start || !end) {
        Alert.alert(
          "Date lipsă",
          "Pentru override deschis trebuie să completezi intervalul orar.",
        );
        return;
      }

      if (start >= end) {
        Alert.alert(
          "Interval invalid",
          "Ora de început trebuie să fie înaintea orei de sfârșit.",
        );
        return;
      }
    }

    try {
      setStructureBusy(true);
      await upsertMyAvailabilityException({
        doctor_id: activeDoctorIdForAvailability,
        date: normalizedExceptionDate,
        is_closed: exceptionClosed,
        start_time: exceptionClosed ? null : `${start}:00`,
        end_time: exceptionClosed ? null : `${end}:00`,
        note: cleanText(exceptionNote) || null,
      });
      setExceptionModalOpen(false);
      setExceptionDate("");
      setExceptionClosed(true);
      setExceptionStart("08:00");
      setExceptionEnd("16:00");
      setExceptionNote("");
      await loadAvailabilityData(activeDoctorIdForAvailability);
      Alert.alert("Succes", "Ziua de excepție a fost salvată.");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Salvarea zilei de excepție a eșuat";
      Alert.alert("Eroare", String(detail));
    } finally {
      setStructureBusy(false);
    }
  }

  async function handleDeleteException(item: ProviderAvailabilityExceptionOut) {
    Alert.alert("Ștergere excepție", "Ștergi această zi de excepție?", [
      { text: "Renunță", style: "cancel" },
      {
        text: "Șterge",
        style: "destructive",
        onPress: async () => {
          try {
            setStructureBusy(true);
            await deleteMyAvailabilityException(item.id);
            await loadAvailabilityData(activeDoctorIdForAvailability);
          } catch (e: any) {
            const detail =
              e?.response?.data?.detail ||
              e?.message ||
              "Ștergerea excepției a eșuat";
            Alert.alert("Eroare", String(detail));
          } finally {
            setStructureBusy(false);
          }
        },
      },
    ]);
  }

  async function logout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  function renderAccountActions() {
    return (
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
          Acțiuni cont
        </Text>

        <Pressable
          onPress={logout}
          style={{
            marginTop: 14,
            height: 48,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Deconectare</Text>
        </Pressable>
      </View>
    );
  }

  function renderUserRoleCard() {
    return (
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          {roleCtx?.labelRo || "Utilizator"}
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          {roleDescription(roleCtx)}
        </Text>
      </View>
    );
  }

  function renderOrganizationalAccessCard() {
    return (
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
          Acces organizațional
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          {canManageAvailability
            ? "Poți gestiona programul, sloturile și zilele de excepție disponibile rolului tău."
            : "Profilul clinicii, specializările, medicii și programul sunt administrate de administratorul clinicii."}
        </Text>
      </View>
    );
  }

  function renderClinicProfileCard() {
    if (!canManageClinicProfile || !provider) return null;

    return (
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          {provider.name || "Clinică"}
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Status:{" "}
          <Text
            style={{
              fontWeight: "900",
              color:
                provider.status === "approved"
                  ? COLORS.success
                  : provider.status === "rejected"
                    ? COLORS.error
                    : COLORS.warning,
            }}
          >
            {provider.status}
          </Text>
        </Text>

        {provider.rejection_reason ? (
          <Text style={{ marginTop: 8, color: COLORS.error }}>
            Motiv respingere: {provider.rejection_reason}
          </Text>
        ) : null}

        {!editing ? (
          <View style={{ marginTop: 12 }}>
            <ReadonlyRow
              label="Tip furnizor"
              value={providerTypeLabel(provider.provider_type)}
            />
            <ReadonlyRow label="Specializări" value={provider.specialty} />
            <ReadonlyRow
              label="Servicii oferite"
              value={provider.services_offered}
            />
            <ReadonlyRow
              label="Număr licență"
              value={provider.license_number}
            />
            <ReadonlyRow label="CUI / CIF" value={provider.cui} />
            <ReadonlyRow
              label="Nr. Registrul Comerțului"
              value={provider.trade_register_number}
            />
            <ReadonlyRow label="Telefon" value={provider.phone} />
            <ReadonlyRow label="Email" value={provider.email} />
            <ReadonlyRow
              label="Persoană de contact"
              value={provider.contact_person_name}
            />
            <ReadonlyRow label="Email contact" value={provider.contact_email} />
            <ReadonlyRow
              label="Telefon contact"
              value={provider.contact_phone}
            />
            <ReadonlyRow
              label="Arie acoperire"
              value={provider.coverage_area}
            />
            <ReadonlyRow
              label="Număr autorizație sanitară"
              value={provider.sanitary_authorization_number}
            />
            <ReadonlyRow
              label="Autorizație valabilă până la"
              value={provider.sanitary_authorization_expires_at}
            />
            <ReadonlyRow
              label="Confirmare conformitate"
              value={boolLabel(provider.healthcare_compliance_confirmed)}
            />
            <ReadonlyRow
              label="Acord furnizor acceptat"
              value={boolLabel(provider.provider_agreement_accepted)}
            />
            <ReadonlyRow label="Adresă" value={provider.address_line} />
            <ReadonlyRow label="Oraș" value={provider.city} />
            <ReadonlyRow label="Județ" value={provider.county} />
            <ReadonlyRow label="Cod poștal" value={provider.postal_code} />
            <ReadonlyRow label="Țară" value={provider.country} />
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            <FieldLabel required>Nume clinică</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              editable={!saving}
              placeholder="Ex.: Medi Center / Clinica Popescu"
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

            <FieldLabel required>Tip furnizor</FieldLabel>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setProviderType("clinic")}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    providerType === "clinic" ? "#EEF4FF" : "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: providerType === "clinic" ? "900" : "700",
                  }}
                >
                  Clinică / cabinet
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setProviderType("home_care")}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    providerType === "home_care" ? "#EEF4FF" : "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontWeight: providerType === "home_care" ? "900" : "700",
                  }}
                >
                  Home Care
                </Text>
              </Pressable>
            </View>

            <FieldLabel>Specializări</FieldLabel>
            <View style={{ gap: 10 }}>
              {specialties.map((item, index) => (
                <View
                  key={`edit-specialty-${index}`}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <TextInput
                    value={item}
                    onChangeText={(value) => updateSpecialtyAt(index, value)}
                    editable={!saving}
                    placeholder={`Specializare #${index + 1}`}
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
                    disabled={saving}
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
                      opacity: saving ? 0.6 : 1,
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
              disabled={saving}
              style={{
                marginTop: 10,
                height: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                + Specializare nouă
              </Text>
            </Pressable>

            <FieldLabel>Servicii oferite</FieldLabel>
            <TextInput
              value={servicesOffered}
              onChangeText={setServicesOffered}
              editable={!saving}
              placeholder="Ex.: injecții, pansamente, consultații..."
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

            <FieldLabel>Număr licență</FieldLabel>
            <TextInput
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              editable={!saving}
              placeholder="Ex.: RO-12345"
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

            <FieldLabel>CUI / CIF</FieldLabel>
            <TextInput
              value={cui}
              onChangeText={setCui}
              editable={!saving}
              placeholder="Ex.: RO12345678"
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

            <FieldLabel>Nr. Registrul Comerțului</FieldLabel>
            <TextInput
              value={tradeRegisterNumber}
              onChangeText={setTradeRegisterNumber}
              editable={!saving}
              placeholder="Ex.: J40/1234/2026"
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
              editable={!saving}
              placeholder="+40..."
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

            <FieldLabel>Email</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              editable={!saving}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@exemplu.ro"
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

            <FieldLabel>Persoană de contact</FieldLabel>
            <TextInput
              value={contactPersonName}
              onChangeText={setContactPersonName}
              editable={!saving}
              placeholder="Ex.: Popescu Maria"
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

            <FieldLabel>Email contact</FieldLabel>
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              editable={!saving}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="contact@exemplu.ro"
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

            <FieldLabel>Telefon contact</FieldLabel>
            <TextInput
              value={contactPhone}
              onChangeText={setContactPhone}
              editable={!saving}
              placeholder="+40..."
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
                <FieldLabel>Arie de acoperire</FieldLabel>
                <TextInput
                  value={coverageArea}
                  onChangeText={setCoverageArea}
                  editable={!saving}
                  placeholder="Ex.: Cluj-Napoca, Florești, Apahida"
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
              </>
            ) : null}

            <FieldLabel>Număr autorizație sanitară</FieldLabel>
            <TextInput
              value={sanitaryAuthorizationNumber}
              onChangeText={setSanitaryAuthorizationNumber}
              editable={!saving}
              placeholder="Ex.: ASP-2026-123"
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

            <FieldLabel>Valabilă până la (YYYY-MM-DD)</FieldLabel>
            <TextInput
              value={sanitaryAuthorizationExpiresAt}
              onChangeText={(value) =>
                setSanitaryAuthorizationExpiresAt(normalizeDateInput(value))
              }
              editable={!saving}
              placeholder="2026-12-31"
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

            <FieldLabel>Declarații</FieldLabel>
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() =>
                  !saving &&
                  setHealthcareComplianceConfirmed(
                    !healthcareComplianceConfirmed,
                  )
                }
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: healthcareComplianceConfirmed
                    ? "#EEF4FF"
                    : "#fff",
                  padding: 12,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                  {healthcareComplianceConfirmed ? "✓ " : ""}
                  Confirm că serviciile medicale respectă reglementările din
                  România.
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  !saving &&
                  setProviderAgreementAccepted(!providerAgreementAccepted)
                }
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: providerAgreementAccepted
                    ? "#EEF4FF"
                    : "#fff",
                  padding: 12,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                  {providerAgreementAccepted ? "✓ " : ""}
                  Accept acordul MediCalend pentru furnizori.
                </Text>
              </Pressable>
            </View>

            <FieldLabel required>Adresă</FieldLabel>
            <TextInput
              value={addressLine}
              onChangeText={setAddressLine}
              editable={!saving}
              placeholder="Str. Exemplu 12"
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
                  editable={!saving}
                  placeholder="Cluj-Napoca"
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
                  editable={!saving}
                  placeholder="Cluj"
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

            <FieldLabel required>Cod poștal</FieldLabel>
            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              editable={!saving}
              placeholder="400000"
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

            <FieldLabel>Țară</FieldLabel>
            <TextInput
              value={country}
              onChangeText={setCountry}
              editable={!saving}
              placeholder="RO"
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
        )}

        {err ? (
          <Text style={{ marginTop: 12, color: COLORS.error }}>{err}</Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          {!editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>Editează</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={onCancelEdit}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                  Renunță
                </Text>
              </Pressable>

              <Pressable
                onPress={onSave}
                disabled={!canSave || saving}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: COLORS.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !canSave || saving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {saving ? "Se salvează..." : "Salvează"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  function renderSpecialtiesCard() {
    if (!canManageStructure) return null;

    return (
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>
            Specializări
          </Text>

          <Pressable
            onPress={() => setSpecialtyModalOpen(true)}
            style={{
              height: 38,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>+ Adaugă</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Aici sunt specializările reale ale clinicii.
        </Text>

        <View style={{ marginTop: 12, gap: 10 }}>
          {specialtyRows.length === 0 ? (
            <Text style={{ color: COLORS.muted }}>
              Nu există încă specializări adăugate.
            </Text>
          ) : (
            specialtyRows.map((item) => (
              <View
                key={item.id}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                  {item.name}
                </Text>

                <Text style={{ marginTop: 4, color: COLORS.muted }}>
                  Specializare #{item.id}
                </Text>

                <Pressable
                  onPress={() => handleDeleteSpecialty(item)}
                  disabled={structureBusy}
                  style={{
                    marginTop: 10,
                    height: 40,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                    Șterge
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>
    );
  }

  function renderDoctorsCard() {
    if (!canManageStructure) return null;

    return (
      <View
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>
            Medici
          </Text>

          <Pressable
            onPress={openDoctorModal}
            style={{
              height: 38,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>+ Adaugă</Text>
          </Pressable>
        </View>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Pentru acești medici poți seta calendare separate.
        </Text>

        <View style={{ marginTop: 12, gap: 10 }}>
          {doctorRows.length === 0 ? (
            <Text style={{ color: COLORS.muted }}>
              Nu există încă medici adăugați.
            </Text>
          ) : (
            doctorRows.map((item) => (
              <View
                key={item.id}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 14,
                  padding: 12,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                  {item.title ? `${item.title} ` : ""}
                  {item.name}
                </Text>

                <Text style={{ marginTop: 4, color: COLORS.muted }}>
                  Specializare: {item.specialty_name || item.specialty_id}
                </Text>

                {item.phone ? (
                  <Text style={{ marginTop: 4, color: COLORS.muted }}>
                    Telefon: {item.phone}
                  </Text>
                ) : null}

                {item.email ? (
                  <Text style={{ marginTop: 4, color: COLORS.muted }}>
                    Email: {item.email}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => handleDeleteDoctor(item)}
                  disabled={structureBusy}
                  style={{
                    marginTop: 10,
                    height: 40,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                    Șterge
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>
    );
  }

  function renderAvailabilityCard() {
    if (!canManageAvailability) return null;

    return (
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
          Calendar medic / program
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Aici poți gestiona programul săptămânal, durata sloturilor și zilele
          de excepție.
        </Text>

        {canManageStructure ? (
          <>
            <Text style={{ marginTop: 12, color: COLORS.muted }}>
              Calendar selectat:
            </Text>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <Pressable
                onPress={() => setSelectedCalendarDoctorId(null)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor:
                    selectedCalendarDoctorId === null ? "#EEF4FF" : "#fff",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Calendar clinică
                </Text>
              </Pressable>

              {doctorRows.map((doctor) => {
                const active = selectedCalendarDoctorId === doctor.id;
                return (
                  <Pressable
                    key={doctor.id}
                    onPress={() => setSelectedCalendarDoctorId(doctor.id)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: active ? "#EEF4FF" : "#fff",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: COLORS.text }}>
                      {doctorLabel(doctor)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={{ marginTop: 12, color: COLORS.muted }}>
          Vizualizare activă: {activeCalendarLabel}
        </Text>

        {roleCtx?.isDoctor && !canManageStructure && ownDoctorId === null ? (
          <Text style={{ marginTop: 8, color: COLORS.warning }}>
            Nu am găsit încă ID-ul profilului tău de medic. Dacă salvarea
            programului nu funcționează, trebuie verificat RoleContext /
            provider_doctor_id.
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={() => setAvailabilityModalOpen(true)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              + Interval săptămânal
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setExceptionModalOpen(true)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "900" }}>
              + Zi de excepție
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text }}>
            Program săptămânal
          </Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {weeklyRows.length === 0 ? (
              <Text style={{ color: COLORS.muted }}>
                Nu există program săptămânal setat pentru această vizualizare.
              </Text>
            ) : (
              weeklyRows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: "#fff",
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                    {WEEKDAYS.find((day) => day.value === row.weekday)?.label ??
                      "-"}
                  </Text>

                  <Text style={{ marginTop: 4, color: COLORS.muted }}>
                    {formatTime(row.start_time)} - {formatTime(row.end_time)}
                    {" • slot "}
                    {row.slot_duration_minutes ?? 30}
                    {" min"}
                  </Text>

                  <Pressable
                    onPress={() => handleDeleteWeeklyAvailability(row)}
                    disabled={structureBusy}
                    style={{
                      marginTop: 10,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                      opacity: structureBusy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                      Șterge
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text }}>
            Zile de excepție
          </Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {exceptionRows.length === 0 ? (
              <Text style={{ color: COLORS.muted }}>
                Nu există zile de excepție pentru această vizualizare.
              </Text>
            ) : (
              exceptionRows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    borderRadius: 14,
                    padding: 12,
                    backgroundColor: "#fff",
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                    {row.date}
                  </Text>

                  <Text style={{ marginTop: 4, color: COLORS.muted }}>
                    {row.is_closed
                      ? "Închis"
                      : `${formatTime(row.start_time)} - ${formatTime(
                          row.end_time,
                        )}`}
                  </Text>

                  {row.note ? (
                    <Text style={{ marginTop: 4, color: COLORS.muted }}>
                      Notă: {row.note}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={() => handleDeleteException(row)}
                    disabled={structureBusy}
                    style={{
                      marginTop: 10,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                      opacity: structureBusy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                      Șterge
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    );
  }

  function renderSpecialtyModal() {
    return (
      <Modal
        visible={specialtyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecialtyModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
            >
              Specializare nouă
            </Text>

            <FieldLabel required>Nume</FieldLabel>
            <TextInput
              value={newSpecialtyName}
              onChangeText={setNewSpecialtyName}
              placeholder="Ex.: cardiologie"
              editable={!structureBusy}
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

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setSpecialtyModalOpen(false)}
                disabled={structureBusy}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  opacity: structureBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Renunță
                </Text>
              </Pressable>

              <Pressable
                onPress={handleAddSpecialty}
                disabled={structureBusy}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: structureBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {structureBusy ? "..." : "Salvează"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderDoctorModal() {
    return (
      <Modal
        visible={doctorModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDoctorModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
              >
                Medic nou
              </Text>

              <FieldLabel required>Specializare</FieldLabel>
              <View style={{ gap: 8 }}>
                {specialtyRows.map((item) => {
                  const active = selectedSpecialtyId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSelectedSpecialtyId(item.id)}
                      style={{
                        minHeight: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        backgroundColor: active ? "#EEF4FF" : "#fff",
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.text,
                          fontWeight: active ? "900" : "700",
                        }}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <FieldLabel required>Nume</FieldLabel>
              <TextInput
                value={doctorName}
                onChangeText={setDoctorName}
                editable={!structureBusy}
                placeholder="Ex.: Popescu Andrei"
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

              <FieldLabel>Titlu</FieldLabel>
              <TextInput
                value={doctorTitle}
                onChangeText={setDoctorTitle}
                editable={!structureBusy}
                placeholder="Ex.: Dr."
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

              <FieldLabel>Număr licență</FieldLabel>
              <TextInput
                value={doctorLicenseNumber}
                onChangeText={setDoctorLicenseNumber}
                editable={!structureBusy}
                placeholder="Ex.: RO-12345"
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
                value={doctorPhone}
                onChangeText={setDoctorPhone}
                editable={!structureBusy}
                placeholder="+40..."
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

              <FieldLabel>Email</FieldLabel>
              <TextInput
                value={doctorEmail}
                onChangeText={setDoctorEmail}
                editable={!structureBusy}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="doctor@exemplu.ro"
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

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => setDoctorModalOpen(false)}
                  disabled={structureBusy}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: "#fff",
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Renunță
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleAddDoctor}
                  disabled={structureBusy}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: COLORS.primary,
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#fff" }}>
                    {structureBusy ? "..." : "Salvează"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  function renderAvailabilityModal() {
    return (
      <Modal
        visible={availabilityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvailabilityModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
            >
              Program săptămânal
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Calendar: {activeCalendarLabel}
            </Text>

            <FieldLabel required>Zi</FieldLabel>
            <View style={{ gap: 8 }}>
              {WEEKDAYS.map((day) => {
                const active = selectedWeekday === day.value;
                return (
                  <Pressable
                    key={day.value}
                    onPress={() => setSelectedWeekday(day.value)}
                    style={{
                      minHeight: 44,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: active ? "#EEF4FF" : "#fff",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.text,
                        fontWeight: active ? "900" : "700",
                      }}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <FieldLabel required>Început (HH:MM)</FieldLabel>
            <TextInput
              value={availabilityStart}
              onChangeText={setAvailabilityStart}
              placeholder="08:00"
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

            <FieldLabel required>Final (HH:MM)</FieldLabel>
            <TextInput
              value={availabilityEnd}
              onChangeText={setAvailabilityEnd}
              placeholder="16:00"
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

            <FieldLabel required>Durată slot</FieldLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SLOT_DURATION_OPTIONS.map((minutes) => {
                const active = slotDurationMinutes === minutes;

                return (
                  <Pressable
                    key={minutes}
                    onPress={() => setSlotDurationMinutes(minutes)}
                    style={{
                      minHeight: 42,
                      minWidth: 72,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? COLORS.primary : COLORS.border,
                      backgroundColor: active ? "#EEF4FF" : "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.text,
                        fontWeight: active ? "900" : "700",
                      }}
                    >
                      {minutes} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setAvailabilityModalOpen(false)}
                disabled={structureBusy}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                  opacity: structureBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Renunță
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSaveWeeklyAvailability}
                disabled={structureBusy}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.primary,
                  opacity: structureBusy ? 0.6 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  {structureBusy ? "..." : "Salvează"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderExceptionModal() {
    return (
      <Modal
        visible={exceptionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExceptionModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
              >
                Zi de excepție
              </Text>

              <Text style={{ marginTop: 6, color: COLORS.muted }}>
                Calendar: {activeCalendarLabel}
              </Text>

              <FieldLabel required>Data (YYYY-MM-DD)</FieldLabel>
              <TextInput
                value={exceptionDate}
                onChangeText={(value) =>
                  setExceptionDate(normalizeDateInput(value))
                }
                placeholder="2026-03-15"
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

              <FieldLabel>Zi închisă sau override deschis</FieldLabel>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setExceptionClosed(true)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: exceptionClosed ? "#EEF4FF" : "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Închis
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setExceptionClosed(false)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: !exceptionClosed ? "#EEF4FF" : "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Override deschis
                  </Text>
                </Pressable>
              </View>

              {!exceptionClosed ? (
                <>
                  <FieldLabel required>Început (HH:MM)</FieldLabel>
                  <TextInput
                    value={exceptionStart}
                    onChangeText={setExceptionStart}
                    placeholder="08:00"
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

                  <FieldLabel required>Final (HH:MM)</FieldLabel>
                  <TextInput
                    value={exceptionEnd}
                    onChangeText={setExceptionEnd}
                    placeholder="16:00"
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

              <FieldLabel>Notă</FieldLabel>
              <TextInput
                value={exceptionNote}
                onChangeText={setExceptionNote}
                placeholder="Ex.: concediu, conferință, program redus"
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

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => setExceptionModalOpen(false)}
                  disabled={structureBusy}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: "#fff",
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Renunță
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveException}
                  disabled={structureBusy}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: COLORS.primary,
                    opacity: structureBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#fff" }}>
                    {structureBusy ? "..." : "Salvează"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  if (roleBusy) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: COLORS.muted }}>
            Se încarcă profilul…
          </Text>
        </View>
      </View>
    );
  }

  if (!canAccessProfileScreen) {
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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}>
            Profil utilizator
          </Text>

          <Pressable
            onPress={load}
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
            <Text style={{ fontWeight: "900", color: COLORS.text }}>
              Reîmprospătare
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {renderUserRoleCard()}
          {renderOrganizationalAccessCard()}
          {renderAccountActions()}
        </ScrollView>
      </View>
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
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}>
          {canManageClinicProfile ? "Profil clinică" : "Profil medic"}
        </Text>

        <Pressable
          onPress={load}
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
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Reîmprospătare
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: COLORS.muted }}>
            Se încarcă…
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!canManageClinicProfile ? renderUserRoleCard() : null}
            {!canManageClinicProfile ? renderOrganizationalAccessCard() : null}

            {canManageClinicProfile && err && !provider ? (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                  Eroare
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.text }}>{err}</Text>
              </View>
            ) : null}

            {canManageClinicProfile && !provider && !err ? (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                  Nu există clinică asociată
                </Text>
                <Text style={{ marginTop: 6, color: COLORS.muted }}>
                  Acest cont nu este conectat la o clinică administrabilă.
                </Text>
              </View>
            ) : null}

            {renderClinicProfileCard()}
            {renderSpecialtiesCard()}
            {renderDoctorsCard()}
            {renderAvailabilityCard()}
            {renderAccountActions()}
          </ScrollView>

          {canManageStructure ? renderSpecialtyModal() : null}
          {canManageStructure ? renderDoctorModal() : null}
          {canManageAvailability ? renderAvailabilityModal() : null}
          {canManageAvailability ? renderExceptionModal() : null}
        </>
      )}
    </View>
  );
}
