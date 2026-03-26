---
name: create-team
description: Create a Fyso agent team from natural language requirements. Diseña y despliega equipos de agentes IA en Fyso. Keywords: crear equipo, create team, nuevo equipo, agentes fyso, deploy agents, equipo de agentes, team setup.
user-invocable: true
---

# Create Fyso Agent Team

Follow these steps exactly to design and deploy a new agent team to Fyso from a natural language requirement.

## Reference: Best Practices for Agent Design

Before starting, internalize these principles — they guide ALL design decisions in Steps 4–6.

### Orchestration Patterns

| Pattern | When to use | Structure |
|---------|-------------|-----------|
| **Coordinator/Delegator** | Most teams. One agent routes work to specialists. | 1 coordinator + N specialists |
| **Sequential Pipeline** | Tasks with strict ordering (A → B → C). | Each agent hands off to the next |
| **Parallel** | Independent subtasks that can run simultaneously. | Coordinator fans out, collects results |
| **Evaluator-Optimizer** | Quality loops (generate → review → improve). | Generator + Evaluator + optional Refiner |

### Agent Design Principles

- **Focused role**: Each agent does ONE thing well. Avoid "does everything" agents.
- **Clear personality**: The `soul` gives the agent a voice, values, and working style.
- **Structured prompts**: `system_prompt` has sections: Context, Responsibilities, Rules, Output Format.
- **Minimal team**: Start with the fewest agents that cover the requirement. You can always add later.
- **No overlap**: Two agents should not own the same responsibility.
- **Always a coordinator**: Every team needs one agent with `role: coordinator` to route work.

### Soul Template

```
You are [NAME], [ONE-LINE IDENTITY].

Your core values: [2-3 values that shape every decision].

Your working style: [How you approach problems — methodical, creative, direct, etc.].

You [DO/DON'T] [KEY BEHAVIOR]. You always [POSITIVE HABIT].
```

### System Prompt Template

```
## Context
[What team this agent belongs to and its purpose in the team.]

## Responsibilities
- [Primary responsibility]
- [Secondary responsibility]
- [...]

## Rules
- Always [rule 1]
- Never [rule 2]
- When in doubt, [rule 3]

## Output Format
[How this agent structures its responses: headings, lists, JSON, prose, etc.]
```

### Team Design Rules

1. Always include exactly one `coordinator` agent.
2. Name the team with a clear slug: `lowercase-with-hyphens`.
3. Agent `name` field = slug (e.g. `content-writer`), `display_name` = human label (e.g. `Content Writer`).
4. Roles: `coordinator`, `developer`, `writer`, `reviewer`, `qa`, `analyst`, `designer`, `security`, `researcher`, `specialist`.
5. Minimum viable team: 2 agents (coordinator + 1 specialist). Maximum recommended: 6.

---

## Step 1 — Authentication

Check if credentials exist at `~/.fyso/config.json`. If they do, read the file and use the stored `token` and `tenant_id`.

Tell the user:
> Encontré credenciales guardadas en `~/.fyso/config.json`. Las usaré para esta sesión.

If no saved config exists, ask the user for their **Token** (Bearer token for API access).

Tell the user:
> Para obtener tu token, andá a https://agent-ui-sites.fyso.dev/ , ingresá con tu email y contraseña, y copiá el token que aparece en pantalla.

The tenant ID is always `fyso-world-fcecd`. The API URL is always `https://api.fyso.dev`. Do NOT ask the user for either.

Once you have a token, save it to `~/.fyso/config.json`:

```bash
mkdir -p ~/.fyso
```

```json
{
  "token": "{TOKEN}",
  "tenant_id": "fyso-world-fcecd",
  "api_url": "https://api.fyso.dev",
  "saved_at": "{ISO_TIMESTAMP}"
}
```

Validate the token with a quick check:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://api.fyso.dev/api/entities/teams/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd"
```

If the response is 401 or 403, tell the user the token is invalid and ask for a new one. Repeat once. If it fails again, stop and ask them to verify their credentials at https://agent-ui-sites.fyso.dev/.

## Step 2 — Gather Requirements

Ask the user:

> ¿Qué tipo de equipo necesitás crear? Describilo en lenguaje natural (ej: "un equipo de marketing para crear contenido en redes sociales", "un equipo de desarrollo para revisar PRs", etc.)

Wait for their response. If the description is vague (e.g. "un equipo bueno"), ask up to 3 clarifying questions — one at a time:

1. ¿Cuál es el objetivo principal del equipo?
2. ¿Qué tareas específicas realizará?
3. ¿Hay algún tipo de output o entregable esperado?

After 3 questions, proceed with the best understanding you have.

## Step 3 — Check for Duplicates

Fetch existing teams and agents:

```bash
curl -s "https://api.fyso.dev/api/entities/teams/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd"
```

```bash
curl -s "https://api.fyso.dev/api/entities/agents/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd"
```

Parse the `data.items` arrays from each response. Note all existing team names/slugs and agent names/slugs.

If any proposed name would collide with an existing one, you have two options:
- **Reuse**: If an existing agent clearly matches a role you need, plan to reuse it (note its UUID).
- **Rename**: Append a suffix to differentiate (e.g. `marketing-writer-v2`).

Do NOT alert the user about collisions at this step — just note them internally for Step 4.

## Step 4 — Design the Team

Based on the requirements and your knowledge of best practices, design the team structure. Then present it to the user in this format:

---

**Propuesta de equipo: `{team-slug}`**

*{One-sentence description of what this team does}*

**Patrón de orquestación:** {pattern name and brief explanation}

**Agentes:**

| # | Nombre | Rol | Responsabilidad principal |
|---|--------|-----|--------------------------|
| 1 | {display_name} (`{name}`) | coordinator | {what it does} |
| 2 | {display_name} (`{name}`) | {role} | {what it does} |
| ... | | | |

**Team prompt:** _{Brief description of what the team-level prompt will say}_

¿Esta estructura te parece bien? Podés pedirme que agregue, quite o modifique agentes antes de continuar.

---

## Step 5 — Iterate Until Approved

Wait for user feedback. Apply any changes they request:
- Add/remove agents
- Rename agents or the team
- Change roles or responsibilities
- Adjust the orchestration pattern

After each change, show the updated table. Repeat until the user explicitly approves (e.g. "sí", "ok", "adelante", "perfecto", "aprobado", "listo").

## Step 6 — Generate Prompts

For each agent in the approved structure, generate a complete `soul` and `system_prompt` following the templates in the Reference section above. Make them specific, detailed, and high-quality.

Present a preview to the user:

---

**Preview de prompts generados:**

**{display_name}** (`{role}`)

*Soul:*
> {first 2 sentences of soul}...

*System prompt:*
> ## Context
> {first line}...

_(y {N-1} agentes más)_

¿Querés revisar los prompts completos antes de crear los recursos? (sí/no)

---

If the user says yes, show each agent's full soul and system_prompt. Wait for approval or adjustments.

If the user says no or approves, proceed to Step 7.

## Step 7 — Create the Team

POST the team to Fyso:

```bash
curl -s -X POST "https://api.fyso.dev/api/entities/teams/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{team display name}",
    "slug": "{team-slug}",
    "description": "{team description}",
    "prompt": "{team-level orchestration prompt}"
  }'
```

The `prompt` field should describe how agents in the team collaborate — which agent handles what, how work flows between them.

Save the team `id` from the response — you need it in Step 9.

If the request fails with 4xx (not 409), retry once. If it fails again, show the error to the user and ask how to proceed.

If it fails with 409 (conflict/duplicate slug), append `-new` to the slug and retry once.

## Step 8 — Create Agents

For each agent (in order, coordinator first), POST to Fyso:

```bash
curl -s -X POST "https://api.fyso.dev/api/entities/agents/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{agent-slug}",
    "display_name": "{Agent Display Name}",
    "role": "{role}",
    "soul": "{full soul text}",
    "system_prompt": "{full system prompt text}",
    "status": "active"
  }'
```

Save each agent's `id` from the response — you need it in Step 9.

If an agent slug already exists (409), append `-new` to the slug and retry once.

If the user flagged a reusable existing agent in Step 3, skip creating it and use the existing UUID directly.

## Step 9 — Assign Agents to Team

For each agent (using the IDs from Steps 7 and 8), POST the team-agent association:

```bash
curl -s -X POST "https://api.fyso.dev/api/entities/team_agents/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: fyso-world-fcecd" \
  -H "Content-Type: application/json" \
  -d '{
    "team": "{TEAM_UUID}",
    "agent": "{AGENT_UUID}"
  }'
```

Repeat for every agent in the team.

## Step 10 — Report and Sync Offer

Print a final summary:

---

**Equipo creado exitosamente**

- **Team:** `{team-slug}` (ID: `{team-uuid}`)
- **Agentes creados:** {N}

| Agente | Rol | ID |
|--------|-----|----|
| {display_name} | {role} | `{uuid}` |
| ... | | |

Los agentes ya están disponibles en Fyso en https://agent-ui-sites.fyso.dev/

---

¿Querés sincronizar este equipo al directorio local `.claude/agents/` para usarlo como subagentes en Claude Code? Podés ejecutar `/sync-team` ahora para hacerlo.

---

If anything failed during creation (non-retried errors), list what was created successfully and what was skipped, so the user can manually complete or retry.
