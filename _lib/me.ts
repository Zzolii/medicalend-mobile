// Path: medicalend-mobile/_lib/me.ts
import { api } from "./api";
import type { MeResponse } from "./types";

export async function fetchMe(): Promise<MeResponse> {
  const res = await api.get("/users/me");
  return res.data as MeResponse;
}
