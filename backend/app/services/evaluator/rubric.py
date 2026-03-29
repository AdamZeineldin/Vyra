"""Candidate evaluator — LLM-as-judge with heuristic fallback."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass

import httpx

from app.models.domain import Evaluation, FileEntry, RubricScores
from app.services.openrouter.diff import diff_file_maps

FileMap = dict[str, FileEntry]

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
JUDGE_MODEL = "google/gemini-2.0-flash-001"

# Rubric weights (must sum to 1.0)
_WEIGHTS = {
    "correctness": 0.35,
    "completeness": 0.30,
    "efficiency": 0.20,
    "code_quality": 0.15,
}

JUDGE_SYSTEM_PROMPT = (
    "You are a code evaluation judge. You will receive an original prompt and multiple "
    "AI-generated code solutions. Score each solution on four dimensions (0-10 scale):\n\n"
    "1. **correctness** — Does the code look syntactically valid? Would it run without "
    "obvious errors? Are imports correct? Is the logic sound?\n"
    "2. **completeness** — Does it fulfill ALL requirements from the prompt? Does it handle "
    "edge cases? Are all requested features implemented?\n"
    "3. **efficiency** — Is the code concise without being cryptic? Minimal redundancy? "
    "Good algorithmic choices? No unnecessary complexity?\n"
    "4. **code_quality** — Clean naming, good structure, proper separation of concerns, "
    "readable, maintainable, follows language idioms?\n\n"
    "Respond with ONLY valid JSON — no markdown, no explanation. Format:\n"
    '{"candidates": [{"id": "<candidate_id>", "correctness": N, "completeness": N, '
    '"efficiency": N, "code_quality": N, "verdict": "2-3 sentences"}]}\n\n'
    "VERDICT RULES (strictly enforced):\n"
    "- Write 2-3 sentences, NOT one.\n"
    "- Name specific files, functions, libraries, or patterns this candidate used.\n"
    "- Explain what it did differently from the OTHER candidates — not in isolation.\n"
    "- If it's missing something another candidate has, say what and who has it.\n"
    "- NEVER say 'this is the best because it is concise' or similar generic filler.\n"
    "- Example good verdict: 'Uses Express with router-level middleware for auth, "
    "unlike Candidate B which inlined it. Handles edge cases for empty input that "
    "Candidate C missed entirely. Could improve by adding input validation on the POST route.'\n\n"
    "Score fairly and use the full 0-10 range. Differentiate — do not give all candidates similar scores."
)


@dataclass
class RubricInput:
    files: FileMap
    prompt: str
    prior_files: FileMap
    execution_stdout: str
    execution_exit_code: int
    execution_timed_out: bool
    execution_stderr: str = ""


async def llm_score_candidates(
    candidates_data: list[dict],
    prompt: str,
) -> dict[str, Evaluation]:
    """Use LLM-as-judge to score all candidates comparatively.

    Each entry in candidates_data: {id, model_label, files (truncated), execution_summary}
    Returns: {candidate_id: Evaluation}
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        return {}

    sections = [f"**Original prompt:** {prompt}\n"]
    for c in candidates_data:
        file_preview = ""
        for path, entry in list(c.get("files", {}).items())[:5]:
            content = entry.get("content", "") if isinstance(entry, dict) else getattr(entry, "content", "")
            lines = content.splitlines()[:60]
            file_preview += f"\n--- {path} ---\n" + "\n".join(lines) + "\n"

        sections.append(
            f"### Candidate: {c['id']} ({c['model_label']})\n"
            f"Execution: {c.get('execution_summary', 'N/A')}\n"
            f"```\n{file_preview.strip()}\n```\n"
        )

    user_message = "Evaluate these solutions:\n\n" + "\n".join(sections)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
                    "X-Title": "YHack Iterative Coder",
                },
                json={
                    "model": JUDGE_MODEL,
                    "messages": [
                        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 2048,
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]

            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)

            results: dict[str, Evaluation] = {}
            for entry in data.get("candidates", []):
                cid = entry["id"]
                scores = RubricScores(
                    correctness=_clamp(float(entry.get("correctness", 5)), 0, 10),
                    completeness=_clamp(float(entry.get("completeness", 5)), 0, 10),
                    efficiency=_clamp(float(entry.get("efficiency", 5)), 0, 10),
                    code_quality=_clamp(float(entry.get("code_quality", 5)), 0, 10),
                )
                total = _weighted_total(scores)
                verdict = entry.get("verdict", "")
                results[cid] = Evaluation(
                    scores=scores,
                    total_score=total,
                    confidence=0.7,
                    reasoning=verdict,
                )
            return results

    except Exception:
        return {}


def _clamp(v: float, lo: float, hi: float) -> float:
    return round(min(max(v, lo), hi), 2)


def _weighted_total(scores: RubricScores) -> float:
    total = (
        scores.correctness * _WEIGHTS["correctness"]
        + scores.completeness * _WEIGHTS["completeness"]
        + scores.efficiency * _WEIGHTS["efficiency"]
        + scores.code_quality * _WEIGHTS["code_quality"]
    )
    return round(_clamp(total, 0, 10), 3)


# ── Heuristic fallback (used when LLM call fails) ───────────────────────────

def _score_correctness(inp: RubricInput) -> float:
    if inp.execution_timed_out:
        return 0.0
    if inp.execution_exit_code != 0:
        # Differentiate: syntax errors are worse than missing dependencies
        stderr = inp.execution_stderr.lower()
        if "syntaxerror" in stderr or "unexpected token" in stderr:
            return 2.0
        if inp.execution_stdout:
            return 4.0  # ran partially
        return 3.0  # failed but may be dependency issue, not code issue
    return 9.0 if inp.execution_stdout.strip() else 7.5


def _score_completeness(inp: RubricInput) -> float:
    if not inp.files:
        return 0.0
    all_content = " ".join(f.content.lower() for f in inp.files.values())
    prompt_words = [w.lower() for w in inp.prompt.split() if len(w) > 3]
    if not prompt_words:
        return 5.0
    matched = sum(1 for w in prompt_words if w in all_content)
    ratio = matched / len(prompt_words)
    return round(_clamp(ratio * 10, 0, 10), 2)


def _score_efficiency(inp: RubricInput) -> float:
    if not inp.prior_files:
        # First generation: score based on conciseness
        total_lines = sum(len(f.content.splitlines()) for f in inp.files.values())
        if total_lines == 0:
            return 5.0
        # Reasonable range: 10-500 lines is ideal
        if total_lines <= 500:
            return 8.0
        return _clamp(8.0 - (total_lines - 500) / 200, 3, 8)

    diffs = diff_file_maps(inp.prior_files, inp.files)
    modified = [d for d in diffs if d.status == "modified"]
    if not modified:
        return 9.0

    total_prior_lines = sum(len(f.content.splitlines()) for f in inp.prior_files.values())
    if total_prior_lines == 0:
        return 7.0

    changed_lines = sum(
        len([line for line in d.hunks.splitlines() if line.startswith("-") or line.startswith("+")])
        for d in modified
    )
    regression_ratio = changed_lines / max(total_prior_lines, 1)
    return round(_clamp(10.0 - regression_ratio * 10, 0, 10), 2)


def _score_code_quality(inp: RubricInput) -> float:
    if not inp.files:
        return 0.0

    total_lines = 0
    long_lines = 0
    max_nesting = 0
    total_functions = 0

    for entry in inp.files.values():
        lines = entry.content.splitlines()
        total_lines += len(lines)
        for line in lines:
            if len(line) > 120:
                long_lines += 1
            # Rough nesting depth by leading whitespace
            stripped = line.lstrip()
            if stripped:
                indent = len(line) - len(stripped)
                depth = indent // 2
                max_nesting = max(max_nesting, depth)
            # Count function definitions
            if any(kw in stripped for kw in ("function ", "def ", "const ", "=> {", "async ")):
                total_functions += 1

    if total_lines == 0:
        return 5.0

    score = 10.0
    # Penalize long lines
    long_ratio = long_lines / total_lines
    score -= long_ratio * 10
    # Penalize extreme nesting (>6 levels)
    if max_nesting > 6:
        score -= (max_nesting - 6) * 0.5
    # Bonus for having modular code (multiple functions)
    if total_functions >= 3:
        score += 0.5

    return round(_clamp(score, 0, 10), 2)


def score_candidate(inp: RubricInput) -> Evaluation:
    """Heuristic fallback scorer for a single candidate."""
    scores = RubricScores(
        correctness=_score_correctness(inp),
        completeness=_score_completeness(inp),
        efficiency=_score_efficiency(inp),
        code_quality=_score_code_quality(inp),
    )
    total = _weighted_total(scores)
    reasoning = _build_reasoning(scores, total)
    return Evaluation(scores=scores, total_score=total, confidence=0.7, reasoning=reasoning)


def _build_reasoning(scores: RubricScores, total: float) -> str:
    parts = []
    if scores.correctness >= 7:
        parts.append("Executes successfully")
    elif scores.correctness == 0:
        parts.append("Execution timed out")
    elif scores.correctness <= 3:
        parts.append("Execution errors detected")
    else:
        parts.append("Partial execution")

    if scores.completeness >= 7:
        parts.append("addresses the prompt well")
    elif scores.completeness >= 4:
        parts.append("partially addresses the prompt")
    else:
        parts.append("does not clearly address the prompt")

    if scores.efficiency >= 7:
        parts.append("minimal regression")
    else:
        parts.append("significant code churn")

    return f"{total:.1f}/10 — " + "; ".join(parts) + "."


def compute_confidence(scores: list[float]) -> float:
    if not scores:
        return 0.0
    if len(scores) == 1:
        return 1.0
    sorted_scores = sorted(scores, reverse=True)
    gap = sorted_scores[0] - sorted_scores[1]
    return round(min(gap / 3.0, 1.0), 3)


def pick_best_candidate(evaluations: dict[str, Evaluation]) -> str | None:
    if not evaluations:
        return None
    return max(evaluations, key=lambda k: evaluations[k].total_score)


def format_comparison(winner_eval: Evaluation, others: dict[str, Evaluation]) -> list[str]:
    if not others:
        return []
    winner_score = winner_eval.total_score
    lines: list[str] = []
    for candidate_id, other_eval in others.items():
        other_score = other_eval.total_score
        gap = round(winner_score - other_score, 1)
        sign = "+" if gap >= 0 else ""
        lines.append(f"{candidate_id} scored {other_score:.1f} ({sign}{gap:.1f} vs winner's {winner_score:.1f})")
    return lines
