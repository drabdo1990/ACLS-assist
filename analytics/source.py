"""Where the Codes rows come from: the admin's Google Sheet (read-only service account), or a CSV export of
the Codes tab for a machine with no Google credentials (RESUSCODE_CSV). Nothing here writes to the sheet."""
import io
import os

import gspread
import pandas as pd
from gspread.utils import ValueRenderOption

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
DEFAULT_KEY = os.path.join(os.path.dirname(__file__), "service-account.json")


def read_csv(src) -> pd.DataFrame:
    # utf-8-sig: a CSV saved by Excel starts with a BOM that would otherwise stick to the first header name
    return pd.read_csv(src, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def configured() -> bool:
    """True when the environment names a sheet or a CSV; otherwise the app waits for an uploaded file."""
    return bool(os.environ.get("RESUSCODE_CSV") or os.environ.get("RESUSCODE_SHEET_ID"))


def load(csv_bytes: bytes | None = None) -> pd.DataFrame:
    """An uploaded file wins over the configured source, even an empty one (`is not None`, never truthiness):
    a dropped 0-byte file must say so, not quietly show other data."""
    return read_csv(io.BytesIO(csv_bytes)) if csv_bytes is not None else load_codes()


def load_codes() -> pd.DataFrame:
    csv = os.environ.get("RESUSCODE_CSV")
    if csv:
        return read_csv(csv)
    sheet_id = os.environ.get("RESUSCODE_SHEET_ID")
    if not sheet_id:
        raise RuntimeError("Set RESUSCODE_SHEET_ID to the id in the sheet's URL (see analytics/README.md).")
    gc = gspread.service_account(filename=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", DEFAULT_KEY), scopes=SCOPES)
    ws = gc.open_by_key(sheet_id).worksheet("Codes")
    # unformatted: real numbers and booleans instead of display strings; numericise off so ids stay text
    rows = ws.get_all_records(value_render_option=ValueRenderOption.unformatted, numericise_ignore=["all"])
    return pd.DataFrame(rows)
