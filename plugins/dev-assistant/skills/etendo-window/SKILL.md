---
description: "/etendo:window — Create or modify a Window in the Etendo Application Dictionary via webhooks"
argument-hint: "[create | alter WindowName | description]"
---

# /etendo:window — Create or modify a Window in the Application Dictionary

**Arguments:** `$ARGUMENTS` (optional: `create`, `alter WindowName`, or description)

---

First, read `skills/etendo-_context/SKILL.md` and `skills/etendo-_webhooks/SKILL.md`.

A **Window** in Etendo is the UI entry point. It contains Tabs (level 0 = header, 1 = detail, etc.), each Tab maps to a table.

## Step 1: Context

Resolve:
- Active module (javapackage, DB prefix, AD_MODULE_ID)
- API key available (see `_webhooks` skill)
- Tomcat running (required for webhooks)

## Step 2: Determine operation

- `create` or empty → create new window
- `alter {WindowName}` → modify existing window (use `GetWindowTabOrTableInfo`)
- Natural language → infer intent

## Step 3: Gather information

Ask only what cannot be inferred:

**Window:**
- Name (required)
- Description (optional)

**Tabs:** for each tab:
- Which table? (list module tables or manual entry)
- Level: 0=header (default for the first), 1=detail, 2=subdetail...
- Read-only? (default N)
- WhereClause? (e.g., `em_smft_iscourse='Y'` for filtering)

**Menu:** Add a menu entry? (default yes)

Confirm everything together before executing.

## Step 4: Create the window

```bash
ETENDO_URL="http://localhost:8080/etendo"
API_KEY="{apikey}"
DB_PREFIX="{dbprefix}"

# 1. Create window + menu
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterWindow&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "DBPrefix": "'${DB_PREFIX}'",
    "Name": "{WindowName}",
    "Description": "{description}",
    "HelpComment": "{description}"
  }')
echo $RESP
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else '')")
echo "Window ID: $WINDOW_ID"
```

## Step 5: Create tabs

For each tab in order (level 0 first, then 1, 2...):

```bash
# Create tab
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterTab&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowID": "'${WINDOW_ID}'",
    "TableName": "{DBTableName}",
    "DBPrefix": "'${DB_PREFIX}'",
    "TabLevel": "{0|1|2...}",
    "SequenceNumber": "{10|20|30...}",
    "Name": "{TabName}",
    "Description": "{description}",
    "HelpComment": "{description}"
  }')
echo $RESP
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else '')")
echo "Tab ID: $TAB_ID"

# Auto-register all fields for the tab
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterFields&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowTabID": "'${TAB_ID}'",
    "DBPrefix": "'${DB_PREFIX}'",
    "Description": "{description}",
    "HelpComment": "{description}"
  }'
```

Repeat for each tab in the tree.

## Step 6: WhereClause (if applicable)

If a tab needs a filter (e.g., only show products that are courses), use the `SetTabFilter` webhook:

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=SetTabFilter&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "TabID": "'${TAB_ID}'",
    "WhereClause": "{clause}"
  }'
```

## Step 7: Export to XML

With Tomcat DOWN:
```bash
./gradlew resources.down
JAVA_HOME={java_home_path} \
  ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
./gradlew resources.up
```

## Step 8: Result

```
+ Window "{name}" created

  Window ID: {id}
  Tabs created: {N}

  To see it in Etendo:
    /etendo:smartbuild -> recompile and deploy
    Then: UI -> refresh -> {name} in the menu
```
