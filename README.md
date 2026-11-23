# Masters 2028 tracker

A single-page tracker (`index.html`) that reads and writes a Google Sheet through a small Apps Script (`Code.gs`).
Without a sheet it runs on demo data saved in your browser, so you can try it first.

## Files

- `index.html`: the app. No build step.
- `seed.js`: demo data (a copy of the spreadsheet at the time it was made).
- `Code.gs`: the Google Apps Script backend that turns the sheet into a small API.
- `../Masters-Planning-Tracker.xlsx`: the spreadsheet to import. Its tab and column names are what the app expects, so do not rename them.

## Connect it to Google Sheets (about 5 minutes)

1. Go to drive.google.com, upload `Masters-Planning-Tracker.xlsx`, open it, and choose File > Save as Google Sheets.
2. In that Google Sheet: Extensions > Apps Script. Delete the starter code and paste in `Code.gs`.
3. Change `TOKEN` at the top to a long random string of your own. Save.
4. Deploy > New deployment > type: Web app. Execute as: Me. Who has access: Anyone. Deploy and approve the permissions.
5. Copy the Web app URL (ends in `/exec`).
6. Open `index.html` in a browser (double-click it, or serve the folder), click Settings, paste the URL and the same token, and Save. The badge changes to "live: google sheet".

Edits to status, next action, notes, document status and cost inputs are written to the sheet. Formula columns are never overwritten. To change anything else (deadlines, tuition text), edit the sheet itself and press Refresh in the app.

## Notes

- "Anyone" means anyone who has the URL can call the script, so the token is what protects your data. Keep the URL and token private. Reads and writes both need the token.
- After you edit `Code.gs`, use Deploy > Manage deployments > Edit > New version for the change to go live.
- Exchange rates in the Cost tab are placeholders. Update them in the sheet.
- The app lists only what the sheet has. To add a column, add it in the sheet; it will show in the data but the app only displays fields it knows.

## Publishing on GitHub Pages with a password

The public site holds no readable personal data. `seed.json` (your grades and notes) stays on your Mac and is git-ignored. `lock.mjs` encrypts it into `seed.enc.js` (AES-256-GCM, key from your password via PBKDF2), and the page decrypts it in the browser after you type the password. Anyone can download `seed.enc.js`, so the protection is only as strong as the password: use 12+ characters, ideally a few random words.

1. Lock the data (type the password when asked; it is not stored anywhere):
   `cd masters-tracker && node lock.mjs`
2. Create an empty repository on github.com (public, because free accounts only serve Pages from public repos). Do not add a README.
3. Push:
   ```
   git init -b main
   git add -A
   git commit -m "Masters tracker"
   git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
   git push -u origin main
   ```
4. On GitHub: Settings > Pages > Build and deployment > Deploy from a branch > main / (root) > Save. The site appears at `https://YOUR-USER.github.io/YOUR-REPO/` after a minute.

Re-run `node lock.mjs` and push again whenever you change `seed.json`. The Google Sheet URL and token you enter in Settings are saved only in your browser, never in the repo. The Sheet itself is the place for live edits; the site is just the front end.

The gate protects the starting data only. If you connect a Google Sheet, anyone who learns your web app URL and token could read it, so keep both private.
