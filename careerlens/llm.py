"""AI calls: resume/JD fit analysis and AI job discovery.

Two interchangeable providers, both returning the same Pydantic objects (schemas.py):
  - Google Gemini (free tier)  -> set GEMINI_API_KEY
  - Anthropic Claude           -> set ANTHROPIC_API_KEY
Pick explicitly with LLM_PROVIDER=gemini|claude; otherwise Claude is used when its key is set,
else Gemini.
"""

from __future__ import annotations

import os

import json
import re

from .jobsources import JobSourceError, adzuna_configured, search_adzuna, web_search_jobs
from .schemas import FitAnalysis, JobFeed, LiveJobFeed, LiveJobPosting, SearchProfile, WebJobPicks

CLAUDE_MODEL = os.getenv("CAREERLENS_MODEL", "claude-opus-5-5")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_FAST_MODEL = os.getenv("GEMINI_FAST_MODEL", "gemini-3.5-flash-lite")  # for the job finder
# Tried in order when the main model is overloaded (503) or out of free quota (429).
GEMINI_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.6-flash,gemini-3.5-flash-lite").split(",")
    if m.strip()
]


def provider() -> str:
    explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
    if explicit in ("gemini", "claude"):
        return explicit
    return "claude" if os.getenv("ANTHROPIC_API_KEY") else "gemini"


ANALYZE_SYSTEM = """You are CareerLens, a strict, evidence-based career advisor for fresh graduates \
and early-career engineers.

SCORING RULES (follow exactly):
- Score ONLY on evidence explicitly present in the resume text. Never infer a skill that is not \
written down. If the resume says "Python" but not "FastAPI", FastAPI is missing.
- Every matched strength MUST quote or closely paraphrase resume text as evidence. If you cannot \
point to resume text, it is not a strength.
- Weight requirements by importance: core/must-have requirements dominate the score; \
nice-to-haves move it only slightly.
- Calibration: 75-100 = meets nearly all must-haves with evidence; 50-74 = meets most must-haves \
but has 1-3 meaningful gaps; below 50 = missing several must-haves.
- Do not inflate scores to be encouraging. Be honest and specific.

GAP RULES:
- List the most important missing skills (max 6), most critical first.
- Use short canonical skill names (e.g. "Docker", "SQL", "AWS", "React", "Unit Testing") so gaps \
can be aggregated across many job applications.
- For each gap give one reputable, free, stable learning resource URL (prefer official docs or \
well-known free platforms). Do not invent obscure URLs.
- For each gap design a mini-project buildable in one weekend that produces public GitHub proof, \
ideally themed around the target company's domain, with exactly 3 concrete build steps."""

FINDER_SYSTEM = """You generate realistic, high-quality SAMPLE job postings for internship and \
entry-level tech roles, tailored to a candidate's skills. These are illustrative examples to help \
the candidate practice evaluating fit and discover role types and keywords to search for; they are \
not live listings. Vary company types (startups, scale-ups, enterprises, non-profits), domains and \
locations. Use plausible but clearly generic or fictional company names - never real company names. \
Requirements should be realistic for junior roles, including some skills beyond the candidate's \
stack so fit analysis is meaningful. If a resume is given, first extract the candidate's key skills from it and match on those."""

PICK_SYSTEM = """You turn raw web search results into job cards for a candidate. Use ONLY facts present in each result's title and snippet - never invent salary, requirements or details. Reference each card by its result number. Skip search/listing pages that cover many jobs, duplicates, and roles clearly unsuitable for a fresh graduate. Order cards by best fit first, and when fits are \
similar prefer a mix of platforms (LinkedIn, Internshala, Wellfound, ...)."""


PROFILE_SYSTEM = """From the candidate's resume and/or skills, produce a job-board search profile: \
a short 2-3 word role title to search for (match the desired role if given, otherwise the best-fit \
role for their experience level) and their key technical skills. Use short canonical skill names. \nEstimate total full-time work experience in years (students / fresh graduates = 0)."""

class LLMError(RuntimeError):
    """Raised with a user-facing message when an AI call fails."""


def _parse(system: str, user: str, schema, effort: str, search: bool = False):
    if provider() == "claude":
        if search:
            raise LLMError("Live web search is only wired up for Gemini.")
        return _parse_claude(system, user, schema, effort)
    return _parse_gemini(system, user, schema, search, fast=(effort == "low"))


# ---------------- Google Gemini ----------------

def _extract_json(text: str, schema):
    """Validate JSON from free text (used when the model can't use response_schema)."""
    text = re.sub(r"^```(?:json)?|```$", "", (text or "").strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in response")
    return schema.model_validate(json.loads(text[start:end + 1]))


def _parse_gemini(system: str, user: str, schema, search: bool = False, fast: bool = False):
    from google import genai
    from google.genai import errors, types

    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        raise LLMError("No Gemini API key found. Set GEMINI_API_KEY on the server (free at aistudio.google.com).")
    # Keep a reference: an inline Client() is closed before the request is sent.
    # One quick retry per model, then move on to the next model instead of waiting.
    client = genai.Client(http_options=types.HttpOptions(
        timeout=120_000,  # ms
        retry_options=types.HttpRetryOptions(attempts=2, initial_delay=1.0, max_delay=4.0),
    ))
    if search:
        # Google Search grounding: the model looks up real pages before answering.
        # JSON shape is requested in the prompt (schema + tools isn't supported on every model).
        system = (system + "\n\nReturn ONLY a JSON object (no prose, no markdown) matching this JSON schema:\n"
                  + json.dumps(schema.model_json_schema()))
        config = types.GenerateContentConfig(
            system_instruction=system,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            max_output_tokens=16000,
        )
    else:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,  # Gemini returns JSON matching the Pydantic model
            max_output_tokens=16000,
        )
    models = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
    if fast:  # simple tasks (job finder): lightest, least-loaded model first
        models = [GEMINI_FAST_MODEL] + [m for m in models if m != GEMINI_FAST_MODEL]
    response = None
    last_busy = None
    for model in models:
        try:
            response = client.models.generate_content(model=model, contents=user, config=config)
            break
        except errors.ServerError as e:  # 5xx: model overloaded -> try the next model
            last_busy = e
        except errors.ClientError as e:
            if e.code == 429:  # quota for this model used up -> try the next model
                if search:  # search grounding quota is per key; other models won't help
                    raise LLMError("web-search quota reached for this API key") from e
                last_busy = e
                continue
            if e.code == 404 and model != models[-1]:  # model retired/renamed -> try the next model
                continue
            if e.code in (400, 401, 403) and "API key" in str(e):
                raise LLMError("Gemini rejected the API key. Check GEMINI_API_KEY in your .env file.") from e
            if e.code == 404:
                raise LLMError(f"Gemini model '{model}' not found. Set GEMINI_MODEL to a current model.") from e
            raise LLMError(f"Gemini request failed ({e.code}): {e.message}") from e
        except errors.APIError as e:
            raise LLMError(f"Gemini API error: {e.message}") from e
    if response is None:
        if isinstance(last_busy, errors.ClientError):
            raise LLMError("Gemini free-tier quota reached on all models. Wait a minute (or until tomorrow) and retry.") from last_busy
        raise LLMError("Gemini is overloaded right now on all models. Please retry in a minute.") from last_busy

    feedback = getattr(response, "prompt_feedback", None)
    if feedback is not None and feedback.block_reason:
        raise LLMError("Gemini blocked this request. Try rephrasing or trimming the input.")
    finish = response.candidates[0].finish_reason if response.candidates else None
    if finish is not None and finish.name == "MAX_TOKENS":
        raise LLMError("The model's response was cut off. Please retry.")
    if not search and isinstance(response.parsed, schema):
        return response.parsed
    try:  # fall back to validating the raw JSON text ourselves
        return _extract_json(response.text, schema)
    except ValueError as e:
        raise LLMError("The model returned an unexpected format. Please retry.") from e


# ---------------- Anthropic Claude ----------------

def _parse_claude(system: str, user: str, schema, effort: str):
    import anthropic

    try:
        response = anthropic.Anthropic().beta.messages.parse(
            model=CLAUDE_MODEL,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
            output_config={"effort": effort},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as e:
        raise LLMError("Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY.") from e
    except anthropic.RateLimitError as e:
        raise LLMError("Rate limited by the Anthropic API - wait a moment and retry.") from e
    except anthropic.BadRequestError as e:
        raise LLMError(f"Request rejected by the API: {e.message}") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"Anthropic API error ({e.status_code}). Please retry.") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("Could not reach the Anthropic API. Check your network.") from e
    except anthropic.AnthropicError as e:
        raise LLMError(f"Anthropic client error: {e}") from e
    except TypeError as e:  # the SDK raises TypeError when no credentials can be resolved
        raise LLMError("No Anthropic credentials found. Set ANTHROPIC_API_KEY on the server.") from e

    if response.stop_reason == "refusal":
        raise LLMError("The model declined this request. Try rephrasing or trimming the input.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise LLMError("The model's response was incomplete. Please retry.")
    return response.parsed_output


def analyze_fit(resume_text: str, job_description: str) -> FitAnalysis:
    user = (
        "<resume>\n" + resume_text.strip() + "\n</resume>\n\n"
        "<job_description>\n" + job_description.strip() + "\n</job_description>\n\n"
        "Evaluate this resume against the job description following the scoring and gap rules."
    )
    result: FitAnalysis = _parse(ANALYZE_SYSTEM, user, FitAnalysis, effort="medium")
    result.match_score = max(0, min(100, int(result.match_score)))
    for gap in result.missing_skills:
        gap.build_steps = gap.build_steps[:3]
    return result


# Experience levels offered in the UI -> (label, max years the candidate has)
EXPERIENCE_LEVELS = {
    "fresher": ("Fresher / student", 0),
    "0-1": ("0-1 years", 1),
    "1-3": ("1-3 years", 3),
    "3-5": ("3-5 years", 5),
    "5+": ("5+ years", 50),
}


def _level_for_years(years: int) -> str:
    years = max(0, years)
    return "fresher" if years == 0 else "0-1" if years <= 1 else "1-3" if years <= 3 else "3-5" if years <= 5 else "5+"


def experience_fit(min_years: int, candidate_max: int) -> str:
    """'match' | 'stretch' (1 year above) | 'over' (needs more) | 'unknown' (posting doesn't say)."""
    if min_years is None or min_years < 0:
        return "unknown"
    if min_years <= candidate_max:
        return "match"
    return "stretch" if min_years <= candidate_max + 1 else "over"


_FIT_ORDER = {"match": 0, "unknown": 1, "stretch": 2, "over": 3}


def find_jobs(skills: str, role_hint: str, location: str, resume_text: str = "",
              live: bool = True, experience: str = "", count: int = 6) -> dict:
    """Returns the feed as a dict plus live / notice / candidate experience; each job gets experience_fit.

    Live mode searches the web; falls back to sample postings. Experience comes from the form, or is
    estimated from the resume when the form says "auto".
    """
    level = experience if experience in EXPERIENCE_LEVELS else ""
    parts = []
    if resume_text.strip():
        parts.append("<resume>\n" + resume_text.strip()[:15000] + "\n</resume>")
    if skills.strip():
        parts.append(f"Candidate skills / keywords: {skills.strip()}")
    parts.append(f"Desired role: {role_hint.strip() or 'any relevant junior tech role'}")
    parts.append(f"City / location: {location.strip() or 'any (include remote options)'}")
    if level:
        parts.append(f"Candidate experience: {EXPERIENCE_LEVELS[level][0]}")
    base = "\n".join(parts) + "\n\n"

    def finish(feed, is_live: bool, notice: str, lvl: str) -> dict:
        lvl = lvl or "fresher"
        cap = EXPERIENCE_LEVELS[lvl][1]
        out = feed.model_dump()
        for job in out["jobs"]:
            job["experience_fit"] = experience_fit(job.get("min_years", -1), cap)
        out["jobs"].sort(key=lambda j: _FIT_ORDER[j["experience_fit"]])  # stable: keeps best-fit order
        return {**out, "live": is_live, "notice": notice,
                "experience_level": lvl, "experience_label": EXPERIENCE_LEVELS[lvl][0]}

    notice = ""
    if live:
        # 1) search keywords + skills + experience (from the resume, or straight from the form)
        if skills.strip() and not resume_text.strip():  # no AI call needed: build keywords directly
            skill_list = [x.strip() for x in re.split(r"[,;\n]", skills) if x.strip()][:10]
            junior = EXPERIENCE_LEVELS[level or "fresher"][1] <= 1
            profile = SearchProfile(
                search_query=role_hint.strip() or f"{' '.join(skill_list[:2])} {'intern' if junior else 'developer'}",
                skills_used=skill_list, experience_years=EXPERIENCE_LEVELS[level or "fresher"][1])
        else:
            profile = _parse(PROFILE_SYSTEM, base + "Build the job-search profile.", SearchProfile, effort="low")
            if role_hint.strip():
                profile.search_query = role_hint.strip()
        level = level or _level_for_years(profile.experience_years)
        if not any(f"Candidate experience" in p for p in parts):
            base += f"Candidate experience: {EXPERIENCE_LEVELS[level][0]}\n\n"
        query = profile.search_query
        if EXPERIENCE_LEVELS[level][1] <= 1 and not re.search(r"intern|fresher|graduate|trainee", query, re.I):
            query += " fresher"

        # 2a) Adzuna job API, if keys are configured
        if adzuna_configured():
            try:
                jobs = search_adzuna(query, location.strip(), profile.skills_used, count=max(count, 8))
                if jobs:
                    return finish(LiveJobFeed(search_query=query, skills_used=profile.skills_used, jobs=jobs),
                                  True, "", level)
            except JobSourceError:
                pass  # fall through to web search

        # 2b) Web search across job boards (Tavily if keyed, else free DuckDuckGo/ddgs)
        results, engine = web_search_jobs(query, location)
        if results:
            listing = "\n".join(f"[{i}] ({r['platform']}) {r['title']}\n    {r['snippet']}"
                                for i, r in enumerate(results))
            user = (base + f"Search results for '{query}':\n{listing}\n\n"
                    f"Pick up to {count + 2} results that are single job postings matching this candidate's "
                    "skills, experience level and location (drop results in a different country or city unless "
                    "remote). Build each card ONLY from that result's title and snippet; use 'Not specified' "
                    "for anything not shown.")
            picks = _parse(PICK_SYSTEM, user, WebJobPicks, effort="low")
            jobs, used = [], set()
            for pick in picks.jobs:
                i = pick.result_index
                if 0 <= i < len(results) and i not in used:  # links always come from the real result
                    used.add(i)
                    r = results[i]
                    jobs.append(LiveJobPosting(
                        title=pick.title, company=pick.company, location=pick.location, job_type=pick.job_type,
                        tech_stack=pick.tech_stack, experience_required=pick.experience_required,
                        min_years=pick.min_years, summary=pick.summary,
                        description=(f"{pick.title} - {pick.company} ({pick.location})\n"
                                     f"Experience: {pick.experience_required}\n\n{r['snippet']}\n\n"
                                     f"Why it fits: {pick.match_reason}\n\nFull posting: {r['url']}"),
                        source=r["platform"], apply_url=r["url"], posted="Unknown"))
            if jobs:
                return finish(LiveJobFeed(search_query=query, skills_used=profile.skills_used, jobs=jobs),
                              True, f"Found via {engine} web search.", level)
        notice = (f'No live postings found for "{query}" right now, so these are AI sample roles. '
                  "Use the platform links below to see real listings.")

    user = base + (f"Generate exactly {count} sample postings that match this candidate's skills and experience "
                   "level (internship / entry-level for freshers; matching seniority otherwise).")
    feed = _parse(FINDER_SYSTEM, user, JobFeed, effort="low")
    return finish(feed, False, notice, level)


# ---------------- Learning plan ----------------

PLAN_SYSTEM = """You are CareerLens, a practical learning coach for fresh graduates. Turn the user's \
skill gaps (aggregated across the jobs they're targeting) into a realistic week-by-week plan.

RULES:
- Cover ONLY the listed skills. Order by ROI: skills missing in the most jobs and flagged critical come
  first; skills the user chose themselves come after unless they are prerequisites.
- Respect the weekly time budget: the hours of a week's tasks must add up to roughly that budget.
- Each week: 1 main skill, 3-5 tasks mixing 'learn' (a free resource), 'build' (a small proof-of-work \
project step that ends up on GitHub) and, at the end of a skill, 'apply' (e.g. add the project to the \
resume, update LinkedIn, re-analyze a target job).
- Big skills may span 2 weeks; small ones can share a week. Do not exceed the requested number of weeks.
- Use reputable free resources only (official docs, freeCodeCamp, Kaggle Learn, Microsoft Learn, \
Google Skills Boost, DeepLearning.AI short courses, fast.ai). Never invent obscure URLs.
- If a resume is given, skip basics the user already knows and build on their existing projects."""


def learning_plan(gaps: list[dict], resume_text: str = "", hours_per_week: int = 10, weeks: int = 6):
    from .schemas import LearningPlan

    lines = "\n".join(
        f"- {g['skill']}: missing in {g['jobs']} job(s), critical in {g.get('critical', 0)}" if g["jobs"]
        else f"- {g['skill']}: chosen by the user to learn (not from tracked jobs)" for g in gaps[:12])
    user = ""
    if resume_text.strip():
        user += "<resume>\n" + resume_text.strip()[:12000] + "\n</resume>\n\n"
    user += (f"Skills I want this plan to cover (gaps from my target jobs, plus any I chose myself):\n{lines}\n\n"
             f"Time budget: {hours_per_week} hours per week. Plan length: at most {weeks} weeks.\n"
             "Build my week-by-week plan.")
    plan = _parse(PLAN_SYSTEM, user, LearningPlan, effort="low")
    plan.weeks = plan.weeks[:weeks]
    for i, w in enumerate(plan.weeks, 1):
        w.week = i
    return plan


# ---------------- Bulk job scoring ----------------

SCORE_SYSTEM = """You are CareerLens, a strict, evidence-based resume screener. Score the resume \
against EACH job in the list, independently.

RULES:
- Score only on evidence explicitly written in the resume; never infer unlisted skills.
- Core requirements dominate; nice-to-haves move the score only slightly.
- Calibration: 75-100 meets nearly all must-haves; 50-74 meets most with 1-3 gaps; below 50 misses several.
- Some job texts are short search snippets: score on what is stated, and keep scores moderate (40-75) \
when the posting says little.
- Return exactly one entry per job, using its number as index."""


def score_jobs(resume_text: str, jobs: list[dict]):
    from .schemas import JobScores

    listing = "\n\n".join(
        f"[{i}] {j.get('title', '')} - {j.get('company', '')}\n{(j.get('description') or '')[:1500]}"
        for i, j in enumerate(jobs))
    user = ("<resume>\n" + resume_text.strip()[:12000] + "\n</resume>\n\n"
            f"<jobs>\n{listing}\n</jobs>\n\nScore the resume against every job.")
    result = _parse(SCORE_SYSTEM, user, JobScores, effort="low")
    by_index = {}
    for s in result.scores:
        if 0 <= s.index < len(jobs) and s.index not in by_index:
            s.score = max(0, min(100, int(s.score)))
            by_index[s.index] = s
    return [by_index.get(i) for i in range(len(jobs))]
