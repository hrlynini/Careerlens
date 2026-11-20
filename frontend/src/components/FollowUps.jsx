import { useState } from "react";
import { Badge, Button, Card, CopyButton, Group, Modal, Stack, Text, Textarea, TextInput, ThemeIcon, Title } from "@mantine/core";
import { addDays, daysBetween, FOLLOW_UP_DAYS, prettyDate, today } from "../lib/history.js";
import Icon from "./Icon.jsx";

/** Fills in follow-up fields for older tracker entries that were saved before reminders existed. */
export function withFollowUp(job) {
  const appliedDate = job.appliedDate ?? (job.status === "Applied" ? job.date : null);
  return { ...job, appliedDate, followUp: job.followUp ?? (appliedDate ? addDays(appliedDate, FOLLOW_UP_DAYS) : null) };
}

export const isDue = (j) => j.status === "Applied" && j.followUp && j.followUp <= today();

/** "due today", "3 days overdue", "in 4 days" */
export function followUpLabel(j) {
  if (!j.followUp) return "";
  const d = daysBetween(today(), j.followUp);
  if (d === 0) return "Due today";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  return `In ${d} day${d === 1 ? "" : "s"}`;
}

function draftFor(job) {
  const applied = job.appliedDate ? prettyDate(job.appliedDate) : "recently";
  const second = Boolean(job.followedUpOn);
  return {
    subject: `${second ? "Checking in again" : "Following up"}: ${job.role} application`,
    body:
`Hi [Hiring Manager's name],

I hope you're doing well. I applied for the ${job.role} position at ${job.company} on ${applied} and wanted to ${second ? "check in once more" : "follow up"} to reiterate my strong interest in the role.

My experience with [your most relevant project or skill] lines up closely with what the team is looking for, and I'd welcome the chance to discuss how I could contribute to ${job.company}.

Please let me know if there's anything else I can share, such as my portfolio or GitHub. Thank you for your time and consideration.

Best regards,
[Your name]
[Phone] · [LinkedIn] · [GitHub]`,
  };
}

function EmailModal({ job, onClose, onSent }) {
  const [draft, setDraft] = useState(() => draftFor(job));
  const mailto = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  return (
    <Modal opened onClose={onClose} size="lg" radius="md" title={<Text fw={600}>Follow-up email · {job.company}</Text>}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">Fill in the [brackets], then copy it or open it in your email app.</Text>
        <TextInput label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.currentTarget.value })} />
        <Textarea label="Message" autosize minRows={10} value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value })} />
        <Group justify="space-between" mt="xs">
          <CopyButton value={`Subject: ${draft.subject}\n\n${draft.body}`}>
            {({ copied, copy }) => (
              <Button variant="default" onClick={copy} leftSection={<Icon name={copied ? "check" : "clipboard"} size={15} />}>
                {copied ? "Copied" : "Copy email"}
              </Button>
            )}
          </CopyButton>
          <Group gap="xs">
            <Button component="a" href={mailto} variant="default" leftSection={<Icon name="external" size={14} />}>
              Open in email app
            </Button>
            <Button onClick={onSent} leftSection={<Icon name="check" size={15} />}>Mark as sent</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Panel listing applications whose follow-up date has arrived, plus the email draft modal. */
export default function FollowUps({ jobs, patch }) {
  const [emailFor, setEmailFor] = useState(null);
  const due = jobs.filter(isDue).sort((a, b) => a.followUp.localeCompare(b.followUp));
  const markSent = (job) => {
    // Sent today: schedule the next nudge a week later.
    patch(job.id, { followedUpOn: today(), followUp: addDays(today(), FOLLOW_UP_DAYS) });
    setEmailFor(null);
  };

  return (
    <>
      {due.length > 0 && (
        <Card withBorder radius="md" padding="lg" shadow="xs" style={{ borderColor: "var(--mantine-color-orange-3)" }}>
          <Group gap="sm" mb="md">
            <ThemeIcon color="orange" variant="light" size={38} radius="md"><Icon name="calendar" size={19} /></ThemeIcon>
            <div>
              <Title order={5}>Follow-ups due ({due.length})</Title>
              <Text size="sm" c="dimmed">A short, polite follow-up about a week after applying helps you stand out.</Text>
            </div>
          </Group>
          <Stack gap="xs">
            {due.map((j) => (
              <Card key={j.id} withBorder radius="md" padding="sm">
                <Group justify="space-between" gap="sm">
                  <div>
                    <Text fw={600} size="sm">{j.company} · {j.role}</Text>
                    <Text size="xs" c="dimmed">
                      Applied {daysBetween(j.appliedDate, today())} days ago
                      {j.followedUpOn && ` · last followed up ${prettyDate(j.followedUpOn)}`}
                      {" · "}<Text span size="xs" c="orange.7" fw={600}>{followUpLabel(j)}</Text>
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Button size="xs" variant="subtle" color="gray"
                      onClick={() => patch(j.id, { followUp: addDays(today(), 3) })}>Snooze 3 days</Button>
                    <Button size="xs" variant="default" onClick={() => markSent(j)}>Mark done</Button>
                    <Button size="xs" leftSection={<Icon name="send" size={13} />} onClick={() => setEmailFor(j)}>
                      Draft email
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Card>
      )}
      {emailFor && <EmailModal job={emailFor} onClose={() => setEmailFor(null)} onSent={() => markSent(emailFor)} />}
    </>
  );
}

export function FollowUpCell({ job, patch }) {
  if (job.status !== "Applied") return <Text size="sm" c="dimmed">—</Text>;
  const due = isDue(job);
  return (
    <div>
      <input type="date" className="date-input" value={job.followUp ?? ""} aria-label={`Follow-up date for ${job.company}`}
        onChange={(e) => e.target.value && patch(job.id, { followUp: e.target.value })} />
      <Badge size="xs" mt={4} variant="light" color={due ? "orange" : "gray"} tt="none" display="block" w="fit-content">
        {followUpLabel(job)}
      </Badge>
    </div>
  );
}
