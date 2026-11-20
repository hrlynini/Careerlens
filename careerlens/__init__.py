"""CareerLens backend package.

On import, loads KEY=value lines from the project's `.env` file into the environment,
so API keys can live in a file instead of being set in every terminal.
Variables already set in the environment take priority over the file.
"""

import os
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if key and value and not os.environ.get(key):
            os.environ[key] = value


_load_dotenv(Path(__file__).resolve().parent.parent / ".env")
