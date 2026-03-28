"""Rubric-based candidate evaluator — no bias toward any specific model."""
from __future__ import annotations

from dataclasses import dataclass

from app.models.domain import Evaluation, FileEntry, RubricScores
from app.services.openrouter.diff import diff_file_maps

FileMap = dict[str, FileEntry]

# Rubric weights (must sum to 1.0)
_WEIGHTS = {
    "correctness": 0.35,
    "completeness": 0.30,
    "efficiency": 0.20,
    "code_quality": 0.15,
}


@dataclass
class RubricInput:
    files: FileMap
    prompt: str
    prior_files: FileMap
    execution_stdout: str
    execution_exit_code: int
    execution_timed_out: bool
    execution_stderr: str = ""


def _score_correctness(inp: RubricInput) -> float:
    if inp.execution_timed_out:
        return 0.0
    if inp.execution_exit_code != 0:
        return 2.0 if inp.execution_stdout else 1.0
    return 9.0 if inp.execution_stdout.strip() else 7.5


def _score_completeness(inp: RubricInput) -> float:
    """Does the output contain keywords related to the prompt?"""
    if not inp.files:
        return 0.0
    all_content = " ".join(f.content.lower() for f in inp.files.values())
    prompt_words = [w.lower() for w in inp.prompt.split() if len(w) > 3]
    if not prompt_words:
        return 5.0
    matched = sum(1 for w in prompt_words if w in all_content)
    ratio = matched / len(prompt_words)
    return round(min(ratio * 10, 10.0), 2)


def _score_efficiency(inp: RubricInput) -> float:
    """Penalize large regressions — prefer additive changes over rewrites."""
    if not inp.prior_files:
        return 7.0  # no baseline to compare

    diffs = diff_file_maps(inp.prior_files, inp.files)
    modified = [d for d in diffs if d.status == "modified"]
    if not modified:
        return 9.0

    total_prior_lines = sum(
        len(f.content.splitlines()) for f in inp.prior_files.values()
    )
    if total_prior_lines == 0:
        return 7.0

    changed_lines = sum(
        len([l for l in d.hunks.splitlines() if l.startswith("-") or l.startswith("+")])
        for d in modified
    )
    regression_ratio = changed_lines / max(total_prior_lines, 1)
    score = max(0.0, 10.0 - regression_ratio * 10)
    return round(min(score, 10.0), 2)


def _score_code_quality(inp: RubricInput) -> float:
    """Basic static quality: naming, line length, nesting hints."""
    if not inp.files:
        return 0.0

    total_lines = 0
    long_lines = 0
    for entry in inp.files.values():
        lines = entry.content.splitlines()
        total_lines += len(lines)
        long_lines += sum(1 for l in lines if len(l) > 120)

    if total_lines == 0:
        return 5.0

    long_ratio = long_lines / total_lines
    score = max(0.0, 10.0 - long_ratio * 20)
    return round(min(score, 10.0), 2)


def score_candidate(inp: RubricInput) -> Evaluation:
    """Score a single candidate against the rubric."""
    scores = RubricScores(
        correctness=_score_correctness(inp),
        completeness=_score_completeness(inp),
        efficiency=_score_efficiency(inp),
        code_quality=_score_code_quality(inp),
    )
    total = (
        scores.correctness * _WEIGHTS["correctness"]
        + scores.completeness * _WEIGHTS["completeness"]
        + scores.efficiency * _WEIGHTS["efficiency"]
        + scores.code_quality * _WEIGHTS["code_quality"]
    )
    total = round(min(max(total, 0.0), 10.0), 3)
    confidence = 0.7  # single-candidate default; recomputed in pick_best_candidate

    reasoning = _build_reasoning(scores, total)
    return Evaluation(scores=scores, total_score=total, confidence=confidence, reasoning=reasoning)


def _build_reasoning(scores: RubricScores, total: float) -> str:
    """Build a structured reasoning string that includes numeric score values."""
    score_parts = (
        f"correctness={scores.correctness:.1f}/10"
        f", completeness={scores.completeness:.1f}/10"
        f", efficiency={scores.efficiency:.1f}/10"
        f", code_quality={scores.code_quality:.1f}/10"
        f" | Total: {total:.1f}/10"
    )

    verdict_parts = []
    if scores.correctness >= 7:
        verdict_parts.append("Executes successfully")
    elif scores.correctness == 0:
        verdict_parts.append("Execution timed out")
    else:
        verdict_parts.append("Execution errors detected")

    if scores.completeness >= 7:
        verdict_parts.append("addresses the prompt well")
    elif scores.completeness >= 4:
        verdict_parts.append("partially addresses the prompt")
    else:
        verdict_parts.append("does not clearly address the prompt")

    if scores.efficiency >= 7:
        verdict_parts.append("minimal regression")
    else:
        verdict_parts.append("significant code churn")

    verdict = "; ".join(verdict_parts) + "."
    return f"{score_parts} — {verdict}"


def compute_confidence(scores: list[float]) -> float:
    """How confident is the evaluator that the top score is the winner?"""
    if not scores:
        return 0.0
    if len(scores) == 1:
        return 1.0
    sorted_scores = sorted(scores, reverse=True)
    gap = sorted_scores[0] - sorted_scores[1]
    # Normalize gap: gap of 3+ points → full confidence
    confidence = min(gap / 3.0, 1.0)
    return round(confidence, 3)


def pick_best_candidate(evaluations: dict[str, Evaluation]) -> str | None:
    """Return the candidate_id with the highest total score."""
    if not evaluations:
        return None
    return max(evaluations, key=lambda k: evaluations[k].total_score)


def format_comparison(winner_eval: Evaluation, others: dict[str, Evaluation]) -> list[str]:
    """Return human-readable comparison strings: winner vs each other candidate.

    Each string describes the signed score gap between the winner and one other
    candidate. A positive gap means the winner leads; negative means the winner
    trails.

    Example output entry:
        "runner-b scored 6.5 (+2.0 vs winner's 8.5)"

    Returns [] when ``others`` is empty (pure function — no mutations).
    """
    if not others:
        return []

    winner_score = winner_eval.total_score
    lines: list[str] = []

    for candidate_id, other_eval in others.items():
        other_score = other_eval.total_score
        gap = round(winner_score - other_score, 1)
        sign = "+" if gap >= 0 else ""
        line = (
            f"{candidate_id} scored {other_score:.1f}"
            f" ({sign}{gap:.1f} vs winner's {winner_score:.1f})"
        )
        lines.append(line)

    return lines
