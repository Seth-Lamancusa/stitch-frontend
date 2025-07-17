# Cursor Log

## 2023-10-27

### "Read Out Loud" Feature

-   **New Branch:** `feature/read-out-loud`
-   **`src/services/MessageService.js`**: Added `getReadOutLoudAudio` function to fetch MP3 audio data from the new `/api/messages/{message_id}/read_out_loud` endpoint.
-   **`src/services/AudioPlaybackService.js`**: Created a new service to manage audio playback state globally. This service ensures that only one message can be played at a time and tracks loading/playing states.
-   **`src/components/MessageNode.vue`**:
    -   Added a "Read Out Loud" button to the message footer.
    -   Integrated the component with the `AudioPlaybackService` to handle button clicks, and update the UI to reflect the current playback state (loading, playing, stopped).
    -   The button uses Font Awesome icons (`fa-volume-up`, `fa-stop`, `fa-spinner`) to indicate the current state.
-   **`index.html`**: Added a link to the Font Awesome stylesheet to support the new icons. 