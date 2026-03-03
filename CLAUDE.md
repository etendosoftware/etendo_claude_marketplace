# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is the **Etendo Dev Assistant** — a Claude Code plugin marketplace that provides skills (`/etendo:*` slash commands) for Etendo ERP development. It is NOT an application with a build system or tests — it is a collection of Markdown-based skill definitions and reference documentation.

## Repository structure

```
.claude-plugin/marketplace.json    # Marketplace manifest (lists all plugins)
plugins/
  dev-assistant/                   # Main plugin — all /etendo:* skills
    .claude-plugin/plugin.json     # Plugin manifest
    skills/                        # One folder per skill, each with SKILL.md
      etendo-_guidelines/          # Shared conventions (read by all skills)
      etendo-_context/             # Project detection, DB connection patterns
      etendo-_webhooks/            # Webhook invocation patterns and known bugs
      etendo-alter-db/             # Create/modify AD tables and columns
      etendo-window/               # Create/modify windows, tabs, fields
      etendo-java/                 # Scaffold EventHandlers, BG processes, etc.
      etendo-module/               # Create/configure modules
      etendo-flow/                 # Configure EtendoRX flows
      etendo-headless/             # Configure EtendoRX REST endpoints
      etendo-test/                 # Create and run tests
      etendo-report/               # Jasper reports
      etendo-context/              # Detect active module and infra mode
      etendo-init/                 # Bootstrap a new Etendo project
      etendo-install/              # Install on existing project
      etendo-smartbuild/           # Compile and deploy
      etendo-update/               # Synchronize DB with model
    references/                    # Detailed docs loaded on demand by skills
    scripts/xml2json.py            # Utility to inspect AD XML files
  etendo-workflow-manager/         # Jira/GitHub workflow plugin
    skills/etendo-workflow-manager/SKILL.md
```

## Key architectural concepts

- **Skills are SKILL.md files** — each skill is a Markdown file in `plugins/{plugin}/skills/{skill-name}/SKILL.md`. The filename must be exactly `SKILL.md`. The folder name becomes the skill identifier.
- **Underscore-prefixed skills (`_guidelines`, `_context`, `_webhooks`)** are internal shared knowledge — they are NOT user-facing commands but are read by other skills for consistent behavior.
- **Hierarchy of shared files**: `_guidelines` (conventions, output format) → `_context` (project detection, DB connection) → `_webhooks` (webhook parameters, ID extraction, known bugs).
- **Skills use webhooks** from the `com.etendoerp.copilot.devassistant` Etendo module to interact with the Application Dictionary. If unavailable, they fall back to SQL, then manual steps.
- **The `references/` directory** contains detailed docs (AD structure, Java patterns, headless API, Sonar rules, testing guide) loaded on demand — not bundled into every skill to save context.

## Working on this repo

There is no build, lint, or test process. Changes are made to `.md` files (skills and references) or to `marketplace.json`/`plugin.json` manifests. To test changes locally:

```bash
claude --plugin-dir ./plugins/dev-assistant
```

Or register as a local marketplace:
```
/plugin marketplace add ./path/to/this/repo
```

## Conventions when editing skills

- Skill SKILL.md files use YAML frontmatter with a `description` field that controls when the skill triggers.
- AD-related skills (`alter-db`, `window`) operate via HTTP webhooks — never write raw SQL for AD operations when webhooks are available. 
- Webhook parameter casing matters: most use **PascalCase** (`ModuleID`, `Name`), but `CreateColumn` uses **camelCase** (`tableID`, `columnNameDB`).
- All AD configuration names (windows, tabs, fields) must be in **English** regardless of user language.
- DB naming: `lowercase_underscore`. AD names: `Title Case With Spaces`. Java: `PascalCase`.
- Extension columns (adding to another module's table) get `EM_{PREFIX}_` automatically — pass the name without prefix.
- The `scripts/xml2json.py` utility inspects Etendo sourcedata XML — prefer it over raw XML grep.
-

## Files to ignore

- `legacy/` — old files, do not read or modify unless explicitly asked.
- `Test Exercise.md` — standalone test exercise document.
