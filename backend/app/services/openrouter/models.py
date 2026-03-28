"""OpenRouter model registry."""
from app.models.domain import ModelConfig

DEFAULT_MODELS: list[ModelConfig] = [
    ModelConfig(id="anthropic/claude-sonnet-4-5", label="Claude Sonnet 4.5", provider="Anthropic"),
    ModelConfig(id="openai/gpt-4o", label="GPT-4o", provider="OpenAI"),
    ModelConfig(id="google/gemini-2.0-flash-001", label="Gemini 2.0 Flash", provider="Google"),
]

AVAILABLE_MODELS: list[ModelConfig] = [
    *DEFAULT_MODELS,
    ModelConfig(id="anthropic/claude-3-5-haiku", label="Claude 3.5 Haiku", provider="Anthropic"),
    ModelConfig(id="openai/gpt-4o-mini", label="GPT-4o Mini", provider="OpenAI"),
    ModelConfig(id="deepseek/deepseek-chat", label="DeepSeek V3", provider="DeepSeek"),
    ModelConfig(id="meta-llama/llama-3.1-70b-instruct", label="Llama 3.1 70B", provider="Meta"),
    ModelConfig(id="x-ai/grok-beta", label="Grok Beta", provider="xAI"),
]

_MODEL_INDEX: dict[str, ModelConfig] = {m.id: m for m in AVAILABLE_MODELS}


def get_model_by_id(model_id: str) -> ModelConfig | None:
    return _MODEL_INDEX.get(model_id)


def get_default_model_ids() -> list[str]:
    return [m.id for m in DEFAULT_MODELS]
