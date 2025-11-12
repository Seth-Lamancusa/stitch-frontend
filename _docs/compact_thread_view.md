Here’s a concise, high-signal plan for introducing a new Thread View while cleaning up the current UI and decoupling the “monster” `MessageNode`.

### Goals
- Add a new `ThreadViewCompact.vue` (toggle-able alongside existing `ThreadView.vue`).
- Split `MessageNode.vue` into smaller, purpose-built components.
- Introduce a dedicated, lightweight `MessagePreview.vue` for list contexts (used by views under `TabViewLayout.vue`).
- Simplify branch/scroll behavior and make it robust.

### Component architecture
- New thread view:
  - `views/app_views/ThreadViewCompact.vue`
    - Uses a smaller, thread-only message card.
    - Uses composables for branch prep and scroll.
- New message components:
  - `components/thread/ThreadMessage.vue` (thread-only visual; replaces `MessageNode` in thread)
  - `components/MessagePreview.vue` (inbox/public/saved cards)
  - `components/thread/MessageHeader.vue` (author, tag, timestamp, recipients, read toggle)
  - `components/thread/MessageActions.vue` (reply/save/prompt/etc.)
  - `components/thread/RecipientsBadge.vue` (always-on, opens global modal)
- Navigator & composer:
  - `components/thread/SiblingNavigatorNext.vue` (store-light, props-first; keeps behavior but simpler API)
  - `components/thread/ReplyComposer.vue` (extract from `ReplyBox.vue` to a slimmer thread version; reuse shared logic)

### Composables (replace scattered logic and watchers)
- `useThreadData(messageId)`:
  - Ensures radius in store, prepares branch path, exposes `displayedMessages`, `rootMessage`, and `endOfBranch`.
  - Wraps existing store dispatches (`loadMessageRadius`, `prepareBranchPath`, `loadMessageBranchUp/Down`).
- `useThreadScroll({ listRef, getMessageEl })`:
  - Initial center-on message (with offset), layout-stable parent/child loading.
  - IntersectionObserver for top/bottom markers (auto-load more).
  - Scroll position preservation when loading parents.
- `useMarkRead()`:
  - IntersectionObserver-based per-message read marking (debounced, percent-visible threshold).
- `useSiblingNav(parentId)`:
  - Exposes current position and `navigate('prev'|'next')`, defers to store but hides DOM concerns.

### Store and data flow
- Keep existing `messages` and `navigation` modules.
- Add read-only composable wrappers for the view to avoid ad-hoc watchers in components.
- Keep `branch_child` logic in store; composables consume it.
- Continue using global modals (links, recipients, delete confirm, profile) to avoid rework.

### UI/UX considerations
- Thread vs list:
  - Thread: full content, rich actions, sibling nav inline with header.
  - List: truncated plaintext, minimal actions, lightweight layout.
- Sibling nav:
  - Inline on mobile, flanking buttons on desktop (your current approach), but via a small, stateless `SiblingNavigatorNext.vue`.
  - Add keyboard: Left/Right to navigate siblings; Up/Down to scroll per message; Enter to reply.
- Reply:
  - Keep bottom-sheet pattern; extract `ReplyComposer.vue` to share between thread/new-thread but simplify props/events.
- Accessibility:
  - Proper roles/aria for bottom sheet; focus management on open/close; keyboard-first sibling navigation.

### Toggle/feature flag and routing
- UI toggle in the thread header (“Classic | New”), persisted to localStorage.
- Route-level fallback: `?view=new` query param, read on mount; store in `navigation` for consistency.
- Keep `ThreadView.vue` intact; add route alias or conditional render to `ThreadViewCompact.vue`.

### Scroll/branch simplification
- Replace imperative `ensureCorrectScroll` with `useThreadScroll` (center target via `scrollIntoView({block:'center'})` + offset).
- Replace manual “load more parents/children” with top/bottom sentinels (+ IntersectionObserver).
- Use `ResizeObserver` and “reference element delta” for layout-stable parent insertion.
- Optional virtualization (only if needed later) using `vue-virtual-scroll-list`.

### Preview refactor for `TabViewLayout.vue` consumers
- Create `components/MessagePreview.vue`.
- Migrate Inbox/Public/Saved views and any list renders to use the preview card (no `MessageNode.vue` in lists).
- Provide simple props: `message`, `onNavigate`, `selected`, `onToggleSelect` (list-specific concerns only).

### API and actions parity
- Keep all existing actions (send reply, delete, recipients add/remove, mark read/unread).
- Maintain global notifications and modals behavior.
- Preserve selection mode; thread messages keep checkboxes, lists keep their own selection UI.

### Performance
- Memoized computed props in new components.
- Lazy measure/observe only when mounted and visible.
- Debounce URL updates; maintain your `suppressRouteReload` behavior behind `useThreadScroll`.

### Testing
- Unit: `ThreadMessage.vue`, `SiblingNavigatorNext.vue`, `useThreadScroll`, `useThreadData`.
- E2E flows: load thread, auto-center, load parents/children via sentinels, sibling navigation, mark-read by visibility, delete (centered vs non-centered), recipients add.
- A/B via toggle to validate parity with existing behavior.

### Rollout
- Phase 1: Build `ThreadViewCompact.vue` behind toggle; instrument errors/UX metrics.
- Phase 2: Move list screens to `MessagePreview.vue`; keep `MessageNode.vue` only in Classic thread.
- Phase 3: Remove `MessageNode` from lists, then gradually retire it after confidence.
- Phase 4: Make New the default; keep Classic for fallback for a short period.

### Risks and mitigations
- Divergent behavior between Classic and New: mitigate via shared composables over shared store.
- Scroll edge cases: lean on observers + clear offset strategy; avoid deep DOM queries.
- Modals interplay: ensure reply box closes before modals open (you already handle this; preserve).

### Rough effort (high-level)
- New thread view + composables: 2–4 days
- `ThreadMessage` + header/actions split: 1–2 days
- `SiblingNavigatorNext`: 0.5–1 day
- `ReplyComposer` extraction: 0.5–1 day
- `MessagePreview` + list migrations: 1–2 days
- QA + polish: 2–3 days

If you want, I can scaffold `ThreadViewCompact.vue`, the composables, and the two new message components, behind a header toggle, and migrate one list to `MessagePreview.vue` as a first step.

- I’ll start by sketching `useThreadData` and `useThreadScroll`, then add `ThreadViewCompact.vue` that consumes them, and wire the toggle in `ThreadView.vue`’s header (non-destructive).
- No code changes yet; say the word and I’ll begin with the scaffolding.

- Add a new `ThreadViewCompact.vue` with composables for data and scroll; split `MessageNode.vue` into `ThreadMessage.vue` and `MessagePreview.vue` to decouple thread vs list.
- Replace imperative scroll/branch logic with IntersectionObserver sentinels and a scroll composable; keep store actions as-is.
- Introduce a UI toggle (persisted) and route `?view=new` support; keep Classic view intact during rollout.