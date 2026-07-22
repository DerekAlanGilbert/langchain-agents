"""Managed LangSmith sandbox for reproduction and implementation work.

- ``scope="thread"``: each scheduled run (ephemeral thread) gets its own
  isolated sandbox; nothing leaks between tickets.
- ``idle_ttl_seconds=600``: reclaimed after 10 idle minutes.
- ``default_timeout=1800``: installs and test runs get up to 30 minutes.

MDA runs ``setup.sh`` once when provisioning. The agent then uses
``scaffold-repository.sh`` per ticket and ``run-untrusted.sh`` for every
repository-controlled command.
"""

from deepagents.backends import LangSmithSandbox
from managed_deepagents import define_sandbox

sandbox = define_sandbox(
    LangSmithSandbox,
    scope="thread",
    idle_ttl_seconds=600,
    default_timeout=1800,
)
