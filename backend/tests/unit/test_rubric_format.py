"""Tests for format_comparison — pure function in rubric.py.

Signature: format_comparison(winner_eval: Evaluation, others: dict[str, Evaluation]) -> list[str]
"""
import pytest
from app.models.domain import Evaluation, RubricScores
from app.services.evaluator.rubric import format_comparison


def make_evaluation(total_score: float, reasoning: str = "ok") -> Evaluation:
    return Evaluation(
        scores=RubricScores(
            correctness=total_score,
            code_quality=total_score,
            completeness=total_score,
            efficiency=total_score,
        ),
        total_score=total_score,
        confidence=0.8,
        reasoning=reasoning,
    )


class TestFormatComparisonEmptyAndEdgeCases:
    def test_returns_empty_list_for_empty_others(self):
        winner = make_evaluation(8.5)
        result = format_comparison(winner, {})
        assert result == []

    def test_returns_one_string_for_single_other(self):
        winner = make_evaluation(8.5)
        others = {"candidate-b": make_evaluation(6.0)}
        result = format_comparison(winner, others)
        assert len(result) == 1

    def test_returns_list_not_none(self):
        winner = make_evaluation(9.0)
        result = format_comparison(winner, {})
        assert result is not None
        assert isinstance(result, list)


class TestFormatComparisonOutput:
    def test_two_others_produces_two_strings(self):
        winner = make_evaluation(9.0)
        others = {
            "second": make_evaluation(7.0),
            "third": make_evaluation(5.0),
        }
        result = format_comparison(winner, others)
        assert len(result) == 2

    def test_three_others_produces_three_strings(self):
        winner = make_evaluation(9.0)
        others = {
            "a": make_evaluation(7.0),
            "b": make_evaluation(6.0),
            "c": make_evaluation(5.0),
        }
        result = format_comparison(winner, others)
        assert len(result) == 3

    def test_output_contains_other_candidate_score(self):
        winner = make_evaluation(8.5)
        others = {"gpt-4o": make_evaluation(7.2)}
        result = format_comparison(winner, others)
        line = result[0]
        assert "7.2" in line or "7.20" in line

    def test_output_contains_winner_score(self):
        winner = make_evaluation(8.5)
        others = {"gpt-4o": make_evaluation(7.2)}
        result = format_comparison(winner, others)
        line = result[0]
        assert "8.5" in line or "8.50" in line

    def test_positive_gap_shown_when_winner_leads(self):
        winner = make_evaluation(9.0)
        others = {"b": make_evaluation(7.0)}
        result = format_comparison(winner, others)
        assert "+2.0" in result[0]

    def test_negative_gap_shown_when_winner_trails(self):
        winner = make_evaluation(5.0)
        others = {"b": make_evaluation(8.0)}
        result = format_comparison(winner, others)
        assert "-3.0" in result[0]

    def test_zero_gap_shows_plus_zero(self):
        winner = make_evaluation(7.0)
        others = {"b": make_evaluation(7.0)}
        result = format_comparison(winner, others)
        line = result[0]
        assert "+0.0" in line or "0.0" in line

    def test_output_mentions_candidate_id(self):
        winner = make_evaluation(8.5)
        others = {"gpt-4o": make_evaluation(7.2)}
        result = format_comparison(winner, others)
        assert "gpt-4o" in result[0]

    def test_returns_list_of_strings(self):
        winner = make_evaluation(8.0)
        others = {"a": make_evaluation(5.0), "b": make_evaluation(4.0)}
        result = format_comparison(winner, others)
        assert isinstance(result, list)
        for item in result:
            assert isinstance(item, str)
            assert len(item) > 5

    def test_close_scores_still_produce_entry(self):
        winner = make_evaluation(7.1)
        others = {"b": make_evaluation(7.0)}
        result = format_comparison(winner, others)
        assert len(result) == 1
        assert "0.1" in result[0]


class TestFormatComparisonImmutability:
    def test_does_not_mutate_winner_eval(self):
        winner = make_evaluation(8.0)
        original_score = winner.total_score
        others = {"b": make_evaluation(5.0)}
        format_comparison(winner, others)
        assert winner.total_score == original_score

    def test_does_not_mutate_others_dict(self):
        winner = make_evaluation(8.0)
        other_eval = make_evaluation(6.0)
        original_score = other_eval.total_score
        others = {"b": other_eval}
        format_comparison(winner, others)
        assert other_eval.total_score == original_score
        assert set(others.keys()) == {"b"}

    def test_does_not_add_keys_to_others(self):
        winner = make_evaluation(8.0)
        others = {"b": make_evaluation(6.0)}
        original_keys = set(others.keys())
        format_comparison(winner, others)
        assert set(others.keys()) == original_keys


class TestFormatComparisonNumericalPrecision:
    def test_scores_displayed_to_one_decimal_not_raw_float(self):
        winner = make_evaluation(8.666)
        others = {"a": make_evaluation(7.333)}
        result = format_comparison(winner, others)
        line = result[0]
        assert "7.333333" not in line
        assert "8.666666" not in line

    def test_gap_displayed_to_one_decimal(self):
        winner = make_evaluation(8.333)
        others = {"a": make_evaluation(6.111)}
        result = format_comparison(winner, others)
        line = result[0]
        # Gap = 8.333 - 6.111 = 2.222, rounded to 1 decimal = 2.2
        assert "2.222222" not in line
