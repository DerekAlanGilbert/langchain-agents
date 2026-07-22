"""Shared fixtures for the software delivery agent tests.

Modules under test are loaded by file path (the agent folder is an MDA
project, not an installed package). Each load gets a unique module name so
environment-sensitive modules (connectors) can be re-evaluated per test.
"""

from __future__ import annotations

import importlib.util
import itertools
import sys
from pathlib import Path

import pytest

AGENT_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = AGENT_DIR.parent

_counter = itertools.count()


def load_module(relative_path: str):
    """Load a module from the agent folder by path, fresh every call."""
    path = AGENT_DIR / relative_path
    name = f"_sda_{path.stem}_{next(_counter)}"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    finally:
        sys.modules.pop(name, None)
    return module


MCP_ENV_VARS = (
    "ATLASSIAN_MCP_ACCESS_TOKEN",
    "SLACK_MCP_ACCESS_TOKEN",
    "SENTRY_MCP_ACCESS_TOKEN",
    "SENTRY_MCP_URL",
)


@pytest.fixture
def clean_mcp_env(monkeypatch):
    """Start every connector test with no MCP credentials in the environment."""
    for var in MCP_ENV_VARS:
        monkeypatch.delenv(var, raising=False)
    return monkeypatch
