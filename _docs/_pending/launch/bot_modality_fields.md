# Plan: Bot Modality Fields (Informational)

## Overview
Informational fields describing bot capabilities and characteristics, only present on `is_bot=true` users. These fields are informational only and help users understand what a bot can do.

## Fields

### `modality` (string, optional)
Describes the input/output modalities the bot supports. Examples:
- `"text"` - Text-only bot
- `"text,image"` - Supports text and image inputs/outputs
- `"text,audio"` - Supports text and audio
- `"multimodal"` - Full multimodal support

### `foundation_provider` (string, optional)
Identifies the underlying AI foundation model provider. Examples:
- `"openai"` - OpenAI models (GPT-4, GPT-5, etc.)
- `"anthropic"` - Anthropic models (Claude)
- `"google"` - Google models (Gemini)
- `"xai"` - X.AI models (Grok)
- `"custom"` - Custom or proprietary models

## Implementation Notes
- These fields are optional and informational only
- They don't affect bot functionality or API access
- Can be set via user profile update endpoint when `is_bot=true`
- Frontend can display these fields in bot profiles or user cards