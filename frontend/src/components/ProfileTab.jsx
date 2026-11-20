import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert, Avatar, Badge, Button, Card, Divider, Grid, Group, PasswordInput, Select, SimpleGrid, Stack, TagsInput,
  Text, Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { initials, useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

const EXPERIENCE = [
  { value: "fresher", label: "Fresher / student" },
  { value: "0-1", label: "0–1 years" },
  { value: "1-3", label: "1–3 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5+", label: "5+ years" },
];

const empty = { headline: "", location: "", experience: "", target_role: "", bio: "", linkedin: "", github: "", portfolio: "", skills: [] };

function completeness(name, p) {
  const checks = [name, p.headline, p.location, p.experience, p.target_role, p.skills?.length, p.bio, p.linkedin || p.github];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function ProfileTab({ stats, hasResume, goTo }) {
  const { user, saveProfile, changePassword, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const welcome = params.get("welcome") === "1";

  const [name, setName] = useState(user.name);
  const [p, setP] = useState({ ...empty, ...user.profile });
  const [state, setState] = useState({ busy: false, saved: false, error: "" });
  const [pw, setPw] = useState({ current: "", next: "", busy: false, msg: "", error: "" });

  const set = (k) => (e) => setP({ ...p, [k]: e?.currentTarget ? e.currentTarget.value : e });
  const pct = completeness(name, p);
  const dirty = name !== user.name || JSON.stringify({ ...empty, ...user.profile }) !== JSON.stringify(p);

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, saved: false, error: "" });
    try {
      await saveProfile(name, p);
      setState({ busy: false, saved: true, error: "" });
      if (welcome) setParams({});
    } catch (err) {
      setState({ busy: false, saved: false, error: err.message });
    }
  }

  async function updatePassword(e) {
    e.preventDefault();
    setPw({ ...pw, busy: true, msg: "", error: "" });
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", busy: false, msg: "Password updated.", error: "" });
    } catch (err) {
      setPw({ ...pw, busy: false, msg: "", error: err.message });
    }
  }

  const joined = new Date(user.created_at * 1000).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Stack gap="lg">
      {welcome && (
        <Alert color="blue" variant="light" radius="md" icon={<Icon name="sparkles" />} title={`Welcome to CareerLens, ${user.name.split(" ")[0]}!`}>
          Fill in your profile so the Job Finder can pre-fill your city, experience and skills. You can change it anytime.
        </Alert>
      )}

      {/* ---------- Header card ---------- */}
      <Card withBorder radius="md" padding={0} shadow="xs" className="profile-head">
        <div className="profile-cover" />
        <Group justify="space-between" align="flex-end" px="xl" pb="lg" mt={-44} wrap="wrap" gap="md">
          <Group align="flex-start" gap="md">
            <Avatar size={96} radius={96} color="brand" variant="filled" className="profile-avatar">
              <Text fw={700} size="32px" c="white">{initials(name)}</Text>
            </Avatar>
            <div style={{ paddingTop: 52 }}>
              <Title order={3}>{name || "Your name"}</Title>
              <Text c="dimmed">{p.headline || "Add a headline, e.g. Final-year CSE student · AI enthusiast"}</Text>
              <Group gap="md" mt={6}>
                {p.location && <Text size="sm" c="dimmed"><Icon name="pin" size={13} /> {p.location}</Text>}
                <Text size="sm" c="dimmed"><Icon name="calendar" size={13} /> Joined {joined}</Text>
              </Group>
            </div>
          </Group>
          <div className="profile-complete">
            <Group justify="space-between" mb={4}><Text size="sm" fw={600}>Profile completeness</Text><Text size="sm" fw={700}>{pct}%</Text></Group>
            <div className="meter-bar"><span style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--primary)" }} /></div>
          </div>
        </Group>
      </Card>

      {/* ---------- Stats ---------- */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {[
          ["clipboard", "Jobs tracked", stats.jobs, "tracker"],
          ["target", "Analyses run", stats.analyses, "analyze"],
          ["trending", "Best match", stats.best != null ? `${stats.best}%` : "—", "analyze"],
          ["file", "Resume", hasResume ? "On file" : "Not added", "analyze"],
        ].map(([icon, label, value, page]) => (
          <Card key={label} withBorder radius="md" padding="md" className="clickable" onClick={() => goTo(page)}>
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" size={40} radius="md"><Icon name={icon} size={19} /></ThemeIcon>
              <div><Text size="xs" c="dimmed" fw={600}>{label}</Text><Text fw={700} size="lg">{value}</Text></div>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Grid gutter="lg">
        {/* ---------- Profile form ---------- */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder radius="md" padding="xl" shadow="xs" component="form" onSubmit={save}>
            <Title order={4}>Profile details</Title>
            <Text size="sm" c="dimmed" mb="lg">Used to pre-fill the Job Finder. Only you can see this.</Text>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput label="Full name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
                <TextInput label="Email" value={user.email} disabled description="Used to log in" />
              </SimpleGrid>
              <TextInput label="Headline" placeholder="e.g. Final-year CSE student · Building with Gemini & React"
                value={p.headline} onChange={set("headline")} maxLength={120} />
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <TextInput label="City" placeholder="e.g. Hyderabad" value={p.location} onChange={set("location")}
                  leftSection={<Icon name="pin" size={15} />} />
                <Select label="Experience" placeholder="Choose" data={EXPERIENCE} value={p.experience || null}
                  onChange={(v) => setP({ ...p, experience: v || "" })} clearable />
                <TextInput label="Target role" placeholder="e.g. AI/ML intern" value={p.target_role} onChange={set("target_role")}
                  leftSection={<Icon name="briefcase" size={15} />} />
              </SimpleGrid>
              <TagsInput label="Skills" description="Press Enter after each skill" placeholder="Python, React, Gemini API…"
                value={p.skills} onChange={(v) => setP({ ...p, skills: v })} clearable maxTags={30} splitChars={[","]} />
              <Textarea label="About you" placeholder="A few lines about what you're looking for" autosize minRows={3}
                value={p.bio} onChange={set("bio")} maxLength={600} />
              <Divider label="Links" labelPosition="left" />
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <TextInput label="LinkedIn" placeholder="linkedin.com/in/…" value={p.linkedin} onChange={set("linkedin")} />
                <TextInput label="GitHub" placeholder="github.com/…" value={p.github} onChange={set("github")} />
                <TextInput label="Portfolio" placeholder="your-site.com" value={p.portfolio} onChange={set("portfolio")} />
              </SimpleGrid>
              {state.error && <Alert color="red" variant="light" icon={<Icon name="alert" />}>{state.error}</Alert>}
              <Group justify="space-between" mt="xs">
                <Text size="sm" c={state.saved && !dirty ? "green" : "dimmed"}>
                  {state.saved && !dirty ? "✓ Profile saved" : dirty ? "You have unsaved changes" : ""}
                </Text>
                <Group gap="xs">
                  {welcome && <Button variant="default" onClick={() => goTo("analyze")}>Skip for now</Button>}
                  <Button type="submit" loading={state.busy} disabled={!dirty} leftSection={<Icon name="check" size={16} />}>
                    Save profile
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        {/* ---------- Side column ---------- */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            <Card withBorder radius="md" padding="lg" shadow="xs">
              <Title order={5} mb="sm">Quick start</Title>
              <Stack gap="xs">
                {[
                  ["target", "Analyze a job", "analyze", !hasResume ? "Add your resume first" : null],
                  ["compass", "Find jobs in " + (p.location || "your city"), "finder"],
                  ["chat", "Ask the Resume Coach", "coach"],
                ].map(([icon, label, page, hint]) => (
                  <Button key={page} variant="light" justify="space-between" fullWidth onClick={() => goTo(page)}
                    leftSection={<Icon name={icon} size={16} />} rightSection={<Icon name="arrowRight" size={14} />}>
                    <span>{label}{hint && <Badge ml={6} size="xs" color="yellow" variant="light" tt="none">{hint}</Badge>}</span>
                  </Button>
                ))}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="lg" shadow="xs" component="form" onSubmit={updatePassword}>
              <Title order={5} mb="sm">Change password</Title>
              <Stack gap="sm">
                <PasswordInput label="Current password" value={pw.current} autoComplete="current-password"
                  onChange={(e) => setPw({ ...pw, current: e.currentTarget.value })} />
                <PasswordInput label="New password" description="At least 8 characters" value={pw.next} autoComplete="new-password"
                  onChange={(e) => setPw({ ...pw, next: e.currentTarget.value })} />
                {pw.error && <Text size="sm" c="red">{pw.error}</Text>}
                {pw.msg && <Text size="sm" c="green">✓ {pw.msg}</Text>}
                <Button type="submit" variant="default" loading={pw.busy} disabled={!pw.current || pw.next.length < 8}>
                  Update password
                </Button>
              </Stack>
            </Card>

            <Button variant="light" color="red" leftSection={<Icon name="x" size={16} />}
              onClick={logout}>
              Log out
            </Button>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
