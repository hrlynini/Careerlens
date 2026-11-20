import { useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Alert, Avatar, Badge, Box, Button, Card, Divider, FileButton, Group, Paper, SegmentedControl,
  RingProgress, SimpleGrid, Skeleton, Stack, Switch, Text, TextInput, ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import { findJobs, parsePdf, scoreJobs } from "../api.js";
import { platformLinks } from "../lib/platforms.js";
import Icon from "./Icon.jsx";

const EXPERIENCE = [
  { value: "auto", label: "Auto" },
  { value: "fresher", label: "Fresher" },
  { value: "0-1", label: "0–1 yrs" },
  { value: "1-3", label: "1–3 yrs" },
  { value: "3-5", label: "3–5 yrs" },
  { value: "5+", label: "5+ yrs" },
];

const FIT = {
  match: { color: "green", icon: "check", label: "Fits your experience" },
  stretch: { color: "yellow", icon: "alert", label: "Slightly above you" },
  over: { color: "red", icon: "x", label: "Needs more experience" },
  unknown: { color: "gray", icon: "alert", label: "Experience not stated" },
};

const VERDICT_COLOR = { apply: "green", stretch: "yellow", build: "red" };
const jobKey = (j) => j.apply_url || `${j.title}|${j.company}`;

const inFilter = (job, f) =>
  f === "all" ? true
  : f === "above" ? job.experience_fit === "stretch" || job.experience_fit === "over"
  : job.experience_fit === f;

function Fact({ label, value }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4}>{label}</Text>
      <Text size="sm" fw={500} lineClamp={1} title={value}>{value}</Text>
    </div>
  );
}

function JobCard({ job, onImport, score }) {
  const [details, setDetails] = useState(false);
  const fit = FIT[job.experience_fit] || FIT.unknown;
  return (
    <Card withBorder radius="md" padding="lg" shadow="xs" className="job-card-m">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
          <Avatar color="brand" radius="md" size={44}>{job.company.charAt(0)}</Avatar>
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} size="md" lh={1.35} lineClamp={2}>{job.title}</Text>
            <Text size="sm" c="dimmed" lineClamp={1}>{job.company}</Text>
          </Box>
        </Group>
        {score ? (
          <Tooltip label={`${score.verdict.label}: ${score.reason}`} multiline w={260}>
            <RingProgress size={58} thickness={6} roundCaps style={{ flexShrink: 0 }}
              sections={[{ value: score.score, color: VERDICT_COLOR[score.verdict.key] }]}
              label={<Text ta="center" fw={700} size="xs">{score.score}%</Text>} />
          </Tooltip>
        ) : (
          job.source && <Badge variant="default" radius="sm" style={{ flexShrink: 0 }}>{job.source}</Badge>
        )}
      </Group>

      {score && (
        <Box mt="sm">
          <Group gap={6}>
            <Badge color={VERDICT_COLOR[score.verdict.key]} variant="filled" tt="none">
              {score.verdict.emoji} {score.verdict.label}
            </Badge>
            {job.source && <Badge variant="default" radius="sm">{job.source}</Badge>}
          </Group>
          <Text size="sm" mt={6}>{score.reason}</Text>
          {score.top_gap && score.top_gap !== "None" && (
            <Text size="xs" c="dimmed" mt={2}>Biggest gap: <b>{score.top_gap}</b></Text>
          )}
        </Box>
      )}

      <Badge mt="md" color={fit.color} variant="light" size="lg" radius="sm" fullWidth
        leftSection={<Icon name={fit.icon} size={14} />} styles={{ label: { textTransform: "none" } }}>
        {fit.label}
      </Badge>

      <SimpleGrid cols={3} spacing="sm" mt="md">
        <Fact label="Location" value={job.location} />
        <Fact label="Experience" value={job.experience_required || "Not specified"} />
        <Fact label="Type" value={job.job_type} />
      </SimpleGrid>

      <Text size="sm" c="dark.4" mt="md" lineClamp={details ? undefined : 2}>{job.summary}</Text>

      {job.tech_stack.length > 0 && (
        <Group gap={6} mt="sm">
          {job.tech_stack.map((t) => <Badge key={t} variant="light" color="gray" radius="sm" tt="none" fw={500}>{t}</Badge>)}
        </Group>
      )}

      {details && (
        <Paper bg="gray.0" p="sm" mt="sm" radius="sm" withBorder>
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{job.description}</Text>
        </Paper>
      )}

      <Divider mt="md" mb="sm" />
      <Group justify="space-between" gap="xs">
        <Group gap={4}>
          <Button variant="subtle" color="gray" size="xs" onClick={() => setDetails((d) => !d)}
            rightSection={<Icon name="chevronDown" size={14} />}>
            {details ? "Less" : "Details"}
          </Button>
          {job.apply_url && (
            <Button component="a" href={job.apply_url} target="_blank" rel="noreferrer" variant="subtle" size="xs"
              rightSection={<Icon name="external" size={13} />}>
              Open posting
            </Button>
          )}
        </Group>
        <Button size="xs" rightSection={<Icon name="arrowRight" size={14} />}
          onClick={() => onImport(`${job.title} - ${job.company} (${job.location})\n\n${job.description}`)}>
          Analyze & track
        </Button>
      </Group>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group wrap="nowrap"><Skeleton height={44} width={44} radius="md" /><Box style={{ flex: 1 }}>
        <Skeleton height={12} width="70%" mb={8} /><Skeleton height={10} width="40%" /></Box></Group>
      <Skeleton height={30} mt="md" radius="sm" />
      <Skeleton height={10} mt="md" /><Skeleton height={10} mt={8} width="80%" />
    </Card>
  );
}

export default function FinderTab({ onImport, savedResume = "", profile = {} }) {
  // Pre-filled from the user's profile; everything stays editable.
  const [form, setForm] = useState(() => ({
    skills: (profile.skills || []).join(", "),
    role: profile.target_role || "",
    location: profile.location || "",
    experience: EXPERIENCE.some((x) => x.value === profile.experience) ? profile.experience : "auto",
  }));
  const [resume, setResume] = useState({ text: "", label: "" });
  const [resumeState, setResumeState] = useState({ busy: false, error: "" });
  const [live, setLive] = useState(true); // live = real postings via web search; off = AI sample roles
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [scores, setScores] = useState({}); // jobKey -> {score, verdict, reason, top_gap}
  const [scoring, setScoring] = useState({ busy: false, error: "" });

  const phone = useMediaQuery("(max-width: 640px)");
  const set = (k) => (e) => setForm({ ...form, [k]: e.currentTarget.value });
  const hasResume = resume.text.trim().length >= 50;
  const canSearch = form.skills.trim().length >= 2 || hasResume;

  async function uploadResume(file) {
    if (!file) return;
    setResumeState({ busy: true, error: "" });
    try {
      const { text } = await parsePdf(file);
      setResume({ text, label: file.name });
      setResumeState({ busy: false, error: "" });
    } catch (e) {
      setResumeState({ busy: false, error: e.message });
    }
  }

  async function search(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFilter("all");
    setScores({});
    setScoring({ busy: false, error: "" });
    try {
      const experience = form.experience === "auto" ? "" : form.experience;
      setResult(await findJobs({ ...form, experience, resume_text: resume.text, live }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const allJobs = result?.jobs ?? [];
  const ranked = Object.keys(scores).length > 0;
  const jobs = allJobs.filter((j) => inFilter(j, filter))
    .sort((a, b) => (ranked ? (scores[jobKey(b)]?.score ?? -1) - (scores[jobKey(a)]?.score ?? -1) : 0));
  const resumeForScoring = resume.text.trim().length >= 50 ? resume.text : savedResume;
  const canRank = resumeForScoring.trim().length >= 50;

  async function rankJobs() {
    setScoring({ busy: true, error: "" });
    try {
      const { scores: list } = await scoreJobs(resumeForScoring, allJobs.slice(0, 12).map((j) => ({
        title: j.title, company: j.company, description: `${j.summary}\n${j.description}`.slice(0, 5000),
      })));
      const next = {};
      list.forEach((s, i) => { if (s) next[jobKey(allJobs[i])] = s; });
      setScores(next);
      setScoring({ busy: false, error: "" });
    } catch (e) {
      setScoring({ busy: false, error: e.message });
    }
  }
  const count = (f) => allJobs.filter((j) => inFilter(j, f)).length;
  const query = result?.search_query || form.role || form.skills.split(",").slice(0, 3).join(" ");
  const links = result && query.trim() ? platformLinks(query, form.location) : [];

  return (
    <Stack gap="lg">
      {/* ---------------- Search ---------------- */}
      <Card withBorder radius="md" padding={phone ? "md" : "xl"} shadow="xs" component="form" onSubmit={search}>
        <Group justify="space-between" mb="lg" align="flex-start">
          <div>
            <Title order={3}>Search jobs</Title>
            <Text size="sm" c="dimmed">Use your skills or your resume. We check every job against your experience.</Text>
          </div>
          <Switch checked={live} onChange={(e) => setLive(e.currentTarget.checked)} size="md"
            label="Live jobs" description={live ? "Real postings from job sites" : "AI sample roles"} />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <TextInput label="Skills / keywords" value={form.skills} onChange={set("skills")} size="md"
            placeholder={hasResume ? "Optional with a resume" : "e.g. Python, React, Gemini API"}
            leftSection={<Icon name="search" size={16} />} />
          <TextInput label="City" value={form.location} onChange={set("location")} size="md"
            placeholder="e.g. Hyderabad" leftSection={<Icon name="pin" size={16} />} />
          <TextInput label="Desired role" description={undefined} value={form.role} onChange={set("role")} size="md"
            placeholder="Optional, e.g. AI/ML intern" leftSection={<Icon name="briefcase" size={16} />} />
        </SimpleGrid>

        <Paper withBorder radius="md" p="md" mt="lg" bg="gray.0">
          <Group justify="space-between" gap="md">
            <Box>
              <Text fw={600} size="sm">Resume</Text>
              {hasResume ? (
                <Group gap={6} mt={2}>
                  <Badge color="green" variant="light" leftSection={<Icon name="checkCircle" size={12} />} tt="none">
                    {resume.label}
                  </Badge>
                  <Text size="xs" c="dimmed">Skills and experience will be read from it</Text>
                </Group>
              ) : (
                <Text size="xs" c={resumeState.error ? "red" : "dimmed"}>
                  {resumeState.error || "Optional. Add it to match on your full profile."}
                </Text>
              )}
            </Box>
            <Group gap="xs">
              {hasResume ? (
                <Button variant="default" size="sm" onClick={() => setResume({ text: "", label: "" })}
                  leftSection={<Icon name="x" size={14} />}>Remove</Button>
              ) : (
                <>
                  {savedResume.trim().length >= 50 && (
                    <Button variant="default" size="sm" leftSection={<Icon name="file" size={14} />}
                      onClick={() => setResume({ text: savedResume, label: "Resume from Analyze" })}>
                      Use saved resume
                    </Button>
                  )}
                  <FileButton onChange={uploadResume} accept="application/pdf">
                    {(props) => (
                      <Button {...props} variant="default" size="sm" loading={resumeState.busy}
                        leftSection={<Icon name="upload" size={14} />}>Upload PDF</Button>
                    )}
                  </FileButton>
                </>
              )}
            </Group>
          </Group>
        </Paper>

        <Group justify="space-between" align="flex-end" mt="lg" gap="md">
          <Box w={phone ? "100%" : undefined}>
            <Text fw={500} size="sm" mb={6}>Your experience</Text>
            <SegmentedControl value={form.experience} onChange={(v) => setForm({ ...form, experience: v })}
              data={phone ? EXPERIENCE.map((x) => ({ ...x, label: x.label.replace(" yrs", "") })) : EXPERIENCE}
              radius="md" fullWidth={phone} size={phone ? "xs" : "sm"} />
          </Box>
          <Button type="submit" size="md" loading={busy} disabled={!canSearch} px="xl" fullWidth={phone}
            leftSection={<Icon name="search" size={16} />}>
            Find jobs
          </Button>
        </Group>
      </Card>

      {error && (
        <Alert color="red" variant="light" icon={<Icon name="alert" />} title="Search failed">{error}</Alert>
      )}

      {/* ---------------- Results header ---------------- */}
      {result && !busy && (
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <div>
              <Group gap="xs">
                <Title order={3}>
                  {allJobs.length} {result.live ? "live jobs" : "sample roles"}
                  {form.location.trim() ? ` in ${form.location.trim()}` : ""}
                </Title>
                <Badge color={result.live ? "green" : "yellow"} variant="dot" size="lg" tt="none">
                  {result.live ? "Live" : "Samples"}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Searched “{result.search_query}” · Experience: <b>{result.experience_label}</b>
                {ranked && <> · <b>Ranked by match to your resume</b></>}
              </Text>
            </div>
            {allJobs.length > 0 && (
              <SegmentedControl value={filter} onChange={setFilter} radius="md" fullWidth={phone}
                orientation={phone ? "vertical" : "horizontal"} data={[
                { value: "all", label: `All (${count("all")})` },
                { value: "match", label: `Fits you (${count("match")})` },
                { value: "unknown", label: `Not stated (${count("unknown")})` },
                { value: "above", label: `Above you (${count("above")})` },
              ]} />
            )}
          </Group>
          {allJobs.length > 0 && (
            <Paper withBorder radius="md" p="sm" bg={ranked ? "green.0" : "brand.0"}>
              <Group justify="space-between" gap="sm">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color={ranked ? "green" : "brand"} radius="md">
                    <Icon name={ranked ? "checkCircle" : "target"} size={16} />
                  </ThemeIcon>
                  <Text size="sm">
                    {ranked
                      ? "Jobs are sorted by how well your resume matches. Start applying from the top."
                      : canRank
                        ? "Which job should you apply to first? Score your resume against all of them at once."
                        : "Add your resume above to score and rank these jobs by match."}
                  </Text>
                </Group>
                <Button size="xs" loading={scoring.busy} disabled={!canRank} onClick={rankJobs}
                  variant={ranked ? "default" : "filled"} leftSection={<Icon name={ranked ? "refresh" : "sparkles"} size={14} />}>
                  {ranked ? "Re-score" : "Rank by match"}
                </Button>
              </Group>
              {scoring.error && <Text size="sm" c="red" mt={6}>{scoring.error}</Text>}
            </Paper>
          )}
          {result.skills_used?.length > 0 && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">Matched on:</Text>
              {result.skills_used.map((s) => <Badge key={s} variant="outline" color="brand" radius="sm" tt="none">{s}</Badge>)}
            </Group>
          )}
          {result.notice && !result.live && (
            <Alert color="yellow" variant="light" icon={<Icon name="alert" />}>{result.notice}</Alert>
          )}
        </Stack>
      )}

      {/* ---------------- Jobs ---------------- */}
      {busy && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </SimpleGrid>
      )}
      {!busy && jobs.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {jobs.map((j) => <JobCard key={jobKey(j)} job={j} onImport={onImport} score={scores[jobKey(j)]} />)}
        </SimpleGrid>
      )}
      {!busy && result && allJobs.length > 0 && jobs.length === 0 && (
        <Paper withBorder radius="md" p="xl" ta="center"><Text c="dimmed">No jobs in this filter.</Text></Paper>
      )}

      {/* ---------------- Platform links ---------------- */}
      {!busy && links.length > 0 && (
        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" gap="md">
            <div>
              <Text fw={600}>See every listing on each site</Text>
              <Text size="sm" c="dimmed">“{query.trim()}”{form.location.trim() && ` in ${form.location.trim()}`}</Text>
            </div>
            <Group gap="xs">
              {links.map((p) => (
                <Tooltip key={p.name} label={`Open ${p.name} search`}>
                  <Button component="a" href={p.url} target="_blank" rel="noreferrer" variant="default" size="xs"
                    radius="xl" rightSection={<Icon name="external" size={12} />}>{p.name}</Button>
                </Tooltip>
              ))}
            </Group>
          </Group>
        </Card>
      )}

      {/* ---------------- Empty state ---------------- */}
      {!result && !busy && !error && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          {[
            ["file", "Tell us about you", "Type your skills or add your resume, then pick your city and experience."],
            ["search", "We search job sites", "Real postings from LinkedIn, Internshala, Wellfound, Naukri and Indeed."],
            ["checkCircle", "Get checked matches", "Each job is checked against your experience. Analyze any in one click."],
          ].map(([icon, title, text], i) => (
            <Card key={title} withBorder radius="md" padding="lg">
              <Group justify="space-between">
                <ThemeIcon variant="light" size={42} radius="md"><Icon name={icon} size={20} /></ThemeIcon>
                <Text fw={700} c="gray.4" size="xl">0{i + 1}</Text>
              </Group>
              <Text fw={600} mt="md">{title}</Text>
              <Text size="sm" c="dimmed" mt={4}>{text}</Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
