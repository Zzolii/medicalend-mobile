// Path: medicalend-mobile/_lib/auth.ts

import { api } from "./api";
import { API_BASE_URL } from "./config";

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
};

export type MessageResponse = {
  message: string;
};

export type RegisterPatientPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  address_line: string;
  city: string;
  county: string;
  postal_code: string;
  country?: string | null;
};

export type RegisterProviderPayload = {
  email: string;
  password: string;

  name: string;
  provider_type: "clinic" | "home_care";

  website?: string | null;
  image_url?: string | null;
  public_description?: string | null;

  specialty?: string | null;
  services_offered?: string | null;

  cui: string;
  trade_register_number?: string | null;

  contact_person_name: string;
  contact_email: string;
  contact_phone: string;

  phone?: string | null;

  address_line: string;
  city: string;
  county: string;
  postal_code?: string | null;
  country?: string | null;

  coverage_area?: string | null;

  sanitary_authorization_number: string;
  sanitary_authorization_expires_at?: string | null;

  healthcare_compliance_confirmed: boolean;
  provider_agreement_accepted: boolean;
};

export type ProviderImageAsset = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

function appendNullableText(
  form: FormData,
  key: string,
  value?: string | null,
) {
  if (value !== undefined && value !== null && value !== "") {
    form.append(key, value);
  }
}

function appendBoolean(form: FormData, key: string, value: boolean) {
  form.append(key, String(value));
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/login", payload);
  return res.data as LoginResponse;
}

export async function registerPatient(payload: RegisterPatientPayload) {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/register-patient", payload);
  return res.data;
}

export async function registerProvider(payload: RegisterProviderPayload) {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/register-provider", payload);
  return res.data;
}

export async function registerProviderWithImage(
  payload: RegisterProviderPayload,
  image?: ProviderImageAsset | null,
) {
  console.log("[API] baseURL:", API_BASE_URL);

  const form = new FormData();

  form.append("email", payload.email);
  form.append("password", payload.password);

  form.append("name", payload.name);
  form.append("provider_type", payload.provider_type);

  appendNullableText(form, "website", payload.website ?? null);
  appendNullableText(
    form,
    "public_description",
    payload.public_description ?? null,
  );
  appendNullableText(form, "specialty", payload.specialty ?? null);
  appendNullableText(
    form,
    "services_offered",
    payload.services_offered ?? null,
  );

  form.append("cui", payload.cui);
  appendNullableText(
    form,
    "trade_register_number",
    payload.trade_register_number ?? null,
  );

  form.append("contact_person_name", payload.contact_person_name);
  form.append("contact_email", payload.contact_email);
  form.append("contact_phone", payload.contact_phone);

  appendNullableText(form, "phone", payload.phone ?? null);

  form.append("address_line", payload.address_line);
  form.append("city", payload.city);
  form.append("county", payload.county);
  appendNullableText(form, "postal_code", payload.postal_code ?? null);
  form.append("country", payload.country ?? "RO");

  appendNullableText(form, "coverage_area", payload.coverage_area ?? null);

  form.append(
    "sanitary_authorization_number",
    payload.sanitary_authorization_number,
  );
  appendNullableText(
    form,
    "sanitary_authorization_expires_at",
    payload.sanitary_authorization_expires_at ?? null,
  );

  appendBoolean(
    form,
    "healthcare_compliance_confirmed",
    payload.healthcare_compliance_confirmed,
  );
  appendBoolean(
    form,
    "provider_agreement_accepted",
    payload.provider_agreement_accepted,
  );

  if (image?.uri) {
    const fallbackName = image.uri.split("/").pop() || "provider-image.jpg";
    const normalizedName = image.name || fallbackName;
    const normalizedType = image.type || "image/jpeg";

    form.append("image_file", {
      uri: image.uri,
      name: normalizedName,
      type: normalizedType,
    } as any);
  }

  const res = await api.post("/auth/register-provider-upload", form, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/verify-email", { token });
  return res.data as MessageResponse;
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/forgot-password", { email });
  return res.data as MessageResponse;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<MessageResponse> {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return res.data as MessageResponse;
}

export async function resendVerification(
  email: string,
): Promise<MessageResponse> {
  console.log("[API] baseURL:", API_BASE_URL);
  const res = await api.post("/auth/resend-verification", { email });
  return res.data as MessageResponse;
}
