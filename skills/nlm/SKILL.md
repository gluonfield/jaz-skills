---
name: nlm
description: Drive Google NotebookLM from the terminal with the `nlm` CLI to authenticate from a browser profile, manage notebooks and sources, run chat and research, and generate audio or video overviews, mind maps, slides, and reports. Use whenever the user mentions nlm, NotebookLM, notebooks, sources, generated overviews, or NotebookLM authentication problems such as browser-profile detection, wrong Google accounts, Chrome profile selection, or Dia, Arc, and Brave detection.
allowed-tools:
  - Bash
  - Read
  - Write
---

# nlm — NotebookLM from the command line

`nlm` is a CLI for Google NotebookLM. It manages notebooks, sources, chat,
research, and generated artifacts (audio/video overviews, mind maps, slides,
reports) from the terminal. Binary is typically at `~/go/bin/nlm`; confirm with
`which nlm`. First run requires `nlm auth`.

`nlm <command> [args]` — run `nlm --help` for the full command surface, or
`nlm <command> --help` for per-command flags.

## Authentication (read this first — most issues live here)

`nlm` authenticates by **copying cookies from a logged-in browser profile**, not
by opening a login flow. It then writes a token + cookies to `~/.nlm/env`.

### Which browsers it can read
It scans **Chromium-family profiles only**: Chrome, Brave, Arc, Edge, Chromium,
Vivaldi. **It does NOT detect Dia** (The Browser Company's browser) even though
Dia is Chromium-based and stores data under `~/Library/Application Support/Dia`.
There is no flag to point it at Dia. **If the user is logged into NotebookLM only
in Dia, auth will fail — have them log into NotebookLM in Chrome (or Brave/Arc)
instead.** This is the single most common "it doesn't pick up my browser" cause.

### Directory name vs. display name (the second most common gotcha)
`nlm` selects profiles by their **directory name** (`Default`, `Profile 1`,
`Profile 2`, …), NOT the friendly name shown in Chrome's profile switcher
("Augustinas MS1", "Work", etc.). To map a display name → directory:

```bash
python3 -c "
import json
d = json.load(open('$HOME/Library/Application Support/Google/Chrome/Local State'))
for dirn, info in sorted(d.get('profile',{}).get('info_cache',{}).items()):
    print(f\"{dirn:12s} -> {info.get('name','?'):28s} | {info.get('user_name','(no account)')}\")
"
```

(Swap the path for `BraveSoftware/Brave-Browser` etc. for other browsers.)

### Auth commands
```bash
nlm auth                       # auto: use the configured/last-good profile
nlm auth -all -n               # scan ALL profiles; -n shows notebook count per profile
nlm auth login -p "Default"    # pin a specific Chrome *directory* (e.g. "Profile 1")
nlm auth -au 1                 # pick Google account index 1 in a multi-account profile
nlm auth --print-env           # print shell-safe export lines for the current session
nlm refresh                    # refresh stored credentials without re-scanning
```

`-all -n` is the best diagnostic: it lists every profile, whether it has
NotebookLM cookies, and how many notebooks each sees. Pick the profile/account
that reports the notebooks the user expects.

### Auth gotchas checklist
- **"Found 0 notebooks" right after logging in** → usually a *stale cookie
  snapshot*. Re-run `nlm auth login -p "<dir>"` (or `nlm refresh`) AFTER the
  browser login completes so it copies fresh cookies, then `nlm notebook list`.
- **Wrong account's notebooks** → the profile is logged into a different Google
  account. Map display→dir (above), confirm the `user_name`, and pin with `-p`
  (and `-au <index>` for multi-account profiles).
- **CI / headless** → set `NLM_AUTH_TOKEN` and `NLM_COOKIES` env vars directly
  instead of browser auth; or `nlm auth -c ws://localhost:9222` to a remote CDP.

### Where auth lives
`~/.nlm/env` (keys: `NLM_AUTH_TOKEN`, `NLM_COOKIES`, `NLM_SESSION_ID`,
`NLM_BL_PARAM`, `NLM_AUTHUSER`, `NLM_BROWSER_PROFILE`, `NLM_SIGNALER_AUTH`).
These can also be exported as env vars to override the file.

## Core commands

### Notebooks & sources
```bash
nlm notebook list
nlm notebook create "<title>"
nlm notebook delete <notebook-id>
nlm source list <notebook-id>
nlm source add <notebook-id> <file|url|-> [more...]   # '-' streams stdin as one source
nlm source sync <notebook-id> [paths...]              # bundle+sync local files (auto-chunks >5MB)
nlm source read <source-id> [notebook-id]             # print server-indexed text
nlm source delete <notebook-id> <source-id|a,b,c|->
```

### Chat & research
```bash
nlm chat <notebook-id> "<prompt>"            # one-shot answer
nlm generate-chat <notebook-id> "<prompt>"   # stream a one-shot answer
nlm research <notebook-id> "<query>"         # --mode=fast|deep, --md for markdown
```

### Generated artifacts
```bash
nlm create-audio  <notebook-id> "<instructions>"   # audio overview
nlm create-video  <notebook-id> "<instructions>"   # video overview
nlm mindmap-create <notebook-id> "<instructions>"
nlm create-slides <notebook-id> "<instructions>"   # --format detailed|presenter
nlm create-report <notebook-id> <report-type> "<desc>"   # see report-suggestions for types
nlm artifact list <notebook-id>
nlm audio download <notebook-id> [filename]
nlm video download <notebook-id> [filename]
nlm deck download <notebook-id> --id <artifact-id> --format pdf|pptx -o file
```

### Content transforms (operate on a notebook's sources)
`summarize`, `outline`, `study-guide`, `faq`, `briefing-doc`, `timeline`, `toc`,
`critique`, `brainstorm`, `verify`, `explain`, `rephrase`, `expand` —
all take `<notebook-id> [source-id...]`.

### Sharing & misc
```bash
nlm share <notebook-id>            # public; share-private for private
nlm account                        # show authenticated NotebookLM account
nlm mcp                            # run as an MCP server on stdin/stdout
```

## Exit codes
`0` ok · `2` bad args · `3` auth required/invalid · `4` not found · `5`
precondition failed (quota, source cap, wrong source type) · `6` transient
(rate limit / 5xx — safe to retry) · `7` resource busy (still generating —
poll and retry).

## Typical flow
1. `nlm auth -all -n` → confirm the right profile/account sees the notebooks.
2. `nlm notebook list` → grab the notebook ID.
3. `nlm source add <id> <files/urls>` → load content.
4. `nlm research <id> "..."` / `nlm chat <id> "..."` / `nlm create-audio <id> "..."`.

When scripting, check exit codes: retry on `6`, poll on `7`, re-auth on `3`.
