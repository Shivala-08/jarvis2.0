# JARVIS Model Providers Record

Verification Date: 2026-08-24

This document tracks verified model provider pricing, availability, and quota structures for Jarvis's cloud model layer.

---

## Groq

*   **API Availability**: Live
*   **Authentication Mechanism**: Bearer token via `GROQ_API_KEY` header.
*   **Current Free/Free-Trial Status**: Active perpetual free tier (no credit card required).
*   **Relevant Rate Limits (Free Tier)**:
    *   *Llama 3.3 70B*: 30 RPM, 1,000 RPD, 12,000 TPM, 100,000 TPD.
    *   *Llama 3.1 8B*: 30 RPM, 14,400 RPD, 6,000 TPM, 500,000 TPD.
*   **Quota Dimensions**: RPM (Requests Per Minute), RPD (Requests Per Day), TPM (Tokens Per Minute), TPD (Tokens/Day). Exceeding *any* dimension results in HTTP 429. Remaining quota info is exposed in response headers.
*   **Model Availability**: `llama-3.3-70b-specdec`, `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`.
*   **Context Limits**:
    *   `llama-3.3-70b-specdec`/`versatile`: 128k context window.
    *   `llama-3.1-8b-instant`: 128k context window.
*   **Streaming Support**: Yes.
*   **OpenAI-Compatible API**: Yes.
*   **Jarvis Free-Tier Routing Eligibility**: **ACTIVE** (Primary candidate for routing tier and everyday tier).

---

## Gemini (Google AI Studio)

*   **API Availability**: Live
*   **Authentication Mechanism**: API Key query parameter (`?key=GEMINI_API_KEY`) or header.
*   **Current Free/Free-Trial Status**: Active perpetual free tier (no credit card required).
*   **Relevant Rate Limits (Free Tier)**:
    *   *Gemini 1.5 Flash*: 15 RPM, 32,000 TPM, 1,500 RPD.
    *   *Gemini 1.5 Pro*: 2 RPM, 32,000 TPM, 50 RPD.
*   **Quota Dimensions**: RPM (Requests Per Minute), TPM (Tokens Per Minute), RPD (Requests Per Day). Resets daily at midnight Pacific Time.
*   **Model Availability**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash-exp`.
*   **Context Limits**:
    *   `gemini-1.5-flash`: 1M tokens.
    *   `gemini-1.5-pro`: 2M tokens.
*   **Streaming Support**: Yes.
*   **OpenAI-Compatible API**: Yes (supported endpoint `/v1beta/openai`).
*   **Jarvis Free-Tier Routing Eligibility**: **ACTIVE** (Primary candidate for everyday tier and coding tier due to massive context windows).

---

## OpenRouter

*   **API Availability**: Live
*   **Authentication Mechanism**: Bearer token via `Authorization: Bearer OPENROUTER_API_KEY` header.
*   **Current Free/Free-Trial Status**: Free models available.
*   **Relevant Rate Limits (Free Models)**:
    *   *Standard Account (No Credits Purchased)*: 20 RPM, 50 RPD.
    *   *Upgraded Account ($10+ Lifetime Credits)*: 20 RPM, 1,000 RPD.
*   **Quota Dimensions**: RPM (Requests Per Minute), RPD (Requests Per Day).
*   **Model Availability**: Rotating list of free models (e.g. `meta-llama/llama-3-8b-instruct:free`, `mistralai/mistral-7b-instruct:free`, or unified `openrouter/free` router).
*   **Context Limits**: Model-dependent (generally 4k to 8k for older free models, up to 128k for Llama-3 free models).
*   **Streaming Support**: Yes.
*   **OpenAI-Compatible API**: Yes.
*   **Jarvis Free-Tier Routing Eligibility**: **CONDITIONAL** (Useful as fallback for routing tier, but daily limits are low unless account is upgraded).

---

## Cerebras

*   **API Availability**: Live
*   **Authentication Mechanism**: Bearer token via `Authorization: Bearer CEREBRAS_API_KEY` header.
*   **Current Free/Free-Trial Status**: Permanent free tier (1M tokens/day floor) + $5 free trial credit for new accounts with payment method.
*   **Relevant Rate Limits (Free Tier)**:
    *   *Free Floor*: 30 RPM, 1,000,000 Tokens/Day.
*   **Quota Dimensions**: RPM (Requests Per Minute), Daily Token Allowance.
*   **Model Availability**: `llama3.1-8b`, `llama3.3-70b`.
*   **Context Limits**: 8k context window.
*   **Streaming Support**: Yes.
*   **OpenAI-Compatible API**: Yes.
*   **Jarvis Free-Tier Routing Eligibility**: **CONDITIONAL** (Excellent for raw speed, but daily token caps are tight and trial credit expires).

---

## Provider Pool Classification Summary

*   **Groq**: **ACTIVE** (Perpetual free tier, no card required, reliable structure, primary routing & everyday candidate).
*   **Gemini**: **ACTIVE** (Perpetual free tier, no card required, massive context, primary everyday & coding candidate).
*   **Cerebras**: **CONDITIONAL** (Permanent free tier exists but token caps are tight, and $5 credits expire).
*   **OpenRouter**: **CONDITIONAL** (Free models are highly dynamic and daily request floor is only 50 RPD unless account is funded).

---

## Selected Coding Provider

```ini
CODING_PROVIDER=gemini
CODING_MODEL=gemini-1.5-pro
VERIFIED_DATE=2026-08-24
```

*   **Rationale**: Gemini 1.5 Pro offers an unmatched **2 Million token context window** in its perpetual free tier, allowing the coding agent to load extensive codebase contexts. While restricted to 2 RPM, its reasoning and coding capabilities represent the most robust free solution compared to Groq (which has tight daily token limits of 100k for Llama-3.3-70b) and Cerebras (8k context limit). If request frequency becomes a bottleneck, the agent can fall back to `gemini-1.5-flash` (15 RPM).


