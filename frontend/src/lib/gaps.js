// Cross-job skill-gap analytics, computed in the browser from tracked jobs.

export const STATUSES = ["Saved / Target Later", "Applied", "Interviewing", "Offer", "Rejected"];
const WEIGHT = { critical: 3, important: 2, "nice-to-have": 1 };

const norm = (s) => s.toLowerCase().replace(/-/g, " ").split(/\s+/).filter(Boolean).join(" ");

/** For each skill: how many tracked jobs list it as missing. Sorted by job count, then importance weight. */
export function aggregateGaps(jobs) {
  const rows = new Map();
  for (const job of jobs) {
    const seen = new Set(); // count a skill at most once per job
    for (const gap of job.missingSkills) {
      const key = norm(gap.skill);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = rows.get(key) ?? { skill: gap.skill, jobs: 0, weight: 0, critical: 0, roles: [] };
      row.jobs += 1;
      row.weight += WEIGHT[gap.importance] ?? 1;
      if (gap.importance === "critical") row.critical += 1;
      row.roles.push(`${job.company} – ${job.role}`);
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.jobs - a.jobs || b.weight - a.weight);
}
