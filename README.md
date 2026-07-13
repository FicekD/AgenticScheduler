# Agentic Scheduler

Desktop app (Electron + React + Tailwind) that fires an autonomous Claude Code
**orchestrator** run against a target repo on a schedule aligned to your subscription's
5‑hour usage windows. Each run is one `claude -p` process: an Opus orchestrator that
spawns Sonnet subagents, works a single plan point on its own git branch, and writes a
completion report. If a run is cut off by the usage limit, the next scheduled run detects
the missing report and resumes the same point from its commits.

## How it works

- **Schedule** — `node-cron` fires at your configured local times (default 06:00 / 11:00 / 16:00).
- **Launch** — spawns `claude -p --model opus --permission-mode bypassPermissions
  --output-format stream-json --verbose` with the target repo as `cwd`; the prompt is piped
  via stdin (no shell quoting).
- **Resume logic** — completion == a new file in the repo's `reports/` dir. The app diffs the
  reports directory around each run; no report ⇒ the next run continues the same point.
- **Durable progress** lives in the target repo (branches + commits). The app only stores run
  history (`runs.json`) and config (`config.json`) under Electron `userData`.

The orchestrator always works on a **dedicated branch it creates** (it chooses the base). It
never merges — you review and merge branches manually.

## Run it

```bash
npm install       # also generates the tray icon
npm run dev        # launches the app with HMR
npm run build      # compile main/preload/renderer to out/
```

Then in **Settings**: pick the target repo, confirm the schedule, and (for a dry run) point
it at `sample-target/`. Hit **Run now** on the Dashboard to watch live activity.

## Target repo contract

The scheduler keeps its own state under a **gitignored** `.agentic-scheduler/` dir in the
target repo (auto-added to the repo's `.gitignore` on first use), so it never pollutes git:

- `.agentic-scheduler/PLAN.md` — numbered points of work, top to bottom.
- `.agentic-scheduler/reports/` — the app/agent writes `point-N.md` here when point N is done.

The report is a local completion certificate detected on disk — it is intentionally not
committed. Actual work lands on per-point branches you review and merge. See `sample-target/`
for the shape.

## Notes / known gaps (prototype)

- `bypassPermissions` runs the agent unattended with full tool access — always on a branch,
  never on your working `main`. Review via PR.
- Only one run executes at a time; a scheduled slot is skipped if a run is already active.
- Run history is a JSON file; swap for SQLite if it grows large.
- Live parsing keys off the `stream-json` event types (`system`/`assistant`/`result`).
