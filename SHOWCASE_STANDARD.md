# Showcase Standard

Every repository in this series uses the same quality gates so that differences in platform behavior are visible and claims remain comparable.

## Maturity Stages

### 1. Foundation

- Repository purpose and platform scope are explicit.
- Architecture, evaluation, and security plans exist.
- No implementation claim is made without working code.

### 2. Working

- At least one end-to-end scenario runs from a clean clone.
- Required credentials are documented through placeholders only.
- Automated tests cover the primary execution path.

### 3. Verified

- A versioned evaluation dataset exists.
- Quality, latency, cost, and failure results are published.
- Tool permissions, data boundaries, and adversarial cases are tested.
- The live deployment or reproducible local execution is verified.

### 4. Showcase-ready

- Architecture and sequence diagrams match the implementation.
- A short demo shows the complete user outcome.
- CI passes from a clean checkout.
- Known limitations and platform tradeoffs are explicit.
- The repository passes a secret-history scan.
- The work is strong enough to stand without verbal explanation.

## Comparative Scenario Contract

Every platform implementation should preserve:

1. The same user brief and completion criteria.
2. The same required output schema.
3. The same source and evaluation fixtures where platform terms allow.
4. Equivalent approval boundaries.
5. Comparable quality, latency, cost, and reliability reporting.

Platform-specific strengths should be used rather than artificially suppressed. Differences must be documented instead of normalized away.

## Repository Rule

A repository remains unpinned until it reaches **Showcase-ready**. Activity is not evidence; working, evaluated, documented behavior is.
