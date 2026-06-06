// Path: medicalend-mobile/app/(patient)/(tabs)/search.tsx

import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  searchClinics,
  searchDoctors,
  searchHomeCare,
  type DoctorSearchResult,
  type ProviderOut,
} from "../../../_lib/provider";
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

type SearchMode = "clinics" | "doctors" | "homecare";

const SPECIALTY_OPTIONS = [
  "Alergologie",
  "Anestezie și terapie intensivă",
  "Cardiologie",
  "Chirurgie generală",
  "Chirurgie pediatrică",
  "Chirurgie plastică",
  "Dermatologie",
  "Diabet și boli de nutriție",
  "Endocrinologie",
  "Gastroenterologie",
  "Geriatrie",
  "Ginecologie",
  "Hematologie",
  "Kinetoterapie",
  "Medicină de familie",
  "Medicină generală",
  "Medicină internă",
  "Medicina muncii",
  "Nefrologie",
  "Neurologie",
  "Neurologie pediatrică",
  "Obstetrică-ginecologie",
  "Oftalmologie",
  "Oncologie",
  "ORL",
  "Ortopedie",
  "Ortopedie pediatrică",
  "Pediatrie",
  "Pneumologie",
  "Psihiatrie",
  "Psihiatrie pediatrică",
  "Psihologie",
  "Psihologie pediatrică",
  "Recuperare medicală",
  "Reumatologie",
  "Stomatologie",
  "Urologie",
] as const;

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <Text style={{ marginTop: 4, color: COLORS.muted }}>
      {label}: {value}
    </Text>
  );
}

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeTimeInput(value: string) {
  const raw = value.trim().replace(".", ":");

  if (!raw) return "";

  if (/^\d{1,2}$/.test(raw)) {
    const h = Number(raw);
    if (h < 0 || h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }

  if (/^\d{1,2}:\d{1,2}$/.test(raw)) {
    const [hRaw, mRaw] = raw.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);

    if (h < 0 || h > 23 || m < 0 || m > 59) return null;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return null;
}

function doctorMatchesSpecialty(
  item: DoctorSearchResult,
  specialtyValue: string,
) {
  const query = normalizeText(specialtyValue);
  if (!query) return true;
  return normalizeText(item.specialty_name).includes(query);
}

function providerDisplayName(p: ProviderOut) {
  if (p.name?.trim()) return p.name.trim();
  if (p.provider_type === "clinic") return "Clinică medicală";
  if (p.provider_type === "home_care") {
    return "Serviciu de îngrijire la domiciliu";
  }
  return "Clinică / specialist";
}

function providerSubtitle(p: ProviderOut) {
  if (p.provider_type === "home_care") {
    return (
      p.services_offered?.trim() ||
      p.specialty?.trim() ||
      "Îngrijire la domiciliu"
    );
  }

  return p.specialty?.trim() || p.services_offered?.trim() || "Clinică";
}

function doctorDisplayName(item: DoctorSearchResult) {
  return `${item.doctor_title ? `${item.doctor_title} ` : ""}${
    item.doctor_name
  }`.trim();
}

function formatAvailability(
  hasRequestedSlot?: boolean | null,
  availableDate?: string,
  availableTime?: string,
) {
  if (!availableDate || !availableTime) return null;

  if (hasRequestedSlot === true) {
    return `Disponibil la ${availableDate}, ${availableTime}`;
  }

  if (hasRequestedSlot === false) {
    return "Indisponibil la ora selectată";
  }

  return null;
}

function formatEarliestAvailable(iso?: string | null) {
  if (!iso) return null;

  const raw = String(iso).replace(/(Z|[+-]\d{2}:\d{2})$/, "");
  const [datePart, timePart = ""] = raw.split("T");
  const [hh = "", mm = ""] = timePart.split(":");

  if (!datePart || !hh || !mm) return null;

  return `${datePart}, ${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ width: "100%" }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
        {title}
      </Text>
      <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: 96,
        minWidth: 96,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? COLORS.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
        paddingHorizontal: 10,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: active ? "#fff" : COLORS.text,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SearchInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.muted}
      keyboardType={keyboardType ?? "default"}
      style={{
        width: "100%",
        minWidth: 0,
        height: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        backgroundColor: "#fff",
        color: COLORS.text,
      }}
    />
  );
}

function ResponsivePair({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

function ResponsiveField({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 0 }}>{children}</View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        width: "100%",
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

function SpecialtyPicker({
  value,
  onChangeText,
  open,
  setOpen,
  items,
}: {
  value: string;
  onChangeText: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  items: readonly string[];
}) {
  const filtered = useMemo(() => {
    const q = normalizeText(value);
    if (!q) return [...items];

    return items.filter((item) => normalizeText(item).includes(q));
  }, [items, value]);

  return (
    <View style={{ width: "100%", minWidth: 0 }}>
      <TextInput
        value={value}
        onChangeText={(next) => {
          onChangeText(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Specialitate"
        placeholderTextColor={COLORS.muted}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingHorizontal: 12,
          backgroundColor: "#fff",
          color: COLORS.text,
        }}
      />

      {open ? (
        <View
          style={{
            marginTop: 8,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            maxHeight: 220,
            overflow: "hidden",
          }}
        >
          <ScrollView nestedScrollEnabled>
            {filtered.length === 0 ? (
              <Text style={{ padding: 12, color: COLORS.muted }}>
                Nu există potriviri.
              </Text>
            ) : (
              filtered.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    onChangeText(item);
                    setOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "700" }}>
                    {item}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function ProviderCard({ p, onPress }: { p: ProviderOut; onPress: () => void }) {
  const typeLabel =
    p.provider_type === "home_care"
      ? "Îngrijire la domiciliu"
      : p.provider_type === "clinic"
        ? "Clinică"
        : "Clinică / specialist";

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "100%",
        backgroundColor: COLORS.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
      }}
    >
      {p.image_url?.trim() ? (
        <Image
          source={{ uri: p.image_url }}
          style={{ width: "100%", height: 170, backgroundColor: "#E2E8F0" }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 124,
            backgroundColor: COLORS.softBlue,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            {typeLabel}
          </Text>
        </View>
      )}

      <View style={{ padding: 16 }}>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: COLORS.softBlue,
          }}
        >
          <Text
            style={{ color: COLORS.primary, fontWeight: "900", fontSize: 12 }}
          >
            {typeLabel}
          </Text>
        </View>

        <Text
          style={{
            marginTop: 12,
            fontSize: 17,
            fontWeight: "900",
            color: COLORS.text,
          }}
        >
          {providerDisplayName(p)}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.text, fontWeight: "700" }}>
          {providerSubtitle(p)}
        </Text>

        <Row label="Oraș" value={p.city ?? null} />
        <Row label="Județ" value={p.county ?? null} />
        {p.provider_type === "home_care" ? (
          <Row label="Zonă acoperită" value={p.coverage_area ?? null} />
        ) : null}
        <Row label="Telefon" value={p.phone ?? null} />

        {p.public_description ? (
          <Text style={{ marginTop: 10, color: COLORS.muted, lineHeight: 21 }}>
            {p.public_description}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 14,
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}
          >
            Vezi profilul și programările
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DoctorCard({
  item,
  availableDate,
  availableTime,
}: {
  item: DoctorSearchResult;
  availableDate?: string;
  availableTime?: string;
}) {
  const availabilityText = formatAvailability(
    item.has_requested_slot,
    availableDate,
    availableTime,
  );

  const earliestText = formatEarliestAvailable(item.earliest_available_at);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(patient)/provider/[id]",
          params: {
            id: String(item.provider_id),
            doctorId: String(item.doctor_id),
          },
        })
      }
      style={{
        width: "100%",
        backgroundColor: COLORS.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
      }}
    >
      {item.provider_image_url?.trim() ? (
        <Image
          source={{ uri: item.provider_image_url }}
          style={{ width: "100%", height: 160, backgroundColor: "#E2E8F0" }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 120,
            backgroundColor: COLORS.softBlue,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
            Medic
          </Text>
        </View>
      )}

      <View style={{ padding: 16 }}>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: COLORS.softBlue,
          }}
        >
          <Text
            style={{ color: COLORS.primary, fontWeight: "900", fontSize: 12 }}
          >
            MEDIC
          </Text>
        </View>

        <Text
          style={{
            marginTop: 12,
            fontSize: 17,
            fontWeight: "900",
            color: COLORS.text,
          }}
        >
          {doctorDisplayName(item)}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.text, fontWeight: "700" }}>
          {item.specialty_name || "Specialitate"}
        </Text>

        <Text style={{ marginTop: 8, color: COLORS.muted }}>
          Clinica: {item.provider_name}
        </Text>

        <Row label="Oraș" value={item.city ?? null} />
        <Row label="Județ" value={item.county ?? null} />

        {item.provider_public_description ? (
          <Text style={{ marginTop: 10, color: COLORS.muted, lineHeight: 21 }}>
            {item.provider_public_description}
          </Text>
        ) : null}

        {availabilityText ? (
          <Text
            style={{
              marginTop: 10,
              color:
                item.has_requested_slot === false
                  ? COLORS.error
                  : COLORS.success,
              fontWeight: "900",
            }}
          >
            {availabilityText}
          </Text>
        ) : null}

        {earliestText ? (
          <Text
            style={{
              marginTop: 8,
              color: COLORS.primary,
              fontWeight: "900",
            }}
          >
            Primul loc disponibil: {earliestText}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 14,
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{ color: "#fff", fontWeight: "900", textAlign: "center" }}
          >
            Vezi clinica și rezervă
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function PatientSearch() {
  const [mode, setMode] = useState<SearchMode>("clinics");

  const [clinicName, setClinicName] = useState("");
  const [clinicSpecialty, setClinicSpecialty] = useState("");
  const [clinicCity, setClinicCity] = useState("");
  const [clinicCounty, setClinicCounty] = useState("");
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false);

  const [clinicBusy, setClinicBusy] = useState(false);
  const [clinicErr, setClinicErr] = useState<string | null>(null);
  const [clinicItems, setClinicItems] = useState<ProviderOut[]>([]);

  const [doctorName, setDoctorName] = useState("");
  const [doctorSpecialty, setDoctorSpecialty] = useState("");
  const [doctorClinicName, setDoctorClinicName] = useState("");
  const [doctorCity, setDoctorCity] = useState("");
  const [doctorCounty, setDoctorCounty] = useState("");
  const [doctorDate, setDoctorDate] = useState(todayYmd());
  const [doctorTime, setDoctorTime] = useState("");
  const [doctorSpecialtyDropdownOpen, setDoctorSpecialtyDropdownOpen] =
    useState(false);

  const [doctorBusy, setDoctorBusy] = useState(false);
  const [doctorErr, setDoctorErr] = useState<string | null>(null);
  const [doctorItems, setDoctorItems] = useState<DoctorSearchResult[]>([]);

  const [hcName, setHcName] = useState("");
  const [hcService, setHcService] = useState("");
  const [hcCity, setHcCity] = useState("");
  const [hcCounty, setHcCounty] = useState("");
  const [hcCoverageArea, setHcCoverageArea] = useState("");
  const [hcDate, setHcDate] = useState(todayYmd());
  const [hcTime, setHcTime] = useState("");

  const [hcBusy, setHcBusy] = useState(false);
  const [hcErr, setHcErr] = useState<string | null>(null);
  const [hcItems, setHcItems] = useState<ProviderOut[]>([]);

  const normalizedDoctorTime = useMemo(() => {
    return normalizeTimeInput(doctorTime);
  }, [doctorTime]);

  const normalizedHomeCareTime = useMemo(() => {
    return normalizeTimeInput(hcTime);
  }, [hcTime]);

  const canSearchClinics = useMemo(() => {
    return (
      clinicName.trim().length >= 2 ||
      clinicSpecialty.trim().length >= 2 ||
      clinicCity.trim().length >= 2 ||
      clinicCounty.trim().length >= 2
    );
  }, [clinicName, clinicSpecialty, clinicCity, clinicCounty]);

  const hasValidDoctorTime = useMemo(() => {
    if (!doctorTime.trim()) return true;
    return normalizedDoctorTime !== null;
  }, [doctorTime, normalizedDoctorTime]);

  const canSearchDoctors = useMemo(() => {
    return (
      doctorName.trim().length >= 2 ||
      doctorSpecialty.trim().length >= 2 ||
      doctorClinicName.trim().length >= 2 ||
      doctorCity.trim().length >= 2 ||
      doctorCounty.trim().length >= 2 ||
      (!!doctorDate && !!doctorTime.trim() && hasValidDoctorTime)
    );
  }, [
    doctorName,
    doctorSpecialty,
    doctorClinicName,
    doctorCity,
    doctorCounty,
    doctorDate,
    doctorTime,
    hasValidDoctorTime,
  ]);

  const hasValidHomeCareTime = useMemo(() => {
    if (!hcTime.trim()) return true;
    return normalizedHomeCareTime !== null;
  }, [hcTime, normalizedHomeCareTime]);

  const canSearchHomeCare = useMemo(() => {
    return (
      hcName.trim().length >= 2 ||
      hcService.trim().length >= 2 ||
      hcCity.trim().length >= 2 ||
      hcCounty.trim().length >= 2 ||
      hcCoverageArea.trim().length >= 2 ||
      (!!hcDate && !!hcTime.trim() && hasValidHomeCareTime)
    );
  }, [
    hcName,
    hcService,
    hcCity,
    hcCounty,
    hcCoverageArea,
    hcDate,
    hcTime,
    hasValidHomeCareTime,
  ]);

  function openProvider(id: number) {
    router.push({
      pathname: "/(patient)/provider/[id]",
      params: { id: String(id) },
    });
  }

  async function runClinicSearch() {
    setClinicErr(null);
    setClinicBusy(true);
    setSpecialtyDropdownOpen(false);

    try {
      const res = await searchClinics({
        name: clinicName.trim() || undefined,
        specialty: clinicSpecialty.trim() || undefined,
        city: clinicCity.trim() || undefined,
        county: clinicCounty.trim() || undefined,
        limit: 50,
      });

      setClinicItems(res ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Căutarea clinicilor a eșuat.";

      setClinicErr(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setClinicBusy(false);
    }
  }

  async function runDoctorSearch() {
    setDoctorErr(null);

    if (doctorTime.trim() && !hasValidDoctorTime) {
      setDoctorErr("Ora poate fi scrisă simplu: 8, 8:00, 08:00 sau 8.30.");
      return;
    }

    setDoctorBusy(true);
    setDoctorSpecialtyDropdownOpen(false);

    try {
      const res = await searchDoctors({
        doctor_name: doctorName.trim() || undefined,
        specialty: doctorSpecialty.trim() || undefined,
        provider_name: doctorClinicName.trim() || undefined,
        city: doctorCity.trim() || undefined,
        county: doctorCounty.trim() || undefined,
        available_date: doctorTime.trim() ? doctorDate : undefined,
        available_time: doctorTime.trim()
          ? normalizedDoctorTime || undefined
          : undefined,
        limit: 50,
      });

      const filtered = (res ?? []).filter((item) =>
        doctorMatchesSpecialty(item, doctorSpecialty),
      );

      setDoctorItems(filtered);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Căutarea medicilor a eșuat.";

      setDoctorErr(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setDoctorBusy(false);
    }
  }

  async function runHomeCareSearch() {
    setHcErr(null);

    if (hcTime.trim() && !hasValidHomeCareTime) {
      setHcErr("Ora poate fi scrisă simplu: 8, 8:00, 08:00 sau 8.30.");
      return;
    }

    setHcBusy(true);

    try {
      const res = await searchHomeCare({
        name: hcName.trim() || undefined,
        service: hcService.trim() || undefined,
        city: hcCity.trim() || undefined,
        county: hcCounty.trim() || undefined,
        coverage_area: hcCoverageArea.trim() || undefined,
        available_date: hcTime.trim() ? hcDate : undefined,
        available_time: hcTime.trim()
          ? normalizedHomeCareTime || undefined
          : undefined,
        limit: 50,
      });

      setHcItems(res ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Căutarea serviciilor de îngrijire la domiciliu a eșuat.";

      setHcErr(typeof detail === "string" ? detail : JSON.stringify(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setHcBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      horizontal={false}
    >
      <View
        style={{
          width: "100%",
          backgroundColor: COLORS.primaryDark,
          borderRadius: 28,
          padding: 20,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -30,
            top: -10,
            width: 170,
            height: 170,
            borderRadius: 999,
            backgroundColor: "rgba(79,179,232,0.18)",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: -40,
            bottom: -50,
            width: 190,
            height: 190,
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
            CĂUTARE
          </Text>

          <Text
            style={{
              marginTop: 8,
              color: "#fff",
              fontSize: 28,
              lineHeight: 34,
              fontWeight: "900",
            }}
          >
            Găsește rapid{"\n"}ce ai nevoie.
          </Text>

          <Text
            style={{
              marginTop: 12,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 21,
              maxWidth: "100%",
            }}
          >
            Caută clinici, medici sau servicii de îngrijire la domiciliu și
            mergi direct spre rezervare.
          </Text>
        </View>
      </View>

      <View
        style={{
          width: "100%",
          backgroundColor: COLORS.card,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <ModeChip
            active={mode === "clinics"}
            label="Clinici"
            onPress={() => setMode("clinics")}
          />
          <ModeChip
            active={mode === "doctors"}
            label="Medici"
            onPress={() => setMode("doctors")}
          />
          <ModeChip
            active={mode === "homecare"}
            label="Domiciliu"
            onPress={() => setMode("homecare")}
          />
        </View>

        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          {mode === "clinics"
            ? "Caută după nume, specialitate, oraș sau județ."
            : mode === "doctors"
              ? "Caută după nume, specialitate, clinică sau interval disponibil."
              : "Caută servicii la domiciliu după furnizor, tip de serviciu sau disponibilitate."}
        </Text>
      </View>

      {mode === "clinics" ? (
        <>
          <View
            style={{
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 10,
            }}
          >
            <SectionHeader
              title="Căutare clinici"
              subtitle="Completează unul sau mai multe câmpuri pentru rezultate mai precise."
            />

            <SearchInput
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="Numele clinicii"
            />

            <SpecialtyPicker
              value={clinicSpecialty}
              onChangeText={setClinicSpecialty}
              open={specialtyDropdownOpen}
              setOpen={setSpecialtyDropdownOpen}
              items={SPECIALTY_OPTIONS}
            />

            <ResponsivePair>
              <ResponsiveField>
                <SearchInput
                  value={clinicCity}
                  onChangeText={setClinicCity}
                  placeholder="Oraș"
                />
              </ResponsiveField>
              <ResponsiveField>
                <SearchInput
                  value={clinicCounty}
                  onChangeText={setClinicCounty}
                  placeholder="Județ"
                />
              </ResponsiveField>
            </ResponsivePair>

            <Pressable
              onPress={runClinicSearch}
              disabled={!canSearchClinics || clinicBusy}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
                opacity: !canSearchClinics || clinicBusy ? 0.6 : 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                {clinicBusy ? "Se caută..." : "Caută clinici"}
              </Text>
            </Pressable>

            {clinicErr ? (
              <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                {clinicErr}
              </Text>
            ) : null}
          </View>

          <SectionHeader
            title="Rezultate clinici"
            subtitle={
              clinicItems.length > 0
                ? `${clinicItems.length} rezultate găsite.`
                : "Aici apar clinicile găsite după căutare."
            }
          />

          {clinicBusy ? (
            <View
              style={{
                width: "100%",
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                Se încarcă rezultatele...
              </Text>
            </View>
          ) : clinicItems.length === 0 ? (
            <EmptyCard
              title="Nu există rezultate pentru clinici"
              subtitle="Încearcă alt nume, alt oraș sau o altă specialitate."
            />
          ) : (
            <View style={{ width: "100%", gap: 12 }}>
              {clinicItems.map((p) => (
                <ProviderCard
                  key={`clinic-${p.id}`}
                  p={p}
                  onPress={() => openProvider(p.id)}
                />
              ))}
            </View>
          )}
        </>
      ) : mode === "doctors" ? (
        <>
          <View
            style={{
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 10,
            }}
          >
            <SectionHeader
              title="Căutare medici"
              subtitle="Poți căuta după nume, specialitate, clinică sau după un interval exact."
            />

            <SearchInput
              value={doctorName}
              onChangeText={setDoctorName}
              placeholder="Nume medic"
            />

            <SpecialtyPicker
              value={doctorSpecialty}
              onChangeText={setDoctorSpecialty}
              open={doctorSpecialtyDropdownOpen}
              setOpen={setDoctorSpecialtyDropdownOpen}
              items={SPECIALTY_OPTIONS}
            />

            <SearchInput
              value={doctorClinicName}
              onChangeText={setDoctorClinicName}
              placeholder="Nume clinică"
            />

            <ResponsivePair>
              <ResponsiveField>
                <SearchInput
                  value={doctorCity}
                  onChangeText={setDoctorCity}
                  placeholder="Oraș"
                />
              </ResponsiveField>
              <ResponsiveField>
                <SearchInput
                  value={doctorCounty}
                  onChangeText={setDoctorCounty}
                  placeholder="Județ"
                />
              </ResponsiveField>
            </ResponsivePair>

            <ResponsivePair>
              <ResponsiveField>
                <SearchInput
                  value={doctorDate}
                  onChangeText={setDoctorDate}
                  placeholder="Dată (YYYY-MM-DD)"
                />
              </ResponsiveField>
              <ResponsiveField>
                <SearchInput
                  value={doctorTime}
                  onChangeText={setDoctorTime}
                  placeholder="Oră, ex: 8, 8:00"
                />
              </ResponsiveField>
            </ResponsivePair>

            <Pressable
              onPress={runDoctorSearch}
              disabled={!canSearchDoctors || doctorBusy}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
                opacity: !canSearchDoctors || doctorBusy ? 0.6 : 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                {doctorBusy ? "Se caută..." : "Caută medici"}
              </Text>
            </Pressable>

            {doctorErr ? (
              <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                {doctorErr}
              </Text>
            ) : null}
          </View>

          <SectionHeader
            title="Rezultate medici"
            subtitle={
              doctorItems.length > 0
                ? `${doctorItems.length} rezultate găsite.`
                : "Aici apar medicii găsiți după căutare."
            }
          />

          {doctorBusy ? (
            <View
              style={{
                width: "100%",
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                Se încarcă rezultatele...
              </Text>
            </View>
          ) : doctorItems.length === 0 ? (
            <EmptyCard
              title="Nu există rezultate pentru medici"
              subtitle="Încearcă alt nume, altă specialitate sau schimbă intervalul selectat."
            />
          ) : (
            <View style={{ width: "100%", gap: 12 }}>
              {doctorItems.map((item) => (
                <DoctorCard
                  key={`doctor-${item.doctor_id}-${item.provider_id}`}
                  item={item}
                  availableDate={doctorTime.trim() ? doctorDate : undefined}
                  availableTime={
                    doctorTime.trim()
                      ? normalizedDoctorTime || undefined
                      : undefined
                  }
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View
            style={{
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 10,
            }}
          >
            <SectionHeader
              title="Căutare servicii la domiciliu"
              subtitle="Caută furnizori pentru servicii la domiciliu și filtrează după disponibilitate."
            />

            <SearchInput
              value={hcName}
              onChangeText={setHcName}
              placeholder="Numele furnizorului"
            />

            <SearchInput
              value={hcService}
              onChangeText={setHcService}
              placeholder="Serviciu (ex.: injecție, perfuzie, pansament)"
            />

            <ResponsivePair>
              <ResponsiveField>
                <SearchInput
                  value={hcCity}
                  onChangeText={setHcCity}
                  placeholder="Oraș"
                />
              </ResponsiveField>
              <ResponsiveField>
                <SearchInput
                  value={hcCounty}
                  onChangeText={setHcCounty}
                  placeholder="Județ"
                />
              </ResponsiveField>
            </ResponsivePair>

            <SearchInput
              value={hcCoverageArea}
              onChangeText={setHcCoverageArea}
              placeholder="Zonă de acoperire / arie de activitate"
            />

            <ResponsivePair>
              <ResponsiveField>
                <SearchInput
                  value={hcDate}
                  onChangeText={setHcDate}
                  placeholder="Dată (YYYY-MM-DD)"
                />
              </ResponsiveField>
              <ResponsiveField>
                <SearchInput
                  value={hcTime}
                  onChangeText={setHcTime}
                  placeholder="Oră, ex: 8, 8:00"
                />
              </ResponsiveField>
            </ResponsivePair>

            <Pressable
              onPress={runHomeCareSearch}
              disabled={!canSearchHomeCare || hcBusy}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
                opacity: !canSearchHomeCare || hcBusy ? 0.6 : 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                {hcBusy ? "Se caută..." : "Caută servicii"}
              </Text>
            </Pressable>

            {hcErr ? (
              <Text style={{ color: COLORS.error, fontWeight: "900" }}>
                {hcErr}
              </Text>
            ) : null}
          </View>

          <SectionHeader
            title="Rezultate servicii la domiciliu"
            subtitle={
              hcItems.length > 0
                ? `${hcItems.length} rezultate găsite.`
                : "Aici apar furnizorii găsiți după căutare."
            }
          />

          {hcBusy ? (
            <View
              style={{
                width: "100%",
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={{ marginTop: 12, color: COLORS.muted }}>
                Se încarcă rezultatele...
              </Text>
            </View>
          ) : hcItems.length === 0 ? (
            <EmptyCard
              title="Nu există rezultate pentru servicii la domiciliu"
              subtitle="Încearcă alt serviciu, alt oraș sau schimbă intervalul selectat."
            />
          ) : (
            <View style={{ width: "100%", gap: 12 }}>
              {hcItems.map((p) => (
                <ProviderCard
                  key={`hc-${p.id}`}
                  p={p}
                  onPress={() => openProvider(p.id)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
