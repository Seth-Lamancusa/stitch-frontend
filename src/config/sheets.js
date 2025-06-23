// Google Sheets API Configuration
// Replace these values with your actual Google Sheets details

export const SHEETS_CONFIG = {
  // Your Google Sheets API key
  API_KEY: 'AIzaSyCOMS_tFDaljncHQ9mRyDlLveM9GAlZvBw',
  
  // Your Google Spreadsheet ID (found in the URL)
  // Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
  SPREADSHEET_ID: '1xuD-xY_fqRvTM7rndyy7uzpZJpMJIA4HnRm1O6yY_cc',
  
  // The name of the sheet tab where applications will be stored
  SHEET_NAME: 'Waitlist'
};

// Column headers for the Google Sheet (for reference)
// Make sure your Google Sheet has these column headers in row 1:
// Timestamp | Who are you? | What do you do? | Connections | Contact Info 