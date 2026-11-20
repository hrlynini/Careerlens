import { Link } from "react-router-dom";
import { Badge, Button, Container, Group, SimpleGrid, Text, ThemeIcon, Title } from "@mantine/core";
import Icon from "../components/Icon.jsx";

const FEATURES = [
  { icon: "target", title: "Analyze & Decide", text: "Upload your resume and a job description. Get an evidence-based 0–100 score and a clear verdict: Apply Now, Stretch, or Skill-Build." },
  { icon: "compass", title: "AI Job Finder", text: "Real postings from LinkedIn, Internshala, Wellfound and more, matched to your skills, city and experience, then ranked by fit." },
  { icon: "chat", title: "Resume Coach", text: "Chat with an AI coach that has read your resume. Get rewrites, summaries and interview prep, with no made-up experience." },
  { icon: "chart", title: "Skill-gap insights", text: "See which missing skill unlocks the most jobs, then get a week-by-week learning plan with free resources." },
  { icon: "clipboard", title: "Application tracker", text: "Every job in one place, with statuses, follow-up reminders and ready-to-send follow-up emails." },
  { icon: "trending", title: "Progress you can see", text: "Re-analyze after improving your resume and watch your match score climb, from 72% to 85%." },
];

const STEPS = [
  ["Add your resume", "Upload a PDF once. Your skills and experience are read automatically."],
  ["Find or paste a job", "Search live postings by city, or paste any job description."],
  ["Get a clear verdict", "See your score, the evidence behind it, and exactly what's missing."],
  ["Close the gap & apply", "Follow your learning plan, polish your resume with the coach, track every application."],
];

function ProductPreview() {
  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-preview-bar"><span /><span /><span /></div>
      <div className="lp-preview-body">
        <div className="lp-score">
          <svg viewBox="0 0 120 120" width="112" height="112">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e3e8ef" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="#15803d" strokeWidth="10" strokeLinecap="round"
              strokeDasharray="314" strokeDashoffset="47" transform="rotate(-90 60 60)" />
            <text x="60" y="64" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0b1b33">85%</text>
          </svg>
          <div>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">AI Solutions Architect Intern</Text>
            <Text fw={700} size="lg" c="green.8">● Apply Now</Text>
            <Text size="sm" c="dimmed">Strong fit: submit your application now.</Text>
          </div>
        </div>
        <div className="lp-rows">
          <div className="lp-row ok"><Icon name="check" size={14} /> Gemini API project <em>“Built Learnly with Gemini…”</em></div>
          <div className="lp-row ok"><Icon name="check" size={14} /> AI tool fluency <em>“Claude, Google AI Studio”</em></div>
          <div className="lp-row gap"><Icon name="alert" size={14} /> Prompt engineering <b>Critical gap</b></div>
          <div className="lp-row gap"><Icon name="alert" size={14} /> RAG pipelines <b>Weekend project ready</b></div>
        </div>
        <div className="lp-progress">
          <Text size="xs" fw={600} c="dimmed">YOUR PROGRESS</Text>
          <div className="lp-bars"><span style={{ height: "52%" }} /><span style={{ height: "64%" }} /><span style={{ height: "72%" }} /><span className="hi" style={{ height: "85%" }} /></div>
        </div>
      </div>
      <div className="lp-float">
        <ThemeIcon size={30} radius="xl" color="green" variant="light"><Icon name="trending" size={16} /></ThemeIcon>
        <div><Text size="xs" c="dimmed">Match score</Text><Text fw={700} size="sm">▲ +13 pts</Text></div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      {/* ---------------- Nav ---------------- */}
      <header className="lp-nav">
        <Container size="lg" className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <span className="brand-mark"><Icon name="target" size={18} /></span> CareerLens
          </Link>
          <nav className="lp-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </nav>
          <Group gap="xs">
            <Button component={Link} to="/login" variant="subtle" color="gray" className="lp-login">Log in</Button>
            <Button component={Link} to="/signup" radius="xl">Get started free</Button>
          </Group>
        </Container>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="lp-hero">
        <Container size="lg" className="lp-hero-grid">
          <div>
            <Badge variant="light" color="blue" size="lg" radius="xl" tt="none" className="lp-pill">
              ✨ AI career co-pilot for fresh graduates
            </Badge>
            <Title order={1} className="lp-h1">
              Know which jobs to apply for, <span>and how to close the gap.</span>
            </Title>
            <Text className="lp-sub">
              CareerLens scores your resume against any job, finds real openings in your city, and turns every
              skill gap into a weekend project. Stop guessing. Apply with confidence.
            </Text>
            <Group gap="sm" mt="xl">
              <Button component={Link} to="/signup" size="lg" radius="xl" rightSection={<Icon name="arrowRight" size={18} />}>
                Create free account
              </Button>
              <Button component={Link} to="/login" size="lg" radius="xl" variant="white" color="dark">
                Log in
              </Button>
            </Group>
            <Group gap="lg" mt="lg" className="lp-checks">
              {["Free to use", "Evidence-based scores", "Your data stays yours"].map((t) => (
                <span key={t}><Icon name="checkCircle" size={15} /> {t}</span>
              ))}
            </Group>
          </div>
          <ProductPreview />
        </Container>
      </section>

      {/* ---------------- Stats strip ---------------- */}
      <section className="lp-strip">
        <Container size="lg">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
            {[["0–100", "evidence-based match score"], ["7+", "job sites searched"], ["3-step", "weekend project per gap"], ["1 click", "from posting to analysis"]].map(([n, l]) => (
              <div key={l} className="lp-stat"><strong>{n}</strong><span>{l}</span></div>
            ))}
          </SimpleGrid>
        </Container>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="lp-section" id="features">
        <Container size="lg">
          <Text className="lp-eyebrow">Everything in one place</Text>
          <Title order={2} className="lp-h2">From “Am I qualified?” to “Offer accepted”</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mt={40}>
            {FEATURES.map((f) => (
              <div className="lp-feature" key={f.title}>
                <ThemeIcon size={46} radius="md" variant="light"><Icon name={f.icon} size={22} /></ThemeIcon>
                <Text fw={700} size="lg" mt="md">{f.title}</Text>
                <Text c="dimmed" mt={6} lh={1.6}>{f.text}</Text>
              </div>
            ))}
          </SimpleGrid>
        </Container>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="lp-section lp-alt" id="how">
        <Container size="lg">
          <Text className="lp-eyebrow">How it works</Text>
          <Title order={2} className="lp-h2">Four steps to a smarter job search</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mt={40}>
            {STEPS.map(([title, text], i) => (
              <div className="lp-step" key={title}>
                <span className="lp-step-num">{i + 1}</span>
                <Text fw={700} mt="md">{title}</Text>
                <Text c="dimmed" size="sm" mt={6} lh={1.6}>{text}</Text>
              </div>
            ))}
          </SimpleGrid>
        </Container>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="lp-section">
        <Container size="lg">
          <div className="lp-cta">
            <div>
              <Title order={2} c="white">Ready to see where you stand?</Title>
              <Text c="#c7d4ea" mt={8} size="lg">Create your free account and analyze your first job in under two minutes.</Text>
            </div>
            <Button component={Link} to="/signup" size="lg" radius="xl" variant="white" rightSection={<Icon name="arrowRight" size={18} />}>
              Get started free
            </Button>
          </div>
        </Container>
      </section>

      <footer className="lp-footer">
        <Container size="lg" className="lp-footer-inner">
          <span className="lp-logo small"><span className="brand-mark"><Icon name="target" size={14} /></span> CareerLens</span>
          <Text size="sm" c="dimmed">Built with Gemini · Claude-ready · © {new Date().getFullYear()} CareerLens</Text>
        </Container>
      </footer>
    </div>
  );
}
