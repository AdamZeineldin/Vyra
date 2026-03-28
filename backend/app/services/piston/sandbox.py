"""Sandbox helpers — execution request model, entrypoint detection, output classification."""
from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel

from app.models.domain import ExecutionResult, FileEntry
from app.services.piston.client import execute_with_piston

FileMap = dict[str, FileEntry]


class ExecutionRequest(BaseModel):
    candidate_id: str
    files: FileMap
    runtime: Literal["node", "python"]
    timeout_seconds: int = 30


def detect_entrypoint(files: FileMap, runtime: str) -> str:
    """Auto-detect the entry file for a given file set and runtime."""
    if not files:
        return ""

    if runtime == "node":
        pkg = files.get("package.json")
        if pkg:
            try:
                data = json.loads(pkg.content)
                if data.get("scripts", {}).get("start"):
                    return "npm start"
            except (json.JSONDecodeError, AttributeError):
                pass
        if any(p in files for p in ("index.ts", "src/index.ts")):
            entry = "index.ts" if "index.ts" in files else "src/index.ts"
            return f"npx tsx {entry}"
        if "index.js" in files:
            return "node index.js"
        if "src/index.js" in files:
            return "node src/index.js"
        return ""

    if runtime == "python":
        main_file = next(
            (p for p in ("main.py", "app.py", "src/main.py") if p in files), None
        )
        if main_file:
            return f"python {main_file}"
        return ""

    return ""


def classify_output_type(stdout: str, files: FileMap) -> Literal["web", "html", "console"]:
    """Determine how to display the execution output."""
    port_patterns = [
        r"listening on port \d+",
        r"running at http",
        r"server started",
        r"localhost:\d+",
        r"0\.0\.0\.0:\d+",
    ]
    for pattern in port_patterns:
        if re.search(pattern, stdout, re.IGNORECASE):
            return "web"

    if "index.html" in files:
        return "html"

    return "console"


async def execute_in_sandbox(req: ExecutionRequest) -> ExecutionResult:
    """Delegate to the Piston execution client."""
    return await execute_with_piston(req)


__all__ = [
    "ExecutionRequest",
    "classify_output_type",
    "detect_entrypoint",
    "execute_in_sandbox",
]
