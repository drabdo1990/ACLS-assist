import inspect
import io

import gspread
import pandas as pd
import pytest

import source


def test_read_csv_strips_an_excel_bom_and_keeps_blank_cells_as_text():
    raw = "﻿record_id,unit,weight_kg\n202610201200-abcd1234,ICU,\n".encode("utf-8")
    df = source.read_csv(io.BytesIO(raw))
    assert list(df.columns) == ["record_id", "unit", "weight_kg"]
    assert df.loc[0, "weight_kg"] == ""


def test_an_empty_upload_is_not_replaced_by_the_configured_source(tmp_path, monkeypatch):
    configured_file = tmp_path / "codes.csv"
    configured_file.write_text("record_id\nx\n")
    monkeypatch.setenv("RESUSCODE_CSV", str(configured_file))
    with pytest.raises(pd.errors.EmptyDataError):
        source.load(b"")  # the user dropped a 0-byte file: say so, do not quietly show other data
    assert len(source.load(None)) == 1


def test_sheet_read_is_read_only_on_the_codes_tab_with_valid_gspread_arguments(monkeypatch):
    seen = {}

    class Ws:
        def get_all_records(self, **kw):
            seen["kw"] = kw
            return [{"record_id": "x"}]

    class Book:
        def worksheet(self, name):
            seen["tab"] = name
            return Ws()

    class Client:
        def open_by_key(self, key):
            seen["key"] = key
            return Book()

    def fake_service_account(filename, scopes):
        seen["scopes"] = scopes
        return Client()

    monkeypatch.delenv("RESUSCODE_CSV", raising=False)
    monkeypatch.setenv("RESUSCODE_SHEET_ID", "SHEET123")
    monkeypatch.setattr(source.gspread, "service_account", fake_service_account)
    assert len(source.load_codes()) == 1
    assert seen["scopes"] == ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    assert (seen["key"], seen["tab"]) == ("SHEET123", "Codes")
    inspect.signature(gspread.Worksheet.get_all_records).bind(None, **seen["kw"])  # raises if gspread would reject them
