# Google Sheets API Setup for Whitelist Applications

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Stitch Whitelist Applications"
3. In the first row, add these column headers:
   ```
   Timestamp | Who are you? | What do you do? | Connections | Contact Info
   ```
4. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

## Step 2: Get Google Sheets API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click on it and press "Enable"
4. Create an API Key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key
5. (Optional but recommended) Restrict the API key:
   - Click on the API key you just created
   - Under "API restrictions", select "Restrict key"
   - Choose "Google Sheets API"
   - Under "Website restrictions", add your domain

## Step 3: Make the Sheet Public

For the API to work without authentication, you need to make the sheet publicly writable:

1. In your Google Sheet, click "Share" (top right)
2. Change access to "Anyone with the link can edit"
3. Copy the sharing link (optional, for your reference)

**Security Note**: This makes the sheet publicly writable. Anyone with the API endpoint could potentially write to it. For a waitlist form, this is usually acceptable, but be aware of this limitation.

## Step 4: Update Configuration

1. Open `frontend/src/config/sheets.js`
2. Replace the placeholder values:
   ```javascript
   export const SHEETS_CONFIG = {
     API_KEY: 'your-actual-api-key-here',
     SPREADSHEET_ID: 'your-actual-spreadsheet-id-here',
     SHEET_NAME: 'Whitelist Applications' // or whatever you named your sheet tab
   };
   ```

## Step 5: Test the Integration

1. Start your frontend application
2. Navigate to the "Join Waitlist" page
3. Fill out the form and submit
4. Check your Google Sheet - you should see a new row with the submitted data

## Troubleshooting

- **403 Forbidden**: Check that the Google Sheets API is enabled and your API key is correct
- **404 Not Found**: Verify the Spreadsheet ID and Sheet Name are correct
- **CORS Error**: This shouldn't happen with Google's API, but if it does, the sheet might not be public
- **Empty rows**: Make sure the sheet has the correct column headers in row 1

## Data Format

Each submission will create a new row with:
- Column A: Timestamp (ISO format)
- Column B: "Who are you?" answer
- Column C: "What do you do?" answer  
- Column D: "Connections" answer
- Column E: "Contact Info" answer

Empty answers will be stored as empty strings. 