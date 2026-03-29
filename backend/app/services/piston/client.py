"""Piston API client — executes code via the Piston remote execution engine."""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import shutil
import tempfile
import time
from typing import TYPE_CHECKING

import httpx

logger = logging.getLogger(__name__)

from app.models.domain import ExecutionResult, FileEntry

if TYPE_CHECKING:
    from app.services.piston.sandbox import ExecutionRequest

FileMap = dict[str, FileEntry]

# Maps the ExecutionRequest.runtime field to the Piston language name.
RUNTIME_MAP: dict[str, str] = {
    "python": "python",
    "node": "javascript",
}

# Maps file extension → (piston language name, piston version)
EXT_TO_RUNTIME: dict[str, tuple[str, str]] = {
    ".py":   ("python",     "3.10.0"),
    ".js":   ("javascript", "18.15.0"),
    ".ts":   ("typescript", "5.0.3"),
    ".java": ("java",       "15.0.2"),
    ".go":   ("go",         "1.16.2"),
    ".rs":   ("rust",       "1.68.2"),
    ".c":    ("c",          "*"),
    ".cpp":  ("c++",        "*"),
    ".rb":   ("ruby",       "*"),
    ".sh":   ("bash",       "*"),
}

# Extensions that should never be sent to Piston as executable files
NON_CODE_EXTS = {
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini",
    ".cfg", ".env", ".gitignore", ".lock", ".xml", ".html",
    ".css", ".scss", ".svg", ".png", ".jpg", ".jpeg", ".gif",
}


def _is_code_file(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in EXT_TO_RUNTIME and ext not in NON_CODE_EXTS


def _detect_language_and_entry(files: FileMap) -> tuple[str, str, str]:
    """Return (piston_language, piston_version, entry_path) from file extensions."""
    # Bucket paths by extension
    by_ext: dict[str, list[str]] = {}
    for path in files:
        ext = os.path.splitext(path)[1].lower()
        by_ext.setdefault(ext, []).append(path)

    # Priority order: check extensions in preference order
    for ext in (".py", ".ts", ".js", ".java", ".go", ".rs", ".cpp", ".c", ".rb", ".sh"):
        if ext not in by_ext:
            continue
        lang, version = EXT_TO_RUNTIME[ext]
        paths = by_ext[ext]

        if ext == ".py":
            for name in ("main.py", "app.py"):
                match = next((p for p in paths if os.path.basename(p) == name), None)
                if match:
                    return lang, version, match
            return lang, version, paths[0]

        if ext in (".ts", ".js"):
            prefix = "index" + ext
            for name in (prefix, "main" + ext):
                match = next((p for p in paths if os.path.basename(p) == name), None)
                if match:
                    return lang, version, match
            return lang, version, paths[0]

        if ext == ".java":
            # Prefer file that contains the main method
            for path in paths:
                if "public static void main" in files[path].content:
                    return lang, version, path
            return lang, version, paths[0]

        # Default: first file of this extension
        return lang, version, paths[0]

    # Absolute fallback
    first = next(iter(files))
    ext = os.path.splitext(first)[1].lower()
    lang, version = EXT_TO_RUNTIME.get(ext, ("javascript", "18.15.0"))
    return lang, version, first


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

    # Strip non-code files (READMEs, configs, etc.) — Piston can't run them
    code_files = {path: entry for path, entry in req.files.items() if _is_code_file(path)}

    if not code_files:
        return ExecutionResult(
            stdout="",
            stderr="No executable code files found (only docs/config files present).",
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    language, version, entry_path = _detect_language_and_entry(code_files)

    # Piston doesn't support subdirectory paths — flatten all filenames to basenames.
    # For TypeScript, Piston's runtime appends .ts itself, so strip only .ts extensions.
    def _flat(path: str) -> str:
        name = os.path.basename(path)
        if language == "typescript" and name.endswith(".ts"):
            name = name[:-3]
        return name

    flat_entry = _flat(entry_path)

    # For TypeScript projects, only send .ts source files — Piston can't use configs/json
    def _should_include(path: str) -> bool:
        if language == "typescript":
            return path.endswith(".ts")
        return True

    # Entry file must be first so Piston runs it as the main file.
    piston_files: list[dict[str, str]] = [
        {"name": flat_entry, "content": code_files[entry_path].content}
    ]
    for path, entry in code_files.items():
        if path != entry_path and _should_include(path):
            piston_files.append({"name": _flat(path), "content": entry.content})

    payload = {
        "language": language,
        "version": version,
        "files": piston_files,
        "stdin": req.stdin,
        "args": [],
        "run_timeout": min(req.timeout_seconds * 1000, 3000),
    }

    piston_base_url = os.getenv("PISTON_BASE_URL", "http://localhost:2000/api/v2")
    timeout = httpx.Timeout(req.timeout_seconds + 5.0)
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{piston_base_url}/execute", json=payload)

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
        timed_out = run.get("signal") == "SIGKILL"
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
        logger.warning("Piston unavailable (%s) — falling back to subprocess", exc)
        return await _execute_with_subprocess(req)


async def _execute_with_subprocess(req: "ExecutionRequest") -> ExecutionResult:
    """Fallback executor using local subprocess when Piston is unavailable.

    Supports Python and Node/JavaScript only.  Other languages return a
    descriptive error rather than silently failing.

    This fallback is DISABLED by default and must be explicitly enabled via
    the ``ALLOW_SUBPROCESS_FALLBACK=true`` environment variable.  When
    disabled the function returns a safe error result without spawning any
    process.
    """
    allow_fallback = os.getenv("ALLOW_SUBPROCESS_FALLBACK", "").strip().lower() in (
        "1", "true", "yes"
    )
    if not allow_fallback:
        return ExecutionResult(
            stdout="",
            stderr=(
                "Subprocess fallback is disabled. "
                "Start the Piston Docker container or set ALLOW_SUBPROCESS_FALLBACK=true."
            ),
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    code_files = {p: e for p, e in req.files.items() if _is_code_file(p)}
    if not code_files:
        return ExecutionResult(
            stdout="",
            stderr="No executable code files found.",
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    language, _version, entry_path = _detect_language_and_entry(code_files)

    if language == "python":
        cmd_prefix = ["python3"]
    elif language in ("javascript", "typescript"):
        cmd_prefix = ["node"] if language == "javascript" else ["npx", "tsx"]
    else:
        return ExecutionResult(
            stdout="",
            stderr=(
                f"Subprocess fallback does not support {language}. "
                "Start the Piston Docker container to run this language."
            ),
            exit_code=1,
            duration_ms=0,
            timed_out=False,
        )

    tmpdir = tempfile.mkdtemp(prefix="vyra_exec_")
    try:
        for path, entry in code_files.items():
            dest = os.path.join(tmpdir, path.lstrip("/"))
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as fh:
                fh.write(entry.content)

        entry_rel = entry_path.lstrip("/")
        cmd = [*cmd_prefix, entry_rel]
        start = time.monotonic()

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=tmpdir,
                start_new_session=True,
            )
            stdin_bytes = req.stdin.encode("utf-8") if req.stdin else b""
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(input=stdin_bytes),
                timeout=float(req.timeout_seconds),
            )
            duration_ms = int((time.monotonic() - start) * 1000)
            return ExecutionResult(
                stdout=stdout_bytes.decode(errors="replace"),
                stderr=stderr_bytes.decode(errors="replace"),
                exit_code=proc.returncode if proc.returncode is not None else 0,
                duration_ms=duration_ms,
                timed_out=False,
            )

        except asyncio.TimeoutError:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except (ProcessLookupError, OSError):
                pass
            duration_ms = int((time.monotonic() - start) * 1000)
            return ExecutionResult(
                stdout="",
                stderr="Execution timed out",
                exit_code=1,
                duration_ms=duration_ms,
                timed_out=True,
            )

        except FileNotFoundError as exc:
            return ExecutionResult(
                stdout="",
                stderr=f"Runtime not found: {exc}. Ensure python3/node is installed and on PATH.",
                exit_code=127,
                duration_ms=0,
                timed_out=False,
            )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
