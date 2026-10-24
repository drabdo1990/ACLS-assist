import pandas as pd
import pytest

import metrics as m


def row(**kw):
    base = {
        "record_id": "202610201200-abcd1234", "unit": "ICU", "outcome": "rosc", "training": "FALSE", "void": "FALSE",
        "exclude": "FALSE", "population": "adult", "start_month": "2026-10", "first_epi_ms": 100000,
        "first_shock_ms": 60000, "arrest_ms": 600000, "last_upload_iso": "2026-10-20T10:00:00.000Z",
    }
    base.update(kw)
    return base


def frame(*rows):
    return m.normalise(pd.DataFrame(rows))


def test_normalise_drops_filler_rows_and_reads_sheet_strings():
    # the Codes sheet pre-inserts checkbox rows (FALSE, no record_id); booleans arrive as "TRUE" text or real bools
    df = frame(row(training="TRUE"), row(record_id="", exclude=False), row(record_id="202610201201-abcd1234", exclude=True))
    assert list(df.record_id) == ["202610201200-abcd1234", "202610201201-abcd1234"]
    assert list(df.training) == [True, False]
    assert list(df.exclude) == [False, True]


def test_counted_leaves_out_training_void_excluded_incomplete_and_test_rows():
    df = frame(
        row(record_id="202610201200-a1b2c3d4"),
        row(record_id="202610201201-a1b2c3d4", training="TRUE"),
        row(record_id="202610201202-a1b2c3d4", void="TRUE"),
        row(record_id="202610201203-a1b2c3d4", exclude="TRUE"),
        row(record_id="202610201204-a1b2c3d4", outcome="incomplete"),
        row(record_id="TEST-a1b2c3d4"),  # a test row that lost its training flag is still not a code
    )
    assert list(m.counted(df).record_id) == ["202610201200-a1b2c3d4"]


def test_summarise_counts_both_rosc_outcomes_and_reports_seconds():
    df = frame(
        row(record_id="202610201200-a1b2c3d4", outcome="rosc", first_epi_ms=60000),
        row(record_id="202610201201-a1b2c3d4", outcome="rosc_then_terminated", first_epi_ms=120000),
        row(record_id="202610201202-a1b2c3d4", outcome="terminated", first_epi_ms=""),
        row(record_id="202610201203-a1b2c3d4", unit="ED", outcome="terminated"),
    )
    s = m.summarise(df, ["unit"]).set_index("unit")
    assert s.loc["ICU", "codes"] == 3
    assert s.loc["ICU", "any_rosc"] == 2
    assert abs(s.loc["ICU", "rosc_rate"] - 2 / 3) < 1e-9
    assert s.loc["ICU", "first_epi_s"] == 90  # median of 60 s and 120 s; the blank is ignored
    assert s.loc["ED", "rosc_rate"] == 0


def test_blank_population_is_adult():
    df = frame(row(population=""), row(record_id="202610201201-a1b2c3d4", population="pediatric"))
    assert list(df.population) == ["adult", "pediatric"]


def test_quality_indicators():
    df = frame(
        row(record_id="202610201200-a1b2c3d4", epi_longest_interval_ms=400000, epi_interval_flag="TRUE"),
        row(record_id="202610201201-a1b2c3d4", epi_longest_interval_ms=200000, epi_interval_flag="FALSE"),
        row(record_id="202610201202-a1b2c3d4", population="pediatric", weight_kg="", epi_not_calculated=1,
            post_rosc_done=2, post_rosc_total=5),
        row(record_id="202610201203-a1b2c3d4", population="pediatric", weight_kg=12, outcome="terminated"),
    )
    q = m.quality(df).set_index("indicator")
    assert tuple(q.loc["Epinephrine interval over the flag threshold", ["count", "of"]]) == (1, 2)
    assert tuple(q.loc["Pediatric codes with no weight", ["count", "of"]]) == (1, 2)
    assert tuple(q.loc["Pediatric codes with a dose not calculated", ["count", "of"]]) == (1, 2)
    assert tuple(q.loc["ROSC codes with the post-ROSC bundle incomplete", ["count", "of"]]) == (1, 1)


def test_quality_with_no_eligible_codes_is_nan_not_an_error():
    q = m.quality(frame(row()))
    empty = q[q["of"] == 0]
    assert len(empty) == 4 and empty.pct.isna().all()  # a lone adult code makes none of the four indicators eligible


def test_issues_by_status_ignores_training_and_blank_status_reads_none():
    df = frame(
        row(record_id="202610201200-a1b2c3d4", issue_category="airway", action_status="open"),
        row(record_id="202610201201-a1b2c3d4", issue_category="airway", action_status=""),
        row(record_id="202610201202-a1b2c3d4", issue_category="airway", action_status="open", training="TRUE"),
    )
    i = m.issues(df)
    assert i.loc["airway", "open"] == 1
    assert i.loc["airway", "none"] == 1


def test_last_upload_flags_a_silent_unit():
    df = frame(
        row(unit="ICU", last_upload_iso="2026-10-20T10:00:00.000Z"),
        row(record_id="202610201201-a1b2c3d4", unit="ED", last_upload_iso="2026-10-17T10:00:00.000Z"),
    )
    lu = m.last_upload(df, now=pd.Timestamp("2026-10-20T12:00:00Z")).set_index("unit")
    assert lu.loc["ICU", "hours_ago"] == 2
    assert lu.loc["ED", "hours_ago"] == 74


def test_duplicate_of_is_left_out():
    df = frame(row(), row(record_id="202610201201-a1b2c3d4", duplicate_of="202610201200-abcd1234"))
    assert list(m.counted(df).record_id) == ["202610201200-abcd1234"]
    assert list(m.summarise(df, ["unit"]).codes) == [1]


def test_few_codes_flag_switches_at_the_threshold():
    many = [row(record_id=f"20261020{i:04d}-a1b2c3d4") for i in range(m.MIN_CODES)]
    assert not m.summarise(frame(*many), ["unit"]).few_codes.any()
    assert m.summarise(frame(*many[:-1]), ["unit"]).few_codes.all()


def test_to_utc_accepts_iso_text_sheets_serials_and_display_text():
    serial = (pd.Timestamp("2026-10-20") - pd.Timestamp("1899-12-30")).days + 0.5  # noon on the 20th
    t = m.to_utc(pd.Series(["2026-10-20T10:00:00.000Z", str(serial), "10/20/2026 10:00:00", "garbage", "", "12345"]))
    assert t[0] == pd.Timestamp("2026-10-20T10:00:00Z")
    assert t[1] == pd.Timestamp("2026-10-20T12:00:00Z")
    assert t[2] == pd.Timestamp("2026-10-20T10:00:00Z")
    assert t[3:].isna().all()  # junk and an arbitrary number are not dates


def test_last_upload_survives_sheets_turning_the_cell_into_a_date():
    serial = (pd.Timestamp("2026-10-20") - pd.Timestamp("1899-12-30")).days + 0.5
    lu = m.last_upload(frame(row(last_upload_iso=serial)), now=pd.Timestamp("2026-10-20T14:00:00Z"))
    assert lu.hours_ago.iloc[0] == 2


def test_a_file_without_record_id_is_refused_not_read_as_empty():
    with pytest.raises(ValueError):
        m.normalise(pd.DataFrame([{"foo": "1"}]))


def test_normalise_keeps_only_the_columns_the_analysis_uses():
    # free text, device ids and exact start times are never needed, so they are not held in memory after loading
    df = frame(row(sbar="free text", debrief_note="note", device_id="abcd1234", start_month="", start_iso="2026-09-03T10:00:00+03:00"))
    assert {"sbar", "debrief_note", "device_id", "start_iso"}.isdisjoint(df.columns)
    assert {"record_id", "unit", "outcome", "any_rosc", "last_upload_iso"} <= set(df.columns)
    assert list(df.start_month) == ["2026-09"]  # the month still comes from start_iso when the column is blank


def test_empty_sheet_does_not_crash():
    df = m.normalise(pd.DataFrame([{"record_id": ""}]))
    assert m.summarise(df, ["unit"]).empty
    assert m.last_upload(df).empty
    assert m.issues(df).empty
