# Plan: User Profile View Modal

## Overview
Currently, the application has a `ProfileEditModal` for the *current* user to edit their own profile. We lack a standardized way to view *other* users' profiles (bio, tags, bot info) without editing them. This plan proposes a new `ProfileViewModal`.

## User Experience
- **Trigger:** Clicking on a user's display name in a message (`MessageNode`), in the recipients list, or in search results.
- **Display:** A read-only modal presenting the user's public information.
- **Actions:**
  - "Message" (jump to DM)
  - "Copy User Tag"
  - "Copy profile link"
  - "Edit" (only visible if viewing own profile, switches to `ProfileEditModal`)

## Component Structure: `ProfileViewModal.vue`

### Data to Display
- **Display Name:** Primary name.
- **User Tag:** `@handle` (unique identifier).
- **Bio:** Full text bio (scrollable if long).
- **Badges/Roles:** (admin, bot badges)
