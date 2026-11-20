"""Real job listings from the Adzuna API (free developer key: https://developer.adzuna.com).

Adzuna aggregates postings from many job boards and company sites, searchable by keyword and city.
Set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env; ADZUNA_COUNTRY defaults to "in" (India).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from html import unescape


def adzuna_configured() -> bool:
    return bool(os.getenv("ADZUNA_APP_ID") and os.getenv("ADZUNA_APP_KEY"))


class JobSourceError(RuntimeError):
    pass


def _get(what: str, where: str, count: int) -> list[dict]:
    country = os.getenv("ADZUNA_COUNTRY", "in").lower()
    params = {
        "app_id": os.environ["ADZUNA_APP_ID"],
        "app_key": os.environ["ADZUNA_APP_KEY"],
        "results_per_page": count,
        "what": what,
        "sort_by": "date",
        "max_days_old": 45,
        "content-type": "application/json",
    }
    if where and not re.search(r"remote|any", where, re.I):
        params["where"] = where
    url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.load(r).get("results", [])
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise JobSourceError("Adzuna rejected the keys - check ADZUNA_APP_ID / ADZUNA_APP_KEY in .env") from e
        raise JobSourceError(f"Adzuna error {e.code}") from e
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise JobSourceError("couldn't reach Adzuna") from e


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", text or ""))).strip()


def search_adzuna(query: str, city: str, skills: list[str], count: int = 8) -> list[dict]:
    """Returns postings shaped like schemas.LiveJobPosting. Broadens the query if nothing matches."""
    words = query.split()
    attempts = [query] + ([" ".join(words[:2])] if len(words) > 2 else []) + ([words[0]] if len(words) > 1 else [])
    results: list[dict] = []
    for what in attempts:
        results = _get(what, city, count)
        if results:
            break

    jobs = []
    for r in results:
        title = _clean(r.get("title", ""))
        desc = _clean(r.get("description", ""))
        hay = f"{title} {desc}".lower()
        stack = [s for s in skills if re.search(r"(?<![a-z0-9])" + re.escape(s.lower()) + r"(?![a-z0-9])", hay)]
        created = (r.get("created") or "")[:10]
        yrs = re.search(r"(\d{1,2})\s*(?:\+|-|to)?\s*\d{0,2}\s*(?:years?|yrs?)", hay)
        fresher = re.search(r"intern|fresher|graduate|trainee", hay)
        min_years = int(yrs.group(1)) if yrs else (0 if fresher else -1)
        jobs.append({
            "title": title or "Untitled role",
            "company": _clean((r.get("company") or {}).get("display_name", "")) or "Company not listed",
            "location": _clean((r.get("location") or {}).get("display_name", "")) or city or "Not specified",
            "job_type": "Internship" if re.search(r"\bintern", hay) else "Entry-level",
            "tech_stack": stack[:8],
            "experience_required": f"{min_years}+ years" if min_years > 0 else "Fresher" if min_years == 0 else "Not specified",
            "min_years": min_years,
            "summary": (desc[:160] + "…") if len(desc) > 160 else desc,
            "description": f"{title}\n\n{desc}",
            "source": "Adzuna",
            "apply_url": r.get("redirect_url", ""),
            "posted": created or "Unknown",
        })
    return jobs


# ---------------- Web search (Tavily, falling back to DuckDuckGo) ----------------
# Finds real job pages; the LLM then turns the results into job cards (llm.find_jobs).

JOB_SITES = {  # domain -> path that marks a single posting (vs. a search/listing page)
    "linkedin.com": "/jobs/view",
    "naukri.com": "/job-listings",
    "indeed.com": "/viewjob",
    "internshala.com": "/internship/detail",
    "glassdoor.co.in": "/job-listing",
    "wellfound.com": "/jobs/",
    "foundit.in": "/job/",
    "cutshort.io": "/job/",
    "instahyre.com": "/job-",
}
PLATFORM_NAMES = {"linkedin.com": "LinkedIn", "naukri.com": "Naukri", "indeed.com": "Indeed",
                  "internshala.com": "Internshala", "glassdoor.co.in": "Glassdoor", "wellfound.com": "Wellfound",
                  "foundit.in": "Foundit", "cutshort.io": "Cutshort", "instahyre.com": "Instahyre"}


def platform_of(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    for domain, name in PLATFORM_NAMES.items():
        if host == domain or host.endswith("." + domain):
            return name
    return "Company site"


def _is_posting(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    for domain, marker in JOB_SITES.items():
        if parsed.netloc.lower().endswith(domain):
            return marker in parsed.path
    return True  # company career pages etc.


def _tavily(query: str, n: int, domains: list[str] | None = None) -> list[dict]:
    body = json.dumps({"query": query, "max_results": n, "search_depth": "basic",
                       "include_domains": domains or list(JOB_SITES)}).encode()
    req = urllib.request.Request("https://api.tavily.com/search", data=body, method="POST", headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {os.environ['TAVILY_API_KEY']}"})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.load(r)
    return [{"title": x.get("title", ""), "url": x.get("url", ""), "snippet": x.get("content", "")}
            for x in data.get("results", [])]


def _duckduckgo(query: str, n: int) -> list[dict]:
    """Free, no key: the ddgs library queries Google/Bing/Yahoo, skipping whichever is rate-limited."""
    from ddgs import DDGS
    from ddgs.exceptions import DDGSException
    hits = []
    for backend in ("google,bing,yahoo", "bing,yahoo,google"):  # one retry in a different order
        try:
            hits = DDGS(timeout=15).text(query, max_results=n, backend=backend) or []
        except DDGSException:  # "No results found" / throttled
            hits = []
        if hits:
            break
    return [{"title": x.get("title", ""), "url": x.get("href", ""), "snippet": x.get("body", "")} for x in hits]


def web_search_jobs(query: str, city: str, limit: int = 25, enough: int = 10) -> tuple[list[dict], str]:
    """Returns (results, engines used). Each result: title, url, snippet, platform. Only single postings.

    Tavily (if keyed) runs first, one search per job site; the free ddgs search tops up when
    Tavily finds fewer than `enough` single postings (most hits are often listing pages).
    """
    from concurrent.futures import ThreadPoolExecutor

    where = city.strip() if city.strip() else "India"
    sites = ["linkedin.com/jobs/view", "internshala.com/internship/detail", "in.indeed.com/viewjob",
             "naukri.com/job-listings", "wellfound.com/jobs"]

    engines = []
    if os.getenv("TAVILY_API_KEY"):
        domains = [["linkedin.com"], ["internshala.com"], ["wellfound.com"], ["naukri.com", "indeed.com"],
                   ["instahyre.com", "cutshort.io", "foundit.in", "glassdoor.co.in"]]
        engines.append(("Tavily", lambda d: _tavily(f"{query} job opening {where}", 10, d), domains))
    engines.append(("DuckDuckGo", lambda q: _duckduckgo(q, 8), [f"{query} {where} site:{s}" for s in sites]))

    seen, results, used = set(), [], []
    for engine, run, args in engines:
        try:
            with ThreadPoolExecutor(max_workers=len(args)) as pool:
                batches = list(pool.map(run, args))
        except Exception:  # network error / bad key / quota -> try the next engine
            continue
        before = len(results)
        for batch in batches:
            for r in batch:
                url = r["url"]
                if url and url not in seen and _is_posting(url):
                    seen.add(url)
                    results.append({**r, "url": url, "snippet": _clean(r["snippet"])[:400],
                                    "platform": platform_of(url)})
        if len(results) > before:
            used.append(engine)
        if len(results) >= enough:
            break
    return results[:limit], " + ".join(used)
