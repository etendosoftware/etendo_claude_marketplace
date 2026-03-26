---
name: sync-team
description: Sync a Fyso agent team to local .claude/agents/ directory. Downloads agent definitions and creates .md files for Claude Code to use as subagents.
user-invocable: true
---

# Sync Fyso Team Agents

Follow these steps exactly to sync a Fyso team's agents into the local `.claude/agents/` directory and the team prompt into `.claude/CLAUDE.md`.

## Config structure

This plugin uses two config files:

- `~/.fyso/config.json` — **global** (user credentials, shared across all projects)
- `.fyso/team.json` — **local** (team info, per project directory)

## Step 0 — Check Etendo dev environment

Before syncing, verify the Etendo development plugins are installed. Run this command:

```bash
python3 -c "
import json, sys
try:
    with open('${HOME}/.claude/settings.json') as f:
        d = json.load(f)
except:
    d = {}
plugins = d.get('enabledPlugins', {})
markets = d.get('extraKnownMarketplaces', {})
missing_market = 'etendo-marketplace' not in markets
missing_da = 'dev-assistant@etendo-marketplace' not in plugins
missing_wm = 'etendo-workflow-manager@etendo-marketplace' not in plugins
print('marketplace_missing=' + str(missing_market))
print('dev_assistant_missing=' + str(missing_da))
print('workflow_manager_missing=' + str(missing_wm))
"
```

Evaluate the output:

**If all three print `False`**: Etendo environment is ready. Continue to Step 1.

**If any print `True`**: Inform the user which plugins are missing and show them the exact commands to run in Claude Code (these are slash commands, not shell commands — the user must type them directly in the Claude Code prompt):

| Missing | Command to run in Claude Code |
|---------|-------------------------------|
| `marketplace_missing=True` | `/plugin marketplace add etendosoftware/etendo_claude_marketplace` |
| `dev_assistant_missing=True` | `/plugin install dev-assistant@etendo_claude_marketplace` |
| `workflow_manager_missing=True` | `/plugin install etendo-workflow-manager@etendo_claude_marketplace` |

Tell the user:
> Los plugins de Etendo no están instalados. Para tener el entorno completo de desarrollo, ejecutá los comandos de arriba directamente en el prompt de Claude Code (no en la terminal). Después de instalarlos, reiniciá esta sesión y corré `/sync-team` de nuevo.
>
> Podés seguir el proceso de sync ahora si solo necesitás los agentes de Fyso, o pausar para instalar primero los plugins de Etendo.

Ask: **"¿Querés continuar con el sync o pausar para instalar los plugins de Etendo primero?"** Wait for their answer before continuing.

If they want to continue anyway, proceed to Step 1. If they want to pause, stop here and remind them to run the install commands above.

## Step 1 — Get the API key

First, check if a saved key exists at `~/.fyso/config.json`. If it does, read it and use the stored `token` and `tenant_id` values. Tell the user you found saved credentials and ask if they want to use them or enter new ones.

If no saved config exists, ask the user for their **Token** (Bearer token for API access).

Tell the user:

> Para obtener tu token, andá a https://agent-ui-sites.fyso.dev/ , ingresá con tu email y contraseña, y copiá el token que aparece en pantalla.

The tenant ID is always `fyso-world-fcecd`. Do NOT ask the user for it.

The API URL is always `https://api.fyso.dev`. Do NOT ask the user for it.

## Step 2 — Save global credentials

Save to `~/.fyso/config.json` (global, user-level):

```bash
mkdir -p ~/.fyso
```

Write the file with the Write tool:

```json
{
  "token": "{TOKEN}",
  "tenant_id": "fyso-world-fcecd",
  "api_url": "https://api.fyso.dev",
  "user_email": "{EMAIL_IF_KNOWN}",
  "saved_at": "{ISO_TIMESTAMP}"
}
```

If you can validate the token by calling `GET /api/auth/me`, do it and save the `user_email`. If the endpoint returns an error, skip it and save without email.

## Step 3 — List teams

Fetch all teams:

```
curl -s "https://api.fyso.dev/api/entities/teams/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd"
```

Parse the JSON response. The records are in `data.items`. Each team has at least `id`, `name`, and optionally `prompt`.

## Step 4 — Let the user pick a team

Present the list of teams to the user in a numbered list, showing each team's name. Ask them to pick one by number or name. Wait for their response before continuing.

Save the selected team info to `.fyso/team.json` in the **current working directory** (local, per project):

```bash
mkdir -p .fyso
```

```json
{
  "team_id": "{TEAM_ID}",
  "team_name": "{TEAM_NAME}",
  "synced_at": "{ISO_TIMESTAMP}"
}
```

## Step 5 — Write team prompt to CLAUDE.md

If the selected team has a `prompt` field (non-empty), write it to `.claude/CLAUDE.md` in the current working directory. If the file already exists, replace the section between `<!-- FYSO TEAM START -->` and `<!-- FYSO TEAM END -->` markers. If no markers exist, append the section at the end.

The format is:

```markdown
<!-- FYSO TEAM START -->
{team prompt content}
<!-- FYSO TEAM END -->
```

If the team has no prompt, skip this step and inform the user.

## Step 6 — Fetch team agents

Using the selected team's `id`, fetch the agents assigned to that team:

```
curl -s "https://api.fyso.dev/api/entities/team_agents/records?resolve=true&filter.team={TEAM_ID}" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd"
```

The response contains records where each entry has an `_agent` field (resolved to a full agent object because of `resolve=true`). Extract the agent details from each record. Key fields on each agent:

- `name` — slug/identifier
- `display_name` — human-readable name
- `role` — the agent's role (developer, qa, reviewer, coordinator, writer, security, etc.)
- `soul` — the agent's soul text (personality and principles)
- `system_prompt` — the agent's system prompt (instructions, rules, workflow)

If any field is missing, use a sensible default (empty string for text fields, "assistant" for role).

## Step 7 — Clean existing agent files

Before creating new files, remove any existing agent files that will be overwritten. For each agent from the API response, check if `.claude/agents/{name}.md` already exists and delete it:

```bash
rm -f .claude/agents/{name}.md
```

This ensures a clean sync without stale data from previous runs.

## Step 8 — Create agent files

First, ensure the `.claude/agents/` directory exists in the current working directory:

```
mkdir -p .claude/agents
```

For each agent, create a file at `.claude/agents/{name}.md` where `{name}` is the agent's `name` field (the slug). Use the Write tool to create each file with this exact format:

```markdown
---
name: {name}
description: {role} -- {display_name}. {first_line_of_soul}
tools: Read, Write, Edit, Bash, Grep, Glob
color: {color}
---

# {display_name}

**Role:** {role}

## Soul
{soul}

## System Prompt
{system_prompt}
```

IMPORTANT: Include the FULL content of `soul` and `system_prompt` fields. Do NOT truncate, summarize, or abbreviate them. These are the agent's complete instructions and must be preserved exactly as received from the API.

Map the `color` field based on the agent's role using these rules:

| Role contains | Color  |
|---------------|--------|
| developer     | green  |
| qa or tester  | yellow |
| reviewer      | purple |
| coordinator   | blue   |
| writer        | cyan   |
| security      | red    |
| triage        | orange |
| (anything else) | gray |

The match should be case-insensitive and partial (e.g. "Senior Developer" matches "developer" and gets green).

For `first_line_of_soul`: take the first non-empty line of the `soul` field, trimmed. If soul is empty, use the display_name instead.

## Step 9 — Report results

After creating all files, print a summary:

- Whether the team prompt was written to `.claude/CLAUDE.md`
- How many agent files were created
- The full path of each file created
- That global credentials were saved to `~/.fyso/config.json`
- That team info was saved to `.fyso/team.json`
- A reminder that the user can now use these agents as subagents in Claude Code via the Task tool or by referencing them

If no agents were found for the selected team, inform the user and suggest they check the team configuration in the Fyso dashboard at https://agent-ui-sites.fyso.dev.
