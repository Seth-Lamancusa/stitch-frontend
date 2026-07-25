# Attachment Support — Frontend Implementation

## Overview
Frontend implementation for PDF and image attachment support, integrating with backend upload endpoints and Google Cloud Storage.

---

## Now

### Frontend Implementation

### 1. Service Layer

**Create `src/services/AttachmentService.js`**:
- `uploadFile(file)` - Upload a single file to backend
  - Accepts File object
  - Returns promise with attachment metadata
  - Handles upload progress and errors
  - Max file size: 100MB (client-side validation; backend may enforce different limit)
   - Validates file types: PDF, JPEG, PNG, GIF, WebP, and Python code (.py)
  - Provides user-friendly error messages for:
    - File size exceeded
    - Invalid file type
    - Authentication errors (401)
    - Permission errors (403)
    - Network errors

**Update `src/services/MessageService.js`**:
- Add `attachments` parameter to message creation methods
- Include attachments array in request payload

### 2. Component Updates

**`src/components/ReplyBox.vue`**:
- Add file picker UI (📎 Attach button)
- Handle file selection (single file only - multiple files is future enhancement)
- Show upload progress indicator ("Uploading...")
- Display selected files before sending with:
  - File name
  - File size (formatted)
  - Remove button (removes from draft; uploaded file remains in GCS until message is sent)
- Add attachments to message payload
- Handle file size validation (client-side check before upload)
- Clear attachments when message is sent successfully

**`src/components/MessageNode.vue`**:
- Display attachments in message rendering
- Show attachment icons/previews
- Handle attachment click (open in new tab or preview modal)

**`src/components/MessageAttachments.vue`** (new component):
- Display list of attachments for a message
- Show file name, size, type
- Provide download/open actions (opens in new tab via signed URL)
- Display file type icons (🖼️ for images, 📄 for PDFs, 📎 for others)
- **Note**: Image thumbnails and PDF previews are not yet implemented (future enhancement)

### 3. State Management

**Update `src/store/modules/messages.js`**:
- Pass attachments through when creating messages
- Store attachment metadata with messages
- Handle attachment URLs (signed URLs from backend)

### 4. UI/UX Considerations

- Show upload progress for large files
- Display file size and type before upload
- Validate file types (PDF, images)
- Show error messages for failed uploads
- Handle multiple file selection (future enhancement)
- Drag & drop support (future enhancement)

### 5. Testing Locally

```bash
# Terminal 1: Run backend (backend team handles this)
cd stitch-backend
export GCS_BUCKET_NAME=stitch-attachments
export GCP_PROJECT_ID=YOUR_PROJECT_ID
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
python main.py

# Terminal 2: Run frontend
cd stitch-frontend
npm install
npm run dev
```

### 6. Test Upload Flow
1. Open http://localhost:5173
2. Log in
3. Click reply on a message
4. Click "📎 Attach" button
5. Select a PDF or image
6. Wait for "Uploading..." to finish
7. Verify attachment preview appears with name and size
8. Test removing attachment before sending
9. Send the message
10. Verify attachment appears in the message with clickable link
11. Click attachment link - should open in new tab
12. Test with different file types (PDF, JPEG, PNG, GIF, WebP)
13. Test error cases:
    - File too large (>100MB)
    - Invalid file type
    - Network error (disconnect network)

## Backend API Contract

### POST /api/v1/attachments/upload
Upload a single file (backend may enforce size limit; client validates up to 100MB).

**Request:** multipart/form-data with `file` field

**Response:**
```json
{
  "name": "document.pdf",
  "size": 123456,
  "type": "application/pdf",
  "url": "https://storage.googleapis.com/...",
  "gcs_path": "uploads/user123/abc-123_document.pdf"
}
```

**Notes:**
- `url`: Signed URL valid for 7 days (GET requests only)
- `gcs_path`: Permanent storage path used to regenerate signed URLs
- Backend validates file ownership: `gcs_path` must start with `uploads/{user_uid}/`

### Message Format

Attachments are stored in the `attachments` array of each message:

```json
{
  "id": "abc123",
  "content": "Check out this document",
  "attachments": [
    {
      "name": "document.pdf",
      "size": 123456,
      "type": "application/pdf",
      "url": "https://storage.googleapis.com/...",
      "gcs_path": "uploads/user123/abc-123_document.pdf"
    }
  ]
}
```

## Files to Create/Modify

### Frontend Files
- `src/services/AttachmentService.js` - New upload service
- `src/services/MessageService.js` - Added attachments param
- `src/store/modules/messages.js` - Pass attachments through
- `src/components/ReplyBox.vue` - File picker UI
- `src/components/MessageNode.vue` - Display attachments
- `src/components/MessageAttachments.vue` - New attachment display component

## Troubleshooting

### "Upload failed" error
- Check network connection
- Verify backend is running
- Check file size (client validates up to 100MB; backend may enforce different limit)
   - Verify file type is supported (PDF, JPEG, PNG, GIF, WebP, .py)
- Check browser console for detailed error message

### Signed URLs expire
- URLs are valid for 7 days (backend generates with 7-day expiration)
- URLs are regenerated on each message fetch (backend handles this automatically)
- If URLs expire, refresh the message thread to get new signed URLs
- Backend uses `gcs_path` to regenerate URLs when needed

### Files too large
- Client-side validation: 100MB limit
- Backend may enforce different limit (check backend docs)
- Show user-friendly error message with actual file size
- Consider client-side compression for images (future enhancement)

### Attachment removed before sending
- Removing attachment from draft only removes it from UI
- Uploaded file remains in GCS until message is sent
- Orphaned uploads may accumulate (future: cleanup job)

### Security
- Backend validates file ownership: attachments must belong to the uploading user
- File type validation on both client and server
- Signed URLs provide time-limited access without exposing GCS credentials

---

## Later

### Optional Frontend Enhancements

1. **Progress bars** - Show upload progress for large files (currently only shows "Uploading...")
2. **Multiple files** - Allow selecting multiple files at once (currently single file only)
3. **Drag & drop** - Add drag-and-drop upload UI
4. **Preview modal** - Show PDF/image previews in-app (currently opens in new tab)
5. **Image thumbnails** - Display thumbnails for images (backend generates; frontend not yet implemented)
6. **File type icons** - Show appropriate icons for different file types (partially implemented: 🖼️ 📄 📎)
7. **Download progress** - Show download progress for large attachments
8. **Attachment gallery** - Grid view for multiple attachments
9. **Cleanup orphaned uploads** - Remove files from GCS if user removes attachment before sending
10. **Upload retry** - Retry failed uploads automatically
11. **Image compression** - Client-side compression before upload for large images
