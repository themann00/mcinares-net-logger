# Station Identity Spec

Logs reference stations by roster UUID. The roster is the single authority for station identity (callsign, names). Logs keep per-net facts (location, quadrant, station type, traffic and announcement flags). Decided 2026-06-05.

## Schema changes

1. `mcinares_log_entries.station_id UUID NULL` with FK to `mcinares_roster.id`, `ON DELETE RESTRICT`. Set on every station-related entry type: checkin, late_checkin, report, traffic, announcement, station_moved, circle_back, liaison, alt_nc.
2. `mcinares_roster.created_in_net_id UUID NULL`. Stamped when a check-in auto-creates the roster entry. Null for imported or manually added members. This is the test for "new this net."
3. Case-insensitive unique constraint on `mcinares_roster.callsign` (unique index on `upper(callsign)`). All entry paths normalize: uppercase, trim.
4. Log metadata gains `callsign_as_typed`, written once at entry creation, never updated. Audit trail of original keystrokes.
5. Backfill migration: for each log entry with `metadata.callsign`, case-insensitive match to roster, create roster rows for misses, write `station_id` and `callsign_as_typed`.
6. Names (`first_name`, `last_name`) live on roster only. Remove from new log metadata writes. Display joins roster.
7. Regenerate `supabase/migration.sql` to match deployed schema (currently stale).

## Display rule

Station-type entries render callsign and names from the roster join at read time. `content` holds only free text (report body, traffic detail). Never bake callsign text into `content` for station entries, or renames leave stale prose.

## Check-in flow (live net, zero friction)

Callsign field autocompletes against roster plus current net stations. When no exact match, the final option is always explicit: `New station: <typed>`. Selecting it, or submitting an unknown callsign, silently creates the roster entry as typed (uppercased), stamped with `created_in_net_id`. No prompts during a live net. Duplicate detection compares `station_id`, with the existing force check-in override.

Base or Mobile is `station_type` in log metadata, a designator, never part of callsign identity. Mid-net swaps flow through station_moved and circle_back derivation as today.

## Editing a callsign on a log entry

Callsign on every log entry (all three net types, live and past views) is clickable, opens autocomplete. Incorrect is the station currently on the entry. Correct is what the user selects or types.

| Incorrect | Correct | Action |
|---|---|---|
| New this net | New (not in roster) | Rename roster row in place. UUID keeps. Typo never existed. |
| New this net | Existing | Repoint logs to existing UUID. Delete the just-created roster row. Never happened. |
| Existing | New | Create roster entry and UUID, repoint this entry. Prompt: change all (this net), highlight all, skip. |
| Existing | Existing | Repoint this entry. Same prompt: change all, highlight all, skip. |

Guard on rows 1 and 2: automatic only when the incorrect station has a single log entry in this net. Multiple entries (force-dupe case, where one may be a real station) get the same change all / highlight all / skip prompt as rows 3 and 4.

Prompt semantics, scoped to the current net only:

- Change all: repoint every entry in this net from the incorrect UUID to the correct UUID.
- Highlight all: visually mark every entry in this net still on the incorrect UUID, each clickable for individual repoint. Client-side state, no persistence.
- Skip: this entry only.

After any repoint, if the old UUID has zero log references across all nets and was created this net, prompt: "No longer referenced anywhere. Delete from roster?" Never auto-delete silently.

Name edits from a log entry update the roster directly. Names are roster-only, no prompt.

## Roster page edits

Roster page edit modal behaves as today: direct roster updates, no roster-versus-net question. Callsign rename there is the vanity-callsign path (UUID keeps, all history follows).

Rename collision (target callsign already exists as another roster entry) offers:

1. Merge: combine into the target. All logs repoint from the renamed entry's UUID to the target UUID, names and contact fields fill nulls from the loser, loser deleted. Dialog shows both entries with check-in counts before commit.
2. Rename the other station first (for example W9XYZ to W9XYZ-OLD), keeping two distinct stations, then complete the original rename. The other-station rename is a plain roster update.
3. Cancel.

Roster delete is blocked when logs reference the station: "Station has N log references. Merge instead."

## As-typed audit display

Past net log view gains a "Show original entries" toggle, default off. When on, entries whose `callsign_as_typed` differs from the current roster callsign render both: `N9MAN (typed: N9NIN)`. Matching entries stay clean.

## Cleanup items

- Delete `app/api/nets/[id]/stations/route.ts` (references dropped stations table).
- Report entries repoint independently of their check-in entry. EditLogModal stops silently patching the check-in's metadata when a report is edited; highlight mode is the tool for fixing related entries deliberately.
