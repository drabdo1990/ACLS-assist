"""Admin dashboard. Run from this folder:  streamlit run app.py   (setup: analytics/README.md)"""
import pandas as pd
import streamlit as st

import metrics as m
import source

st.set_page_config(page_title="ResusCode admin", layout="wide")


@st.cache_data(ttl=300, show_spinner="Reading the data…")
def load(csv_bytes: bytes | None) -> pd.DataFrame:
    return m.normalise(source.load(csv_bytes))


def mmss(seconds: float) -> str:
    return "—" if pd.isna(seconds) else f"{int(seconds // 60)}:{int(seconds % 60):02d}"


st.title("ResusCode — admin analytics")
st.caption(
    "Runs on this computer and reads the sheet read-only. Start time plus unit can identify a patient indirectly: "
    "keep screenshots and exports within your data-governance approval."
)

with st.sidebar:
    upload = st.file_uploader(
        "Codes tab as CSV", type="csv",
        help="In the sheet: File → Download → CSV, on the Codes tab. The file stays in memory on this computer.",
    )
if upload is None and not source.configured():
    st.info("Drop the Codes tab (exported as CSV) in the sidebar, or set RESUSCODE_SHEET_ID to read the sheet directly. See analytics/README.md.")
    st.stop()
try:
    df = load(upload.getvalue() if upload is not None else None)
except Exception as e:  # missing key file, sheet not shared with the service account, no network, wrong CSV
    st.error(f"Could not read the data: {e}")
    st.stop()

months = sorted(m.counted(df).start_month.unique())
units = sorted(m.valid(df).unit.unique())
with st.sidebar:
    if st.button("Refresh from sheet"):
        st.cache_data.clear()
        st.rerun()
    pick = st.multiselect("Unit", units, default=units)
    pop = st.selectbox("Population", ["all", "adult", "pediatric"])
    if len(months) > 1:
        lo, hi = st.select_slider("Months", months, value=(months[0], months[-1]))
    else:
        lo = hi = months[0] if months else ""

f = df[df.unit.isin(pick) & df.start_month.between(lo, hi) & (df.population.eq(pop) | (pop == "all"))]
c = m.counted(f)

st.header("Overview")
if c.empty:
    st.info("No finished, non-training codes match these filters yet.")
else:
    k = m.summarise(f.assign(scope="all"), ["scope"]).iloc[0]
    if k.few_codes:
        st.warning(f"Only {int(k.codes)} finished codes here (fewer than {m.MIN_CODES}): read the rates and medians as anecdotes, not trends.")
    a, b, d, e = st.columns(4)
    a.metric("Codes", int(k.codes))
    b.metric(f"Any ROSC ({int(k.any_rosc)} of {int(k.codes)})", f"{k.rosc_rate:.0%}", help="rosc or rosc_then_terminated")
    d.metric("Median first epinephrine", mmss(k.first_epi_s), help="m:ss from activation")
    e.metric("Median first shock", mmss(k.first_shock_s), help="m:ss from activation")

    trend = m.summarise(f, ["start_month"]).set_index("start_month")
    left, right = st.columns(2)
    left.subheader("Codes per month")
    left.bar_chart(trend.codes)
    right.subheader("Any-ROSC rate per month")
    rate = trend.rosc_rate.where(~trend.few_codes)
    if rate.notna().any():
        right.line_chart(rate)
    right.caption(f"Months with fewer than {m.MIN_CODES} codes are not plotted.")

    st.subheader("By unit and month")
    t = m.summarise(f, ["unit", "start_month"])
    t["rosc_pct"] = t.rosc_rate * 100
    t["note"] = t.few_codes.map({True: "few codes", False: ""})
    st.dataframe(
        t[["unit", "start_month", "codes", "any_rosc", "rosc_pct", "first_epi_s", "first_shock_s", "arrest_s", "note"]],
        hide_index=True,
        column_config={
            "rosc_pct": st.column_config.NumberColumn("ROSC rate", format="%.0f%%"),
            "first_epi_s": st.column_config.NumberColumn("Median first epi (s)", format="%.0f"),
            "first_shock_s": st.column_config.NumberColumn("Median first shock (s)", format="%.0f"),
            "arrest_s": st.column_config.NumberColumn("Median arrest (s)", format="%.0f"),
        },
    )

    st.header("Quality indicators")
    q = m.quality(f)
    q["pct"] = q.pct * 100
    st.dataframe(
        q, hide_index=True,
        column_config={"pct": st.column_config.NumberColumn("%", format="%.0f%%"), "of": "Eligible codes"},
    )

    st.header("Debrief review")
    iss = m.issues(f)
    if iss.empty:
        st.write("No issue categories recorded yet.")
    else:
        st.metric("Open actions", int(iss["open"].sum()) if "open" in iss else 0)
        st.bar_chart(iss)

st.header("Upload health")
lu = m.last_upload(df)
st.dataframe(
    lu, hide_index=True,
    column_config={"hours_ago": st.column_config.NumberColumn("Hours ago", format="%.0f")},
)
st.caption("Includes test records. A long gap means no codes, or a device that cannot upload (Settings → Send test record).")
