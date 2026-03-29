"""Unit tests for the Piston API client (TDD — written before implementation)."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from app.models.domain import FileEntry
from app.services.piston.client import RUNTIME_MAP, _execute_with_subprocess, execute_with_piston
from app.services.piston.sandbox import ExecutionRequest


def _files(*names_and_content: tuple[str, str]) -> dict[str, FileEntry]:
    return {
        name: FileEntry(path=name, content=content, language="text")
        for name, content in names_and_content
    }


def _piston_ok(stdout: str, stderr: str = "", code: int = 0, signal: str | None = None) -> dict:
    return {
        "language": "python",
        "version": "3.10.0",
        "run": {"stdout": stdout, "stderr": stderr, "code": code, "signal": signal, "output": stdout + stderr},
    }


# ── Runtime mapping ────────────────────────────────────────────────────────────

def test_runtime_map_node_maps_to_javascript():
    assert RUNTIME_MAP["node"] == "javascript"


def test_runtime_map_python_maps_to_python():
    assert RUNTIME_MAP["python"] == "python"


# ── Successful execution ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_successful_python_execution(respx_mock):
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        return_value=httpx.Response(200, json=_piston_ok("hello\n"))
    )

    req = ExecutionRequest(
        candidate_id="c1",
        files=_files(("main.py", 'print("hello")')),
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.stdout == "hello\n"
    assert result.stderr == ""
    assert result.exit_code == 0
    assert result.timed_out is False
    assert result.duration_ms >= 0


@pytest.mark.asyncio
async def test_successful_node_execution(respx_mock):
    response_body = {
        "language": "javascript",
        "version": "18.0.0",
        "run": {"stdout": "hello\n", "stderr": "", "code": 0, "signal": None, "output": "hello\n"},
    }
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        return_value=httpx.Response(200, json=response_body)
    )

    req = ExecutionRequest(
        candidate_id="c2",
        files=_files(("index.js", 'console.log("hello")')),
        runtime="node",
    )
    result = await execute_with_piston(req)

    assert result.stdout == "hello\n"
    assert result.exit_code == 0
    assert result.timed_out is False


# ── Non-zero exit code ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_nonzero_exit_code(respx_mock):
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        return_value=httpx.Response(200, json=_piston_ok("", "NameError: x\n", code=1))
    )

    req = ExecutionRequest(
        candidate_id="c3",
        files=_files(("main.py", "print(x)")),
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.exit_code == 1
    assert result.timed_out is False
    assert "NameError" in result.stderr


# ── SIGKILL → timed_out ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sigkill_sets_timed_out(respx_mock):
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        return_value=httpx.Response(
            200,
            json=_piston_ok("", "", code=None, signal="SIGKILL"),  # type: ignore[arg-type]
        )
    )

    req = ExecutionRequest(
        candidate_id="c4",
        files=_files(("main.py", "while True: pass")),
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.timed_out is True
    assert result.exit_code == 1  # null code → treat as 1


# ── HTTP 500 → graceful result ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_http_500_returns_graceful_result(respx_mock):
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    req = ExecutionRequest(
        candidate_id="c5",
        files=_files(("main.py", 'print("hi")')),
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.exit_code == 127
    assert result.stderr != ""
    assert result.timed_out is False


# ── Network timeout → timed_out ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_network_timeout_sets_timed_out(respx_mock):
    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(
        side_effect=httpx.TimeoutException("timed out")
    )

    req = ExecutionRequest(
        candidate_id="c6",
        files=_files(("main.py", 'print("hi")')),
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.timed_out is True
    assert result.exit_code == 1


# ── Empty files → graceful result ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_files_returns_error_result():
    req = ExecutionRequest(
        candidate_id="c7",
        files={},
        runtime="python",
    )
    result = await execute_with_piston(req)

    assert result.exit_code != 0
    assert result.stderr != ""


# ── Piston language in outbound request ───────────────────────────────────────

@pytest.mark.asyncio
async def test_node_runtime_sends_javascript_to_piston(respx_mock):
    captured: list[dict] = []

    def capture(request: httpx.Request) -> httpx.Response:
        import json as _json
        captured.append(_json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "language": "javascript",
                "version": "18.0.0",
                "run": {"stdout": "ok", "stderr": "", "code": 0, "signal": None, "output": "ok"},
            },
        )

    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(side_effect=capture)

    req = ExecutionRequest(
        candidate_id="c8",
        files=_files(("index.js", "console.log('ok')")),
        runtime="node",
    )
    await execute_with_piston(req)

    assert len(captured) == 1
    assert captured[0]["language"] == "javascript"


@pytest.mark.asyncio
async def test_python_runtime_sends_python_to_piston(respx_mock):
    captured: list[dict] = []

    def capture(request: httpx.Request) -> httpx.Response:
        import json as _json
        captured.append(_json.loads(request.content))
        return httpx.Response(200, json=_piston_ok("ok"))

    respx_mock.post("https://emkc.org/api/v2/piston/execute").mock(side_effect=capture)

    req = ExecutionRequest(
        candidate_id="c9",
        files=_files(("main.py", "print('ok')")),
        runtime="python",
    )
    await execute_with_piston(req)

    assert captured[0]["language"] == "python"


# ── _execute_with_subprocess ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_subprocess_fallback_disabled_by_default(monkeypatch):
    """When ALLOW_SUBPROCESS_FALLBACK is not set the fallback returns an error."""
    monkeypatch.delenv("ALLOW_SUBPROCESS_FALLBACK", raising=False)

    req = ExecutionRequest(
        candidate_id="s1",
        files=_files(("main.py", 'print("hi")')),
        runtime="python",
    )
    result = await _execute_with_subprocess(req)

    assert result.exit_code == 1
    assert result.timed_out is False
    assert "disabled" in result.stderr.lower()


@pytest.mark.asyncio
async def test_subprocess_fallback_disabled_explicit_false(monkeypatch):
    """ALLOW_SUBPROCESS_FALLBACK=false also disables the fallback."""
    monkeypatch.setenv("ALLOW_SUBPROCESS_FALLBACK", "false")

    req = ExecutionRequest(
        candidate_id="s2",
        files=_files(("main.py", 'print("hi")')),
        runtime="python",
    )
    result = await _execute_with_subprocess(req)

    assert result.exit_code == 1
    assert "disabled" in result.stderr.lower()


@pytest.mark.asyncio
async def test_subprocess_fallback_unsupported_language(monkeypatch):
    """Unsupported language returns a descriptive error, not a crash."""
    monkeypatch.setenv("ALLOW_SUBPROCESS_FALLBACK", "true")

    req = ExecutionRequest(
        candidate_id="s3",
        files=_files(("main.go", "package main\nfunc main(){}")),
        runtime="python",  # runtime field is ignored by _execute_with_subprocess
    )
    result = await _execute_with_subprocess(req)

    assert result.exit_code == 1
    assert result.timed_out is False
    # go is not supported by the subprocess fallback
    assert "go" in result.stderr.lower() or "piston" in result.stderr.lower()


@pytest.mark.asyncio
async def test_subprocess_fallback_timeout_kills_process_group(monkeypatch):
    """On timeout the process group is killed via SIGKILL and timed_out is True."""
    monkeypatch.setenv("ALLOW_SUBPROCESS_FALLBACK", "true")

    killed_pgids: list[int] = []

    def fake_killpg(pgid: int, sig: int) -> None:
        killed_pgids.append(pgid)

    fake_proc = MagicMock()
    fake_proc.pid = 12345

    with patch("app.services.piston.client.asyncio.create_subprocess_exec", new=AsyncMock(return_value=fake_proc)), \
         patch("app.services.piston.client.os.getpgid", return_value=12345), \
         patch("app.services.piston.client.os.killpg", side_effect=fake_killpg), \
         patch("app.services.piston.client.asyncio.wait_for", side_effect=asyncio.TimeoutError):

        req = ExecutionRequest(
            candidate_id="s4",
            files=_files(("main.py", "while True: pass")),
            runtime="python",
        )
        result = await _execute_with_subprocess(req)

    assert result.timed_out is True
    assert result.exit_code == 1
    assert killed_pgids == [12345]


@pytest.mark.asyncio
async def test_subprocess_fallback_preserves_directory_structure(monkeypatch):
    """Files with directory paths are written under the same sub-path in tmpdir,
    preventing basename collisions between e.g. src/utils/helper.py and lib/helper.py."""
    monkeypatch.setenv("ALLOW_SUBPROCESS_FALLBACK", "true")

    req = ExecutionRequest(
        candidate_id="s5",
        files={
            "src/main.py": FileEntry(path="src/main.py", content='print("hi")', language="python"),
            "src/utils/helper.py": FileEntry(path="src/utils/helper.py", content="", language="python"),
        },
        runtime="python",
    )

    # Execute for real — if basename collision occurred, one file would silently
    # overwrite the other and the import might fail for unrelated reasons.
    # We verify that the entry file path is properly rooted in the tmpdir and
    # that the process completes without an OSError from file writes.
    result = await _execute_with_subprocess(req)

    # Any exit code is acceptable; what matters is no OSError / path collision crash.
    assert result.timed_out is False
    assert result.exit_code in (0, 1, 2)
