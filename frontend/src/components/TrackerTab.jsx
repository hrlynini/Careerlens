import { useState } from "react";
import { STATUSES } from "../lib/gaps.js";
import { Badge } from "@mantine/core";
import { addDays, FOLLOW_UP_DAYS, today } from "../lib/history.js";
import FollowUps, { FollowUpCell, withFollowUp } from "./FollowUps.jsx";
import Icon from "./Icon.jsx";

const STATUS_TONE = {
  "Saved / Target Later": "neutral",
  Applied: "primary",
  Interviewing: "warning",
  Offer: "success",
  Rejected: "danger",
};

export default function TrackerTab({ jobs: rawJobs, setJobs, goAnalyze }) {
  const jobs = rawJobs.map(withFollowUp);
  const [filter, setFilter] = useState("All");

  if (jobs.length === 0) {
    return (
      <div className="card empty">
        <span className="empty-icon"><Icon name="clipboard" size={26} /></span>
        <h3>No applications yet</h3>
        <p className="text-muted">Analyze a job, then click <strong>Log as applied</strong> or <strong>Save for later</strong>.</p>
        <button className="btn btn-primary" onClick={goAnalyze}>Analyze a job <Icon name="arrowRight" size={15} /></button>
      </div>
    );
  }

  const count = (s) => jobs.filter((j) => j.status === s).length;
  const avg = Math.round(jobs.reduce((n, j) => n + j.score, 0) / jobs.length);
  const shown = jobs
    .filter((j) => filter === "All" || j.status === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const patch = (id, changes) => setJobs(jobs.map((j) => (j.id === id ? { ...j, ...changes } : j)));
  const update = (id, status) => {
    const job = jobs.find((j) => j.id === id);
    // Moving to "Applied" starts the follow-up clock.
    const extra = status === "Applied" && !job.appliedDate
      ? { appliedDate: today(), followUp: addDays(today(), FOLLOW_UP_DAYS) } : {};
    patch(id, { status, ...extra });
  };
  const remove = (id) => setJobs(jobs.filter((j) => j.id !== id));

  const stats = [
    { label: "Total tracked", value: jobs.length, icon: "briefcase", tone: "primary" },
    { label: "Applied", value: count("Applied"), icon: "send", tone: "primary" },
    { label: "Interviewing", value: count("Interviewing"), icon: "calendar", tone: "warning" },
    { label: "Average match", value: `${avg}%`, icon: "target", tone: "success" },
  ];

  return (
    <div className="stack">
      <FollowUps jobs={jobs} patch={patch} />
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <span className={`header-icon ${s.tone}`}><Icon name={s.icon} /></span>
            <div>
              <p className="stat-label">{s.label}</p>
              <p className="stat-value">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-header wrap">
          <div className="grow">
            <h2>Application log</h2>
            <p>Change a status from the dropdown. Changes save automatically.</p>
          </div>
          <div className="segmented" role="tablist">
            {["All", ...STATUSES].map((s) => (
              <button key={s} role="tab" aria-selected={filter === s} className={filter === s ? "active" : ""}
                onClick={() => setFilter(s)}>
                {s === "Saved / Target Later" ? "Saved" : s}
                <span className="seg-count">{s === "All" ? jobs.length : count(s)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company & role</th>
                <th>Match</th>
                <th>Verdict</th>
                <th>Date</th>
                <th>Status</th>
                <th>Follow-up</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => (
                <tr key={j.id}>
                  <td data-label="Company & role">
                    <div className="cell-company">
                      <span className="company-avatar sm">{j.company.charAt(0)}</span>
                      <div>
                        <strong>{j.company}</strong>
                        <div className="text-muted small">{j.role}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Match">
                    <div className="meter">
                      <span className={`meter-num tone-${j.verdict.key}`}>{j.score}%</span>
                      {j.firstScore != null && j.score !== j.firstScore && (
                        <Badge size="xs" variant="light" color={j.score > j.firstScore ? "green" : "red"}
                          title={`First analysis: ${j.firstScore}%`}>
                          {j.score > j.firstScore ? "▲" : "▼"} {Math.abs(j.score - j.firstScore)}
                        </Badge>
                      )}
                      <span className="meter-bar"><span className={`tone-bg-${j.verdict.key}`} style={{ width: `${j.score}%` }} /></span>
                    </div>
                  </td>
                  <td data-label="Verdict"><span className={`tag verdict-${j.verdict.key}`}>{j.verdict.label}</span></td>
                  <td data-label="Date" className="text-muted nowrap">{j.date}</td>
                  <td data-label="Status">
                    <select className={`status-select tone-${STATUS_TONE[j.status]}`} value={j.status}
                      onChange={(e) => update(j.id, e.target.value)} aria-label={`Status for ${j.company}`}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td data-label="Follow-up"><FollowUpCell job={j} patch={patch} /></td>
                  <td className="cell-actions">
                    <button className="icon-btn danger" title="Remove" aria-label={`Remove ${j.company}`} onClick={() => remove(j.id)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="text-muted pad">No applications with status “{filter}”.</p>}
        </div>
      </section>
    </div>
  );
}
