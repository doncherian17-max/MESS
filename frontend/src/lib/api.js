import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("mess_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => {
        if (!e) return "";
        const field = Array.isArray(e.loc) ? e.loc.filter((p) => p !== "body").join(".") : "";
        const msg = typeof e.msg === "string" ? e.msg : JSON.stringify(e);
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join(" · ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default client;
