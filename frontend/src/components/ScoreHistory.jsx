import { Badge, Card, Group, Text, ThemeIcon, Title } from "@mantine/core";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Icon from "./Icon.jsx";

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Progress of the match score for one job across re-analyses. `entries` are oldest-first. */
export default function ScoreHistory({ entries, trackedUpdated }) {
  if (entries.length === 0) return null;
  const first = entries[0].score;
  const last = entries[entries.length - 1].score;
  const delta = last - first;
  const best = Math.max(...entries.map((e) => e.score));

  if (entries.length === 1) {
    return (
      <Card withBorder radius="md" padding="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" radius="md"><Icon name="trending" size={16} /></ThemeIcon>
          <Text size="sm" c="dimmed">
            <b>First analysis for this job: {first}%.</b> Improve your resume using the gaps below (or ask the
            Resume Coach), then click <b>Analyze fit</b> again to track your progress here.
          </Text>
        </Group>
      </Card>
    );
  }

  const data = entries.map((e, i) => ({ attempt: `#${i + 1}`, score: e.score, at: when(e.at) }));
  return (
    <Card withBorder radius="md" padding="lg" shadow="xs">
      <Group justify="space-between" align="flex-start" mb="sm">
        <Group gap="sm">
          <ThemeIcon variant="light" color={delta >= 0 ? "green" : "red"} size={40} radius="md">
            <Icon name="trending" size={19} />
          </ThemeIcon>
          <div>
            <Title order={5}>Your progress on this job</Title>
            <Text size="sm" c="dimmed">
              {first}% → {last}% across {entries.length} analyses · best {best}%
              {trackedUpdated && " · updated in Applications"}
            </Text>
          </div>
        </Group>
        <Badge size="xl" radius="md" variant="light" color={delta > 0 ? "green" : delta < 0 ? "red" : "gray"}>
          {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}{delta} pts
        </Badge>
      </Group>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="attempt" stroke="#94a3b8" fontSize={12} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 75, 100]} stroke="#94a3b8" fontSize={12} />
          <ReferenceLine y={75} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Apply Now", fontSize: 11, fill: "#16a34a", position: "insideTopRight" }} />
          <ReferenceLine y={50} stroke="#d97706" strokeDasharray="4 4" />
          <Tooltip formatter={(v) => [`${v}%`, "Match"]} labelFormatter={(l, p) => p?.[0]?.payload?.at ?? l}
            contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
          <Line type="monotone" dataKey="score" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 5, fill: "#1d4ed8" }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
