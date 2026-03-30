#!/bin/bash
# Fyso Team Sync — Heartbeat: periodic activity summary
# Started by SessionStart hook, runs in background every 5 minutes
# Reads transcript, summarizes recent activity, sends as tracking event

CONFIG="$HOME/.fyso/config.json"
[ ! -f "$CONFIG" ] && exit 0

# Read session info from stdin (SessionStart JSON)
STDIN_DATA=$(cat 2>/dev/null || true)

SESSION_ID=$(echo "$STDIN_DATA" | python3 -c "import sys,json; print(json.loads(sys.stdin.read().strip()).get('session_id',''))" 2>/dev/null)
TRANSCRIPT=$(echo "$STDIN_DATA" | python3 -c "import sys,json; print(json.loads(sys.stdin.read().strip()).get('transcript_path',''))" 2>/dev/null)
CWD=$(echo "$STDIN_DATA" | python3 -c "import sys,json; print(json.loads(sys.stdin.read().strip()).get('cwd',''))" 2>/dev/null)

[ -z "$SESSION_ID" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0

# Write PID file so Stop hook can kill us
PIDFILE="$HOME/.fyso/heartbeat.pid"
echo $$ > "$PIDFILE"

# Heartbeat loop
while true; do
  sleep 300  # 5 minutes

  # Check if transcript still exists (session alive)
  [ ! -f "$TRANSCRIPT" ] && break

  python3 << 'PYEOF'
import json, os, sys, datetime

config_path = os.path.expanduser("~/.fyso/config.json")
try:
    cfg = json.load(open(config_path))
except:
    sys.exit(0)

token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
api_url = cfg.get("api_url", "https://api.fyso.dev")
team_name = ""
try:
    team_path = os.path.join(os.environ.get("CWD", os.getcwd()), ".fyso", "team.json")
    if os.path.exists(team_path):
        team_name = json.load(open(team_path)).get("team_name", "")
except:
    pass
user_email = cfg.get("user_email", "")
session_id = os.environ.get("SESSION_ID", "")
transcript = os.environ.get("TRANSCRIPT", "")
cwd = os.environ.get("CWD", "")

if not token or not tenant or not transcript:
    sys.exit(0)

# Read last 50 lines of transcript to understand recent activity
try:
    lines = []
    with open(transcript) as f:
        for line in f:
            lines.append(line.strip())
    recent = lines[-50:] if len(lines) > 50 else lines
except:
    sys.exit(0)

# Extract recent tool calls and assistant messages
tools_used = []
last_text = ""
for line in recent:
    try:
        entry = json.loads(line)
        msg = entry.get("message", {})
        if not isinstance(msg, dict):
            continue
        content = msg.get("content", [])
        if isinstance(content, list):
            for c in content:
                if isinstance(c, dict):
                    if c.get("type") == "tool_use":
                        name = c.get("name", "")
                        if name and name not in tools_used[-3:]:
                            tools_used.append(name)
                    if c.get("type") == "text" and msg.get("role") == "assistant":
                        t = c.get("text", "").strip()
                        if t and len(t) > 5:
                            last_text = t[:100]
    except:
        continue

# Build short summary
parts = []
if tools_used:
    recent_tools = tools_used[-5:]
    parts.append(", ".join(recent_tools))
if last_text:
    summary = last_text.split("\n")[0][:80]
    parts.append(summary)

detail = " | ".join(parts) if parts else "idle"
if len(detail) > 200:
    detail = detail[:200]

# Count tokens since session start (with breakdown)
total_tokens = 0
total_input = 0
total_output = 0
total_cache_creation = 0
total_cache_read = 0
model = ""
for line in lines:
    try:
        entry = json.loads(line)
        msg = entry.get("message", {})
        if isinstance(msg, dict):
            m = msg.get("model", "")
            if m:
                model = m
            u = msg.get("usage", {})
            if isinstance(u, dict):
                total_input += (u.get("input_tokens", 0) or 0)
                total_output += (u.get("output_tokens", 0) or 0)
                total_cache_creation += (u.get("cache_creation_input_tokens", 0) or 0)
                total_cache_read += (u.get("cache_read_input_tokens", 0) or 0)
    except:
        continue
total_tokens = total_input + total_output + total_cache_creation + total_cache_read

# Cost calculation (per 1M tokens)
PRICING = {
    "opus":   {"input": 15,   "output": 75,  "cache_write": 3.75, "cache_read": 0.375},
    "sonnet": {"input": 3,    "output": 15,  "cache_write": 3.75,  "cache_read": 0.3},
    "haiku":  {"input": 0.8,  "output": 4,   "cache_write": 1.0,   "cache_read": 0.08},
}
model_family = "opus" if "opus" in model else "sonnet" if "sonnet" in model else "haiku" if "haiku" in model else ""
p = PRICING.get(model_family, {})
cost_usd = (total_input / 1e6) * p.get("input", 0) + (total_output / 1e6) * p.get("output", 0) + (total_cache_creation / 1e6) * p.get("cache_write", 0) + (total_cache_read / 1e6) * p.get("cache_read", 0) if p else 0

import urllib.request
data = {
    "event": "heartbeat",
    "detail": detail,
    "team_name": team_name or None,
    "user": user_email or os.environ.get("USER", ""),
    "session_id": session_id or None,
    "model": model or None,
    "model_family": model_family or None,
    "tokens": total_tokens if total_tokens > 0 else None,
    "input_tokens": total_input if total_input > 0 else None,
    "output_tokens": total_output if total_output > 0 else None,
    "cache_creation_tokens": total_cache_creation if total_cache_creation > 0 else None,
    "cache_read_tokens": total_cache_read if total_cache_read > 0 else None,
    "cost_usd": round(cost_usd, 6) if cost_usd > 0 else None,
    "cwd": cwd or None,
    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
}
data = {k: v for k, v in data.items() if v is not None}

try:
    req = urllib.request.Request(
        f"{api_url}/api/entities/tracking/records",
        data=json.dumps(data).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": tenant,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=5)
except:
    pass
PYEOF

done

# Cleanup
rm -f "$PIDFILE" 2>/dev/null
