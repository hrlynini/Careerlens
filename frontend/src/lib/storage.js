import { useEffect, useState } from "react";

// Per-account namespace: "cl.jobs" is stored as "cl.u<id>.jobs" for the logged-in user,
// so several accounts on one browser keep separate trackers, resumes, chats and plans.
let namespace = "";

const LEGACY_KEYS = ["cl.resume", "cl.jobs", "cl.history", "cl.chat", "cl.plan"];

const scoped = (key) => (namespace && key.startsWith("cl.") ? `cl.${namespace}.${key.slice(3)}` : key);

/**
 * Called on login. Data saved before accounts existed (un-namespaced keys) is moved into the
 * first account that logs in on this browser, so nothing is lost.
 */
export function setStorageUser(userId) {
  namespace = userId ? `u${userId}` : "";
  if (!namespace) return;
  try {
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy !== null && localStorage.getItem(scoped(key)) === null) {
        localStorage.setItem(scoped(key), legacy);
      }
      localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable - app still works for this session */
  }
}

// useState that is mirrored to localStorage. Storage can be unavailable
// (private mode, blocked cookies), so every access is wrapped in try/catch.
export function usePersistentState(key, initial) {
  const fullKey = scoped(key);
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      return raw !== null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      /* ignore - app still works for this session */
    }
  }, [fullKey, value]);
  return [value, setValue];
}
