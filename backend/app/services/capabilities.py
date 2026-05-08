"""Capability analysis: derive what a remote Claude Code client can do
from its recent proxied requests.

Inputs we care about, all already in the logs table:
- system_prompt: Claude Code embeds a giant system prompt that lists
  available skills, MCP servers, and tool descriptions.
- request metadata: when newer proxy code runs, it stashes the actual
  `tools` array from the request body in metadata_.available_tools.
- tool_calls: aggregated over recent requests, shows what's actually
  used.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

# MCP tool naming convention: mcp__<server>__<tool>
MCP_RE = re.compile(r"mcp__([a-zA-Z0-9_]+)__([a-zA-Z0-9_-]+)")
SKILL_RE = re.compile(r"^- ([a-z0-9-]+):\s*(.+?)$", re.MULTILINE)


def extract_mcp_servers(text: str) -> dict[str, list[str]]:
    """Pick out mcp__server__tool occurrences and bucket by server."""
    servers: dict[str, set[str]] = defaultdict(set)
    for m in MCP_RE.finditer(text or ""):
        servers[m.group(1)].add(m.group(2))
    return {s: sorted(tools) for s, tools in servers.items()}


def extract_skills(system_prompt: str) -> list[dict[str, str]]:
    """Parse the 'following skills are available' block in CC's system prompt."""
    if not system_prompt:
        return []
    # Find the skills section. Format: "- skill-name: description"
    # bounded by "skills are available" header and the next ## section.
    m = re.search(
        r"following skills are available[^\n]*\n(.+?)(?:\n##|\nThe following|\n# |\Z)",
        system_prompt,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not m:
        return []
    block = m.group(1)
    out = []
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("- "):
            continue
        # "- name: description"
        sm = re.match(r"^-\s+([a-z0-9_\-]+):\s*(.+)$", line, flags=re.IGNORECASE)
        if sm:
            out.append({"name": sm.group(1), "description": sm.group(2)[:200]})
    return out


def categorize_tool(tool_name: str) -> str:
    """Group a tool name into a high-level category for the dashboard."""
    if not tool_name:
        return "unknown"
    if tool_name.startswith("mcp__"):
        return "mcp"
    builtin = {
        "Bash": "shell",
        "Read": "filesystem",
        "Write": "filesystem",
        "Edit": "filesystem",
        "Glob": "filesystem",
        "Grep": "search",
        "WebFetch": "web",
        "WebSearch": "web",
        "Task": "agent",
        "TaskCreate": "agent",
        "TaskUpdate": "agent",
        "Agent": "agent",
        "TodoWrite": "agent",
        "NotebookEdit": "notebook",
        "Skill": "skill",
        "ScheduleWakeup": "schedule",
        "CronCreate": "schedule",
        "Monitor": "monitor",
    }
    return builtin.get(tool_name, "other")


def build_capabilities_summary(
    *,
    latest_log: dict[str, Any] | None,
    recent_logs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate a capability snapshot from one or more recent logs.

    `latest_log` should be the most recent successful Opus/Sonnet request
    (so its tool list and system_prompt represent the *current* configuration).
    `recent_logs` is a wider slice used to compute usage stats.
    """
    summary: dict[str, Any] = {
        "model_history": [],
        "available_tools": [],
        "available_tools_by_category": {},
        "mcp_servers": {},
        "skills": [],
        "tool_usage": [],
        "models_used": [],
        "total_recent_requests": len(recent_logs),
        "system_prompt_size": 0,
    }

    if latest_log:
        sp_value = latest_log.get("system_prompt") or ""
        sp = sp_value if isinstance(sp_value, str) else str(sp_value)
        summary["system_prompt_size"] = len(sp)
        summary["skills"] = extract_skills(sp)
        meta = latest_log.get("metadata") or {}
        tools = meta.get("available_tools") or []
        # Keep names + descriptions, also bucket by category
        cats: dict[str, list[str]] = defaultdict(list)
        servers: dict[str, set[str]] = defaultdict(set)
        for t in tools:
            n = t.get("name", "") if isinstance(t, dict) else ""
            if n:
                cats[categorize_tool(n)].append(n)
                m = MCP_RE.match(n)
                if m:
                    servers[m.group(1)].add(m.group(2))
        # Also pick up any MCP refs from the system_prompt (descriptions/text)
        for s, t in extract_mcp_servers(sp).items():
            servers[s].update(t)
        summary["available_tools"] = tools
        summary["available_tools_by_category"] = {k: sorted(v) for k, v in cats.items()}
        summary["mcp_servers"] = {s: sorted(ts) for s, ts in servers.items()}

    # Aggregate usage across recent_logs
    tool_counter: Counter = Counter()
    model_counter: Counter = Counter()
    for log in recent_logs:
        m = log.get("model")
        if m:
            model_counter[m] += 1
        for tc in log.get("tool_calls") or []:
            if isinstance(tc, dict) and tc.get("name"):
                tool_counter[tc["name"]] += 1

    summary["tool_usage"] = [
        {"name": name, "count": count, "category": categorize_tool(name)}
        for name, count in tool_counter.most_common(30)
    ]
    summary["models_used"] = [
        {"model": m, "count": c} for m, c in model_counter.most_common()
    ]

    return summary
