"""OpenRouter HTTP client — direct API calls, no SDK."""
from __future__ import annotations

import asyncio
import os

import httpx
from pydantic import BaseModel

from app.models.domain import FileMap, ModelConfig
from app.services.openrouter.parse_response import parse_model_response
from app.services.openrouter.prompt import build_system_prompt, build_user_message

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MAX_TOKENS = 8192
TEMPERATURE = 0.7
REQUEST_TIMEOUT = 60.0


class CandidateResult(BaseModel):
    model_id: str
    model_label: str
    files: dict  # FileMap serialized
    raw_response: str
    error: str | None = None
    tokens_used: int = 0


async def _call_model(
    client: httpx.AsyncClient,
    api_key: str,
    model: ModelConfig,
    system_prompt: str,
    user_message: str,
) -> CandidateResult:
    """Call a single OpenRouter model and return the parsed result."""
    try:
        response = await client.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
                "X-Title": "YHack Iterative Coder",
            },
            json={
                "model": model.id,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        raw = data["choices"][0]["message"]["content"]
        files = parse_model_response(raw)
        tokens = data.get("usage", {}).get("total_tokens", 0)

        return CandidateResult(
            model_id=model.id,
            model_label=model.label,
            files={k: v.model_dump() for k, v in files.items()},
            raw_response=raw,
            tokens_used=tokens,
        )
    except Exception as exc:
        return CandidateResult(
            model_id=model.id,
            model_label=model.label,
            files={},
            raw_response="",
            error=str(exc),
        )


GEMINI_MODEL = "google/gemini-2.0-flash-001"
OVERVIEW_MODEL = GEMINI_MODEL
OVERVIEW_SYSTEM_PROMPT = (
    "You are a helpful code reviewer explaining code to a non-technical user. "
    "Given one or more source files, write a clear and concise explanation of what the code does and how it works. "
    "Format your response in Markdown with a top-level heading, then sections with ## subheadings for logical parts of the code. "
    "Do NOT start with any preamble, greeting, or meta-commentary like 'Sure' or 'Okay'. "
    "Jump directly into the explanation. "
    "Do not include raw code snippets. Avoid unexplained jargon."
)


async def get_project_title(prompt: str) -> str:
    """Call Gemini to turn a user prompt into a short project title (2-4 words)."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        return prompt[:60]

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
                    "X-Title": "YHack Iterative Coder",
                },
                json={
                    "model": GEMINI_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You generate concise project titles. "
                                "Given a user's coding request, reply with ONLY a short title of 2-4 words, "
                                "in title case. No punctuation, no quotes, no explanation."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 20,
                    "temperature": 0.3,
                },
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            title = data["choices"][0]["message"]["content"].strip().strip('"').strip("'")
            return title or prompt[:60]
        except Exception:
            return prompt[:60]


async def get_code_overview(files: dict) -> str:
    """Call Gemini via OpenRouter to get a plain-English overview of the provided files."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")

    # Build file listing for the prompt
    file_sections = []
    for path, entry in files.items():
        content = entry.get("content", "") if isinstance(entry, dict) else getattr(entry, "content", "")
        file_sections.append(f"### {path}\n```\n{content}\n```")
    user_message = "Please review the following code files and explain what they do:\n\n" + "\n\n".join(file_sections)

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": os.getenv("APP_URL", "http://localhost:3000"),
                    "X-Title": "YHack Iterative Coder",
                },
                json={
                    "model": OVERVIEW_MODEL,
                    "messages": [
                        {"role": "system", "content": OVERVIEW_SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 1024,
                    "temperature": 0.3,
                },
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:
            return f"Could not generate overview: {exc}"


async def generate_candidates(
    models: list[ModelConfig],
    prompt: str,
    current_files: FileMap | None,
) -> list[CandidateResult]:
    """Fan out a prompt to multiple models in parallel and return all results."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable not set")

    system_prompt = build_system_prompt()
    user_message = build_user_message(prompt, current_files)

    async with httpx.AsyncClient() as client:
        tasks = [
            _call_model(client, api_key, model, system_prompt, user_message)
            for model in models
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    return list(results)
