# Etendo Dev Assistant — Claude Code Plugin Marketplace

A set of Claude Code plugins that help developers work with [Etendo ERP](https://etendo.software). Provides skills for module creation, database changes, window configuration, Java scaffolding, builds, workflow management, and more.

## Available Plugins

| Plugin | Description |
|--------|-------------|
| **dev-assistant** | Core Etendo development skills — `/etendo:module`, `/etendo:alter-db`, `/etendo:window`, `/etendo:java`, `/etendo:smartbuild`, and more |
| **etendo-workflow-manager** | Jira/GitHub issue creation, branch naming, and commit formatting following Etendo conventions |

## Installation

### From the marketplace (recommended)

1. Add this repository as a marketplace in Claude Code:

```
/plugin marketplace add etendosoftware/etendo_claude_marketplace
```

2. Install the plugins you need:

```
/plugin install dev-assistant@etendo_claude_marketplace
/plugin install etendo-workflow-manager@etendo_claude_marketplace
```

You can also browse and install from the interactive plugin manager:

```
/plugin
```

Then go to the **Discover** tab to see available plugins.

### Updating plugins

To pull the latest changes from the marketplace:

```
/plugin marketplace update etendo_claude_marketplace
```

### From a local clone

If you have cloned this repo locally, you can load plugins directly for development or testing:

```bash
claude --plugin-dir ./plugins/dev-assistant
claude --plugin-dir ./plugins/etendo-workflow-manager
```

Or add the local directory as a marketplace:

```
/plugin marketplace add ./path/to/etendo_claude_marketplace
```

### Installation scope

By default plugins are installed at user level (available in all projects). To install for a specific project only:

```
/plugin install dev-assistant@etendo_claude_marketplace --scope project
```

| Scope | Settings file | Shared via git |
|-------|---------------|----------------|
| `user` | `~/.claude/settings.json` | No |
| `project` | `.claude/settings.json` | Yes |
| `local` | `.claude/settings.local.json` | No |

## Skills Reference

### dev-assistant

All skills are prefixed with `/etendo:` and designed to be used from inside an Etendo project directory.

| Skill | Description |
|-------|-------------|
| `/etendo:context` | Detect and set active module, show infrastructure mode |
| `/etendo:init` | Full bootstrap — clone, configure, and set up an Etendo project |
| `/etendo:install` | Install Etendo on an already-cloned project |
| `/etendo:module` | Create or configure an Etendo module |
| `/etendo:alter-db` | Create/modify tables and columns via Application Dictionary |
| `/etendo:window` | Create/modify windows, tabs, and fields |
| `/etendo:java` | Scaffold EventHandlers, Background Processes, Action Processes, Webhooks |
| `/etendo:headless` | Configure EtendoRX REST API endpoints |
| `/etendo:smartbuild` | Compile and deploy |
| `/etendo:update` | Synchronize DB with the model (`update.database`) |
| `/etendo:report` | Create Jasper reports |
| `/etendo:flow` | Configure EtendoRX flows |
| `/etendo:test` | Create and run tests |

The plugin also includes shared internal skills (`_guidelines`, `_context`, `_webhooks`) that provide cross-cutting conventions to all commands, and a `references/` directory with detailed documentation loaded on demand.

### etendo-workflow-manager

| Skill | Description |
|-------|-------------|
| `/etendo:workflow-manager` | Create Jira issues (Bug, Story, Task), GitHub issues, branches, and commits following Git Police conventions |

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- An Etendo ERP project (for `dev-assistant` skills)
- Tomcat running with `com.etendoerp.copilot.devassistant` module installed (optional — skills degrade gracefully to SQL or manual steps)

## How it works

The dev-assistant skills use **webhooks** and **headless endpoints** provided by the `com.etendoerp.copilot.devassistant` Etendo module to interact with the Application Dictionary, create tables, register windows, and more. If the module is not available, skills fall back to direct SQL or guide the user through manual steps.

Authentication is handled automatically via JWT Bearer token obtained from the Etendo login endpoint.

## Repository Structure

```
.claude-plugin/
  marketplace.json          <- Marketplace definition
plugins/
  dev-assistant/
    .claude-plugin/
      plugin.json           <- Plugin manifest
    skills/                 <- Skill definitions (SKILL.md per skill)
    references/             <- Detailed docs loaded on demand
  etendo-workflow-manager/
    .claude-plugin/
      plugin.json
    skills/
```

## License

MIT
