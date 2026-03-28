"""Tests for the file diff service."""
import pytest
from app.services.openrouter.diff import diff_file_maps, diff_stats
from app.models.domain import FileEntry


def make_file(path: str, content: str) -> FileEntry:
    ext = path.rsplit(".", 1)[-1] if "." in path else "txt"
    return FileEntry(path=path, content=content, language=ext)


class TestDiffFileMaps:
    def test_detects_added_files(self):
        before = {}
        after = {
            "src/index.ts": make_file("src/index.ts", 'console.log("hello");')
        }

        diffs = diff_file_maps(before, after)

        assert len(diffs) == 1
        assert diffs[0].path == "src/index.ts"
        assert diffs[0].status == "added"

    def test_detects_deleted_files(self):
        before = {"old.ts": make_file("old.ts", "old code")}
        after = {}

        diffs = diff_file_maps(before, after)

        assert len(diffs) == 1
        assert diffs[0].path == "old.ts"
        assert diffs[0].status == "deleted"

    def test_detects_modified_files(self):
        before = {"index.ts": make_file("index.ts", "const x = 1;")}
        after = {"index.ts": make_file("index.ts", "const x = 2;")}

        diffs = diff_file_maps(before, after)

        assert len(diffs) == 1
        assert diffs[0].path == "index.ts"
        assert diffs[0].status == "modified"
        assert "-const x = 1;" in diffs[0].hunks
        assert "+const x = 2;" in diffs[0].hunks

    def test_unchanged_files_not_included(self):
        file_map = {"same.ts": make_file("same.ts", "unchanged")}

        diffs = diff_file_maps(file_map, file_map)

        assert len(diffs) == 0

    def test_handles_mixed_changes(self):
        before = {
            "keep.ts": make_file("keep.ts", "keep"),
            "modify.ts": make_file("modify.ts", "old content"),
            "delete.ts": make_file("delete.ts", "gone"),
        }
        after = {
            "keep.ts": make_file("keep.ts", "keep"),
            "modify.ts": make_file("modify.ts", "new content"),
            "add.ts": make_file("add.ts", "new file"),
        }

        diffs = diff_file_maps(before, after)

        assert len(diffs) == 3
        statuses = {d.status for d in diffs}
        assert "added" in statuses
        assert "modified" in statuses
        assert "deleted" in statuses

    def test_empty_maps_produce_no_diffs(self):
        diffs = diff_file_maps({}, {})
        assert diffs == []


class TestDiffStats:
    def test_summarizes_diff_results(self):
        from app.models.domain import FileDiff
        diffs = [
            FileDiff(path="a.ts", status="added", hunks=""),
            FileDiff(path="b.ts", status="modified", hunks="+line\n-line\n"),
            FileDiff(path="c.ts", status="deleted", hunks=""),
            FileDiff(path="d.ts", status="added", hunks=""),
        ]

        stats = diff_stats(diffs)

        assert stats.files_added == 2
        assert stats.files_modified == 1
        assert stats.files_deleted == 1
        assert stats.total_changes == 4

    def test_zeros_for_empty_diffs(self):
        stats = diff_stats([])

        assert stats.files_added == 0
        assert stats.files_modified == 0
        assert stats.files_deleted == 0
        assert stats.total_changes == 0
