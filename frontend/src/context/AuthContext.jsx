import { createContext, useContext, useEffect, useState, useCallback } from "react";
import client, { formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);      // null when checking / not signed in yet
  const [ready, setReady] = useState(false);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("mess_token");
    if (!token) { setUser(null); setReady(true); return; }
    try {
      const { data } = await client.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("mess_token");
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (employee_number, password) => {
    try {
      const { data } = await client.post("/auth/login", { employee_number, password });
      localStorage.setItem("mess_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };

  const register = async (employee_number, name, password, email) => {
    try {
      const { data } = await client.post("/auth/register", { employee_number, name, password, email });
      localStorage.setItem("mess_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };

  const updateUser = (patch) => setUser((u) => (u ? { ...u, ...patch } : u));

  const logout = () => {
    localStorage.removeItem("mess_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
