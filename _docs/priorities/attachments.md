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
  - Max file size: 10MB (enforced by backend)

**Update `src/services/MessageService.js`**:
- Add `attachments` parameter to message creation methods
- Include attachments array in request payload

### 2. Component Updates

**`src/components/ReplyBox.vue`**:
- Add file picker UI (📎 Attach button)
- Handle file selection
- Show upload progress indicator ("Uploading...")
- Display selected files before sending
- Add attachments to message payload
- Handle file size validation (client-side check before upload)

**`src/components/MessageNode.vue`**:
- Display attachments in message rendering
- Show attachment icons/previews
- Handle attachment click (open in new tab or preview modal)

**`src/components/MessageAttachments.vue`** (new component):
- Display list of attachments for a message
- Show file name, size, type
- Provide download/open actions
- Handle image previews (thumbnails)
- Handle PDF display (link or embedded viewer)

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
7. Send the message
8. Verify attachment appears in the message

## Backend API Contract

### POST /api/v1/attachments/upload
Upload a single file (max 10MB).

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
- Check file size (max 10MB)
- Verify file type is supported (PDF, images)

### Signed URLs expire
- URLs are regenerated on each message fetch (backend handles this)
- If URLs expire, refresh the message thread

### Files too large
- Default limit is 10MB (backend enforced)
- Show user-friendly error message
- Consider client-side compression for images (future enhancement)

---

## Later

### Optional Frontend Enhancements

1. **Progress bars** - Show upload progress for large files
2. **Multiple files** - Allow selecting multiple files at once
3. **Drag & drop** - Add drag-and-drop upload UI
4. **Preview modal** - Show PDF/image previews in-app
5. **Image thumbnails** - Display thumbnails for images (backend generates)
6. **File type icons** - Show appropriate icons for different file types
7. **Download progress** - Show download progress for large attachments
8. **Attachment gallery** - Grid view for multiple attachments

