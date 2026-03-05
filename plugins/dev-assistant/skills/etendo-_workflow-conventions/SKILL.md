---
description: >
  Etendo git workflow conventions — background knowledge for all Etendo development. Loads
  automatically when working in Etendo repositories (etendosoftware org, com.etendo*/com.smf*
  modules, projects with gradle.properties containing etendo dependencies). Provides commit
  message formats, branch naming rules, and PR conventions enforced by Git Police.
user-invocable: false
---

# Etendo Git Workflow Conventions (passive context)

This is NOT a user-facing command. It provides background knowledge so that ALL git operations
in Etendo projects follow the correct conventions, even when the full workflow manager skill
is not explicitly invoked.

---

## When does this apply?

Any project that matches ONE or more of these signals is an Etendo project:

- GitHub org `etendosoftware`
- Java packages starting with `com.etendo` or `com.smf`
- `gradle.properties` containing `bbdd.sid`, `bbdd.user`, or `etendo` dependencies
- Presence of `modules/`, `modules_core/`, or `src-db/database/sourcedata/` directories

**If the project is Etendo, ALL git operations MUST follow these conventions.**

---

## Branch naming (Git Police)

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{JIRA-KEY}` | `feature/ETP-3400` |
| Hotfix | `hotfix/#{GH}-{JIRA-KEY}` | `hotfix/#42-ETP-3400` |
| Epic | `epic/{JIRA-KEY}` | `epic/ETP-3400` |
| Backport | append `-Y{yy}` | `feature/ETP-3400-Y26` |

---

## Commit messages (Git Police)

First line maximum **80 characters**. Always validate length before committing.

| Type | Format | Example |
|------|--------|---------|
| Feature | `Feature {JIRA-KEY}: description` | `Feature ETP-3400: Add OAuth2 support` |
| Hotfix | `Issue #{GH}: description` + 2nd `-m "{JIRA-KEY}"` | `Issue #42: Fix NPE on session expiry` |
| Epic | `Epic {JIRA-KEY}: description` | `Epic ETP-3400: Refactor auth module` |

**Never add `Co-Authored-By`** — Git Police rejects it.

---

## For full workflow operations

For creating Jira/GitHub issues, managing PRs, reviewing Auto Reviewer feedback, or handling
Jenkins test failures, invoke the **etendo-workflow-manager** skill which contains the
complete workflow documentation.
