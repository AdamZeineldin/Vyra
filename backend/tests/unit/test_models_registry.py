"""Tests for the OpenRouter model registry."""
import pytest
from app.services.openrouter.models import (
    DEFAULT_MODELS,
    AVAILABLE_MODELS,
    get_model_by_id,
    get_default_model_ids,
)


class TestDefaultModels:
    def test_has_exactly_three_default_models(self):
        assert len(DEFAULT_MODELS) == 3

    def test_includes_claude_gpt_and_gemini(self):
        providers = {m.provider for m in DEFAULT_MODELS}
        assert "Anthropic" in providers
        assert "OpenAI" in providers
        assert "Google" in providers

    def test_valid_openrouter_model_ids(self):
        import re
        pattern = re.compile(r"^[a-z0-9_-]+/[a-z0-9._:-]+$")
        for model in DEFAULT_MODELS:
            assert pattern.match(model.id), f"Invalid ID: {model.id}"


class TestAvailableModels:
    def test_includes_all_default_models(self):
        available_ids = {m.id for m in AVAILABLE_MODELS}
        for default in DEFAULT_MODELS:
            assert default.id in available_ids

    def test_unique_ids(self):
        ids = [m.id for m in AVAILABLE_MODELS]
        assert len(ids) == len(set(ids))

    def test_all_models_have_required_fields(self):
        for model in AVAILABLE_MODELS:
            assert model.id
            assert model.label
            assert model.provider


class TestGetModelById:
    def test_returns_model_for_known_id(self):
        model = get_model_by_id("openai/gpt-4o")
        assert model is not None
        assert model.label == "GPT-4o"

    def test_returns_none_for_unknown_id(self):
        model = get_model_by_id("unknown/model-xyz")
        assert model is None


class TestGetDefaultModelIds:
    def test_returns_three_ids(self):
        ids = get_default_model_ids()
        assert len(ids) == 3

    def test_returns_list_of_strings(self):
        ids = get_default_model_ids()
        for id_ in ids:
            assert isinstance(id_, str)
