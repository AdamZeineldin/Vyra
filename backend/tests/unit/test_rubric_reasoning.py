"""Tests for improved reasoning and format_comparison in rubric.py."""
import pytest
from app.services.evaluator.rubric import (
    score_candidate,
    format_comparison,
    RubricInput,
)
from app.models.domain import Evaluation, RubricScores, FileEntry


def make_file(path: str, content: str) -> FileEntry:
    ext = path.rsplit(".", 1)[-1] if "." in path else "txt"
    return FileEntry(path=path, content=content, language=ext)


def make_evaluation(
    correctness: float = 7.0,
    completeness: float = 7.0,
    efficiency: float = 7.0,
    code_quality: float = 7.0,
    total_score: float = 7.0,
    confidence: float = 0.8,
    reasoning: str = "Good",
) -> Evaluation:
    return Evaluation(
        scores=RubricScores(
            correctness=correctness,
            completeness=completeness,
            efficiency=efficiency,
            code_quality=code_quality,
        ),
        total_score=total_score,
        confidence=confidence,
        reasoning=reasoning,
    )


# ── Improved reasoning strings ────────────────────────────────────────────────

class TestImprovedReasoning:
    def test_reasoning_includes_correctness_score(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "correctness=" in result.reasoning

    def test_reasoning_includes_completeness_score(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "completeness=" in result.reasoning

    def test_reasoning_includes_efficiency_score(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "efficiency=" in result.reasoning

    def test_reasoning_includes_code_quality_score(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "code_quality=" in result.reasoning

    def test_reasoning_includes_total_score(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "Total:" in result.reasoning

    def test_reasoning_includes_slash_10_suffix(self):
        inp = RubricInput(
            files={"a.py": make_file("a.py", "x = 1")},
            prompt="Set x to 1",
            prior_files={},
            execution_stdout="",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        assert "/10" in result.reasoning

    def test_reasoning_score_values_are_formatted_with_one_decimal(self):
        inp = RubricInput(
            files={"a.py": make_file("a.py", "x = 1")},
            prompt="Set x",
            prior_files={},
            execution_stdout="",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)
        # Should contain a float with one decimal like "7.0" or "9.0"
        import re
        matches = re.findall(r"\d+\.\d", result.reasoning)
        assert len(matches) >= 4, f"Expected >= 4 decimal values in reasoning, got: {result.reasoning}"

    def test_reasoning_for_timed_out_includes_scores(self):
        inp = RubricInput(
            files={"bad.py": make_file("bad.py", "while True: pass")},
            prompt="Do something",
            prior_files={},
            execution_stdout="",
            execution_exit_code=1,
            execution_timed_out=True,
        )
        result = score_candidate(inp)
        assert "correctness=" in result.reasoning
        assert "Total:" in result.reasoning


# ── format_comparison ─────────────────────────────────────────────────────────

class TestFormatComparison:
    def test_returns_list_of_strings(self):
        winner_eval = make_evaluation(total_score=8.5)
        others = {
            "b": make_evaluation(total_score=6.0),
            "c": make_evaluation(total_score=5.5),
        }
        result = format_comparison(winner_eval, others)
        assert isinstance(result, list)
        assert all(isinstance(s, str) for s in result)

    def test_returns_empty_list_when_no_others(self):
        winner_eval = make_evaluation(total_score=8.5)
        result = format_comparison(winner_eval, {})
        assert result == []

    def test_each_entry_includes_score_gap(self):
        winner_eval = make_evaluation(total_score=8.0)
        others = {
            "b": make_evaluation(total_score=6.0),
        }
        result = format_comparison(winner_eval, others)
        assert len(result) == 1
        # Gap is 2.0; string should contain +2.0 or -2.0
        assert "2.0" in result[0]

    def test_positive_gap_shown_with_plus(self):
        winner_eval = make_evaluation(total_score=9.0)
        others = {"b": make_evaluation(total_score=7.0)}
        result = format_comparison(winner_eval, others)
        assert "+2.0" in result[0]

    def test_negative_gap_shown_with_minus(self):
        """Winner is lower than other — gap should be shown as negative."""
        winner_eval = make_evaluation(total_score=5.0)
        others = {"b": make_evaluation(total_score=8.0)}
        result = format_comparison(winner_eval, others)
        assert "-3.0" in result[0]

    def test_one_string_per_other_candidate(self):
        winner_eval = make_evaluation(total_score=8.0)
        others = {
            "b": make_evaluation(total_score=7.0),
            "c": make_evaluation(total_score=6.0),
            "d": make_evaluation(total_score=5.0),
        }
        result = format_comparison(winner_eval, others)
        assert len(result) == 3

    def test_close_scores_still_produce_entries(self):
        winner_eval = make_evaluation(total_score=7.1)
        others = {"b": make_evaluation(total_score=7.0)}
        result = format_comparison(winner_eval, others)
        assert len(result) == 1
        # Very small gap; still should render
        assert "0.1" in result[0]

    def test_equal_scores_produce_entry(self):
        winner_eval = make_evaluation(total_score=7.0)
        others = {"b": make_evaluation(total_score=7.0)}
        result = format_comparison(winner_eval, others)
        assert len(result) == 1
        assert "+0.0" in result[0] or "0.0" in result[0]

    def test_comparison_strings_are_human_readable(self):
        """Each string should be a complete English sentence fragment."""
        winner_eval = make_evaluation(total_score=8.5)
        others = {"runner-b": make_evaluation(total_score=6.5)}
        result = format_comparison(winner_eval, others)
        # Must be non-empty strings
        assert len(result[0]) > 5

    def test_immutability_winner_not_mutated(self):
        winner_eval = make_evaluation(total_score=8.0)
        original_score = winner_eval.total_score
        others = {"b": make_evaluation(total_score=6.0)}
        format_comparison(winner_eval, others)
        assert winner_eval.total_score == original_score

    def test_immutability_others_not_mutated(self):
        winner_eval = make_evaluation(total_score=8.0)
        other_eval = make_evaluation(total_score=6.0)
        original_score = other_eval.total_score
        format_comparison(winner_eval, {"b": other_eval})
        assert other_eval.total_score == original_score
