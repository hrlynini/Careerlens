"""Pure logic: PDF text extraction and the score -> verdict rule."""

from __future__ import annotations

import io
import logging
from dataclasses import asdict, dataclass

from pypdf import PdfReader

logging.getLogger("pypdf").setLevel(logging.ERROR)  # malformed-but-readable PDFs are common


def extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(p for p in pages if p)


@dataclass(frozen=True)
class Verdict:
    key: str
    label: str
    emoji: str
    advice: str

    def to_dict(self) -> dict:
        return asdict(self)


APPLY_NOW = Verdict("apply", "Apply Now", "🟢", "Strong fit - submit your application now.")
STRETCH = Verdict("stretch", "Stretch Role", "🟡",
                  "Worth applying after building 1 targeted mini-project from the gaps below.")
SKILL_BUILD = Verdict("build", "Skill-Build Target", "🔴",
                      "Close the critical skill gaps before applying.")


def verdict_for(score: int) -> Verdict:
    """Deterministic: the LLM produces the score, code decides the verdict."""
    if score >= 75:
        return APPLY_NOW
    if score >= 50:
        return STRETCH
    return SKILL_BUILD
