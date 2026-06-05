# Roster Lookup Prompt

Copy-paste the prompt below into a new Claude Code session. Requires Playwright MCP + Supabase MCP. Optional: be logged into qrz.com in the Playwright browser for email lookups.

---

## Prompt

I need to fill in missing roster data for the mcinares-net-logger Supabase project (project_id: `ouyecvjkyfekjkplfacu`, table: `mcinares_roster`).

**Step 1 — Find missing data:**
Run this SQL via the Supabase MCP:
```sql
SELECT callsign FROM mcinares_roster WHERE first_name IS NULL OR last_name IS NULL OR email IS NULL ORDER BY callsign
```

**Step 2 — Fetch names from callook.info:**
For every callsign missing first_name OR last_name, use Playwright `browser_evaluate` to batch-fetch from the free callook.info JSON API. The page must already be on a callook.info URL (no CORS) — navigate there first:
```
https://callook.info/W9ABC/json
```

Then run a single evaluate that loops through all needed callsigns with a 300ms delay each:
```javascript
async () => {
  const callsigns = [/* list from step 1 */];
  const results = [];
  for (const cs of callsigns) {
    try {
      const r = await fetch(`https://callook.info/${cs}/json`);
      const d = await r.json();
      results.push({ cs, name: d.status === 'VALID' ? d.name : null });
    } catch(e) { results.push({ cs, name: null }); }
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}
```

The `name` field comes as `"FIRSTNAME M LASTNAME"` or `"FIRSTNAME M LASTNAME, SR ."` or `"FIRSTNAME LAST NAME"` (multi-word last). Parse:
- Strip trailing suffixes (`, SR`, `, JR`, `, II`, `, III`, `, IV`, trailing `.`)
- Strip middle initials (single letters)
- First word is first_name, last remaining word is last_name
- Title case: `MCDANIEL` → `McDaniel`, `O'NAN` → `O'Nan`, `MCCLINTOCK` → `McClintock`

**Step 3 — Update names in Supabase:**
Use a single CASE-based UPDATE statement for all callsigns at once. Example structure:
```sql
UPDATE mcinares_roster SET
  first_name = CASE callsign WHEN 'W9ABC' THEN 'John' ... ELSE first_name END,
  last_name = CASE callsign WHEN 'W9ABC' THEN 'Doe' ... ELSE last_name END
WHERE callsign IN ('W9ABC', ...)
```

**Step 4 — Fetch emails from QRZ.com (optional, requires login + daily lookup quota):**
QRZ free-tier allows ~200 lookups per 24h. If quota available, navigate to qrz.com (any callsign page) to verify session. Then fetch each missing-email callsign and decode the `qmail` JS variable.

QRZ obfuscates emails via a JS variable like `var qmail = "1b1308a2b17m2o4c4.1lai1a7m8gf@9M1R4Ac61D1K!61";`. Decode algorithm:

```javascript
function decodeQmail(qmail) {
  let cl = '';
  let i = qmail.length - 1;
  // Read chars from end until '!' — those chars (reversed) are the email length as a string
  while (i > 0) {
    const c = qmail.charAt(i);
    if (c !== '!') { cl += c; }
    else break;
    i--;
  }
  const count = parseInt(cl);
  i--; // skip the '!'
  // Read `count` chars going backward by 2 from there
  let dem = '';
  for (let x = 0; x < count; x++) {
    dem += qmail.charAt(i);
    i -= 2;
  }
  return dem;
}
```

Batch with 4-5 second delays:
```javascript
async () => {
  const callsigns = [/* missing-email list */];
  const results = [];
  for (const cs of callsigns) {
    await new Promise(r => setTimeout(r, 5000));
    const resp = await fetch(`/db/${cs}`, { credentials: 'include' });
    const html = await resp.text();
    // Check for service limit message
    if (html.includes('Service limit exceeded')) {
      results.push({ cs, e: null, err: 'limit' });
      break; // stop, no point continuing
    }
    let email = null;
    const m = html.match(/var qmail\s*=\s*['"]([^'"]+)['"]/);
    if (m) { try { email = decodeQmail(m[1]); } catch(e) {} }
    results.push({ cs, e: email });
  }
  return results;
}
```

If you hit "Service limit exceeded: Too many lookups in this 24h time period" — stop immediately and tell me. Don't keep trying.

**Step 5 — Update emails:**
```sql
UPDATE mcinares_roster SET email = CASE callsign WHEN ... END WHERE callsign IN (...)
```

**Step 6 — Cleanup junk entries:**
Some roster rows may have callsigns like `K6VGL-UPDATE` or typos like `KDKVZ` (real callsign is `KD9KVZ`). After lookups, identify junk and confirm with me before deleting.

**Rules:**
- Never overwrite existing first_name/last_name/email with NULL or with worse data
- Skip callsigns where callook returns `INVALID`
- Title-case all names properly (especially Mc/Mac/O' prefixes)
- Report what was updated and what's still missing at the end
