// Path: medicalend-mobile/_lib/api.ts
import axios from "axios";
import { API_BASE_URL } from "./config";
import { getToken } from "./session";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});
