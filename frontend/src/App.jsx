import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Avatar, Menu, Text, UnstyledButton } from "@mantine/core";
import AnalyzeTab from "./components/AnalyzeTab.jsx";
import FinderTab from "./components/FinderTab.jsx";
import TrackerTab from "./components/TrackerTab.jsx";
import GapsTab from "./components/GapsTab.jsx";
import CoachTab from "./components/CoachTab.jsx";
import ProfileTab from "./components/ProfileTab.jsx";
import Icon from "./components/Icon.jsx";
import { initials, useAuth } from "./lib/auth.jsx";
import { usePersistentState } from "./lib/storage.js";

const PAGES = [
  { id: "analyze", label: "Analyze & Decide", icon: "target",
    title: "Analyze & Decide", subtitle: "Score your resume against a job description and get a clear next step." },
  { id: "finder", label: "AI Job Finder", icon: "compass",
    title: "AI Job Finder", subtitle: "Explore roles that match your stack and send any of them to the analyzer." },
  { id: "coach", label: "Resume Coach", icon: "chat",
    title: "Resume Coach", subtitle: "Chat with an AI coach about your resume: what to improve, rewrites, interview prep." },
  { id: "tracker", label: "Applications", icon: "clipboard",
    title: "Applications", subtitle: "Every job you've saved or applied to, in one place." },
  { id: "gaps", label: "Skill Gaps", icon: "chart",
    title: "Cross-Job Skill Gaps", subtitle: "See which missing skill would unlock the most opportunities." },
];
const PROFILE = { id: "profile", label: "My Profile", icon: "file",
  title: "My Profile", subtitle: "Your details, preferences and account settings." };

function UserMenu({ user, onProfile, onLogout, compact }) {
  return (
    <Menu position={compact ? "bottom-end" : "top-start"} width={220} shadow="md" radius="md">
      <Menu.Target>
        <UnstyledButton className={compact ? "topbar-user" : "sidebar-user"} aria-label="Account menu">
          <Avatar color="brand" variant="filled" radius="xl" size={compact ? 34 : 36}>{initials(user.name)}</Avatar>
          {!compact && (
            <span className="sidebar-user-text">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          )}
          {!compact && <Icon name="chevronDown" size={15} />}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={600} c="dark">{user.name}</Text>
          <Text size="xs" c="dimmed" truncate>{user.email}</Text>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item leftSection={<Icon name="file" size={15} />} onClick={onProfile}>My profile</Menu.Item>
        <Menu.Item color="red" leftSection={<Icon name="x" size={15} />} onClick={onLogout}>Log out</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default function App() {
  const { page = "analyze" } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Shared state lives here so it survives page switches (stored per account in localStorage).
  const [resume, setResume] = usePersistentState("cl.resume", "");
  const [jd, setJd] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [jobs, setJobs] = usePersistentState("cl.jobs", []);
  const [history, setHistory] = usePersistentState("cl.history", []); // every analysis: {jdKey, at, score, ...}

  // Called after each analysis: log it, and refresh the matching tracked application (same job description).
  // Returns true when a tracked application was updated.
  const recordAnalysis = (a, key) => {
    setHistory((h) => [...h, { id: crypto.randomUUID(), jdKey: key, at: new Date().toISOString(),
      company: a.company, role: a.role, score: a.match_score, verdict: a.verdict.key }].slice(-300));
    const tracked = jobs.some((j) => j.jdKey === key);
    if (tracked) {
      setJobs((prev) => prev.map((j) => (j.jdKey === key ? {
        ...j, score: a.match_score, verdict: a.verdict, firstScore: j.firstScore ?? j.score,
        missingSkills: a.missing_skills.map(({ skill, importance }) => ({ skill, importance })),
      } : j)));
    }
    return tracked;
  };

  const go = (id) => {
    navigate(`/app/${id}`);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };
  const doLogout = async () => {
    await logout(); // the route guard then sends us to the landing page
  };

  const current = page === "profile" ? PROFILE : PAGES.find((p) => p.id === page);
  if (!current) return <Navigate to="/app/analyze" replace />;

  const importJob = (text) => {
    setJd(text);
    setAnalysis(null);
    go("analyze");
  };

  const stats = {
    jobs: jobs.length,
    analyses: history.length,
    best: history.length ? Math.max(...history.map((h) => h.score)) : null,
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="target" size={18} /></span>
          <span className="brand-name">CareerLens</span>
          <button className="icon-btn only-mobile" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <Icon name="x" />
          </button>
        </div>

        <p className="nav-label">Workspace</p>
        <nav className="nav">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? "active" : ""}`}
              onClick={() => go(p.id)}
              aria-current={page === p.id ? "page" : undefined}
            >
              <Icon name={p.icon} />
              <span>{p.label}</span>
              {p.id === "tracker" && jobs.length > 0 && <span className="nav-count">{jobs.length}</span>}
            </button>
          ))}
        </nav>

        <p className="nav-label" style={{ marginTop: 18 }}>Account</p>
        <nav className="nav">
          <button className={`nav-item ${page === "profile" ? "active" : ""}`} onClick={() => go("profile")}
            aria-current={page === "profile" ? "page" : undefined}>
            <Icon name="file" />
            <span>My Profile</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <UserMenu user={user} onProfile={() => go("profile")} onLogout={doLogout} />
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="topbar-title">
            <h1>{current.title}</h1>
            <p>{current.subtitle}</p>
          </div>
          <UserMenu user={user} onProfile={() => go("profile")} onLogout={doLogout} compact />
        </header>

        <main className="content">
          {page === "analyze" && (
            <AnalyzeTab
              resume={resume}
              setResume={setResume}
              jd={jd}
              setJd={setJd}
              analysis={analysis}
              setAnalysis={setAnalysis}
              onSave={(job) => setJobs((prev) => [job, ...prev])}
              onAnalyzed={recordAnalysis}
              history={history}
              goTracker={() => go("tracker")}
            />
          )}
          {page === "finder" && <FinderTab onImport={importJob} savedResume={resume} profile={user.profile} />}
          {page === "coach" && (
            <CoachTab resume={resume} setResume={setResume} jd={jd} analysis={analysis} goAnalyze={() => go("analyze")} />
          )}
          {page === "tracker" && <TrackerTab jobs={jobs} setJobs={setJobs} goAnalyze={() => go("analyze")} />}
          {page === "gaps" && <GapsTab jobs={jobs} resume={resume} goAnalyze={() => go("analyze")} />}
          {page === "profile" && <ProfileTab stats={stats} hasResume={resume.trim().length >= 50} goTo={go} />}
        </main>
      </div>
    </div>
  );
}
