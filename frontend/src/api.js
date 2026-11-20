// Thin wrappers around the FastAPI backend. All Claude calls happen server-side.

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Can't reach the CareerLens server. Is the backend running?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = body.detail;
    // FastAPI validation errors come back as a list; app errors as a string.
    const msg = Array.isArray(d) ? d.map((e) => `${e.loc?.at(-1)}: ${e.msg}`).join("; ") : d;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return body;
}

const json = (data) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export function parsePdf(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/api/parse-pdf", { method: "POST", body: form });
}

export const analyzeFit = (resumeText, jobDescription) =>
  request("/api/analyze", json({ resume_text: resumeText, job_description: jobDescription }));

/**
 * Streams the Resume Coach's reply. Calls onChunk(text) as pieces arrive; resolves with the full reply.
 * payload: { messages: [{role, content}], resume_text, job_description, analysis }
 */
export async function chatStream(payload, onChunk, signal) {
  let res;
  try {
    res = await fetch("/api/chat", { ...json(payload), signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Can't reach the CareerLens server. Is the backend running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const d = body.detail;
    throw new Error((Array.isArray(d) ? d.map((x) => x.msg).join("; ") : d) || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    full += text;
    onChunk(full);
  }
  return full;
}

// { skills, resume_text, role, location, live }
export const findJobs = (params) => request("/api/find-jobs", json(params));

// ---------------- Accounts ----------------
const TOKEN_KEY = "careerlens.token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* session-only */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

/** JSON request that sends the session token. opts: { method, body } */
export function authRequest(path, { method = "GET", body } = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

// { gaps: [{skill, jobs, critical}], resume_text, hours_per_week, weeks }
export const learningPlan = (payload) => request("/api/learning-plan", json(payload));

// Scores the resume against up to 12 jobs in one call. jobs: [{title, company, description}]
export const scoreJobs = (resumeText, jobs) =>
  request("/api/score-jobs", json({ resume_text: resumeText, jobs }));
