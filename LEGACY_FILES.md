# Legacy Files (Pre-Marketplace)

These files and directories existed **before** the marketplace/plugins structure was introduced.
They are NOT part of the marketplace infrastructure and can be moved, reorganized, or extracted
into their own plugin(s) in the future.

## Root Config Files

| File | Description |
|------|-------------|
| `CLAUDE.md` | Project instructions for Claude Code |
| `SOUL.md` | Development philosophy and known bugs |
| `README.md` | Original repo readme |
| `package.json` | Root npm config (for poc concurrency) |
| `package-lock.json` | npm lockfile |
| `.env.example` | Environment variables template |
| `.gitignore` | Git ignore rules |

## `.claude/` — Local Claude Code Configuration

These are **project-level** Claude Code configs (commands, agents). They work independently
of the marketplace system and could eventually be migrated into a plugin.

| Path | Description |
|------|-------------|
| `.claude/agents/senior-dev-executor.md` | Agent persona for PM-driven tasks |
| `.claude/commands/etendo-flow.md` | Interactive guide for headless API flows |
| `.claude/commands/etendo/_context.md` | Shared context resolution (used by all commands) |
| `.claude/commands/etendo/_webhooks.md` | Shared webhook infra + known bugs |
| `.claude/commands/etendo/alter-db.md` | Create/modify AD tables via webhooks |
| `.claude/commands/etendo/context.md` | Detect active module and infra mode |
| `.claude/commands/etendo/headless.md` | Configure EtendoRX REST endpoints |
| `.claude/commands/etendo/init.md` | Bootstrap new Etendo project |
| `.claude/commands/etendo/install.md` | Install Etendo on existing project |
| `.claude/commands/etendo/java.md` | Create Java code (EventHandlers, BG processes) |
| `.claude/commands/etendo/module.md` | Create/configure Etendo module |
| `.claude/commands/etendo/smartbuild.md` | Compile and deploy |
| `.claude/commands/etendo/update.md` | Sync DB with model |
| `.claude/commands/etendo/window.md` | Create/modify AD windows |

## `skills/` — Global Skills (Symlinked)

These are the same Etendo commands published as global skills. They are the **primary product**
of this repo and the most likely candidates to become a proper plugin (`etendo-devassistant`).

| Path | Description |
|------|-------------|
| `skills/etendo-_context/SKILL.md` | Shared context (internal) |
| `skills/etendo-_webhooks/SKILL.md` | Shared webhooks (internal) |
| `skills/etendo-alter-db/SKILL.md` | Alter DB skill |
| `skills/etendo-context/SKILL.md` | Context detection skill |
| `skills/etendo-headless/SKILL.md` | Headless API config skill |
| `skills/etendo-init/SKILL.md` | Project bootstrap skill |
| `skills/etendo-install/SKILL.md` | Install skill |
| `skills/etendo-java/SKILL.md` | Java code generation skill |
| `skills/etendo-module/SKILL.md` | Module creation skill |
| `skills/etendo-smartbuild/SKILL.md` | Smart build skill |
| `skills/etendo-update/SKILL.md` | DB update skill |
| `skills/etendo-window/SKILL.md` | Window creation skill |

## `docs/` — Research & Reference Documentation

Reference material that informs the skills. Could stay at root or move into a plugin's
`references/` directory.

| Path | Description |
|------|-------------|
| `docs/advanced-ad.md` | Advanced Application Dictionary patterns |
| `docs/application-dictionary.md` | AD XML structure, UUID format |
| `docs/architecture.md` | System architecture overview |
| `docs/csrf-investigation.md` | CSRF token research |
| `docs/csrf-solution.md` | CSRF solution documentation |
| `docs/etendo-api-guide.md` | Classic DataSource API reference |
| `docs/etendo-headless.md` | EtendoRX headless API reference |
| `docs/etendo-lite-con-claude.md` | Etendo Lite + Claude integration notes |
| `docs/gradle-tasks-reference.md` | All Gradle tasks and flags |
| `docs/headless-flow-guide.md` | Headless flow creation guide |
| `docs/headless-setup.sql` | SQL for headless endpoint setup |
| `docs/infrastructure-modes.md` | Source vs JAR mode docs |
| `docs/java-development.md` | DAL, events, callouts |
| `docs/jobs-and-actions.md` | Jobs/Actions abstraction |
| `docs/module-publishing.md` | Module publishing to Nexus |

## `poc/` — Proof of Concept (Etendo Lite UI + API)

Self-contained Node.js/Express + React app. Completely independent from the marketplace.

| Path | Description |
|------|-------------|
| `poc/server/` | Express orchestration layer |
| `poc/ui/` | React frontend |

## `reverse-engineer/` — Workflow Analyzer Tool

Tool for recording and analyzing Etendo HTTP sessions. Independent from marketplace.

| Path | Description |
|------|-------------|
| `reverse-engineer/pipeline/` | Analysis pipeline (Node.js) |
| `reverse-engineer/poc/` | Recorder PoC |
| `reverse-engineer/generated/` | Generated specs from sessions |
| `reverse-engineer/*.session.json` | Recorded HTTP sessions |

## `scripts/` — Test Scripts

| Path | Description |
|------|-------------|
| `scripts/full-cycle.js` | Full sales cycle test |
| `scripts/test-masters.js` | Master data test |
| `scripts/test-sales-invoice.js` | Sales invoice test |

---

## Migration Notes

The most natural migration path would be:
1. Move `skills/etendo-*` into `plugins/etendo-devassistant/skills/`
2. Move `docs/` into `plugins/etendo-devassistant/references/`
3. Move `.claude/commands/etendo/` content into the plugin's skills
4. Keep `poc/`, `reverse-engineer/`, `scripts/` as separate concerns (or their own plugins)
