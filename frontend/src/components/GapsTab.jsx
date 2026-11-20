import { useState } from "react";
import {
  Badge, Box, Button, Card, Group, Paper, Progress, RingProgress, SegmentedControl, SimpleGrid, Stack, Switch, Text,
  ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import { aggregateGaps } from "../lib/gaps.js";
import { usePersistentState } from "../lib/storage.js";
import Icon from "./Icon.jsx";
import LearningPlan from "./LearningPlan.jsx";

const keyOf = (skill) => skill.toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean).join(" ");

function importanceOf(row) {
  if (row.critical > 0) return { label: "Critical", color: "red" };
  if (row.weight / row.jobs >= 2) return { label: "Important", color: "orange" };
  return { label: "Nice to have", color: "gray" };
}

const prettyDay = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function GapRow({ row, total, doneAt, onToggle }) {
  const done = Boolean(doneAt);
  const imp = importanceOf(row);
  const pct = Math.round((row.jobs / total) * 100);
  const companies = [...new Set(row.roles.map((r) => r.split(" – ")[0]))];

  return (
    <Paper withBorder radius="md" p="md" className={`gap-row ${done ? "is-done" : ""}`}>
      <Group wrap="nowrap" align="center" gap="md">
        <ThemeIcon size={40} radius="xl" variant={done ? "filled" : "light"} color={done ? "green" : imp.color}>
          <Icon name={done ? "check" : imp.label === "Critical" ? "alert" : "wrench"} size={18} />
        </ThemeIcon>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} wrap="wrap">
            <Text fw={650} size="md" td={done ? "line-through" : undefined} c={done ? "dimmed" : undefined}>{row.skill}</Text>
            {done
              ? <Badge color="green" variant="light" tt="none">Closed {prettyDay(doneAt)}</Badge>
              : <Badge color={imp.color} variant="light" tt="none">{imp.label}</Badge>}
          </Group>
          <Group gap="sm" mt={6} wrap="nowrap">
            <Progress value={pct} size="sm" radius="xl" w={140} color={done ? "green" : imp.color === "gray" ? "brand" : imp.color} />
            <Text size="sm" c="dimmed">Needed by <b>{row.jobs}</b> of {total} job{total === 1 ? "" : "s"}</Text>
          </Group>
          <Text size="xs" c="dimmed" mt={6} lineClamp={1} title={row.roles.join(" · ")}>
            {companies.join(" · ")}
          </Text>
        </Box>

        {done ? (
          <Button variant="subtle" color="gray" size="sm" onClick={onToggle}>Undo</Button>
        ) : (
          <Button color="green" variant="light" size="sm" leftSection={<Icon name="check" size={15} />} onClick={onToggle}>
            Done
          </Button>
        )}
      </Group>
    </Paper>
  );
}

export default function GapsTab({ jobs, goAnalyze, resume = "" }) {
  const [excludeClosed, setExcludeClosed] = useState(false);
  const [view, setView] = useState("todo");
  const [doneMap, setDoneMap] = usePersistentState("cl.gapsDone", {}); // skill key -> ISO date closed

  if (jobs.length === 0) {
    return (
      <Card withBorder radius="md" padding="xl" ta="center">
        <Stack align="center" gap="xs" py="lg">
          <ThemeIcon size={56} radius="xl" variant="light"><Icon name="chart" size={26} /></ThemeIcon>
          <Title order={4} mt="xs">No skill gaps yet</Title>
          <Text c="dimmed" maw={420}>Analyze a few jobs and save them to Applications. Your most common missing skills will show up here.</Text>
          <Button mt="sm" onClick={goAnalyze} rightSection={<Icon name="arrowRight" size={15} />}>Analyze a job</Button>
        </Stack>
      </Card>
    );
  }

  const pool = jobs.filter((j) => !(excludeClosed && ["Rejected", "Offer"].includes(j.status)));
  const rows = aggregateGaps(pool);
  const isDone = (r) => Boolean(doneMap[keyOf(r.skill)]);
  const open = rows.filter((r) => !isDone(r));
  const closed = rows.filter(isDone);
  const pct = rows.length ? Math.round((closed.length / rows.length) * 100) : 0;
  const criticalOpen = open.filter((r) => r.critical > 0).length;
  const focus = open[0];

  const toggle = (skill) => {
    const k = keyOf(skill);
    setDoneMap((m) => {
      const next = { ...m };
      if (next[k]) delete next[k];
      else next[k] = new Date().toISOString();
      return next;
    });
  };

  const list = view === "todo" ? open : closed;

  return (
    <Stack gap="lg">
      {/* ---------- Progress summary ---------- */}
      <Card withBorder radius="md" padding="lg" shadow="xs">
        <Group justify="space-between" gap="lg" wrap="wrap">
          <Group gap="lg" wrap="nowrap">
            <RingProgress size={96} thickness={9} roundCaps
              sections={[{ value: pct, color: pct === 100 ? "green" : "brand" }]}
              label={<Text ta="center" fw={700} size="lg">{pct}%</Text>} />
            <div>
              <Title order={4}>{closed.length} of {rows.length} skill gaps closed</Title>
              <Text size="sm" c="dimmed" maw={460}>
                Based on the {pool.length} job{pool.length === 1 ? "" : "s"} you're tracking. Learn a skill, then press
                <b> Done</b> to tick it off.
              </Text>
            </div>
          </Group>
          <SimpleGrid cols={3} spacing="sm">
            {[["Open", open.length, "brand"], ["Critical", criticalOpen, "red"], ["Closed", closed.length, "green"]].map(([l, v, c]) => (
              <Paper key={l} withBorder radius="md" px="md" py="xs" ta="center" miw={84}>
                <Text fw={700} size="xl" c={`${c}.7`}>{v}</Text>
                <Text size="xs" c="dimmed" fw={600}>{l}</Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Group>
      </Card>

      {/* ---------- Focus next ---------- */}
      {focus ? (
        <Paper radius="md" p="lg" className="focus-card">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={48} radius="md" variant="white" color="brand"><Icon name="trending" size={22} /></ThemeIcon>
              <div>
                <Text size="xs" fw={700} tt="uppercase" className="focus-eyebrow">Focus on this next</Text>
                <Title order={3} className="focus-title">{focus.skill}</Title>
                <Text size="sm" className="focus-text">
                  Needed by {focus.jobs} of {pool.length} jobs{focus.critical > 0 && `, critical in ${focus.critical}`}.
                  Learning it moves the most applications forward.
                </Text>
              </div>
            </Group>
            <Button variant="white" color="green" leftSection={<Icon name="check" size={16} />} onClick={() => toggle(focus.skill)}>
              Mark as done
            </Button>
          </Group>
        </Paper>
      ) : rows.length > 0 && (
        <Paper radius="md" p="lg" withBorder bg="green.0">
          <Group gap="md">
            <ThemeIcon size={44} radius="xl" color="green"><Icon name="check" size={22} /></ThemeIcon>
            <div>
              <Title order={4}>All skill gaps closed 🎉</Title>
              <Text size="sm" c="dimmed">Re-analyze your target jobs in Analyze & Decide to see your new scores.</Text>
            </div>
          </Group>
        </Paper>
      )}

      {/* ---------- Skill gap list ---------- */}
      <Card withBorder radius="md" padding="lg" shadow="xs">
        <Group justify="space-between" mb="md" gap="sm" wrap="wrap">
          <div>
            <Title order={4}>Your skill gaps</Title>
            <Text size="sm" c="dimmed">Most useful first. The bar shows how many of your jobs need each skill.</Text>
          </div>
          <Group gap="md">
            <Tooltip label="Leave out jobs you were rejected from or already got an offer for">
              <Switch size="sm" label="Ignore rejected & offers" checked={excludeClosed}
                onChange={(e) => setExcludeClosed(e.currentTarget.checked)} />
            </Tooltip>
            <SegmentedControl value={view} onChange={setView} data={[
              { value: "todo", label: `To do (${open.length})` },
              { value: "done", label: `Done (${closed.length})` },
            ]} />
          </Group>
        </Group>

        {list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {view === "todo" ? "Nothing left to learn here. Nice work!" : "No skills ticked off yet. Press Done on a skill once you've learned it."}
          </Text>
        ) : (
          <Stack gap="sm">
            {list.map((r) => (
              <GapRow key={r.skill} row={r} total={pool.length} doneAt={doneMap[keyOf(r.skill)]} onToggle={() => toggle(r.skill)} />
            ))}
          </Stack>
        )}
      </Card>

      {/* ---------- Learning plan (open gaps only) ---------- */}
      {open.length > 0 && <LearningPlan rows={open} resume={resume} />}
    </Stack>
  );
}
