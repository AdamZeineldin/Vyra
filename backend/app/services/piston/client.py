"""Piston API client — executes code via the Piston remote execution engine."""
from __future__ import annotations

import json
import os
import time
from typing import TYPE_CHECKING

import httpx

from app.models.domain import ExecutionResult, FileEntry

if TYPE_CHECKING:
    from app.services.piston.sandbox import ExecutionRequest

FileMap = dict[str, FileEntry]

PISTON_BASE_URL = os.getenv("PISTON_BASE_URL", "https://emkc.org/api/v2/piston")

RUNTIME_MAP: dict[str, str] = {
    "node": "javascript",
    "python": "python",
}

_DEFAULT_VERSION = "*"


def _detect_entry_filename(files: FileMap, runtime: str) -> str | None:
    """Return the bare entry filename for the given runtime and file set."""
    if not files:
        return None

    if runtime == "node":
        pkg = files.get("package.json")
        if pkg:
            try:
                data = json.loads(pkg.content)
                if data.get("scripts", {}).get("start"):
                    return None  # npm start — Piston can't run npm; fall through
            except (json.JSONDecodeError, AttributeError):
                pass
        for candidate in ("index.ts", "src/index.ts", "index.js", "src/index.js"):
            if candidate in files:
                return candidate
        return None

    if runtime == "python":
        for candidate in ("main.py", "app.py", "src/main.py"):
            if candidate in files:
                return candidate
        return None

    return None


async def execute_with_piston(req: "ExecutionRequest") -> ExecutionResult:
    """Execute code files via the Piston API and return an ExecutionResult.

    Never raises — always returns a valid ExecutionResult, even on network
    failures or API errors.
    """
    if not req.files:
        return ExecutionResult(
            stdout="",
            stderr="No files provided for execution",
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    language = RUNTIME_MAP.get(req.runtime, req.runtime)
    entry_filename = _detect_entry_filename(req.files, req.runtime)

    # Entry file must be first so Piston runs it as the main file.
    piston_files: list[dict[str, str]] = []
    if entry_filename and entry_filename in req.files:
        piston_files.append({"name": entry_filename, "content": req.files[entry_filename].content})
    for path, entry in req.files.items():
        if path != entry_filename:
            piston_files.append({"name": path, "content": entry.content})

    if not piston_files:
        return ExecutionResult(
            stdout="",
            stderr="Could not determine entry file for execution",
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    payload = {
        "language": language,
        "version": _DEFAULT_VERSION,
        "files": piston_files,
        "stdin": "",
        "args": [],
        "run_timeout": req.timeout_seconds * 1000,
    }

    timeout = httpx.Timeout(req.timeout_seconds + 5.0)
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{PISTON_BASE_URL}/execute", json=payload)

        duration_ms = int((time.monotonic() - start) * 1000)

        if response.status_code != 200:
            return ExecutionResult(
                stdout="",
                stderr=f"Piston API error {response.status_code}: {response.text[:200]}",
                exit_code=127,
                duration_ms=duration_ms,
                timed_out=False,
            )

        data = response.json()
        run = data.get("run", {})
        raw_code = run.get("code")
        signal = run.get("signal")
        timed_out = signal == "SIGKILL"
        exit_code = int(raw_code) if raw_code is not None else 1

        return ExecutionResult(
            stdout=run.get("stdout", ""),
            stderr=run.get("stderr", ""),
            exit_code=exit_code,
            duration_ms=duration_ms,
            timed_out=timed_out,
        )

    except httpx.TimeoutException:
        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            stdout="",
            stderr="Execution timed out",
            exit_code=1,
            duration_ms=duration_ms,
            timed_out=True,
        )
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            stdout="",
            stderr=f"Piston unavailable: {exc}",
            exit_code=127,
            duration_ms=duration_ms,
            timed_out=False,
        )
