"""FastAPI backend: keeps the AI API key server-side; AI endpoints plus accounts/profiles.

Run:  uvicorn careerlens.api:app --reload --port 8000
"""

from __future__ import annotations

from itertools import chain
from pathlib import Path
from typing import List, Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from . import auth
from .chat import chat_stream
from .core import extract_pdf_text, verdict_for
from .llm import (CLAUDE_MODEL, GEMINI_MODEL, LLMError, analyze_fit, find_jobs, learning_plan, provider,
                  score_jobs)

MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_CHARS = 60_000

app = FastAPI(title="CareerLens API")


class AnalyzeRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=MAX_CHARS)
    job_description: str = Field(min_length=50, max_length=MAX_CHARS)


class FindJobsRequest(BaseModel):
    skills: str = Field(default="", max_length=500)
    resume_text: str = Field(default="", max_length=MAX_CHARS)
    role: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=200)
    live: bool = True
    experience: str = Field(default="", max_length=20)  # "", fresher, 0-1, 1-3, 3-5, 5+ ("" = from resume)

    @model_validator(mode="after")
    def need_skills_or_resume(self):
        if len(self.skills.strip()) < 2 and len(self.resume_text.strip()) < 50:
            raise ValueError("Enter some skills or add your resume.")
        return self


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)
    resume_text: str = Field(default="", max_length=MAX_CHARS)
    job_description: str = Field(default="", max_length=MAX_CHARS)
    analysis: str = Field(default="", max_length=20_000)


class GapIn(BaseModel):
    skill: str = Field(min_length=1, max_length=100)
    jobs: int = Field(ge=0, le=1000)
    critical: int = Field(default=0, ge=0, le=1000)


class PlanRequest(BaseModel):
    gaps: List[GapIn] = Field(min_length=1, max_length=30)
    resume_text: str = Field(default="", max_length=MAX_CHARS)
    hours_per_week: int = Field(default=10, ge=2, le=40)
    weeks: int = Field(default=6, ge=1, le=12)


class JobIn(BaseModel):
    title: str = Field(default="", max_length=300)
    company: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=6000)


class ScoreJobsRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=MAX_CHARS)
    jobs: List[JobIn] = Field(min_length=1, max_length=12)


@app.get("/api/health")
def health():
    p = provider()
    return {"ok": True, "provider": p, "model": CLAUDE_MODEL if p == "claude" else GEMINI_MODEL}


@app.post("/api/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF is larger than 10 MB.")
    try:
        text = extract_pdf_text(data)
    except Exception:
        raise HTTPException(422, "Couldn't read that PDF. Is it a valid, unencrypted PDF?")
    if not text:
        raise HTTPException(422, "No text found - the PDF may be a scanned image. Paste the text instead.")
    return {"text": text, "words": len(text.split())}


# Plain `def` endpoints run in FastAPI's threadpool, so the blocking Claude calls don't stall the server.
@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    try:
        result = analyze_fit(req.resume_text, req.job_description)
    except LLMError as e:
        raise HTTPException(502, str(e))
    return {**result.model_dump(), "verdict": verdict_for(result.match_score).to_dict()}


@app.post("/api/find-jobs")
def find(req: FindJobsRequest):
    try:
        return find_jobs(req.skills, req.role, req.location, req.resume_text, req.live, req.experience)
    except LLMError as e:
        raise HTTPException(502, str(e))


@app.post("/api/learning-plan")
def plan(req: PlanRequest):
    try:
        result = learning_plan([g.model_dump() for g in req.gaps], req.resume_text, req.hours_per_week, req.weeks)
    except LLMError as e:
        raise HTTPException(502, str(e))
    return result.model_dump()


@app.post("/api/score-jobs")
def score(req: ScoreJobsRequest):
    try:
        scores = score_jobs(req.resume_text, [j.model_dump() for j in req.jobs])
    except LLMError as e:
        raise HTTPException(502, str(e))
    return {"scores": [
        None if s is None else {**s.model_dump(), "verdict": verdict_for(s.score).to_dict()} for s in scores
    ]}


@app.post("/api/chat")
def chat(req: ChatRequest):
    """Streams the coach's reply as plain text. Errors before the first chunk return a normal 502."""
    msgs = [m.model_dump() for m in req.messages][-20:]  # keep the prompt small: last 20 turns
    if msgs[-1]["role"] != "user":
        raise HTTPException(422, "The last message must be from the user.")
    stream = chat_stream(msgs, req.resume_text, req.job_description, req.analysis)
    try:
        first = next(stream)
    except LLMError as e:
        raise HTTPException(502, str(e))
    except StopIteration:
        raise HTTPException(502, "The coach returned an empty reply. Please retry.")

    def body():
        try:
            yield from chain([first], stream)
        except LLMError as e:
            yield f"\n\n_({e})_"

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------- Accounts ----------------

class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class ProfileRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    profile: dict = Field(default_factory=dict)


class PasswordRequest(BaseModel):
    current: str = Field(min_length=1, max_length=200)
    new: str = Field(min_length=1, max_length=200)


def _token(authorization: str | None) -> str:
    return authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else ""


def current_user(authorization: str | None = Header(default=None)) -> dict:
    user = auth.user_for_token(_token(authorization))
    if user is None:
        raise HTTPException(401, "Please log in again.")
    return user


@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    try:
        token, user = auth.signup(req.name, req.email, req.password)
    except auth.AuthError as e:
        raise HTTPException(400, str(e))
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    try:
        token, user = auth.login(req.email, req.password)
    except auth.AuthError as e:
        raise HTTPException(401, str(e))
    return {"token": token, "user": user}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    auth.logout(_token(authorization))
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return {"user": user}


@app.put("/api/profile")
def save_profile(req: ProfileRequest, user: dict = Depends(current_user)):
    try:
        return {"user": auth.update_profile(user["id"], req.name, req.profile)}
    except auth.AuthError as e:
        raise HTTPException(400, str(e))


@app.post("/api/profile/password")
def change_password(req: PasswordRequest, user: dict = Depends(current_user)):
    try:
        auth.change_password(user["id"], req.current, req.new)
    except auth.AuthError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


# In production, serve the built React app from the same server (one deployable service).
# Client-side routes (/login, /app/finder, ...) all fall back to index.html.
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
