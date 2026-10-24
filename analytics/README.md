# ResusCode admin analytics (Python)

A local dashboard over the admin's Google Sheet. The app and the Apps Script upload are unchanged:
devices still write to the `Codes` tab, and this reads it **read-only**.

It shows, for the filters you pick (unit, adult/pediatric, month range): codes and any-ROSC rate, median
time to first epinephrine / first shock, a monthly trend, a unit-by-month table, quality indicators
(epinephrine interval over the threshold, pediatric codes with no weight or a dose not calculated, ROSC
codes with the post-ROSC bundle incomplete), debrief issues by action status, and the last upload per unit.
It applies the same rules as the sheet's `Dashboard` tab (training, void, `exclude`, `duplicate_of` and
incomplete codes left out), so the two should agree. It never shows individual rows or the SBAR text, and drops the columns it does not use (SBAR, debrief notes,
device ids, exact start times) as soon as the data is loaded.
A selection with fewer than 10 finished codes gets a warning, and months with fewer than 10 are not plotted:
small samples swing wildly.

## Quickest way: drop in a CSV (no Google setup)

In the sheet, on the **Codes** tab: **File → Download → Comma-separated values (.csv)**. Then start the app
(below, without `RESUSCODE_SHEET_ID`) and drop the file in the sidebar. The file stays in memory on this computer.
A file that is not the Codes tab (no `record_id` column) is refused.

## Optional: read the sheet directly (always fresh)

This needs a Google Cloud service account. Skip it if the CSV route is enough.

### One-time Google setup

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project and enable the **Google Sheets API**.
2. **IAM & Admin → Service accounts → Create**, then **Keys → Add key → JSON**. Save the file as
   `analytics/service-account.json` (git-ignored — treat it like a password).
3. Open the admin sheet → **Share** → add the service account's `client_email` as **Viewer**.
4. Copy the sheet id: the long part of `https://docs.google.com/spreadsheets/d/<ID>/edit`.

Needs **Python 3.10 or newer**.

## Run (Windows PowerShell, from the repo root)

```powershell
cd analytics
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:RESUSCODE_SHEET_ID = "<ID>"   # only for the direct sheet read; leave it out to drop in a CSV
.venv\Scripts\streamlit run app.py
```

It serves `127.0.0.1` only (see `.streamlit/config.toml`) and sends no telemetry. Sheet data is cached for 5 minutes;
use **Refresh from sheet** for the latest. `GOOGLE_APPLICATION_CREDENTIALS` overrides the key path, and
`RESUSCODE_CSV` points at a CSV file instead of the sheet. Keep exports inside your data-governance approval
(see `admin/SETUP.md` step 14).

## If it will not load

- "the header row in the worksheet contains duplicates": row 1 of the `Codes` tab has a repeated or blank header
  cell. Name or delete it, or use the CSV route.
- "no record_id column": the file is not the `Codes` tab.
- "Could not read the data" with a Google message: the sheet is not shared with the service account, the Sheets
  API is not enabled, or the sheet id is wrong.

## Test

```powershell
.venv\Scripts\python -m pytest -q
```

## Layout

- `metrics.py` — all the analysis (pure pandas, tested in `test_metrics.py`).
- `source.py` — reads the sheet (service account) or a CSV.
- `app.py` — the Streamlit page.
