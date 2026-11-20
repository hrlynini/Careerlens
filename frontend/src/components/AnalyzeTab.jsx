import { useState } from "react";
import { analyzeFit } from "../api.js";
import { jdKey } from "../lib/history.js";
import Icon from "./Icon.jsx";
import ScoreHistory from "./ScoreHistory.jsx";
import PdfDrop from "./PdfDrop.jsx";

const IMPORTANCE = {
  critical: { label: "Critical", cls: "danger" },
  important: { label: "Important", cls: "warning" },
  "nice-to-have": { label: "Nice to have", cls: "neutral" },
};

const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function ScoreRing({ score, tone }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`ring tone-${tone}`} viewBox="0 0 120 120" role="img" aria-label={`Match score ${score}%`}>
      <circle cx="60" cy="60" r={r} className="ring-track" />
      <circle cx="60" cy="60" r={r} className="ring-value" strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 60 60)" />
      <text x="60" y="60" textAnchor="middle" className="ring-num">{score}%</text>
      <text x="60" y="80" textAnchor="middle" className="ring-cap">MATCH</text>
    </svg>
  );
}

function GapItem({ gap, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [done, setDone] = useState([]);
  const imp = IMPORTANCE[gap.importance] ?? IMPORTANCE.important;
  const toggle = (i) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  return (
    <div className={`gap ${open ? "open" : ""}`}>
      <button className="gap-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`tag ${imp.cls}`}>{imp.label}</span>
        <span className="gap-title">
          <strong>{gap.skill}</strong>
          <small>{gap.why_it_matters}</small>
        </span>
        <span className="gap-progress">{done.length}/{gap.build_steps.length}</span>
        <Icon name="chevronDown" className="chev" />
      </button>
      {open && (
        <div className="gap-body">
          <div className="gap-col">
            <p className="mini-label"><Icon name="book" size={14} /> Free learning resource</p>
            <a className="resource" href={gap.resource_url} target="_blank" rel="noreferrer">
              <span>{gap.resource_title}</span>
              <Icon name="external" size={15} />
            </a>
          </div>
          <div className="gap-col">
            <p className="mini-label"><Icon name="wrench" size={14} /> Weekend proof-of-work</p>
            <h4>{gap.project_title}</h4>
            <p className="text-muted">{gap.project_pitch}</p>
            <ul className="checklist">
              {gap.build_steps.map((step, i) => (
                <li key={i}>
                  <label className={done.includes(i) ? "checked" : ""}>
                    <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
                    <span className="step-no">{i + 1}</span>
                    <span>{step}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyzeTab({
  resume, setResume, jd, setJd, analysis, setAnalysis, onSave, goTracker, onAnalyzed, history = [],
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [trackedUpdated, setTrackedUpdated] = useState(false);
  const ready = resume.trim().length >= 50 && jd.trim().length >= 50;

  async function run() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await analyzeFit(resume, jd);
      setAnalysis(result);
      setTrackedUpdated(onAnalyzed ? onAnalyzed(result, jdKey(jd)) : false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function save(status) {
    const a = analysis;
    onSave({
      id: crypto.randomUUID(),
      company: a.company,
      role: a.role,
      score: a.match_score,
      verdict: a.verdict,
      status,
      date: new Date().toISOString().slice(0, 10),
      jdKey: jdKey(jd),
      firstScore: history.filter((h) => h.jdKey === jdKey(jd))[0]?.score ?? a.match_score,
      missingSkills: a.missing_skills.map(({ skill, importance }) => ({ skill, importance })),
    });
    setSaved(true);
  }

  const a = analysis;
  const inputs = [
    { key: "resume", step: 1, title: "Your resume", hint: "Upload a PDF or paste the text", value: resume, set: setResume,
      placeholder: "Paste your resume text here…" },
    { key: "jd", step: 2, title: "Job description", hint: "Upload a PDF, paste it, or import from AI Job Finder",
      value: jd, set: setJd, placeholder: "Paste the full job description here…" },
  ];

  return (
    <div className="stack">
      <div className="grid-2">
        {inputs.map((f) => (
          <section className="card" key={f.key}>
            <div className="card-header">
              <span className="step-badge">{f.step}</span>
              <div className="grow">
                <h2>{f.title}</h2>
                <p>{f.hint}</p>
              </div>
              {wordCount(f.value) > 0 && (
                <span className="tag success"><Icon name="check" size={12} /> {wordCount(f.value)} words</span>
              )}
            </div>
            <div className="card-body">
              <PdfDrop onText={f.set} />
              <textarea value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} rows={8} />
            </div>
          </section>
        ))}
      </div>

      <section className="card action-bar">
        <div className="grow">
          <strong>{ready ? "Ready to analyze" : "Add both documents to continue"}</strong>
          <p className="text-muted">
            {ready ? "Scoring uses only evidence written in your resume." : "Resume and job description need at least 50 characters each."}
          </p>
        </div>
        <button className="btn btn-primary btn-lg" disabled={!ready || busy} onClick={run}>
          {busy ? (<><span className="spinner" /> Analyzing…</>) : (<><Icon name="sparkles" /> Analyze fit</>)}
        </button>
      </section>

      {error && (
        <div className="alert alert-danger"><Icon name="alert" /> <span>{error}</span></div>
      )}

      {a && (
        <div className="stack fade-in">
          <section className={`card verdict-card tone-${a.verdict.key}`}>
            <div className="verdict-score">
              <ScoreRing score={a.match_score} tone={a.verdict.key} />
            </div>
            <div className="verdict-info">
              <p className="overline">{a.company} · {a.role}</p>
              <h2 className="verdict-title">
                <span className={`verdict-dot tone-${a.verdict.key}`} /> {a.verdict.label}
              </h2>
              <p className="verdict-advice">{a.verdict.advice}</p>
              <p className="text-muted">{a.score_rationale}</p>
            </div>
            <div className="verdict-actions">
              {saved ? (
                <>
                  <span className="tag success lg"><Icon name="check" size={14} /> Saved to Applications</span>
                  <button className="btn btn-link" onClick={goTracker}>View tracker <Icon name="arrowRight" size={15} /></button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => save("Applied")}><Icon name="send" size={16} /> Log as applied</button>
                  <button className="btn btn-outline" onClick={() => save("Saved / Target Later")}><Icon name="bookmark" size={16} /> Save for later</button>
                </>
              )}
            </div>
          </section>

          <ScoreHistory entries={history.filter((h) => h.jdKey === jdKey(jd))} trackedUpdated={trackedUpdated} />

          <div className="grid-results">
            <section className="card">
              <div className="card-header">
                <span className="header-icon success"><Icon name="checkCircle" /></span>
                <div className="grow">
                  <h2>Matched strengths</h2>
                  <p>Backed by evidence from your resume</p>
                </div>
                <span className="tag neutral">{a.matched_strengths.length}</span>
              </div>
              <div className="card-body">
                {a.matched_strengths.length === 0 ? (
                  <p className="text-muted">No evidence-backed matches found.</p>
                ) : (
                  <ul className="strength-list">
                    {a.matched_strengths.map((s, i) => (
                      <li key={i}>
                        <div className="strength-top">
                          <strong>{s.skill}</strong>
                          <span className="text-muted small">{s.jd_requirement}</span>
                        </div>
                        <blockquote>“{s.evidence}”</blockquote>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <span className="header-icon warning"><Icon name="wrench" /></span>
                <div className="grow">
                  <h2>Skill gaps & weekend projects</h2>
                  <p>A free resource and a 3-step build plan for each gap</p>
                </div>
                <span className="tag neutral">{a.missing_skills.length}</span>
              </div>
              <div className="card-body flush">
                {a.missing_skills.length === 0 ? (
                  <p className="text-muted pad">No significant gaps. Go apply!</p>
                ) : (
                  a.missing_skills.map((g, i) => <GapItem key={`${g.skill}-${i}`} gap={g} defaultOpen={i === 0} />)
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
