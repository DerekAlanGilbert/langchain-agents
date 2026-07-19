# Security Policy and Design Requirements

## Reporting

Do not open a public issue containing a credential, exploit payload, customer data, or private system detail. Use GitHub’s private vulnerability reporting when enabled or contact the repository owner through the profile links.

## Repository Rules

- Never commit `.env` files, API keys, OAuth tokens, session files, or platform credentials.
- Use placeholder variables and an `.env.example` only after the implementation requires it.
- Keep tools least-privileged and make consequential actions approval-gated.
- Treat retrieved pages, tool output, files, and model-generated instructions as untrusted input.
- Separate read, write, execute, and external-side-effect permissions.
- Document sandbox, network, filesystem, and tenant boundaries.
- Redact sensitive content from traces and evaluation datasets.
- Define retention and deletion behavior for prompts, artifacts, sessions, and logs.
- Run a full-history secret scan before each showcase release.

## Threats Every Example Must Address

- Prompt injection through retrieved or tool-provided content
- Tool argument manipulation
- Excessive permissions
- Cross-session or cross-tenant data leakage
- Unsafe code or command execution
- Duplicate side effects after retries
- Unsupported claims presented as evidence
- Secrets leaking into logs, traces, or generated artifacts
