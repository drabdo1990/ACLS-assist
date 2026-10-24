"""Analysis of the admin `Codes` sheet. Pure pandas: no Streamlit, no Google, so it is tested on its own.

Same rules as the sheet Dashboard (admin/apps-script/Code.gs): training, void, `exclude` and `duplicate_of`
rows and incomplete codes are left out; "any ROSC" is rosc or rosc_then_terminated; a row with no population is adult.
"""
import pandas as pd

NUMERIC = [
    "weight_kg", "arrest_ms", "first_shock_ms", "first_epi_ms", "epi_longest_interval_ms",
    "epi_not_calculated", "amiodarone_not_calculated", "lidocaine_not_calculated", "magnesium_not_calculated",
    "post_rosc_done", "post_rosc_total",
]
FLAGS = ["training", "void", "exclude", "epi_interval_flag"]
TEXT = [
    "record_id", "unit", "outcome", "population", "start_month", "start_iso", "issue_category", "action_status",
    "last_upload_iso", "duplicate_of",
]
# Fewer finished codes than this and a rate or median says little: the app flags it instead of presenting it as fact.
# shortcut: a plain count, not a confidence interval — upgrade if units compare small samples against each other.
MIN_CODES = 10
ROSC_OUTCOMES = ["rosc", "rosc_then_terminated"]
NOT_CALCULATED = ["epi_not_calculated", "amiodarone_not_calculated", "lidocaine_not_calculated", "magnesium_not_calculated"]


def normalise(raw: pd.DataFrame) -> pd.DataFrame:
    """Typed copy of the sheet rows. Sheets hands back "TRUE" strings, "" for blanks and filler rows (the
    pre-inserted admin checkboxes), so booleans and numbers are coerced and rows with no record_id are dropped."""
    if "record_id" not in raw:  # the wrong file would otherwise read as "no codes yet"
        raise ValueError("no record_id column: this is not the Codes tab")
    df = raw.copy()
    for c in TEXT:
        df[c] = df[c].fillna("").astype(str).str.strip() if c in df else ""
    for c in NUMERIC:
        df[c] = pd.to_numeric(df[c], errors="coerce") if c in df else float("nan")
    for c in FLAGS:
        df[c] = df[c].astype(str).str.strip().str.upper().eq("TRUE") if c in df else False
    df = df[df.record_id.ne("")].copy()
    df["population"] = df.population.where(df.population.eq("pediatric"), "adult")
    df["start_month"] = df.start_month.where(df.start_month.ne(""), df.start_iso.str[:7])
    df["any_rosc"] = df.outcome.isin(ROSC_OUTCOMES)
    # Data minimisation: drop everything else (SBAR and debrief text, device ids, exact start times) right here,
    # so it is not held in memory or cached after loading. start_iso has done its only job above.
    return df[[c for c in TEXT if c != "start_iso"] + NUMERIC + FLAGS + ["any_rosc"]]


def valid(df: pd.DataFrame) -> pd.DataFrame:
    """Real codes: not training, void, excluded or marked a duplicate by the admin, or a "Send test record" row."""
    return df[~(df.training | df.void | df.exclude | df.duplicate_of.ne("") | df.record_id.str.startswith("TEST-"))]


def counted(df: pd.DataFrame) -> pd.DataFrame:
    """Valid codes that finished: what every rate and median below is computed over."""
    v = valid(df)
    return v[v.outcome.ne("incomplete")]


def summarise(df: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    """Codes, any-ROSC rate and median times (seconds from activation) per group."""
    g = counted(df).groupby(by, as_index=False).agg(
        codes=("record_id", "size"),
        any_rosc=("any_rosc", "sum"),
        first_epi_s=("first_epi_ms", "median"),
        first_shock_s=("first_shock_ms", "median"),
        arrest_s=("arrest_ms", "median"),
    )
    g["rosc_rate"] = g.any_rosc / g.codes
    g["few_codes"] = g.codes < MIN_CODES
    g[["first_epi_s", "first_shock_s", "arrest_s"]] = g[["first_epi_s", "first_shock_s", "arrest_s"]] / 1000
    return g


def quality(df: pd.DataFrame) -> pd.DataFrame:
    """Documentation and process indicators, each as count / eligible codes."""
    c = counted(df)
    epi = c[c.epi_longest_interval_ms.notna()]  # two or more epinephrine doses, so an interval exists
    ped = c[c.population.eq("pediatric")]
    rosc = c[c.any_rosc & (c.post_rosc_total > 0)]
    rows = [
        ("Epinephrine interval over the flag threshold", int(epi.epi_interval_flag.sum()), len(epi)),
        ("Pediatric codes with no weight", int(ped.weight_kg.isna().sum()), len(ped)),
        ("Pediatric codes with a dose not calculated", int((ped[NOT_CALCULATED].fillna(0).sum(axis=1) > 0).sum()), len(ped)),
        ("ROSC codes with the post-ROSC bundle incomplete", int((rosc.post_rosc_done < rosc.post_rosc_total).sum()), len(rosc)),
    ]
    out = pd.DataFrame(rows, columns=["indicator", "count", "of"])
    out["pct"] = (out["count"] / out["of"]).where(out["of"] > 0)
    return out


def issues(df: pd.DataFrame) -> pd.DataFrame:
    """Debrief issue categories (admin-entered) by action status, over valid codes."""
    t = valid(df)
    t = t[t.issue_category.ne("")]
    status = t.action_status.where(t.action_status.ne(""), "none")
    return t.groupby([t.issue_category, status]).size().unstack(fill_value=0)


def to_utc(s: pd.Series) -> pd.Series:
    """Timestamps from the sheet as UTC. The script writes ISO text, but if Sheets turned a cell into a date an
    unformatted read gives a serial number and a CSV export gives display text, so all three are accepted.
    shortcut: a serial is read as UTC although Sheets means the sheet's time zone (off by hours, fine for
    "hours ago"); display text is read month-first — upgrade if a locale writes day-first dates."""
    iso = pd.to_datetime(s, utc=True, format="ISO8601", errors="coerce")
    num = pd.to_numeric(s, errors="coerce")
    plausible = num.where(num.between(36526, 109575))  # years 2000-2200: not an arbitrary number in the cell
    serial = pd.to_datetime(plausible, unit="D", origin="1899-12-30", utc=True, errors="coerce")
    text = pd.to_datetime(s.where(num.isna()), utc=True, format="mixed", errors="coerce")
    return iso.fillna(serial).fillna(text)


def last_upload(df: pd.DataFrame, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """Latest upload per unit (test rows included on purpose): a silent unit shows a large `hours_ago`."""
    now = now if now is not None else pd.Timestamp.now(tz="UTC")
    d = df[df.unit.ne("")]
    t = to_utc(d.last_upload_iso)
    out = t.groupby(d.unit).max().rename("last_upload").reset_index()
    out["hours_ago"] = (now - out.last_upload).dt.total_seconds() / 3600
    return out.sort_values("unit", ignore_index=True)
