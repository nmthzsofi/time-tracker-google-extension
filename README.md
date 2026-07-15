# Google Sheets Time Tracker

A Chrome side-panel extension for tracking task-based work sessions and recording structured timesheet data directly in Google Sheets.

## Highlights

- Maintains an accurate timestamp-based timer in a Manifest V3 service worker
- Persists active session state with the Chrome Storage API
- Authenticates through Chrome Identity and creates a dedicated spreadsheet automatically
- Appends completed sessions as structured rows through the Google Sheets API
- Keeps timer state independent from side-panel rendering and browser UI refreshes

## Tech Stack

JavaScript, HTML5, CSS3, Chrome Extensions Manifest V3, Chrome Storage, Chrome Identity, OAuth 2.0, and Google Sheets API.
