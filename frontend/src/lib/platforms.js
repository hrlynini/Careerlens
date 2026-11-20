// Prefilled search links on the major job platforms for a query + city.
// These always work (no API needed), so users can see every live listing themselves.

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function platformLinks(query, city) {
  const q = encodeURIComponent(query.trim());
  const c = city.trim();
  const l = encodeURIComponent(c);
  const remote = !c || /remote/i.test(c);
  return [
    { name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${q}${c ? `&location=${l}` : ""}` },
    { name: "Naukri", url: `https://www.naukri.com/${slug(query)}-jobs${remote ? "" : `-in-${slug(c)}`}` },
    { name: "Indeed", url: `https://in.indeed.com/jobs?q=${q}${c ? `&l=${l}` : ""}` },
    { name: "Internshala", url: `https://internshala.com/internships/${slug(query)}-internship${remote ? "" : `-in-${slug(c)}`}/` },
    { name: "Glassdoor", url: `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${encodeURIComponent(`${query} ${c}`.trim())}` },
    { name: "Wellfound", url: `https://wellfound.com/jobs?query=${q}` },
    { name: "Google Jobs", url: `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent(`${query} jobs ${c}`.trim())}` },
  ];
}
