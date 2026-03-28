"""File-level diffing utilities."""
import difflib
from app.models.domain import FileEntry, FileDiff, DiffSummary

FileMap = dict[str, FileEntry]


def diff_file_maps(before: FileMap, after: FileMap) -> list[FileDiff]:
    """Compute per-file diffs between two FileMaps."""
    diffs: list[FileDiff] = []

    all_paths = set(before) | set(after)
    for path in sorted(all_paths):
        if path in before and path not in after:
            diffs.append(FileDiff(path=path, status="deleted", hunks=""))
        elif path not in before and path in after:
            diffs.append(FileDiff(path=path, status="added", hunks=""))
        else:
            old_content = before[path].content
            new_content = after[path].content
            if old_content != new_content:
                hunks = _unified_diff(old_content, new_content, path)
                diffs.append(FileDiff(path=path, status="modified", hunks=hunks))

    return diffs


def diff_stats(diffs: list[FileDiff]) -> DiffSummary:
    return DiffSummary(
        files_added=sum(1 for d in diffs if d.status == "added"),
        files_modified=sum(1 for d in diffs if d.status == "modified"),
        files_deleted=sum(1 for d in diffs if d.status == "deleted"),
        total_changes=len(diffs),
    )


def _unified_diff(old: str, new: str, path: str) -> str:
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    result = list(difflib.unified_diff(old_lines, new_lines, fromfile=path, tofile=path))
    return "".join(result)
