import { useEffect, useRef, useState } from "react";
import {
  ActionIcon, Alert, Avatar, Badge, Box, Button, Card, FileButton, Group, Paper, ScrollArea, SimpleGrid,
  Stack, Text, Textarea, ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Markdown from "react-markdown";
import { chatStream, parsePdf } from "../api.js";
import { usePersistentState } from "../lib/storage.js";
import Icon from "./Icon.jsx";

const SUGGESTIONS = [
  { icon: "trending", text: "What are the top 3 things I should improve on my resume?" },
  { icon: "wrench", text: "Rewrite my strongest project bullet with more impact." },
  { icon: "target", text: "Am I ready for my target job? What's missing?" },
  { icon: "send", text: "Write a short summary section for the top of my resume." },
  { icon: "book", text: "Which skills should I learn next, and in what order?" },
  { icon: "chat", text: "What interview questions will I get from my resume?" },
];

/** Compact text version of the latest analysis, so the coach can reference it. */
function analysisSummary(a) {
  if (!a) return "";
  const strengths = (a.matched_strengths || []).map((s) => `- ${s.skill}: ${s.evidence}`).join("\n");
  const gaps = (a.missing_skills || []).map((g) => `- [${g.importance}] ${g.skill}: ${g.why_it_matters}`).join("\n");
  return `Role: ${a.role} at ${a.company}\nMatch score: ${a.match_score}/100 (${a.verdict?.label || ""})\n` +
    `Rationale: ${a.score_rationale}\nStrengths:\n${strengths}\nGaps:\n${gaps}`;
}

function Bubble({ msg, streaming }) {
  const mine = msg.role === "user";
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" justify={mine ? "flex-end" : "flex-start"}>
      {!mine && <Avatar color="brand" radius="xl" size={34}><Icon name="sparkles" size={16} /></Avatar>}
      <Paper
        px="md" py="sm" radius="lg" maw="78%"
        bg={mine ? "brand.6" : "white"} c={mine ? "white" : undefined}
        withBorder={!mine} shadow={mine ? undefined : "xs"}
        className={mine ? "chat-bubble mine" : "chat-bubble coach"}
      >
        {mine ? (
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
        ) : msg.content ? (
          <div className="md">
            <Markdown>{msg.content}</Markdown>
            {streaming && <span className="caret" />}
          </div>
        ) : (
          <Group gap={6} py={4}><span className="typing" /><span className="typing" /><span className="typing" /></Group>
        )}
      </Paper>
    </Group>
  );
}

export default function CoachTab({ resume, setResume, jd, analysis, goAnalyze }) {
  const [messages, setMessages] = usePersistentState("cl.chat", []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [upload, setUpload] = useState({ busy: false, error: "" });
  const viewport = useRef(null);
  const abort = useRef(null);
  const phone = useMediaQuery("(max-width: 640px)");

  const hasResume = resume.trim().length >= 50;
  const hasJob = Boolean(analysis) || jd.trim().length >= 50;

  // Keep the newest message in view while the reply streams in.
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function uploadResume(file) {
    if (!file) return;
    setUpload({ busy: true, error: "" });
    try {
      setResume((await parsePdf(file)).text);
      setUpload({ busy: false, error: "" });
    } catch (e) {
      setUpload({ busy: false, error: e.message });
    }
  }

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setError("");
    const history = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await chatStream(
        { messages: history, resume_text: resume, job_description: jd, analysis: analysisSummary(analysis) },
        (full) => setMessages([...history, { role: "assistant", content: full }]),
        abort.current.signal,
      );
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message);
        setMessages(history.slice(0, -1)); // drop the unanswered question...
        setInput(question); // ...and put it back in the box to retry
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const stop = () => abort.current?.abort();
  const lastIndex = messages.length - 1;

  return (
    <Card withBorder radius="md" padding={0} shadow="xs" className="coach-window">
      {/* ---------- Header bar ---------- */}
      <Box p="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Group justify="space-between" gap="sm">
          <Group gap="sm">
            <ThemeIcon variant="light" size={40} radius="md"><Icon name="chat" size={20} /></ThemeIcon>
            <div>
              <Text fw={600}>Ask anything about your resume</Text>
              <Text size="sm" c="dimmed">Answers are based on your actual resume — no made-up experience.</Text>
            </div>
          </Group>
          <Group gap="xs">
            {hasResume ? (
              <Badge color="green" variant="light" size="lg" tt="none" leftSection={<Icon name="checkCircle" size={13} />}>
                Resume loaded
              </Badge>
            ) : (
              <FileButton onChange={uploadResume} accept="application/pdf">
                {(props) => (
                  <Button {...props} size="sm" loading={upload.busy} leftSection={<Icon name="upload" size={14} />}>
                    Upload resume
                  </Button>
                )}
              </FileButton>
            )}
            <Tooltip label={hasJob ? "The coach also sees your latest analyzed job" : "Analyze a job to get fit-specific advice"}>
              <Badge color={hasJob ? "brand" : "gray"} variant="light" size="lg" tt="none"
                leftSection={<Icon name="target" size={13} />}>
                {analysis ? `${analysis.role} @ ${analysis.company}` : hasJob ? "Job description loaded" : "No target job"}
              </Badge>
            </Tooltip>
            {messages.length > 0 && (
              <Button variant="default" size="sm" leftSection={<Icon name="refresh" size={14} />}
                onClick={() => { stop(); setMessages([]); setError(""); }}>
                New chat
              </Button>
            )}
          </Group>
        </Group>
        {upload.error && <Text size="sm" c="red" mt="xs">{upload.error}</Text>}
      </Box>

      {/* ---------- Conversation ---------- */}
        <ScrollArea h={phone ? "calc(100vh - 310px)" : "calc(100vh - 340px)"} mih={340} viewportRef={viewport}
          type="auto" bg="gray.0">
          <Box p={phone ? "md" : "lg"}>
            {messages.length === 0 ? (
              <Stack align="center" gap="xs" py="lg">
                <ThemeIcon variant="light" size={56} radius="xl"><Icon name="sparkles" size={26} /></ThemeIcon>
                <Title order={4} mt="xs">Hi! I'm your CareerLens Coach</Title>
                <Text c="dimmed" size="sm" ta="center" maw={460}>
                  {hasResume
                    ? "I've read your resume. Pick a question below or type your own."
                    : "Upload your resume above (or in Analyze & Decide) so I can give you specific advice."}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="md" w="100%" maw={760}>
                  {SUGGESTIONS.map((s) => (
                    <Paper key={s.text} withBorder radius="md" p="sm" className="suggestion" component="button"
                      onClick={() => send(s.text)} disabled={busy}>
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon variant="light" color="gray" radius="md"><Icon name={s.icon} size={16} /></ThemeIcon>
                        <Text size="sm" ta="left">{s.text}</Text>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            ) : (
              <Stack gap="md">
                {messages.map((m, i) => (
                  <Bubble key={i} msg={m} streaming={busy && i === lastIndex && m.role === "assistant"} />
                ))}
              </Stack>
            )}
          </Box>
        </ScrollArea>

        {/* ---------- Composer ---------- */}
        <Box p="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
          {error && (
            <Alert color="red" variant="light" mb="sm" icon={<Icon name="alert" />} withCloseButton
              onClose={() => setError("")}>{error}</Alert>
          )}
          <Group align="flex-end" gap="sm" wrap="nowrap">
            <Textarea
              style={{ flex: 1 }} autosize minRows={1} maxRows={6} radius="md" size="md"
              placeholder={hasResume ? "Ask about your resume… (Enter to send, Shift+Enter for a new line)" : "Ask a career question…"}
              value={input} onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {busy ? (
              <Tooltip label="Stop">
                <ActionIcon size={42} radius="md" variant="default" onClick={stop} aria-label="Stop reply">
                  <Icon name="stop" size={18} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <ActionIcon size={42} radius="md" onClick={() => send()} disabled={!input.trim()} aria-label="Send">
                <Icon name="send" size={18} />
              </ActionIcon>
            )}
          </Group>
          {!hasJob && messages.length > 0 && (
            <Text size="xs" c="dimmed" mt={6}>
              Tip: <Text span size="xs" c="brand" style={{ cursor: "pointer" }} onClick={goAnalyze}>analyze a job</Text>{" "}
              first and I can give advice for that specific role.
            </Text>
          )}
        </Box>
    </Card>
  );
}
