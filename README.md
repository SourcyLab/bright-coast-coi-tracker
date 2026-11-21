# COI Deadline Tracker

A local date and request tracker for Florida general contractors and project managers who keep a roster of subcontractor certificates of insurance (COIs). Review upcoming dates, track requests, and export reminders.

## Run locally

Open `index.html` directly in a current browser, or serve this directory locally:

```sh
python3 -m http.server --bind 127.0.0.1
```

Open the local server address printed in the terminal. No installation or build is needed.

## Use the roster

- Add a row for a subcontractor and job, or import a CSV. The subcontractor name is required. Dates use `YYYY-MM-DD` and can be left blank.
- Search by subcontractor, trade, job, or contact. Use the flag filter or select a table column heading to sort it. Summary counts cover the entire roster and can overlap.
- The look-ahead is 30 calendar days by default. Expiry and job start dates from today through the last day of the look-ahead are included. Expiry before today is flagged as expired. An expiry strictly earlier than job start gets a separate flag. The request flag applies when a job starts in the look-ahead and its COI is not marked Received. Missing and malformed dates have their own flags.
- The tracker uses the device’s local calendar date for today. Dates are treated as calendar days, including across daylight-saving changes. The tracker compares expiry to job start and does not calculate a job-end date.

## Privacy and storage

The tracker runs entirely in the browser. It has no backend, analytics, cookies, or background network requests. When served locally, the browser loads the static files from the local server. Imports, roster editing, and exports are processed on the device.

The roster is held in page memory by default. The **Remember roster in this browser** checkbox opts into browser localStorage. Unchecking it removes the saved copy while keeping the current page’s roster. **Clear all entries** deletes the roster from the page and browser storage. If saving is enabled, future edits are still saved. Storage is specific to the browser profile and origin. Browsers differ in whether they allow storage for directly opened files. When working across multiple tabs, edit the saved roster from one tab at a time.

CSV and calendar exports are files you control. They may contain roster information. The optional external link opens only when selected and contains fixed campaign parameters and no roster data.

## CSV format

Download [the synthetic sample](fixtures/sample-roster.csv) from the page or use this header:

```csv
subcontractor,trade,contact,job_name,job_start,coi_expiry,request_status,notes
```

All eight headers are required. Header matching ignores case and surrounding whitespace. Headers may be reordered. Use one of these values for `request_status` in either UI language:

- `Not requested`
- `Requested`
- `Received`
- `Expired-renewal requested`

Pick a UTF-8 file or paste text. The importer accepts a UTF-8 BOM, CRLF or LF line endings, quoted commas and multiline fields, and doubled quotes inside quoted fields. It trims surrounding whitespace and ignores empty lines outside quotes. Imports append rows. The report lists issues by the physical line where the record starts. An invalid header stops the import. Malformed rows, missing names, and unknown statuses are skipped. Rows with malformed dates otherwise eligible for import are kept and flagged for correction. The sample intentionally contains two such dates.

CSV export includes the entire roster. If you open a CSV in spreadsheet software, import text columns as text so that any formula-like cell contents remain literal.

## Calendar export

The RFC 5545 calendar file includes one all-day event for each usable recorded expiry. Optionally include a request-by event for each row with a usable job start whose status is other than Received. The request-by date is the job start minus the lead time (seven days by default). Events with dates already in the past are included. Each event has a display alarm one calendar day before its date. Calendar clients control whether and when imported alarms appear.

Event identifiers stay stable across exports and edits to the same roster row, including reloads with storage enabled. A CSV re-import creates new roster rows with new identifiers. Calendar imports are snapshots. Re-import behavior varies by calendar client.

## Language and checklists

Switch between English and Español at the top of the page. The checklist in each language can be copied or printed. CSV headers and status values use English in both modes.

## Scope

The tracker flags dates recorded in your roster and tracks request progress. Coverage and certificate determinations belong with your insurance producer.

## Contributing and license

Run `node --test` or `npm test` with Node.js 24. See [CONTRIBUTING.md](CONTRIBUTING.md) for testing and fixture guidelines. Released under the [MIT License](LICENSE).
