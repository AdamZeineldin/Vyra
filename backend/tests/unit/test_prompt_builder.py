"""Tests for the OpenRouter prompt builder."""
import pytest
from app.services.openrouter.prompt import build_system_prompt, build_user_message, serialize_file_map
from app.models.domain import FileEntry


class TestBuildSystemPrompt:
    def test_includes_role_instructions(self):
        prompt = build_system_prompt()
        assert "code generation assistant" in prompt.lower()

    def test_includes_output_format_spec(self):
        prompt = build_system_prompt()
        assert "<files>" in prompt
        assert '<file path="' in prompt
        assert "</file>" in prompt
        assert "</files>" in prompt

    def test_returns_non_empty_string(self):
        prompt = build_system_prompt()
        assert len(prompt) > 100


class TestBuildUserMessage:
    def test_includes_user_prompt(self):
        msg = build_user_message("Add a hello world function", None)
        assert "Add a hello world function" in msg

    def test_includes_file_context_when_provided(self):
        files = {
            "index.ts": FileEntry(path="index.ts", content="const x = 1;", language="ts")
        }
        msg = build_user_message("Update x to 2", files)

        assert "index.ts" in msg
        assert "const x = 1;" in msg

    def test_no_file_context_section_when_empty(self):
        msg = build_user_message("Create a new project", None)
        assert "Current Project Files" not in msg

    def test_includes_current_files_header_when_files_provided(self):
        files = {
            "app.py": FileEntry(path="app.py", content="print('hi')", language="py")
        }
        msg = build_user_message("Update the print statement", files)
        assert "Current Project Files" in msg


class TestSerializeFileMap:
    def test_serializes_files_to_xml_format(self):
        files = {
            "src/app.ts": FileEntry(path="src/app.ts", content='console.log("app");', language="ts"),
            "package.json": FileEntry(path="package.json", content='{"name": "test"}', language="json"),
        }
        serialized = serialize_file_map(files)

        assert '<file path="src/app.ts">' in serialized
        assert 'console.log("app");' in serialized
        assert '<file path="package.json">' in serialized
        assert '{"name": "test"}' in serialized

    def test_empty_file_map_returns_empty_string(self):
        assert serialize_file_map({}) == ""

    def test_wraps_in_files_tag(self):
        files = {
            "a.ts": FileEntry(path="a.ts", content="x", language="ts")
        }
        serialized = serialize_file_map(files)
        assert serialized.startswith("<files>")
        assert serialized.endswith("</files>")
