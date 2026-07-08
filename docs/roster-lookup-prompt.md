# Roster Lookup Prompt

Copy-paste the prompt below into a new Claude Code session. Requires Playwright MCP + Supabase MCP. All lookups run against callook.info (free FCC data, JSON API, no login, no quota). Do not use QRZ for automated lookups.

Note: callook.info carries FCC license data only, so it can fill names, addresses, and license class, but never emails. Emails are collected over the air or entered by hand on the roster page.

---

## Prompt

I need to fill in missing roster data for the mcinares-net-logger Supabase project (project_id: `ouyecvjkyfekjkplfacu`, table: `mcinares_roster`). All lookups go through callook.info only — never QRZ.

**Step 1 — Find missing data:**
Run this SQL via the Supabase MCP:
```sql
SELECT callsign FROM mcinares_roster WHERE first_name IS NULL OR last_name IS NULL ORDER BY callsign
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

The same JSON response also carries `address.line1` / `address.line2` and `current.operClass` if address or license columns need filling — apply the same never-overwrite rule.

**Step 3 — Update names in Supabase:**
Use a single CASE-based UPDATE statement for all callsigns at once. Example structure:
```sql
UPDATE mcinares_roster SET
  first_name = CASE callsign WHEN 'W9ABC' THEN 'John' ... ELSE first_name END,
  last_name = CASE callsign WHEN 'W9ABC' THEN 'Doe' ... ELSE last_name END
WHERE callsign IN ('W9ABC', ...)
```

**Step 4 — Cleanup junk entries:**
Some roster rows may have callsigns like `K6VGL-UPDATE` or typos like `KDKVZ` (real callsign is `KD9KVZ`). After lookups, identify junk and confirm with me before deleting.

**Rules:**
- callook.info only. No QRZ, no other lookup services.
- Never overwrite existing first_name/last_name/address/license with NULL or with worse data
- Emails are never auto-fetched; leave email as-is
- Skip callsigns where callook returns `INVALID`
- Title-case all names properly (especially Mc/Mac/O' prefixes)
- Report what was updated and what's still missing at the end
