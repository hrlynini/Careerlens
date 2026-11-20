import { useState } from "react";
import {
  Accordion, Alert, Anchor, Badge, Box, Button, Card, Checkbox, Chip, Group, Paper, Progress, RingProgress, Select,
  SegmentedControl, Stack, TagsInput, Text, ThemeIcon, Title,
} from "@mantine/core";
import { learningPlan } from "../api.js";
import { usePersistentState } from "../lib/storage.js";
import Icon from "./Icon.jsx";

const KIND = {
  learn: { color: "blue", label: "Learn", icon: "book" },
  build: { color: "violet", label: "Build", icon: "wrench" },
  apply: { color: "green", label: "Apply", icon: "send" },
};

const taskId = (w, t) => `${w}-${t}`;

/** Week-by-week plan generated from the aggregated skill gaps. Progress is saved in the browser. */
export default function LearningPlan({ rows, resume }) {
  const [saved, setSaved] = usePersistentState("cl.plan", null); // { plan, done, hours, weeks, skills, createdAt }
  const [hours, setHours] = useState(String(saved?.hours ?? 10));
  const [weeks, setWeeks] = useState(String(saved?.weeks ?? 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const plan = saved?.plan;
  const done = saved?.done ?? {};
  // Which skills go into the plan: chosen from the gap chips (default: top 4) plus any the user types in.
  const [selected, setSelected] = useState(() => saved?.selected ?? rows.slice(0, 4).map((r) => r.skill));
  const [custom, setCustom] = useState(() => saved?.custom ?? []);
  const chosen = [...selected.filter((s) => rows.some((r) => r.skill === s)), ...custom];
  const signature = chosen.map((x) => x.toLowerCase()).sort().join("|");
  const outdated = plan && saved.skills !== signature;

  const allTasks = plan ? plan.weeks.flatMap((w) => w.tasks.map((_, t) => taskId(w.week, t))) : [];
  const doneCount = allTasks.filter((id) => done[id]).length;
  const pct = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;
  const firstOpenWeek = plan?.weeks.find((w) => w.tasks.some((_, t) => !done[taskId(w.week, t)]))?.week;

  async function generate() {
    if (chosen.length === 0) {
      setError("Pick at least one skill for your plan.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await learningPlan({
        gaps: [
          ...rows.filter((r) => selected.includes(r.skill)).map((r) => ({ skill: r.skill, jobs: r.jobs, critical: r.critical })),
          ...custom.map((skill) => ({ skill, jobs: 0, critical: 0 })), // jobs: 0 = chosen by the user
        ],
        resume_text: resume,
        hours_per_week: Number(hours),
        weeks: Number(weeks),
      });
      setSaved({ plan: result, done: {}, hours: Number(hours), weeks: Number(weeks), skills: signature, selected, custom,
        createdAt: new Date().toISOString() });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id) => setSaved({ ...saved, done: { ...done, [id]: !done[id] } });
  // Tick (or untick) every task in a week at once.
  const setWeek = (ids, value) => setSaved({ ...saved, done: { ...done, ...Object.fromEntries(ids.map((id) => [id, value])) } });

  return (
    <Card withBorder radius="md" padding="lg" shadow="xs">
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="sm" align="flex-start">
          <ThemeIcon variant="light" size={42} radius="md"><Icon name="calendar" size={20} /></ThemeIcon>
          <div>
            <Title order={4}>Your learning plan</Title>
            <Text size="sm" c="dimmed">A week-by-week plan for the skills you choose, highest-ROI first. Tick tasks off as you go.</Text>
          </div>
        </Group>
        <Group gap="sm" align="flex-end">
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={4}>HOURS / WEEK</Text>
            <SegmentedControl size="xs" value={hours} onChange={setHours}
              data={["5", "10", "15", "20"].map((h) => ({ value: h, label: `${h}h` }))} />
          </div>
          <Select size="xs" w={110} label="LENGTH" value={weeks} onChange={(v) => v && setWeeks(v)} allowDeselect={false}
            styles={{ label: { fontSize: 12, color: "var(--mantine-color-dimmed)" } }}
            data={["4", "6", "8"].map((w) => ({ value: w, label: `${w} weeks` }))} />
          <Button size="sm" loading={busy} onClick={generate} disabled={chosen.length === 0}
            variant="filled" leftSection={<Icon name={plan ? "refresh" : "sparkles"} size={15} />}>
            {plan ? "Regenerate" : "Create my plan"}
          </Button>
        </Group>
      </Group>

      {/* ---------- Skill picker ---------- */}
      <Paper withBorder radius="md" p="md" mt="lg" bg="gray.0">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">Skills to include <Text span c="dimmed" fw={400}>· {chosen.length} selected</Text></Text>
          <Group gap={4}>
            <Button size="compact-xs" variant="subtle" onClick={() => setSelected(rows.map((r) => r.skill))}>Select all</Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => { setSelected([]); setCustom([]); }}>Clear</Button>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">Click the gaps you want to work on. The number shows how many of your tracked jobs need that skill.</Text>
        <Chip.Group multiple value={selected} onChange={setSelected}>
          <Group gap={8}>
            {rows.map((r) => (
              <Chip key={r.skill} value={r.skill} radius="sm" variant="outline"
                color={r.critical > 0 ? "red" : "brand"}>
                {r.skill} · {r.jobs} job{r.jobs === 1 ? "" : "s"}{r.critical > 0 ? " · critical" : ""}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        <TagsInput mt="md" label="Add your own skills" description="Want to learn something that isn't in your gaps? Type it and press Enter."
          placeholder="e.g. LangChain, System Design" value={custom} onChange={setCustom} maxTags={8} clearable
          size="sm" splitChars={[","]} />
      </Paper>

      {error && <Alert color="red" variant="light" mt="md" icon={<Icon name="alert" />}>{error}</Alert>}

      {outdated && !busy && (
        <Alert color="yellow" variant="light" mt="md" icon={<Icon name="alert" />}>
          Your skill selection changed since this plan was made. Click Regenerate to update it (your ticks will reset).
        </Alert>
      )}

      {!plan && !busy && (
        <Text size="sm" c="dimmed" mt="md">
          Choose your skills, weekly time and plan length, then click <b>Create my plan</b>.
          {resume.trim() ? " It skips what your resume shows you already know." : ""}
        </Text>
      )}

      {plan && (
        <Stack gap="md" mt="lg">
          <Group gap="lg" wrap="nowrap" align="center">
            <RingProgress size={78} thickness={8} roundCaps sections={[{ value: pct, color: pct === 100 ? "green" : "brand" }]}
              label={<Text ta="center" fw={700} size="sm">{pct}%</Text>} />
            <Box style={{ flex: 1 }}>
              <Text fw={600}>{doneCount} of {allTasks.length} tasks done{pct === 100 && " 🎉"}</Text>
              <Text size="sm" c="dimmed">{plan.summary}</Text>
              <Progress value={pct} mt={8} size="sm" radius="xl" color={pct === 100 ? "green" : "brand"} />
            </Box>
          </Group>

          <Accordion variant="separated" radius="md" defaultValue={firstOpenWeek ? String(firstOpenWeek) : null}>
            {plan.weeks.map((w) => {
              const ids = w.tasks.map((_, t) => taskId(w.week, t));
              const wDone = ids.filter((id) => done[id]).length;
              const complete = wDone === ids.length;
              const wHours = w.tasks.reduce((n, t) => n + (t.hours || 0), 0);
              return (
                <Accordion.Item key={w.week} value={String(w.week)}>
                  <Accordion.Control icon={
                    <ThemeIcon radius="xl" size={30} color={complete ? "green" : "brand"} variant={complete ? "filled" : "light"}>
                      {complete ? <Icon name="check" size={15} /> : <Text fw={700} size="xs">{w.week}</Text>}
                    </ThemeIcon>
                  }>
                    <Group justify="space-between" wrap="nowrap" pr="sm">
                      <div>
                        <Text fw={600} size="sm">Week {w.week} · {w.theme}</Text>
                        <Text size="xs" c="dimmed">{w.skill} · ~{wHours}h</Text>
                      </div>
                      <Badge variant="light" color={complete ? "green" : "gray"} tt="none">{wDone}/{ids.length}</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Text size="sm" mb="sm"><b>Goal:</b> {w.goal}</Text>
                    <Stack gap="xs">
                      {w.tasks.map((t, ti) => {
                        const id = taskId(w.week, ti);
                        const kind = KIND[t.kind] ?? KIND.learn;
                        return (
                          <Card key={id} withBorder radius="md" padding="sm" bg={done[id] ? "gray.0" : undefined}>
                            <Group align="flex-start" wrap="nowrap" gap="sm">
                              <Checkbox mt={2} checked={!!done[id]} onChange={() => toggle(id)} aria-label={t.title} />
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Group gap={6} wrap="wrap">
                                  <Badge size="sm" variant="light" color={kind.color} leftSection={<Icon name={kind.icon} size={11} />}
                                    tt="none">{kind.label}</Badge>
                                  <Text size="sm" fw={600} td={done[id] ? "line-through" : undefined}
                                    c={done[id] ? "dimmed" : undefined}>{t.title}</Text>
                                  <Text size="xs" c="dimmed">· {t.hours}h</Text>
                                </Group>
                                <Text size="sm" c="dimmed" mt={4}>{t.detail}</Text>
                                {t.resource_url && (
                                  <Anchor href={t.resource_url} target="_blank" rel="noreferrer" size="sm" mt={4}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    {t.resource_title || "Open resource"} <Icon name="external" size={12} />
                                  </Anchor>
                                )}
                              </Box>
                            </Group>
                          </Card>
                        );
                      })}
                    </Stack>
                    <Group justify="flex-end" mt="sm">
                      {complete ? (
                        <Button size="xs" variant="subtle" color="gray" onClick={() => setWeek(ids, false)}>Undo week</Button>
                      ) : (
                        <Button size="xs" color="green" variant="light" leftSection={<Icon name="check" size={14} />}
                          onClick={() => setWeek(ids, true)}>Mark week {w.week} done</Button>
                      )}
                    </Group>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </Stack>
      )}
    </Card>
  );
}
