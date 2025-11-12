# Migration Plan: Featured Bots → User-Based Speed Dial (Frontend)

## Overview
Replace the current featured bots mechanism (hardcoded bot list) with a user-based speed dial system where each user can maintain their own personalized list of frequently contacted users/bots.

## Current State Analysis

### Frontend Components Using Featured Bots
1. **`RecipientsModal.vue`** (lines 111-176, 1064-1087)
   - Displays "Featured Bots" section with main/advanced categorization
   - Allows toggling bots as recipients
   - Uses `FeaturedBotsService.listFeaturedBots()`

2. **`BotPromptModal.vue`** (lines 14-43, 120-162)
   - Shows featured bots for adding to messages
   - Supports main/advanced bot categorization
   - Uses `FeaturedBotsService.listFeaturedBots()`

3. **`ImportView.vue`** (lines 457, 537, 1240-1245)
   - Uses featured bots for import functionality
   - Uses `FeaturedBotsService.listFeaturedBots()`

### Current Data Flow
- **No backend endpoint exists** for `/featured_bots`
- Frontend falls back to mock data in `FeaturedBotsService.js`
- Mock data includes: Claude, ChatGPT, Grok, GPT-5, Gemini
- Featured bots are identified by UIDs (e.g., '39daf2ca', '2ae49e27')
- Each bot has: `uid`, `display_name`, `user_tag`, `advanced` (boolean)

## Backend API Contract

The backend will provide the following endpoints:

**GET `/api/v1/users/me/speed-dial`**
- Returns current user's speed dial list
- Response format:
  ```json
  {
    "users": [
      {
        "uid": "39daf2ca",
        "display_name": "Claude",
        "user_tag": "claude",
        "position": 0,
        "added_at": "2024-01-01T00:00:00Z",
        "last_used_at": "2024-01-15T00:00:00Z"
      }
    ]
  }
  ```

**POST `/api/v1/users/me/speed-dial`**
- Add user to speed dial
- Body: `{ "uid": "39daf2ca", "position": 0 }` (position optional, defaults to end)
- Returns updated speed dial list

**DELETE `/api/v1/users/me/speed-dial/{uid}`**
- Remove user from speed dial
- Returns updated speed dial list

**PUT `/api/v1/users/me/speed-dial/reorder`**
- Reorder speed dial items
- Body: `{ "uids": ["uid1", "uid2", "uid3"] }` (ordered list)
- Returns updated speed dial list

## Frontend Implementation Plan

### 1. Service Layer

**Create `SpeedDialService.js`** to replace `FeaturedBotsService.js`:
```javascript
// New service methods:
- listSpeedDialUsers() // Get current user's speed dial
- addToSpeedDial(uid, position?) // Add user to speed dial
- removeFromSpeedDial(uid) // Remove from speed dial
- reorderSpeedDial(uids) // Reorder speed dial
```

**Implementation details:**
- Use existing API client patterns (likely `apiClient.get/post/delete/put`)
- Handle errors gracefully with user-friendly messages
- Return promises that resolve to the speed dial user list
- Support optional position parameter for `addToSpeedDial`

### 2. Component Updates

**1. `RecipientsModal.vue`**
- Replace "Featured Bots" section with "Speed Dial"
- Load speed dial users instead of featured bots using `SpeedDialService.listSpeedDialUsers()`
- Remove advanced/main categorization (or replace with user-defined groups)
- Add UI to manage speed dial (add/remove/reorder buttons)
- Handle loading states while fetching speed dial
- Handle empty state when speed dial is empty

**2. `BotPromptModal.vue`**
- Replace featured bots with speed dial users
- Update variable names: `featuredBots` → `speedDialUsers`
- Remove advanced/main categorization
- Update to use `SpeedDialService.listSpeedDialUsers()`
- Handle empty state gracefully

**3. `ImportView.vue`**
- Replace featured bots dropdown with speed dial users
- Update to use `SpeedDialService.listSpeedDialUsers()`
- Update dropdown options to use speed dial data

### 3. UI Enhancements

- Add "Add to Speed Dial" button in user search results
- Add speed dial management UI:
  - Drag-to-reorder functionality (consider using Vue.Draggable or similar)
  - Remove buttons for each speed dial item
  - Visual feedback when adding/removing from speed dial
- Show "Recently Used" or "Frequently Contacted" suggestions (future enhancement)
- Auto-add users to speed dial when frequently contacted (optional, future enhancement)

### 4. State Management

- Add speed dial state to Vuex store (consider new `speedDial.js` module or add to `navigation.js`)
- Cache speed dial list in store to avoid repeated API calls
- Update store when speed dial is modified (add/remove/reorder)
- Consider reactive updates across components when speed dial changes

### 5. Migration Strategy

#### Phase 1: Service Creation
1. Create `SpeedDialService.js` with all CRUD methods
2. Keep `FeaturedBotsService.js` temporarily for backward compatibility
3. Add feature flag support to toggle between old/new system

#### Phase 2: Component Updates
1. Update `RecipientsModal.vue` to use speed dial
2. Update `BotPromptModal.vue` to use speed dial
3. Update `ImportView.vue` to use speed dial
4. Add speed dial management UI components

#### Phase 3: State Management
1. Add speed dial module to Vuex store
2. Integrate speed dial state with components
3. Add reactive updates for speed dial changes

#### Phase 4: Cleanup
1. Remove `FeaturedBotsService.js` after migration complete
2. Remove mock featured bots data
3. Remove feature flag after full rollout
4. Update documentation

### 6. Frontend Considerations

#### Error Handling
- Handle API errors gracefully (network errors, 404, 500, etc.)
- Show user-friendly error messages
- Provide retry mechanisms for failed requests

#### Loading States
- Show loading indicators while fetching speed dial
- Handle empty states when speed dial is empty
- Provide helpful empty state messaging

#### User Experience
- Show visual feedback when adding/removing from speed dial
- Provide immediate UI updates (optimistic updates)
- Handle edge cases (duplicate adds, invalid UIDs)
- Respect backend limits (e.g., max 20 users)

#### Performance
- Cache speed dial list in frontend store
- Debounce reorder operations if needed
- Minimize unnecessary API calls
- Use efficient rendering for speed dial lists

#### Backward Compatibility
- During migration, support both featured bots and speed dial via feature flag
- Graceful fallback if speed dial is empty (show empty state or default suggestions)
- Ensure smooth transition for users

### 7. Testing Plan

#### Unit Tests
- Test `SpeedDialService` methods (mocked API calls)
- Test error handling in service layer
- Test component logic for speed dial operations

#### Component Tests
- Test speed dial loading and display in each component
- Test add/remove/reorder operations
- Test integration with RecipientsModal and BotPromptModal
- Test empty state handling
- Test error states

#### Integration Tests
- Test full flow: add to speed dial → use in RecipientsModal → send message
- Test cross-component consistency
- Test state management updates

### 8. Files to Modify

#### Frontend Files
- `stitch-frontend/src/services/SpeedDialService.js` - New service file
- `stitch-frontend/src/services/FeaturedBotsService.js` - Deprecate/remove after migration
- `stitch-frontend/src/components/modals/RecipientsModal.vue` - Update to use speed dial
- `stitch-frontend/src/components/modals/BotPromptModal.vue` - Update to use speed dial
- `stitch-frontend/src/views/app_views/ImportView.vue` - Update to use speed dial
- `stitch-frontend/src/store/modules/navigation.js` or new `speedDial.js` - Add speed dial state management

### 9. Timeline Estimate

- **Phase 1 (Service Creation)**: 1 day
- **Phase 2 (Component Updates)**: 2-3 days
- **Phase 3 (State Management)**: 1 day
- **Phase 4 (Cleanup)**: 1 day

**Total**: ~5-6 days

### 10. Open Questions

1. Should speed dial be limited to bots only, or include all users?
   - **Recommendation**: Include all users (more flexible)

2. Should there be a maximum size limit for speed dial?
   - **Recommendation**: Yes, limit to 20-30 users for performance (backend enforced)

3. Should speed dial auto-populate based on usage?
   - **Recommendation**: Start manual, add auto-populate as enhancement

4. Should we maintain the "advanced" categorization?
   - **Recommendation**: Remove it, let users organize as they want

5. How to handle speed dial for managed users?
   - **Recommendation**: Same as regular users, but respect managed user permissions (backend handles)

6. Should speed dial be shareable/syncable across devices?
   - **Recommendation**: Yes, stored server-side so it syncs automatically

## Next Steps

1. Review and approve this plan
2. Coordinate with backend team on API contract
3. Create feature branch: `feature/user-speed-dial-frontend`
4. Begin Phase 1 implementation (service creation)
5. Set up feature flag for gradual rollout
6. Implement and test incrementally
7. Deploy with feature flag disabled initially
8. Enable for beta users, then full rollout
