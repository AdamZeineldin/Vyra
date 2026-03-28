"""Build prompts for OpenRouter requests."""
from app.models.domain import FileMap


def serialize_file_map(files: FileMap) -> str:
    """Serialize a FileMap into the XML format expected by models."""
    if not files:
        return ""
    lines = ["<files>"]
    for entry in files.values():
        lines.append(f'<file path="{entry.path}">')
        lines.append(entry.content)
        lines.append("</file>")
    lines.append("</files>")
    return "\n".join(lines)


def build_system_prompt() -> str:
    return """You are a code generation assistant. Given a user instruction and optionally the current project files, generate updated or new project files.

CRITICAL: Your entire response must be a single XML block in this exact format and nothing else:

<files>
<file path="path/to/file.ext">
file content here
</file>
<file path="another/file.ext">
another file content
</file>
</files>

Rules:
- Include ALL files for the project, not just changed ones
- Use relative paths (e.g. src/index.ts, not /src/index.ts)
- Do not include any text outside the <files> block
- Do not use markdown fencing around the XML block"""


def build_user_message(prompt: str, current_files: FileMap | None) -> str:
    parts: list[str] = []

    if current_files:
        parts.append("Current Project Files:")
        parts.append(serialize_file_map(current_files))
        parts.append("")

    parts.append(f"Instruction: {prompt}")
    return "\n".join(parts)
