"""Tests for sandbox helpers (unit-level, no external services)."""
import pytest
from app.services.piston.sandbox import (
    detect_entrypoint,
    classify_output_type,
    ExecutionRequest,
)
from app.models.domain import FileEntry


def make_file(path: str, content: str) -> FileEntry:
    ext = path.rsplit(".", 1)[-1] if "." in path else "txt"
    return FileEntry(path=path, content=content, language=ext)


class TestDetectEntrypoint:
    def test_node_with_start_script(self):
        files = {
            "package.json": make_file(
                "package.json",
                '{"name":"test","scripts":{"start":"node index.js"}}'
            )
        }
        cmd = detect_entrypoint(files, "node")
        assert "npm" in cmd and "start" in cmd

    def test_node_falls_back_to_index_js(self):
        files = {
            "index.js": make_file("index.js", "console.log('hi')"),
            "package.json": make_file("package.json", '{"name":"test"}'),
        }
        cmd = detect_entrypoint(files, "node")
        assert "index.js" in cmd

    def test_node_prefers_index_ts(self):
        files = {
            "index.ts": make_file("index.ts", "console.log('hi')"),
        }
        cmd = detect_entrypoint(files, "node")
        assert "index.ts" in cmd or "tsx" in cmd

    def test_python_with_requirements(self):
        files = {
            "main.py": make_file("main.py", "print('hello')"),
            "requirements.txt": make_file("requirements.txt", "requests"),
        }
        cmd = detect_entrypoint(files, "python")
        assert "pip" in cmd or "main.py" in cmd

    def test_python_falls_back_to_main_py(self):
        files = {"main.py": make_file("main.py", "print('hi')")}
        cmd = detect_entrypoint(files, "python")
        assert "main.py" in cmd

    def test_unknown_runtime_returns_empty(self):
        cmd = detect_entrypoint({}, "unknown")
        assert cmd == ""

    def test_no_files_returns_empty(self):
        cmd = detect_entrypoint({}, "node")
        assert cmd == ""


class TestClassifyOutputType:
    def test_web_project_detected_by_port_in_stdout(self):
        output_type = classify_output_type(
            stdout="Server listening on port 3000",
            files={"index.js": make_file("index.js", "")},
        )
        assert output_type == "web"

    def test_html_project_detected_by_index_html(self):
        output_type = classify_output_type(
            stdout="",
            files={"index.html": make_file("index.html", "<h1>Hello</h1>")},
        )
        assert output_type == "html"

    def test_console_default(self):
        output_type = classify_output_type(
            stdout="Hello world",
            files={"main.py": make_file("main.py", "print('hi')")},
        )
        assert output_type == "console"

    def test_web_detected_by_express_pattern(self):
        output_type = classify_output_type(
            stdout="Express server running at http://localhost:8080",
            files={},
        )
        assert output_type == "web"


class TestExecutionRequest:
    def test_valid_request_creation(self):
        req = ExecutionRequest(
            candidate_id="abc123",
            files={"main.py": make_file("main.py", "print('hi')")},
            runtime="python",
        )
        assert req.candidate_id == "abc123"
        assert req.runtime == "python"

    def test_default_timeout(self):
        req = ExecutionRequest(
            candidate_id="x",
            files={},
            runtime="node",
        )
        assert req.timeout_seconds == 30
