# Admin setup: receiving code statistics in a Google Sheet

For a unit admin, not a developer. Every step is a click or a paste.

## 1. What this is

One Google Sheet that **you own** receives finished-code statistics from the devices you enrol.
No patient identifiers are sent. You write the debrief in the admin columns.

## 2. Create the sheet

Create a new Google Sheet, then **Extensions → Apps Script**.

## 3. Paste the script

Replace the default code with the whole of `admin/apps-script/Code.gs`.
Optionally: Project Settings → **Show "appsscript.json"** → paste `admin/apps-script/appsscript.json`.

## 4. Run `setupAdminSheet` once

Select `setupAdminSheet` in the function dropdown, press **Run**, and approve the permission
prompt. It creates the `Codes`, `Units` and `Dashboard` tabs, the dropdowns and the checkboxes.

## 5. Add your units

One row per unit on the `Units` tab:

| Column | Value |
|---|---|
| `enrollment_key` | 8–64 letters, digits, `-` or `_`. Make it random. |
| `unit_name` | e.g. `ICU` — **must be unique among active units** |
| `active` | ticked |

To revoke a unit, untick `active`.

A unit can only update rows its own `unit_name` wrote (a record is re-sent when a user edits its
Training/Void flags). If you rename a unit, later edits to its **older** records are refused
(`key`); new codes are not affected. Fix an old row by editing its `unit` cell to the new name.

## 6. Deploy

**Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone**, then copy the
`/exec` URL.

> **To change the code later: Deploy → Manage deployments → ✏ → Version: New version → Deploy.**
> Never choose "New deployment" again: it changes the URL and every enrolled device stops working.

## 7. Check it

Open the `/exec` URL in a private window: it must say `ok`.
"Script function not found: doGet" means the deployed project does not contain this code, or an
old version is deployed.

## 8. Make an enrollment link

Open ResusCode in a browser, run this in the browser console, then share the link or paste it into any QR-code generator.
**Treat the link like a password**: anyone with it can add rows to your sheet.

```js
const e = { url: 'https://script.google.com/macros/s/XXXX/exec', key: 'your-unit-key', unit: 'ICU' };
const b = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(e))))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log(location.href.split('#')[0] + '#enroll=' + b);
```

## 9. iPhone / iPad

Safari and the home-screen app keep **separate storage**. Open the installed app → **Settings** →
paste the code (the part after `#enroll=`, or the whole link).

## 10. Check a device

Settings → **Send test record**. A `TEST-…` row appears (flagged training and ignored by the
Dashboard). The message tells you whether the browser can read the reply ("confirmed") or not
("sent, not confirmed"). In the second case the Dashboard's **Last upload** column shows which
units are silent.

## 11. Columns

- **Device-owned** columns are written by the script and overwritten on every upload.
- **Admin-owned** columns are never touched: `debrief_note`, `issue_category`, `action_status`,
  `reviewed`, `reviewer`, `review_date`, `exclude`, `duplicate_of`.
- You may reorder columns. Do not rename device columns.
- A cell that starts with `=`, `+`, `-` or `@` is stored with a leading apostrophe on purpose.

## 12. Dashboard

Formulas by unit and month, excluding training, void, `exclude` and incomplete codes. "Any ROSC"
counts `rosc` and `rosc_then_terminated`. The **Population** selector (`C2`/`D2`: all / adult /
pediatric) narrows every row; older rows with an empty `population` cell count as adult.
*The Dashboard formulas were not run against a live sheet when this was written. Check the first
real upload.*

## 13. Upgrading the script (app updates)

When a new version of the app adds columns or fixes the script:

1. Copy the new `admin/apps-script/Code.gs` over the old code in **Extensions → Apps Script**.
2. Run `setupAdminSheet` once more. It appends any new device columns to the end of the `Codes`
   header row (for example `population`, `weight_kg`, `weight_source`), then rebuilds the
   Dashboard formulas. It never moves or clears existing rows. **Run it before you deploy
   (step 3) and again if you notice a blank Dashboard column** — the Dashboard cannot reference
   a column that does not exist yet. Existing rows have no population value; the Dashboard counts
   them as adult.
3. **Deploy → Manage deployments → ✏ → Version: New version → Deploy** — this keeps the same URL.
   Never create a new deployment: it changes the `/exec` URL and every enrolled device stops
   working until it is re-enrolled.

Old script versions ignore unknown columns, so updating the devices first is safe: the pediatric
columns stay empty until you paste the new script. Rows written by older devices (no `population`
value) are counted as adult on the Dashboard.

## 14. Before clinical use (release gate)

Get written approval from hospital data governance covering:

- what is sent (statistics, patient weight, age for pediatric codes, start date/time, unit, a summary note);
- who can open the sheet;
- retention on devices and in the sheet.

Start date/time plus unit can identify a patient indirectly even without names. Access to the
sheet is controlled only by its Google sharing settings.

## 15. Troubleshooting

| Settings message | Meaning and fix |
|---|---|
| Enrollment invalid — contact admin | The key is wrong or the unit is inactive. Check the `Units` tab (`active` ticked, key matches) and re-issue the link. |
| Update app | The app and the script disagree on the payload version. Reload the app (or reinstall the home-screen app); redeploy the script as a **New version** if you changed it. |
| A record was too large — contact admin | The payload exceeded the size limit. Contact the developer. |
| Error page / HTML reply | The deployment is not set to "Anyone", or an old version is deployed. See steps 6–7. |
| Sent, not confirmed | The browser cannot read Google's reply. Rows still arrive. Check the Dashboard's **Last upload** column. |
