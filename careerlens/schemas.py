"""Structured-output schemas shared by the LLM layer and the UI."""

from typing import List, Literal

from pydantic import BaseModel, Field


class Strength(BaseModel):
    skill: str = Field(description="Short skill or project name, 1-4 words.")
    evidence: str = Field(
        description="Exact phrase or close paraphrase from the RESUME proving this skill."
    )
    jd_requirement: str = Field(description="The job-description requirement it satisfies.")


class SkillGap(BaseModel):
    skill: str = Field(
        description="Canonical short skill name, 1-3 words, Title Case (e.g. 'Docker', 'SQL', 'CI/CD')."
    )
    importance: Literal["critical", "important", "nice-to-have"]
    why_it_matters: str = Field(description="One sentence on how the JD uses this skill.")
    resource_title: str
    resource_url: str = Field(
        description="URL of a reputable FREE resource (official docs, freeCodeCamp, MDN, "
        "Kaggle Learn, Microsoft Learn, Google Cloud Skills Boost, fast.ai, etc.)."
    )
    project_title: str = Field(description="Name of a 1-weekend proof-of-work mini-project.")
    project_pitch: str = Field(description="1-2 sentences: what it is and why it impresses this employer.")
    build_steps: List[str] = Field(description="Exactly 3 concrete build steps.")


class FitAnalysis(BaseModel):
    company: str = Field(description="Company name from the JD, or 'Unknown'.")
    role: str = Field(description="Job title from the JD, or 'Unknown Role'.")
    match_score: int = Field(description="0-100 evidence-based match score.")
    score_rationale: str = Field(description="2-3 sentences explaining the score.")
    matched_strengths: List[Strength]
    missing_skills: List[SkillGap]


class JobPosting(BaseModel):
    title: str
    company: str
    location: str
    job_type: Literal["Internship", "Entry-level", "Graduate Program", "Apprenticeship"]
    tech_stack: List[str]
    experience_required: str = Field(description="Experience the posting asks for, e.g. 'Fresher', "
                                     "'0-1 years', '2+ years', or 'Not specified'.")
    min_years: int = Field(description="Minimum years of experience required as a number "
                           "(0 for fresher/intern roles), or -1 if not specified.")
    summary: str = Field(description="One-sentence pitch of the role.")
    description: str = Field(
        description="Full job description: About, Responsibilities (bullets), "
        "Requirements (bullets), Nice-to-have (bullets). 150-300 words."
    )


class LiveJobPosting(JobPosting):
    source: str = Field(description="Platform where the posting was found, e.g. LinkedIn, Naukri, Indeed, "
                        "Internshala, Glassdoor, Wellfound, or 'Company site'.")
    apply_url: str = Field(description="URL of the posting exactly as found in search results.")
    posted: str = Field(description="When it was posted if shown (e.g. '3 days ago'), else 'Unknown'.")


# Note: no default values in these schemas - Gemini's response_schema rejects defaults.
class JobFeed(BaseModel):
    search_query: str = Field(description="Short job-search query (role + key skills, max 6 words) "
                              "best suited to this candidate.")
    skills_used: List[str] = Field(description="The candidate's key skills used for matching (max 10).")
    jobs: List[JobPosting]


class WebJobPick(BaseModel):
    result_index: int = Field(description="Number of the search result this card is built from.")
    title: str
    company: str
    location: str
    job_type: Literal["Internship", "Entry-level", "Graduate Program", "Apprenticeship"]
    tech_stack: List[str] = Field(description="Skills named in the title/snippet (may be empty).")
    experience_required: str = Field(description="Experience asked for in the title/snippet, e.g. 'Fresher', "
                                     "'0-2 years', '3+ years'. Internships are 'Fresher'. Else 'Not specified'.")
    min_years: int = Field(description="Minimum years required as a number (0 for fresher/intern), "
                           "or -1 if the result doesn't say.")
    summary: str = Field(description="One sentence, only from the search result text.")
    match_reason: str = Field(description="One short sentence on why it fits the candidate.")


class WebJobPicks(BaseModel):
    jobs: List[WebJobPick]


class SearchProfile(BaseModel):
    search_query: str = Field(description="Job-board search keywords: a 2-3 word role title the candidate "
                              "should search for, e.g. 'AI intern', 'React developer', 'data analyst'.")
    skills_used: List[str] = Field(description="The candidate's key technical skills (max 10, short names).")
    experience_years: int = Field(description="Candidate's total full-time work experience in whole years, "
                                  "from the resume (students / fresh graduates = 0; internships don't count).")


class LiveJobFeed(BaseModel):
    search_query: str = Field(description="Short job-search query (role + key skills, max 6 words) "
                              "best suited to this candidate.")
    skills_used: List[str] = Field(description="The candidate's key skills used for matching (max 10).")
    jobs: List[LiveJobPosting]


# ---------------- Learning plan (Skill Gaps page) ----------------

class PlanTask(BaseModel):
    kind: Literal["learn", "build", "apply"] = Field(
        description="learn = study a resource, build = proof-of-work project step, apply = use it in applications.")
    title: str = Field(description="Short, concrete task, e.g. 'Finish Prompt Engineering for Developers course'.")
    detail: str = Field(description="One sentence on what exactly to do or produce.")
    resource_title: str = Field(description="Name of a free resource for this task, or '' if none.")
    resource_url: str = Field(description="URL of a reputable free resource (official docs, well-known free "
                              "course), or '' if none. Never invent obscure URLs.")
    hours: int = Field(description="Estimated hours for this task.")


class PlanWeek(BaseModel):
    week: int
    skill: str = Field(description="The main skill gap this week closes.")
    theme: str = Field(description="Short title for the week, e.g. 'Prompt engineering foundations'.")
    goal: str = Field(description="One sentence: what the user can show by the end of the week.")
    tasks: List[PlanTask]


class LearningPlan(BaseModel):
    summary: str = Field(description="2 sentences: the order chosen and why (highest ROI first).")
    weeks: List[PlanWeek]


# ---------------- Bulk job scoring (AI Job Finder) ----------------

class JobScore(BaseModel):
    index: int = Field(description="Number of the job in the list.")
    score: int = Field(description="0-100 evidence-based match score.")
    reason: str = Field(description="One short sentence: the main reason for the score.")
    top_gap: str = Field(description="The most important missing skill, or 'None'.")


class JobScores(BaseModel):
    scores: List[JobScore]
