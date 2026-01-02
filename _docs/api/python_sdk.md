# Python SDK Documentation

Python SDK (`stitchai`) for interacting with the Stitch API.

## Installation

```bash
pip install -e .
```

Or install from the `stitchai` directory:

```bash
cd stitchai
pip install -e .
```

## Quick Start

```python
from stitchai import StitchClient

# Initialize client
client = StitchClient(api_key="sk_...")

# Or with custom base URL
client = StitchClient(
    api_key="sk_...",
    base_url="https://api.stitch.lol",
    timeout=30.0
)
```

## Messages

### Create Message

Create a new message with recipients.

```python
from stitchai import StitchClient

client = StitchClient(api_key="sk_...")

# Simple message
result = client.messages.create(
    recipients=["user123", "user456"],
    content="Hello, world!",
    public=True
)

if result["success"]:
    message = result["message"]
    print(f"Created message: {message['id']}")
else:
    print(f"Error: {result['error']}")
```

#### Parameters

- `recipients` (required): List of recipient user UIDs or user_tags. Can be:
  - List of strings: `["user123", "user456"]`
  - List of dicts with `uid` and optional `public`: `[{"uid": "user123", "public": True}]`
- `content` (required): Message content (min length 1)
- `parent_id` (optional): Parent message ID for replies
- `public` (optional): Whether the message is public (default: `True`)
- `files` (optional): List of file metadata dicts from `files.upload()`
- `tags` (optional): List of tag strings

#### Return Value

Returns a dict with:
- `success`: Boolean indicating if creation succeeded
- `message`: MessageResponse dict (if successful)
- `error`: Error message string (if failed)

#### Examples

**Create a reply:**

```python
result = client.messages.create(
    recipients=["user123"],
    content="This is a reply",
    parent_id="msg_abc123",
    public=False
)
```

**Create a message with tags:**

```python
result = client.messages.create(
    recipients=["user123", "user456"],
    content="Important message",
    tags=["important", "urgent"],
    public=True
)
```

**Create a message with files:**

```python
# First upload a file
with open("document.pdf", "rb") as f:
    file_meta = client.files.upload(f)

# Then create message with file
result = client.messages.create(
    recipients=["user123"],
    content="Check out this document",
    files=[file_meta],
    public=True
)
```

**Advanced recipient control:**

```python
# Mix of string and dict recipients
result = client.messages.create(
    recipients=[
        "user123",  # Uses message's public value
        {"uid": "user456", "public": False},  # Hidden recipient
        {"uid": "user789", "public": True}   # Visible recipient
    ],
    content="Message with mixed recipients",
    public=True  # Default for string recipients
)
```

### Async Client

For async/await usage:

```python
from stitchai import AsyncStitchClient

async def create_message_async():
    async with AsyncStitchClient(api_key="sk_...") as client:
        result = await client.messages.create(
            recipients=["user123"],
            content="Hello from async!",
            public=True
        )
        return result
```

## Files

### Upload File

Upload a file and get metadata for attaching to messages.

```python
with open("document.pdf", "rb") as f:
    file_meta = client.files.upload(f)
    print(file_meta.url)
    print(file_meta.filename)
    print(file_meta.size)
```

## Error Handling

The SDK raises `APIError` exceptions for API errors:

```python
from stitchai import StitchClient
from stitchai.exceptions import APIError

try:
    result = client.messages.create(
        recipients=["user123"],
        content="Test message"
    )
except APIError as e:
    print(f"API error: {e.status_code}")
    print(f"Response: {e.response}")
```

## Development Status

Currently implemented:
- [x] Files upload (`/v1/files/upload`)
- [x] Messages create (`/v1/messages`)

Coming soon:
- [ ] Messages get, traverse, search, delete
- [ ] Users (me, search, profile updates)
- [ ] Recipients
- [ ] Managed users
- [ ] Links

