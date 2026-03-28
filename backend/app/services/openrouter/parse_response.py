"""Parse LLM responses into FileMap objects."""
import re
from app.models.domain import FileEntry, FileMap

_EXTENSION_MAP: dict[str, str] = {
    "ts": "ts", "tsx": "tsx", "js": "js", "jsx": "jsx",
    "py": "py", "json": "json", "md": "md", "css": "css",
    "html": "html", "txt": "txt", "sh": "sh", "yaml": "yaml",
    "yml": "yaml", "toml": "toml", "env": "env", "rs": "rs",
    "go": "go", "java": "java", "cpp": "cpp", "c": "c",
}


def _detect_language(path: str) -> str:
    if "." in path:
        ext = path.rsplit(".", 1)[-1].lower()
        return _EXTENSION_MAP.get(ext, ext)
    return "txt"


def _make_entry(path: str, content: str) -> FileEntry:
    return FileEntry(path=path, content=content.strip("\n"), language=_detect_language(path))


def parse_model_response(response: str) -> FileMap:
    """Parse a model response into a FileMap using multiple fallback strategies."""
    if not response or not response.strip():
        return {}

    # Strategy 1: XML <files> block
    xml_match = re.search(r"<files>(.*?)</files>", response, re.DOTALL)
    if xml_match:
        files: FileMap = {}
        block = xml_match.group(1)
        for m in re.finditer(r'<file path="([^"]+)">(.*?)</file>', block, re.DOTALL):
            path, content = m.group(1), m.group(2).strip("\n")
            files[path] = _make_entry(path, content)
        if files:
            return files

    # Strategy 2: Labeled fenced code blocks (```lang:path/to/file)
    labeled_blocks = re.findall(r"```[a-zA-Z]*:([^\n]+)\n(.*?)```", response, re.DOTALL)
    if labeled_blocks:
        return {path.strip(): _make_entry(path.strip(), content) for path, content in labeled_blocks}

    # Strategy 3: Single unlabeled fenced code block
    single_block = re.search(r"```([a-zA-Z]*)\n(.*?)```", response, re.DOTALL)
    if single_block:
        lang = single_block.group(1).lower() or "txt"
        ext = {"typescript": "ts", "javascript": "js", "python": "py"}.get(lang, lang) or "txt"
        filename = f"main.{ext}"
        content = single_block.group(2)
        return {filename: _make_entry(filename, content)}

    # Strategy 4: Plain text fallback
    return {"main.txt": FileEntry(path="main.txt", content=response, language="txt")}
