# Frontend Implementation: Bot Modality Fields

**Date**: 2025-01-27  
**Status**: Implementation spec  
**Related**: Backend implementation doc in `stitch-backend/_docs/_pending/launch/bot_modality_fields_backend.md`

---

## Overview

Informational fields describing bot capabilities and characteristics, only present on `is_bot=true` users. These fields are informational only and help users understand what a bot can do. Display these fields in the frontend UI to help users understand bot capabilities before interacting with them.

**Implementation Notes:**
- These fields are optional and informational only
- They don't affect bot functionality or API access
- Can be set via user profile update endpoint when `is_bot=true`
- Frontend should display these fields in bot profiles or user cards

---

## Fields to Display

### `input_modalities` (string, optional)
- Display format: Human-readable field
- Examples: "txt", "txt, png, pdf", "txt, mp3"
- Format: Comma-separated list of file types (e.g., "txt", "png", "pdf", "mp3")

### `output_modalities` (string, optional)
- Display format: Human-readable field
- Examples: "txt", "txt, png", "txt, mp3"
- UI suggestion: Small badge/chip component near bot name or in profile
- Format: Comma-separated list of filetypes (e.g., "txt", "png", "pdf", "mp3")

### `foundation_provider` (string, optional)
- Display format: Provider name with optional icon
- Examples: "OpenAI", "Anthropic", "Google", "X.AI", "Custom"
- UI suggestion: Provider badge or icon in bot profile/card

---

## Implementation Locations

### 1. Bot Profile/User Card Components
**Files to update:**
- User card components (where bot badges are displayed)
- Bot profile modals/views
- User list components

**Display logic:**
- Only show these fields when `user.is_bot === true`
- Handle missing/undefined fields gracefully (don't show empty sections)
- Consider grouping fields in a "Capabilities" section

### 2. Bot Selection UI
**Files to update:**
- `BotPromptModal.vue` (bot selection modal)
- Any featured bots display components

**Enhancement:**
- Show modality/provider badges in bot selection cards
- Filter/search by modality or provider (future enhancement)

### 3. User Profile Views
**Files to update:**
- Profile view components
- User detail modals

**Display:**
- Add "Bot Capabilities" section for bot users
- Show input/output modalities and foundation provider in a structured format

---

## UI/UX Considerations

1. **Visual Hierarchy**: These are informational fields, so they should be secondary to the bot's name and bio
2. **Accessibility**: Ensure modality labels are readable and properly labeled
3. **Responsive Design**: Consider how to display modality badges on mobile (compact layout)
4. **Consistency**: Use consistent styling with other user metadata badges/tags

---

## Data Fetching

- Fields should be included in user object responses from backend
- No additional API calls needed if fields are part of standard user payload
- Handle cases where fields are missing (optional fields)

---

## Future Enhancements

- Filter bots by modality/provider in bot selection
- Visual icons for common providers (OpenAI logo, Anthropic logo, etc.)
- Human-readable labels for filetypes (e.g., "txt" → "Text", "png" → "Image")

