import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../lib/auth.jsx";

const PERKS = [
  "Evidence-based match score for any job",
  "Real postings in your city, ranked by fit",
  "An AI coach that knows your resume",
  "A learning plan for every skill gap",
];

/** Shared login / sign-up page. mode: "login" | "signup" */
export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { login, signup } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.currentTarget.value });
  const mismatch = isSignup && form.confirm.length > 0 && form.confirm !== form.password;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (isSignup && form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // The route guard redirects once the user is set: new users fill in their profile first.
      if (isSignup) await signup(form.name, form.email, form.password, "/app/profile?welcome=1");
      else await login(form.email, form.password, location.state?.from || "/app/analyze");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      {/* ---------- Brand panel ---------- */}
      <aside className="auth-brand">
        <Link to="/" className="lp-logo light">
          <span className="brand-mark"><Icon name="target" size={18} /></span> CareerLens
        </Link>
        <div>
          <Title order={2} c="white" className="auth-brand-title">
            {isSignup ? "Your AI co-pilot for the job search." : "Welcome back."}
          </Title>
          <Text c="#c7d4ea" mt="sm" size="lg">
            {isSignup ? "Know where you stand, close the gaps, and apply with confidence." : "Pick up right where you left off."}
          </Text>
          <ul className="auth-perks">
            {PERKS.map((p) => <li key={p}><Icon name="checkCircle" size={18} /> {p}</li>)}
          </ul>
        </div>
        <Text size="sm" c="#7f93b8">Free · No credit card · Your data stays yours</Text>
      </aside>

      {/* ---------- Form ---------- */}
      <main className="auth-main">
        <form className="auth-card" onSubmit={submit} noValidate>
          <Link to="/" className="lp-logo auth-mobile-logo">
            <span className="brand-mark"><Icon name="target" size={18} /></span> CareerLens
          </Link>
          <Title order={2}>{isSignup ? "Create your account" : "Log in to CareerLens"}</Title>
          <Text c="dimmed" mt={6} mb="lg">
            {isSignup ? "It takes less than a minute." : "Enter your email and password to continue."}
          </Text>

          {error && <Alert color="red" variant="light" mb="md" icon={<Icon name="alert" />}>{error}</Alert>}

          <Stack gap="md">
            {isSignup && (
              <TextInput label="Full name" placeholder="e.g. Priya Sharma" size="md" required autoComplete="name"
                value={form.name} onChange={set("name")} leftSection={<Icon name="file" size={16} />} />
            )}
            <TextInput label="Email" placeholder="you@example.com" type="email" size="md" required autoComplete="email"
              value={form.email} onChange={set("email")} leftSection={<Icon name="send" size={16} />} />
            <PasswordInput label="Password" placeholder={isSignup ? "At least 8 characters" : "Your password"} size="md"
              required autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password} onChange={set("password")} leftSection={<Icon name="shield" size={16} />} />
            {isSignup && (
              <PasswordInput label="Confirm password" placeholder="Type it again" size="md" required autoComplete="new-password"
                value={form.confirm} onChange={set("confirm")} error={mismatch ? "Passwords don't match" : null}
                leftSection={<Icon name="shield" size={16} />} />
            )}
            <Button type="submit" size="md" loading={busy} fullWidth mt="xs">
              {isSignup ? "Create account" : "Log in"}
            </Button>
          </Stack>

          <Text ta="center" mt="lg" size="sm" c="dimmed">
            {isSignup ? "Already have an account? " : "New to CareerLens? "}
            <Anchor component={Link} to={isSignup ? "/login" : "/signup"} fw={600}>
              {isSignup ? "Log in" : "Create an account"}
            </Anchor>
          </Text>
        </form>
      </main>
    </div>
  );
}
