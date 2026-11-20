import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Center, Loader } from "@mantine/core";
import { authRequest, clearToken, getToken, setToken } from "../api.js";
import { setStorageUser } from "./storage.js";

const AuthContext = createContext(null);

/** Holds the logged-in user. On first load, a saved session token is checked with the server. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [next, setNext] = useState(null); // where to go right after logging in / signing up

  const applyUser = useCallback((u) => {
    setStorageUser(u?.id ?? null); // switch localStorage to this account's data
    setUser(u);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    authRequest("/api/auth/me")
      .then(({ user: u }) => applyUser(u))
      .catch(() => clearToken()) // expired or invalid session
      .finally(() => setReady(true));
  }, [applyUser]);

  const value = useMemo(() => ({
    user,
    ready,
    next,
    async login(email, password, destination) {
      const { token, user: u } = await authRequest("/api/auth/login", { method: "POST", body: { email, password } });
      setToken(token);
      setNext(destination || null);
      applyUser(u);
      return u;
    },
    async signup(name, email, password, destination) {
      const { token, user: u } = await authRequest("/api/auth/signup", { method: "POST", body: { name, email, password } });
      setToken(token);
      setNext(destination || null);
      applyUser(u);
      return u;
    },
    async logout() {
      try { await authRequest("/api/auth/logout", { method: "POST" }); } catch { /* already gone */ }
      clearToken();
      setNext("/"); // tells the route guard this was a deliberate logout: go to the landing page
      applyUser(null);
    },
    async saveProfile(name, profile) {
      const { user: u } = await authRequest("/api/profile", { method: "PUT", body: { name, profile } });
      setUser(u);
      return u;
    },
    changePassword: (current, next) =>
      authRequest("/api/profile/password", { method: "POST", body: { current, new: next } }),
  }), [user, ready, next, applyUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Route guard: logged-out visitors go to /login, then come back where they were heading. */
export function RequireAuth({ children }) {
  const { user, ready, next } = useAuth();
  const location = useLocation();
  if (!ready) return <Center h="100vh"><Loader /></Center>;
  if (!user && next === "/") return <Navigate to="/" replace />; // just logged out
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** For landing/login/signup: logged-in users skip straight to the app. */
export function GuestOnly({ children }) {
  const { user, ready, next } = useAuth();
  if (!ready) return <Center h="100vh"><Loader /></Center>;
  if (user) return <Navigate to={next || "/app/analyze"} replace />;
  return children;
}

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
