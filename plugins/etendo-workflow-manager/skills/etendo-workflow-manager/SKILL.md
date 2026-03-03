---
description: Manages the full Etendo development workflow — creating Jira issues, GitHub issues, branches, and commits following Etendo conventions. Use this skill whenever the user mentions creating a ticket/bug/story/task, committing code, creating branches, or anything related to the Etendo dev workflow (Jira, GitHub issues, branch naming, commit messages, hotfixes, features). Also trigger when a bug is detected during code analysis or when the user needs help with git branch/commit naming.
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
