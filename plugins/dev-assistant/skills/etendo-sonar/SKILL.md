---
description: >
  Run SonarQube analysis on Etendo modules. Use this skill when the user wants to run Sonar,
  check code quality, fix Sonar issues, analyze a PR with SonarQube, or when a SonarQube
  check fails on a PR. Also trigger when the user mentions code smells, quality gate,
  static analysis, or duplicated code in the context of an Etendo module.
---

# /etendo:sonar — Run SonarQube analysis on Etendo modules

**Arguments:** `$ARGUMENTS` (optional: `check` to run analysis, `fix` to auto-fix issues, `pr` to analyze a PR, `setup` to install sonar-scanner)

---

## Prerequisites

### 1. Install SonarScanner CLI

Detect the OS and guide accordingly:

**macOS:**
```bash
brew install sonar-scanner
```

**Linux (Ubuntu/Debian/any):**
```bash
# Download the latest sonar-scanner CLI
wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-7.0.2.4839-linux-x64.zip
unzip sonar-scanner-cli-*-linux-x64.zip
sudo mv sonar-scanner-*-linux-x64 /opt/sonar-scanner
sudo ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
rm sonar-scanner-cli-*-linux-x64.zip
```

If the download URL returns 404, fetch the latest version from the [SonarSource binaries page](https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/) and adjust the URL.

**Verify installation:**
```bash
sonar-scanner --version
```

### 2. SonarQube Token

The token authenticates against `sonar.etendo.cloud`. Check if it's already configured:

```bash
# Check env var
echo $SONAR_TOKEN

# Check macOS Keychain (macOS only)
security find-generic-password -a "$USER" -s "sonar-etendo" -w 2>/dev/null
```

If no token is found, inform the user:

> You need a SonarQube token. Generate one at:
> `https://sonar.etendo.cloud` → Avatar → My Account → Security → Generate Token
>
> Then store it:
> ```bash
> # Option A — env var (add to ~/.zshrc or ~/.bashrc)
> export SONAR_TOKEN="squ_your_token_here"
>
> # Option B — macOS Keychain
> security add-generic-password -a "$USER" -s "sonar-etendo" -w "squ_your_token_here"
> ```

**Token retrieval order:**
1. `$SONAR_TOKEN` env var
2. macOS Keychain (`security find-generic-password -a "$USER" -s "sonar-etendo" -w`)
3. Ask the user

**NEVER store the token in files tracked by git, in CLAUDE.md, or in memory files.**

---

## Workflow: Run Analysis

### Step 1 — Detect module and project key

Find the `sonar-project.properties` file in the current module:

```bash
# From current directory, search upward for sonar-project.properties
SONAR_PROPS=$(find . -maxdepth 2 -name "sonar-project.properties" -print -quit 2>/dev/null)
if [ -z "$SONAR_PROPS" ]; then
  echo "No sonar-project.properties found. Cannot run analysis."
  # Guide user to create one — see "Project Configuration" section
fi

PROJECT_KEY=$(grep "sonar.projectKey" "$SONAR_PROPS" | cut -d'=' -f2 | tr -d ' ')
echo "Project key: $PROJECT_KEY"
```

### Step 2 — Detect context (branch or PR)

```bash
# Check if on a PR
PR_INFO=$(gh pr view --json number,headRefName 2>/dev/null)
if [ $? -eq 0 ]; then
  PR_NUMBER=$(echo "$PR_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
  BRANCH_NAME=$(echo "$PR_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin)['headRefName'])")
  echo "PR #$PR_NUMBER on branch $BRANCH_NAME"
else
  BRANCH_NAME=$(git branch --show-current)
  echo "Branch: $BRANCH_NAME (no open PR)"
fi
```

### Step 3 — Resolve token

```bash
SONAR_TOKEN="${SONAR_TOKEN:-$(security find-generic-password -a "$USER" -s "sonar-etendo" -w 2>/dev/null)}"
if [ -z "$SONAR_TOKEN" ]; then
  echo "ERROR: No SONAR_TOKEN found. See setup instructions."
  exit 1
fi
```

### Step 4 — Run scanner

Navigate to the directory containing `sonar-project.properties`, then run:

**If PR exists:**
```bash
sonar-scanner \
  -Dsonar.host.url=https://sonar.etendo.cloud \
  -Dsonar.token=$SONAR_TOKEN \
  -Dsonar.pullrequest.key=$PR_NUMBER \
  -Dsonar.pullrequest.branch=$BRANCH_NAME \
  -Dsonar.pullrequest.base=main
```

**If no PR (branch analysis):**
```bash
sonar-scanner \
  -Dsonar.host.url=https://sonar.etendo.cloud \
  -Dsonar.token=$SONAR_TOKEN \
  -Dsonar.branch.name=$BRANCH_NAME
```

**If on main (default analysis):**
```bash
sonar-scanner \
  -Dsonar.host.url=https://sonar.etendo.cloud \
  -Dsonar.token=$SONAR_TOKEN
```

The scanner takes ~20 seconds. Delegate to a subagent if preferred to keep context clean.

### Step 5 — Get changed files list

**Before querying Sonar results, determine which files were changed** so you can filter and prioritize issues on those files. The developer only cares about issues in code they touched — pre-existing issues in untouched files are not their responsibility.

```bash
# Get list of changed files (new + modified) relative to main
CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR main...HEAD 2>/dev/null || git diff --name-only --diff-filter=ACMR HEAD~5)
echo "Changed files:"
echo "$CHANGED_FILES"
```

Store this list — you'll use it in the next step to separate "your issues" from "pre-existing issues".

### Step 6 — Wait and query results

Wait 5 seconds for server processing, then query the API:

```bash
sleep 5

# Build the API URL based on context
API_URL="https://sonar.etendo.cloud/api/issues/search?componentKeys=${PROJECT_KEY}&resolved=false&ps=100"
if [ -n "$PR_NUMBER" ]; then
  API_URL="${API_URL}&pullRequest=${PR_NUMBER}"
fi

# Fetch issues and separate by changed files vs pre-existing
curl -s -u "$SONAR_TOKEN:" "$API_URL" \
  | python3 -c "
import json, sys

data = json.load(sys.stdin)
total = data.get('total', 0)

# Changed files from git (passed via env or stdin)
import os
changed_raw = os.environ.get('CHANGED_FILES', '')
changed = set(f.strip() for f in changed_raw.split('\n') if f.strip())

your_issues = []
other_issues = []

for i in data.get('issues', []):
    comp = i.get('component','').split(':')[-1]
    line = i.get('line','?')
    sev = i.get('severity','?')
    typ = i.get('type','?')
    msg = i.get('message','')
    rule = i.get('rule','')
    entry = f'[{sev}] {typ} — {comp}:{line}\n  {msg}\n  Rule: {rule}'
    # Check if the file matches any changed file
    if any(comp.endswith(cf) or cf.endswith(comp) for cf in changed):
        your_issues.append(entry)
    else:
        other_issues.append(entry)

print(f'=== Issues in YOUR changed files: {len(your_issues)} ===')
for e in your_issues:
    print(e)
    print()

if other_issues:
    print(f'=== Pre-existing issues (other files): {len(other_issues)} ===')
    print(f'(Not your responsibility — {len(other_issues)} issues in untouched files)')
    print()

if not your_issues and not other_issues:
    print('No issues found. Clean!')
"
```

**Important:** Set `CHANGED_FILES` env var before running the python script:
```bash
export CHANGED_FILES="$CHANGED_FILES"
```

**Focus rule:** When reporting results to the user, **always show issues in changed files first and prominently**. Pre-existing issues in untouched files should be mentioned as a count only, not listed in detail, unless the user explicitly asks.

### Step 7 — Check Quality Gate

```bash
QG_URL="https://sonar.etendo.cloud/api/qualitygates/project_status?projectKey=${PROJECT_KEY}"
if [ -n "$PR_NUMBER" ]; then
  QG_URL="${QG_URL}&pullRequest=${PR_NUMBER}"
fi

QG_STATUS=$(curl -s -u "$SONAR_TOKEN:" "$QG_URL" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('projectStatus',{}).get('status','UNKNOWN'))")

echo "Quality Gate: $QG_STATUS"
```

---

## Workflow: Fix Issues

When the user says `fix` or when issues are found:

1. **Only fix issues in changed files** — do not touch pre-existing issues in files the developer didn't modify
2. Parse each issue from the API response, filtered to changed files
3. Read the file at the reported line
4. Apply the fix based on issue type:

| Issue Type | Common Fix |
|---|---|
| Duplicated string literal | Extract to `private static final String CONSTANT_NAME = "value"` |
| Unused import | Remove the import line |
| Empty catch block | Add logging or comment explaining why it's empty |
| Cognitive complexity too high | Extract sub-methods |
| Deprecated API usage | Replace with recommended alternative |

4. After fixing, re-run the scanner to verify

---

## Project Configuration

If a module lacks `sonar-project.properties`, create one:

```properties
sonar.projectKey=etendosoftware_<module-javapackage>_<sonar-id>
sonar.java.binaries=.
```

The `projectKey` must match the one registered on `sonar.etendo.cloud`. Check existing projects:

```bash
curl -s -u "$SONAR_TOKEN:" \
  "https://sonar.etendo.cloud/api/projects/search?q=<module-name>" \
  | python3 -c "import sys,json; [print(p['key']) for p in json.load(sys.stdin).get('components',[])]"
```

---

## Output Format

```
+ Ran SonarQube analysis

  Project:      etendosoftware_com.etendoerp.example_AY...
  Context:      PR #42 (branch: hotfix/#42-ETP-3400)
  Quality Gate: OK | ERROR
  Issues:       3 (1 CRITICAL, 2 MAJOR)

  Dashboard: https://sonar.etendo.cloud/dashboard?id=<projectKey>&pullRequest=42

  Next steps:
    /etendo:sonar fix -> Auto-fix detected issues
    /etendo:sonar     -> Re-run after manual fixes
```
