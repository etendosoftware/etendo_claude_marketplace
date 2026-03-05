---
description: >
  Manages Etendo development workflow conventions. ALWAYS use this skill when working in any
  Etendo repository — repos under the etendosoftware GitHub org, modules with com.etendo* or
  com.smf* Java packages, projects whose gradle.properties references etendo dependencies, or
  any directory inside an Etendo workspace (modules/, modules_core/, etc.). Covers git commits,
  branch naming, PR titles, Jira and GitHub issue creation, and bug tracking. Trigger on ANY
  git operation (commit, branch, push, PR) performed in Etendo context, when creating or
  discussing tickets/bugs/stories/tasks, when a bug is detected during code analysis, when the
  user asks to commit or push changes, or when reviewing PR feedback. If you are unsure whether
  the current project is Etendo-related, check for gradle.properties with bbdd.* keys, an
  etendo-core dependency, or a modules/ directory — if any are present, use this skill for all
  git operations.
---

## Etendo Workflow Manager

Manages the complete Etendo development workflow: issue creation (Jira + GitHub), branch naming, and commit formatting, all following the ETP project conventions and Git Police rules.

## Configuration

- **Jira Project:** Ask the user if unknown. Once obtained, save it to memory (with `/memory`) so you don't need to ask again in future sessions. Retrieve issue type IDs (Bug, Story, Task) by querying the Jira API when creating the issue.
- **GitHub Organization:** `etendosoftware`

## Architecture: Bundles and Modules

In Etendo, code is organized into **bundles** and **modules**:
- A **bundle** is an "umbrella" repository on GitHub (e.g., `com.etendoerp.copilot.extensions`) that groups several related modules.
- **Modules** are the individual packages inside the bundle (e.g., `com.etendoerp.copilot`, `com.etendoerp.copilot.toolpack`) where the actual code changes happen.

When a bug is reported, the GitHub issue is created in the **bundle repo**, even though the actual changes are made in one or more of its modules.

---

## Branch Conventions (Git Police)

Branches must follow these exact patterns, validated by Git Police:

### Feature branches
| Pattern | Example | Usage |
|---------|---------|-------|
| `feature/XYZ-1234` | `feature/ETP-3400` | Standard feature |
| `feature/XYZ-1234-Y<yy>` | `feature/ETP-3400-Y26` | Backport to release year |

### Hotfix branches
| Pattern | Example | Usage |
|---------|---------|-------|
| `hotfix/XYZ-1234` | `hotfix/ETP-3400` | Hotfix without GitHub issue |
| `hotfix/#N-XYZ-1234` | `hotfix/#42-ETP-3400` | Hotfix with GitHub issue (most common) |
| `hotfix/#N-XYZ-1234-Y<yy>` | `hotfix/#42-ETP-3400-Y26` | Backport hotfix |

### Epic branches
| Pattern | Example | Usage |
|---------|---------|-------|
| `epic/XYZ-1234` | `epic/ETP-3400` | Standard epic |
| `epic/XYZ-1234-Y<yy>` | `epic/ETP-3400-Y26` | Backport epic |

### Rules
- `XYZ` = Jira project code (2-4 uppercase letters, e.g., `ETP`)
- `1234` = Jira issue number (1-4 digits)
- `#N` = GitHub issue number in the bundle (1-6 digits)
- `Y<yy>` = backport year (2 digits, e.g., `Y26` for 2026)

Branches are created in the **modules** where changes are made, not in the bundle.

---

## Commit Conventions (Git Police)

Commit messages are validated by Git Police. First line maximum **80 characters**.

### Feature commits
```
Feature ETP-1234: Brief change description
```
- Start with `Feature ABC-123:` (with a space after the colon).
- Clear, imperative description in English.
- If more detail is needed, use a second `-m` for the body.

### Hotfix commits (Issue)
Commits on hotfix branches **always** use the `Issue` format, both in commits and PR titles:
```
Issue #42: Brief fix description
```
- First line: `Issue #<number>:` followed by a descriptive message (max 80 chars).
- Second line (mandatory): must contain the Jira ID (e.g., `ETP-3400`).
- `#N` is the GitHub issue number of the bundle.
- This same format is used as the PR title.

### Epic commits
```
Epic ETP-1234: Brief description
```
- Start with `Epic ABC-123:` followed by a descriptive message.

### Complete examples
```bash
# Feature commit
git commit -m "Feature ETP-3400: Add OAuth2 support for API auth"

# Hotfix commit (always Issue format, requires Jira ID in second message)
git commit -m "Issue #42: Fix NPE on session expiry" -m "ETP-3400"

# Hotfix PR title (same format)
# Issue #42: Fix NPE on session expiry
```

---

## Issue Creation

### Issue types

#### Bug — Most frequent
- Created in **Jira + GitHub**.
- **Epic:** Always under the "Etendo Maintenance YxQz" epic (year + quarter). Search with JQL: `project = ETP AND issuetype = Epic AND summary ~ "Etendo Maintenance" AND status != Done ORDER BY created DESC`.
- **GitHub:** Create issue in the **bundle** repo indicated by the user, with the `bug` label.

#### Story
- Created **only in Jira**.
- **Epic:** Ask the user which epic to place it under. Search open epics with: `project = ETP AND issuetype = Epic AND status != Done ORDER BY created DESC`.

#### Task — Less frequent
- Created **only in Jira**.
- **Epic:** Ask the user (same as Story).
- Uses the same description format as Story.

### Description Templates

#### Template: Bug

```markdown
# Error's description

[Clear description of the error, what fails and in what context]

# Steps to reproduce the error

### Required Configurations (if necessary)

1. [Step 1]
2. [Step 2]
3. [Step 3]

# Expected behavior

[What should happen instead of the error]

# Affected Version

Version number: [affected version]

# Solution Design (optional)

[Technical solution proposal if known]

# Other test cases

**Given:** [initial condition]
**When:** [action executed]
**Then:** [expected result]

Issue

[link to GitHub issue — filled in after creating the GitHub issue]
```

#### Template: Story / Task

```markdown
# Issue Description

* [Functional description with bullets of what is needed]

# Solution Design

* [Detailed technical design]
* [May include subsections: DB, Backend/API, Frontend/UI, etc.]
```

---

## Workflow: Creating Issues

### 1. Gather information
Analyze $ARGUMENTS and/or the conversation context to determine:
- **Type** of issue (Bug by default if an error/failure is being discussed).
- **Summary** clear and in imperative form (e.g., "Fix login error when session expires").
- **Description** following the corresponding template.
- **Priority** if mentioned (Highest, High, Medium, Low, Lowest). Default: Medium.
- **Assignee**: Always auto-assign to the current user. Use the `atlassianUserInfo` tool to get the current user's `accountId`, then pass it as `assignee_account_id` when creating the Jira issue. If the user explicitly names a different assignee, use `lookupJiraAccountId` to find that person instead.
- **Labels** if mentioned.

### 2. Determine Epic
- **If Bug:** Automatically search for the current quarter's "Etendo Maintenance" epic.
- **If Story/Task:** Ask the user. Show a list of open epics from the ETP project for them to choose.

### 3. If Bug: ask for GitHub bundle
Ask the user which **bundle** (repository in the `etendosoftware` organization) to create the GitHub issue in. Remember that the issue goes in the bundle, not in individual modules.

### 4. Confirm with the user
Show a summary before creating:
```
Project:     ETP
Type:        Bug
Epic:        Etendo Maintenance Y26Q1
Summary:     Fix login error when session expires
Priority:    Medium
Assignee:    [current user name — auto-assigned]
GH Bundle:   etendosoftware/com.etendoerp.copilot.extensions (bugs only)
```

### 5. Create the issues
**For Bugs (order matters):**
1. Create the issue in **Jira** first (using `createJiraIssue`). Get the key (e.g., ETP-3400).
2. Create the issue in **GitHub** with:
   - Title: `[ETP-3400] same summary`
   - Body: same content as the Jira description (without the "Issue" section)
   - Label: `bug`
3. **Update** the Jira issue by appending the following section to the description:
   ```
   Issue
   [link to GitHub issue]
   ```

**For Story/Task:**
1. Create the issue in **Jira** using `createJiraIssue`.

### 6. Inform the user
Show the created issue key with a link, and if it's a bug, also the GitHub issue link.
Additionally, indicate the branch name to use for working in the modules:
- **Bug:** `hotfix/#N-JIRA-CODE` (e.g., if the GitHub issue is #42 and the Jira key is ETP-3400 → `hotfix/#42-ETP-3400`)
- **Story/Feature:** `feature/JIRA-CODE` (e.g., `feature/ETP-3400`)
- **Epic:** `epic/JIRA-CODE` (e.g., `epic/ETP-3400`)

And the commit format they should use:
- **Bug (hotfix):** `Issue #42: Description` with a second `-m "ETP-3400"` (always Issue format)
- **Story/Feature:** `Feature ETP-3400: ...`
- **Epic:** `Epic ETP-3400: ...`

---

## Workflow: Commits and Branches

When the user asks to make a commit or create a branch, validate that it follows the conventions before executing:

### Create branch
1. Determine the type (feature/hotfix/epic) based on context.
2. Build the branch name following Git Police patterns.
3. If it's a hotfix with a GitHub issue, include the `#N`.
4. Create the branch in the correct module.

### Make commit
1. Determine the correct prefix (`Feature`, `Hotfix`, `Epic`, or `Issue`).
2. Include the Jira code (e.g., `ETP-3400`).
3. **BEFORE executing the commit**, validate that the first line does not exceed 80 characters. This is critical because Git Police rejects commits that exceed this limit and fixing it afterwards (amend, rebase) is cumbersome. Use this command to verify:
   ```bash
   echo -n "Feature ETP-3400: Change description" | wc -c
   ```
   If the result is greater than 80, shorten the description before committing. Never assume the message is short enough — always measure.
4. If it's an `Issue` type commit, ensure the second message contains the Jira ID.

---

## Regression Tests for Bugs

When a bug is resolved, look for a way to add a test that covers that case. A bug fixed without a test is a bug that can reappear. The goal is that if someone introduces the same regression in the future, the test fails and catches it before it reaches production.

1. Identify the case that caused the bug (the input, the condition, the state).
2. Write a test that reproduces that scenario and verifies the correct behavior.
3. Follow the project's testing conventions (look for existing tests near the modified code to use the same style and framework).
4. If for some reason it's not possible to add a test (e.g., purely configuration changes, CSS, etc.), mention it to the user.

## Notes
- Always write the summary in English, imperative form, and clearly.
- Descriptions should have enough context for another dev to understand the issue.
- If the user provides vague information, ask for what's needed before creating.
- If a bug is detected in the code during the conversation, suggest creating the issue.
- When making commits, always validate the format against Git Police rules before executing.
- **Do not add `Co-Authored-By`** in commit messages. Git Police may reject them and it's not part of Etendo conventions.
- **Jira rate limit:** If a Jira call fails due to rate limit (HTTP 429 or similar), do not retry in a loop. Instead, open the Jira URL in the user's browser (`open <url>`) so they can make the change manually, and inform them what action needs to be completed (e.g., "Couldn't create the issue due to rate limit. I've opened Jira in your browser — create it with this data: ...").

---

## Workflow: PR Review — Auto Reviewer (etendobot)

After pushing commits, the **Auto Reviewer** GitHub Actions workflow runs automatically and the bot (`etendobot`) posts review comments on the PR. There are two types:

- **Suggestions**: non-blocking feedback. Body starts with `**Suggestion**`.
- **Blocking issues**: must be addressed or marked as false positives. Body contains `⚠️ Blocking Issue`.

### Step 1 — Fetch all review threads

```bash
gh api graphql -f query='
{
  repository(owner: "etendosoftware", name: "REPO_NAME") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { body path line databaseId }
          }
        }
      }
    }
  }
}'
```

Parse the result to separate blocking threads (`⚠️ Blocking Issue` in body) from suggestions.

### Step 2 — Resolve non-blocking threads (Suggestions)

For each non-blocking thread ID (`PRRT_xxx`):

```bash
gh api graphql -f query="mutation {
  resolveReviewThread(input: {threadId: \"PRRT_xxx\"}) {
    thread { id isResolved }
  }
}"
```

### Step 3 — Evaluate blocking issues

**The bot has limited context.** It reviews the diff without understanding the full flow of the code. For each blocking issue:

1. **Read the actual code** around the flagged line (not just the diff).
2. Understand the full execution context: where does the data come from? Who calls this? What guarantees exist upstream?
3. Decide: is the concern valid given the real code, or is it based on a misread of the diff?

If the concern doesn't hold up against the actual code → mark as false positive.
If it's a real issue → fix it before re-running the reviewer.

### Step 4 — Mark false positives

Reply `/false-positive` to the original comment of the thread. Use the `databaseId` from Step 1:

```bash
gh api repos/etendosoftware/REPO_NAME/pulls/PR_NUMBER/comments/COMMENT_DATABASE_ID/replies \
  -X POST -f body="/false-positive"
```

### Step 5 — Re-run the Auto Reviewer

After fixing real blocking issues or marking false positives, re-trigger the bot:

```bash
# Find the last Auto Reviewer run ID
gh run list --repo etendosoftware/REPO_NAME --branch BRANCH_NAME --limit 5

# Re-run it
gh run rerun RUN_ID --repo etendosoftware/REPO_NAME
```

---

## Workflow: PR Jenkins Test Failure Review

When tests fail on a PR's Jenkins build, follow this workflow to identify and fix the root cause.

### Prerequisites — Jenkins MCP

This workflow requires the Jenkins MCP server. If not installed, run:

```bash
claude mcp add --transport stdio --scope user jenkins -- uvx mcp-jenkins \
  --jenkins-url=<JENKINS_URL> \
  --jenkins-username=<USERNAME> \
  --jenkins-password=<PASSWORD>
```

If the command doesn't work, configure it manually by editing `~/.claude.json` and adding the following entry inside `mcpServers`:

```json
"jenkins": {
  "type": "stdio",
  "command": "uvx",
  "args": [
    "mcp-jenkins",
    "--jenkins-url=<JENKINS_URL>",
    "--jenkins-username=<USERNAME>",
    "--jenkins-password=<PASSWORD>"
  ]
}
```

Then restart Claude Code for the MCP to load.

### Step 1 — Find the failing Jenkins build

```bash
gh pr checks <PR_NUMBER> --repo etendosoftware/<REPO_NAME>
```

Identify the `Module Tests` check that shows `fail`. Note the Jenkins build URL (e.g., `https://jenkins2.etendo.cloud/job/copilot-module-tests/4726/`). Extract the job name and build number.

### Step 2 — Get the failing test names

Use the Jenkins MCP to fetch the build console output:

```
get_build_console_output(fullname="<job-name>", number=<build-number>)
```

The output can be very large. Search for key patterns to find test failures:
- `FAILED` — individual test failures
- `BUILD FAILURE` — overall build failure
- `Tests run.*Failures` — test summary lines

### Step 3 — Analyze via subagent (recommended)

Delegate the analysis to a `general-purpose` subagent to keep the main context clean. Pass it:
- The list of failing test names and their full stack traces extracted from the console output
- The working directory of the project
- This instruction:

> Read the failing test methods and any shared setup/teardown (`@Before`, `@After`, `setUp()`, `tearDown()`). Identify the root cause of each failure. Return a diagnosis with: (1) the root cause, (2) why only these tests are affected, and (3) the exact fix to apply.

The subagent must return a **structured diagnosis** before any fix is applied:

```
## Diagnosis

### Failing tests
- `TestClass > methodName`

### Root cause
[What exactly triggers the exception and why]

### Why only these tests
[What distinguishes them from passing tests]

### Proposed fix
[Exact code change with file path and line numbers]
```

Review the diagnosis before applying the fix. If it looks correct, instruct the subagent (or apply yourself) the change.

### Step 4 — Fix and inform

Apply the fix to the relevant source file. Report to the user:
- **Root cause**: what exactly triggered the exception and why
- **Why only these tests**: what distinguishes them from passing tests
- **Fix applied**: the exact code change and why it resolves the issue
