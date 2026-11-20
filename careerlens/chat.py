"""Resume Coach: a streaming chat grounded in the user's resume (and latest job analysis, if any)."""

from __future__ import annotations

import os
from typing import Iterator

from .llm import (CLAUDE_MODEL, GEMINI_FALLBACK_MODELS, GEMINI_FAST_MODEL, GEMINI_MODEL, LLMError,
                  provider)

COACH_SYSTEM = """You are CareerLens Coach, a friendly, honest career coach for fresh graduates and \
early-career engineers. You help the user improve their resume and job applications.

GROUNDING RULES (follow strictly):
- Base every claim about the user on the RESUME below. Quote or point to the exact resume line when \
you give feedback on it.
- Never invent experience, skills, numbers, dates, names or achievements the resume doesn't contain. \
When a rewrite needs a detail that isn't there (impact %, user counts, graduation month, company name), \
write a placeholder like [X%] or [Month] and tell them to fill in the real value.
- If no resume is provided, say so briefly and answer generally, inviting them to add it.
- If a target job / analysis is provided, use it for questions about fit, gaps or interview prep.

STYLE:
- Be concise and practical. Use short markdown: brief paragraphs, bullet points, **bold** key terms.
- For rewrites, show **Before** and **After**, using strong action verbs and measurable impact.
- Prioritise: tell them the 1-3 changes that matter most, not twenty small ones.
- Career, resume, job search, interview and learning questions are in scope. Politely decline \
unrelated requests in one sentence."""


def _context(resume_text: str, job_description: str, analysis: str) -> str:
    parts = [COACH_SYSTEM]
    parts.append("<resume>\n" + (resume_text.strip()[:20000] or "(no resume provided)") + "\n</resume>")
    if job_description.strip():
        parts.append("<target_job>\n" + job_description.strip()[:12000] + "\n</target_job>")
    if analysis.strip():
        parts.append("<latest_fit_analysis>\n" + analysis.strip()[:6000] + "\n</latest_fit_analysis>")
    return "\n\n".join(parts)


def chat_stream(messages: list[dict], resume_text: str = "", job_description: str = "",
                analysis: str = "") -> Iterator[str]:
    """Yields the assistant's reply in text chunks. Raises LLMError before the first chunk on failure."""
    system = _context(resume_text, job_description, analysis)
    if provider() == "claude":
        yield from _claude_stream(system, messages)
    else:
        yield from _gemini_stream(system, messages)


def _gemini_stream(system: str, messages: list[dict]) -> Iterator[str]:
    from google import genai
    from google.genai import errors, types

    if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
        raise LLMError("No Gemini API key found. Set GEMINI_API_KEY in your .env file.")
    client = genai.Client(http_options=types.HttpOptions(
        timeout=120_000, retry_options=types.HttpRetryOptions(attempts=2, initial_delay=1.0, max_delay=4.0)))
    contents = [types.Content(role="model" if m["role"] == "assistant" else "user",
                              parts=[types.Part(text=m["content"])]) for m in messages]
    config = types.GenerateContentConfig(system_instruction=system, max_output_tokens=4000)

    # Chat should feel quick: start with the lightest model, then the others.
    models = [GEMINI_FAST_MODEL] + [m for m in [GEMINI_MODEL, *GEMINI_FALLBACK_MODELS] if m != GEMINI_FAST_MODEL]
    last = None
    for model in dict.fromkeys(models):  # de-duplicated, order kept
        try:
            stream = client.models.generate_content_stream(model=model, contents=contents, config=config)
            first = None
            for chunk in stream:  # the first chunk proves the model accepted the request
                if chunk.text:
                    first = chunk.text
                    break
        except errors.ServerError as e:
            last = e
            continue
        except errors.ClientError as e:
            if e.code in (404, 429):
                last = e
                continue
            if "API key" in str(e):
                raise LLMError("Gemini rejected the API key. Check GEMINI_API_KEY in your .env file.") from e
            raise LLMError(f"Gemini request failed ({e.code}): {e.message}") from e
        except errors.APIError as e:
            raise LLMError(f"Gemini API error: {e.message}") from e

        if first is None:
            raise LLMError("The coach returned an empty reply. Try rephrasing your question.")
        yield first
        try:
            for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except Exception:  # connection dropped mid-answer: keep what we have
            yield "\n\n_(Reply was cut off. Ask me to continue.)_"
        return

    if isinstance(last, errors.ClientError) and last.code == 429:
        raise LLMError("Gemini free-tier quota reached. Wait a minute and try again.") from last
    raise LLMError("Gemini is busy right now. Please try again in a minute.") from last


def _claude_stream(system: str, messages: list[dict]) -> Iterator[str]:
    import anthropic

    try:
        client = anthropic.Anthropic()
        with client.messages.stream(model=CLAUDE_MODEL, max_tokens=4000, system=system,
                                    messages=[{"role": m["role"], "content": m["content"]} for m in messages]
                                    ) as stream:
            for text in stream.text_stream:
                yield text
    except anthropic.AuthenticationError as e:
        raise LLMError("Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY.") from e
    except anthropic.RateLimitError as e:
        raise LLMError("Rate limited by the Anthropic API - wait a moment and retry.") from e
    except anthropic.APIError as e:
        raise LLMError(f"Anthropic API error: {e}") from e
    except TypeError as e:  # no credentials could be resolved
        raise LLMError("No Anthropic credentials found. Set ANTHROPIC_API_KEY on the server.") from e
