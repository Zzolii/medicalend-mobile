// Path: medicalend-mobile/_lib/provider.ts

import { Alert } from "react-native";

import { api } from "./api";

export type ProviderStatus = "pending" | "approved" | "rejected";
export type ProviderType = "clinic" | "home_care";

export type ProviderMe = {
  id: number;
  user_id: number;
  clinic_id?: number | null;

  status: ProviderStatus;
  rejection_reason?: string | null;
  provider_type?: ProviderType | null;

  name: string;
  website?: string | null;
  image_url?: string | null;
  public_description?: string | null;

  specialty?: string | null;
  services_offered?: string | null;
  license_number?: string | null;

  cui?: string | null;
  trade_register_number?: string | null;

  contact_person_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  phone?: string | null;
  email?: string | null;
  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  postal_code?: string | null;
  country?: string | null;
  coverage_area?: string | null;

  sanitary_authorization_number?: string | null;
  sanitary_authorization_expires_at?: string | null;

  healthcare_compliance_confirmed?: boolean | null;
  provider_agreement_accepted?: boolean | null;

  is_active?: boolean | null;
  fhir_id?: string | null;

  created_at?: string;
};

export type ProviderOut = {
  id: number;
  user_id?: number | null;
  clinic_id?: number | null;

  status?: ProviderStatus | null;
  rejection_reason?: string | null;
  provider_type?: ProviderType | null;

  name?: string | null;
  website?: string | null;
  image_url?: string | null;
  public_description?: string | null;

  specialty?: string | null;
  services_offered?: string | null;
  license_number?: string | null;

  cui?: string | null;
  trade_register_number?: string | null;

  contact_person_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  city?: string | null;
  county?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  country?: string | null;
  coverage_area?: string | null;

  sanitary_authorization_number?: string | null;
  sanitary_authorization_expires_at?: string | null;

  healthcare_compliance_confirmed?: boolean | null;
  provider_agreement_accepted?: boolean | null;

  is_active?: boolean | null;
  fhir_id?: string | null;

  created_at?: string;
};

export type ProviderDoctorPublicOut = {
  id: number;
  provider_id: number;
  specialty_id: number;
  name: string;
  title?: string | null;
  license_number?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  specialty_name?: string | null;
};

export type DoctorSearchResult = {
  doctor_id: number;
  doctor_name: string;
  doctor_title?: string | null;

  specialty_id?: number | null;
  specialty_name?: string | null;

  provider_id: number;
  provider_name: string;
  provider_type?: ProviderType | null;
  provider_image_url?: string | null;
  provider_website?: string | null;
  provider_public_description?: string | null;

  city?: string | null;
  county?: string | null;
  address_line?: string | null;
  phone?: string | null;
  email?: string | null;

  has_requested_slot?: boolean | null;
  earliest_available_at?: string | null;
};

export type ProviderSearchParams = {
  provider_type?: ProviderType;
  name?: string;
  specialty?: string;
  service?: string;
  city?: string;
  county?: string;
  coverage_area?: string;
  available_date?: string;
  available_time?: string;
  doctor_id?: number;
  status?: ProviderStatus;
  skip?: number;
  limit?: number;
};

export type DoctorSearchParams = {
  doctor_name?: string;
  specialty?: string;
  provider_name?: string;
  city?: string;
  county?: string;
  available_date?: string;
  available_time?: string;
  limit?: number;
};

export type ProviderUpdatePayload = {
  name?: string;
  provider_type?: ProviderType | null;

  website?: string | null;
  image_url?: string | null;
  public_description?: string | null;

  specialty?: string | null;
  services_offered?: string | null;
  license_number?: string | null;

  cui?: string | null;
  trade_register_number?: string | null;

  contact_person_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  phone?: string | null;
  email?: string | null;
  address_line?: string | null;
  city?: string | null;
  county?: string | null;
  postal_code?: string | null;
  country?: string | null;
  coverage_area?: string | null;

  sanitary_authorization_number?: string | null;
  sanitary_authorization_expires_at?: string | null;

  healthcare_compliance_confirmed?: boolean | null;
  provider_agreement_accepted?: boolean | null;
};

function cleanParam(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function doctorMatchesSearch(
  item: DoctorSearchResult,
  params: DoctorSearchParams,
) {
  const specialty = normalizeText(params.specialty);
  const doctorName = normalizeText(params.doctor_name);
  const providerName = normalizeText(params.provider_name);
  const city = normalizeText(params.city);
  const county = normalizeText(params.county);

  if (specialty && !normalizeText(item.specialty_name).includes(specialty)) {
    return false;
  }

  if (doctorName && !normalizeText(item.doctor_name).includes(doctorName)) {
    return false;
  }

  if (
    providerName &&
    !normalizeText(item.provider_name).includes(providerName)
  ) {
    return false;
  }

  if (city && !normalizeText(item.city).includes(city)) {
    return false;
  }

  if (county && !normalizeText(item.county).includes(county)) {
    return false;
  }

  return true;
}

function normalizeProvider(raw: any): ProviderMe {
  try {
    console.log("[PROVIDER] raw response:", raw);
  } catch {}

  const id = Number(
    raw?.id ?? raw?.provider_id ?? raw?.provider?.id ?? raw?.data?.id,
  );

  if (!Number.isFinite(id) || id <= 0) {
    const msg =
      "Provider profile response missing id/provider_id.\n\n" +
      "RAW:\n" +
      JSON.stringify(raw, null, 2);

    Alert.alert("DEBUG /providers/me", msg.slice(0, 1500));
    throw new Error("Provider profile response missing id/provider_id");
  }

  return {
    id,
    user_id: Number(raw?.user_id ?? raw?.provider?.user_id ?? 0),
    clinic_id: raw?.clinic_id ?? raw?.provider?.clinic_id ?? null,

    status: raw?.status ?? raw?.provider?.status ?? "pending",
    rejection_reason:
      raw?.rejection_reason ?? raw?.provider?.rejection_reason ?? null,
    provider_type:
      raw?.provider_type ?? raw?.provider?.provider_type ?? "clinic",

    name: raw?.name ?? raw?.provider?.name ?? "Provider",
    website: raw?.website ?? raw?.provider?.website ?? null,
    image_url: raw?.image_url ?? raw?.provider?.image_url ?? null,
    public_description:
      raw?.public_description ?? raw?.provider?.public_description ?? null,

    specialty: raw?.specialty ?? raw?.provider?.specialty ?? null,
    services_offered:
      raw?.services_offered ?? raw?.provider?.services_offered ?? null,
    license_number:
      raw?.license_number ?? raw?.provider?.license_number ?? null,

    cui: raw?.cui ?? raw?.provider?.cui ?? null,
    trade_register_number:
      raw?.trade_register_number ??
      raw?.provider?.trade_register_number ??
      null,

    contact_person_name:
      raw?.contact_person_name ?? raw?.provider?.contact_person_name ?? null,
    contact_email: raw?.contact_email ?? raw?.provider?.contact_email ?? null,
    contact_phone: raw?.contact_phone ?? raw?.provider?.contact_phone ?? null,

    phone: raw?.phone ?? raw?.provider?.phone ?? null,
    email: raw?.email ?? raw?.provider?.email ?? null,
    address_line: raw?.address_line ?? raw?.provider?.address_line ?? null,
    city: raw?.city ?? raw?.provider?.city ?? null,
    county: raw?.county ?? raw?.provider?.county ?? null,
    postal_code: raw?.postal_code ?? raw?.provider?.postal_code ?? null,
    country: raw?.country ?? raw?.provider?.country ?? "RO",
    coverage_area: raw?.coverage_area ?? raw?.provider?.coverage_area ?? null,

    sanitary_authorization_number:
      raw?.sanitary_authorization_number ??
      raw?.provider?.sanitary_authorization_number ??
      null,
    sanitary_authorization_expires_at:
      raw?.sanitary_authorization_expires_at ??
      raw?.provider?.sanitary_authorization_expires_at ??
      null,

    healthcare_compliance_confirmed:
      raw?.healthcare_compliance_confirmed ??
      raw?.provider?.healthcare_compliance_confirmed ??
      false,
    provider_agreement_accepted:
      raw?.provider_agreement_accepted ??
      raw?.provider?.provider_agreement_accepted ??
      false,

    is_active: raw?.is_active ?? raw?.provider?.is_active ?? true,
    fhir_id: raw?.fhir_id ?? raw?.provider?.fhir_id ?? null,
    created_at: raw?.created_at ?? raw?.provider?.created_at ?? undefined,
  };
}

export async function fetchProviderMe(): Promise<ProviderMe> {
  const res = await api.get("/providers/me");
  return normalizeProvider(res.data);
}

export async function updateProviderMe(
  payload: ProviderUpdatePayload,
): Promise<ProviderMe> {
  const me = await fetchProviderMe();
  const res = await api.put(`/providers/${me.id}`, payload);
  return normalizeProvider(res.data);
}

export async function searchProviders(
  params: ProviderSearchParams,
): Promise<ProviderOut[]> {
  const res = await api.get("/providers/search", {
    params: {
      provider_type: params.provider_type,
      name: cleanParam(params.name),
      service: cleanParam(params.service || params.specialty),
      city: cleanParam(params.city),
      county: cleanParam(params.county),
      coverage_area: cleanParam(params.coverage_area),
      available_date: cleanParam(params.available_date),
      available_time: cleanParam(params.available_time),
      doctor_id: params.doctor_id || undefined,
      limit: params.limit || undefined,
      skip: params.skip || undefined,
      status: params.status || undefined,
    },
  });

  return (res.data ?? []) as ProviderOut[];
}

export async function searchClinics(
  params: ProviderSearchParams,
): Promise<ProviderOut[]> {
  const res = await api.get("/providers/search-clinics", {
    params: {
      name: cleanParam(params.name),
      specialty: cleanParam(params.specialty || params.service),
      city: cleanParam(params.city),
      county: cleanParam(params.county),
      available_date: cleanParam(params.available_date),
      available_time: cleanParam(params.available_time),
      doctor_id: params.doctor_id || undefined,
      limit: params.limit || undefined,
      skip: params.skip || undefined,
    },
  });

  return (res.data ?? []) as ProviderOut[];
}

export async function searchHomeCare(
  params: ProviderSearchParams,
): Promise<ProviderOut[]> {
  const res = await api.get("/providers/search-homecare", {
    params: {
      name: cleanParam(params.name),
      service: cleanParam(params.service || params.specialty),
      city: cleanParam(params.city),
      county: cleanParam(params.county),
      coverage_area: cleanParam(params.coverage_area),
      available_date: cleanParam(params.available_date),
      available_time: cleanParam(params.available_time),
      limit: params.limit || undefined,
      skip: params.skip || undefined,
    },
  });

  return (res.data ?? []) as ProviderOut[];
}

export async function searchDoctors(
  params: DoctorSearchParams,
): Promise<DoctorSearchResult[]> {
  const res = await api.get("/providers/search-doctors", {
    params: {
      doctor_name: cleanParam(params.doctor_name),
      specialty: cleanParam(params.specialty),
      provider_name: cleanParam(params.provider_name),
      city: cleanParam(params.city),
      county: cleanParam(params.county),
      available_date: cleanParam(params.available_date),
      available_time: cleanParam(params.available_time),
      limit: params.limit || undefined,
    },
  });

  const rows = (res.data ?? []) as DoctorSearchResult[];

  return rows.filter((item) => doctorMatchesSearch(item, params));
}

export async function fetchProviderById(
  providerId: number,
): Promise<ProviderOut> {
  const res = await api.get(`/providers/${providerId}`);
  return res.data as ProviderOut;
}

export async function fetchProviderDoctors(
  providerId: number,
  specialtyId?: number,
): Promise<ProviderDoctorPublicOut[]> {
  const res = await api.get(`/providers/${providerId}/doctors`, {
    params: {
      specialty_id: specialtyId || undefined,
    },
  });

  return (res.data ?? []) as ProviderDoctorPublicOut[];
}
