# Frontend Scratchpad

Informal notes and ideas for frontend work.

## Completed ✓

### Tags Schema Change - COMPLETE ✓

**Summary**: Tags upgraded from simple strings to rich objects with metadata. UI displays tags as rows with author attribution and timestamps. Updates happen immediately when adding/removing tags.

**Changes Implemented**:
1. **Immediate Updates**: Tags now update the backend immediately when "Add" or "Remove (×)" is clicked, instead of waiting for "Done"
   - Added `@update` event that dispatches `updateMessageTags` action
   - Added `isUpdating` state to show loading feedback
   - "Done" button now just closes the modal

2. **Row-Based Display**: Tags are now displayed as rows with metadata instead of chips
   - Each tag shows: `#tagname` with `@author` and `time` below
   - Supports both old string format and new object format (backward compatible)
   - Shows "just now", "5m ago", "3h ago", "2d ago", or date format

3. **Tag Object Support**: Modal now handles tags as objects with:
   - `name`: tag string
   - `added_by_tag`: user who added it
   - `created_at`: timestamp
   - Falls back gracefully for old string-only tags

4. **Updated Components**:
   - `TagsModal.vue`: New row layout, immediate update logic, time formatting
   - `MessageNode.vue`: Added `handleTagsUpdate` handler, passes `messageId` prop

---

## Notes & Ideas

### UI/UX
- [fix] dev modal styling a bit of a mess
- [ui] tabs at bottom of screen on mobile
- [info] mobile-friendly tooltips across apps, echoed in concept docs
- [feature] Enhance accessibility site-wide then add pro-accessibility website blurb

### Features
- [feature] Default branch message setting
- [feature] propagate public option for ancestors, descendents, and whole tree + UI
- [feature] Thread settings modal
  - Publicity, recipients control for all messages
- [feature] Publicity control on message (message settings modal?)
- [feature] Subject UI
  - Input box on new thread view and / or replybox
- [feature] Add to descendents toggle on (draft) replybox, prompt bot modals
- [feature] Message search tab
  - By content
  - Filters: public, tag
- [feature] live draft rendering
- [feature] render in replybox
- [feature] Graph view and context selection features
- [feature] Export as JPG button
- [feature] Interactive widget implementation
- [feature] Implement manual context selection on send
- [feature] Reformat button
- [feature] Reformat admin button on `MessageNode`

### Tags & Mentions
- [✓] Implement tags feature (with metadata) - COMPLETE
  - [✓] Add to all frontend and backend models
  - [✓] Tags modal with row display + immediate updates
  - [] `#` utility for parsing tags from content
  - [✓] Search by tag (already working)
- [feature] Implement `@` utility for draft recipients
  - `@`s notify

### Fixes
- [fix] Maintain scroll position and loaded messages when exiting thread view back to message list tab view
- [fix] Separate draft and existing recipient modals (recips become part of settings?)

### Refactoring
- [refactor] divide message node component
- [refactor] divide messages.js

### Content & Pages
- [info] Add FAQ page with links to threads
  - Invent app-wide styling for linking to messages on-site
- [feature] Public docs (How it works page)
  - API reference
  - Conceptual docs
  - Stitch Bots guidance
- [feature] AI Impact info page
  - AI causing delusions / psychosis
  - Impact on job market
  - Environmental impact
- [feature] Stitch Chats
  - Informational web page with explanation and links to all podcasts and corresponding chats
- [feature] Demo / overview video on YouTube channel
- [feature] QR printout design
- [note] Ensure public messages indexable by search engines

### Future / Outsource
- [feature] Outsource mobile app
- [new] Outsource desktop app
- [feature] User voice calls and screen sharing

