"""Tests for the rubric evaluator service."""
import pytest
from app.services.evaluator.rubric import (
    score_candidate,
    compute_confidence,
    pick_best_candidate,
    RubricInput,
)
from app.models.domain import FileEntry, RubricScores, Evaluation


def make_file(path: str, content: str) -> FileEntry:
    ext = path.rsplit(".", 1)[-1] if "." in path else "txt"
    return FileEntry(path=path, content=content, language=ext)


class TestScoreCandidate:
    def test_perfect_score_for_valid_running_code(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "function add(a,b){return a+b;}")},
            prompt="Add an add function",
            prior_files={},
            execution_stdout="3",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)

        assert result.scores.correctness >= 7.0
        assert result.total_score >= 5.0
        assert 0.0 <= result.total_score <= 10.0

    def test_zero_correctness_for_timed_out_execution(self):
        inp = RubricInput(
            files={"index.js": make_file("index.js", "while(true){}")},
            prompt="Do something",
            prior_files={},
            execution_stdout="",
            execution_exit_code=1,
            execution_timed_out=True,
        )
        result = score_candidate(inp)

        assert result.scores.correctness == 0.0

    def test_low_correctness_for_nonzero_exit(self):
        inp = RubricInput(
            files={"main.py": make_file("main.py", "print(undefined_var)")},
            prompt="Print something",
            prior_files={},
            execution_stdout="",
            execution_exit_code=1,
            execution_timed_out=False,
        )
        result = score_candidate(inp)

        assert result.scores.correctness <= 4.0

    def test_penalizes_high_regression(self):
        prior = {
            "index.ts": make_file("index.ts", "\n".join(f"line{i}" for i in range(50)))
        }
        # Candidate completely rewrites the file
        new_content = "\n".join(f"different{i}" for i in range(50))
        inp = RubricInput(
            files={"index.ts": make_file("index.ts", new_content)},
            prompt="Add a small feature",
            prior_files=prior,
            execution_stdout="ok",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)

        assert result.scores.efficiency <= 5.0

    def test_scores_have_valid_range(self):
        inp = RubricInput(
            files={"a.py": make_file("a.py", "x = 1")},
            prompt="Set x",
            prior_files={},
            execution_stdout="",
            execution_exit_code=0,
            execution_timed_out=False,
        )
        result = score_candidate(inp)

        for field, val in result.scores.model_dump().items():
            assert 0.0 <= val <= 10.0, f"{field}={val} out of range"
        assert 0.0 <= result.total_score <= 10.0
        assert 0.0 <= result.confidence <= 1.0


class TestComputeConfidence:
    def test_high_confidence_when_one_dominates(self):
        scores = [8.5, 4.0, 3.5]
        conf = compute_confidence(scores)
        assert conf >= 0.7

    def test_low_confidence_when_scores_are_close(self):
        scores = [6.1, 6.0, 5.9]
        conf = compute_confidence(scores)
        assert conf <= 0.4

    def test_medium_confidence_for_moderate_gap(self):
        scores = [7.0, 5.5, 4.0]
        conf = compute_confidence(scores)
        assert 0.3 <= conf <= 0.85

    def test_single_score_returns_max_confidence(self):
        conf = compute_confidence([8.0])
        assert conf == 1.0

    def test_empty_scores_returns_zero(self):
        conf = compute_confidence([])
        assert conf == 0.0


class TestPickBestCandidate:
    def test_picks_highest_total_score(self):
        evaluations = {
            "candidate-a": Evaluation(
                scores=RubricScores(correctness=8, code_quality=7, completeness=9, efficiency=8),
                total_score=8.0,
                confidence=0.8,
                reasoning="Good",
            ),
            "candidate-b": Evaluation(
                scores=RubricScores(correctness=5, code_quality=6, completeness=5, efficiency=5),
                total_score=5.3,
                confidence=0.8,
                reasoning="Mediocre",
            ),
        }
        best_id = pick_best_candidate(evaluations)
        assert best_id == "candidate-a"

    def test_returns_none_for_empty_evaluations(self):
        assert pick_best_candidate({}) is None

    def test_returns_only_candidate_if_single(self):
        evaluations = {
            "only": Evaluation(
                scores=RubricScores(correctness=5, code_quality=5, completeness=5, efficiency=5),
                total_score=5.0,
                confidence=1.0,
                reasoning="Only one",
            )
        }
        assert pick_best_candidate(evaluations) == "only"
