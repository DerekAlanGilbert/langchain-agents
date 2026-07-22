"""Prototype smoke tests for the software delivery agent's core promises."""

from __future__ import annotations

import os
import subprocess

import yaml
from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    PIIMiddleware,
    ToolCallLimitMiddleware,
)
from managed_deepagents import DeepAgentDefinition

from conftest import AGENT_DIR, REPO_ROOT, load_module


def test_root_level_python_agent_replaces_examples() -> None:
    assert (AGENT_DIR / "agent.py").is_file()
    assert not (REPO_ROOT / "example").exists()
    assert not (REPO_ROOT / "examples").exists()
    assert not (AGENT_DIR / "tools").exists()
    assert not list(AGENT_DIR.rglob("*.ts"))


def test_managed_agent_uses_valid_model_and_safety_middleware() -> None:
    agent = load_module("agent.py").agent
    assert isinstance(agent, DeepAgentDefinition)
    assert agent.config["model"] == "anthropic:claude-sonnet-5"
    middleware = agent.config["middleware"]
    assert any(isinstance(item, PIIMiddleware) for item in middleware)
    assert any(isinstance(item, ModelCallLimitMiddleware) for item in middleware)
    assert any(isinstance(item, ToolCallLimitMiddleware) for item in middleware)


def test_vendor_integrations_are_remote_mcp_and_github_is_not() -> None:
    servers = load_module("connectors/mcp.py").mcp.config["mcp_servers"]
    assert set(servers) == {"langchain_docs", "atlassian", "slack", "sentry"}
    assert all(server["transport"] == "http" for server in servers.values())
    assert all(server["url"].startswith("https://") for server in servers.values())
    assert all("github" not in server["url"] for server in servers.values())


def test_schedules_are_separate_and_implementation_requires_approval() -> None:
    triage = load_module("schedules/triage_production_errors.py").schedule.config
    implementation = load_module("schedules/implement_approved_tickets.py").schedule.config
    assert triage["cron"] != implementation["cron"]
    assert "do not use the sandbox" in triage["prompt"]
    assert "JIRA_READY_LABEL" in implementation["prompt"]
    assert "re-read the live ticket" in implementation["prompt"]
    assert "DRAFT pull request" in implementation["prompt"]


def test_untrusted_commands_do_not_receive_credentials() -> None:
    wrapper = AGENT_DIR / "sandbox" / "run-untrusted.sh"
    env = os.environ.copy()
    env.update({"GH_TOKEN": "secret", "SLACK_MCP_ACCESS_TOKEN": "secret", "SAFE_FLAG": "visible"})
    result = subprocess.run(
        ["bash", str(wrapper), "env"],
        check=True,
        capture_output=True,
        text=True,
        env=env,
    )
    child = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    assert "GH_TOKEN" not in child
    assert "SLACK_MCP_ACCESS_TOKEN" not in child
    assert child["SAFE_FLAG"] == "visible"


def test_root_agent_discovery_finds_only_the_agent() -> None:
    result = subprocess.run(
        ["bash", "scripts/deploy-changed-agents.sh", "--list", "--all"],
        check=True,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert result.stdout.splitlines() == ["software-delivery-agent"]


def test_ci_compiles_but_deploys_only_when_explicitly_enabled() -> None:
    workflow_path = REPO_ROOT / ".github" / "workflows" / "deploy-agents.yml"
    text = workflow_path.read_text(encoding="utf-8")
    workflow = yaml.safe_load(text)
    assert {"changes", "check", "deploy"} <= set(workflow["jobs"])
    assert "uv run mda build ." in text
    assert "vars.MDA_DEPLOY_ENABLED == 'true'" in workflow["jobs"]["deploy"]["if"]
    assert "api.githubcopilot.com" not in text
