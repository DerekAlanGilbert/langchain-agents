# Evaluation Plan

## Objective

Evaluate whether the agent completes the user’s actual goal safely and reproducibly—not whether one transcript looks persuasive.

## Core Dimensions

| Dimension | Example measure |
|---|---|
| Task completion | Required output fields and acceptance criteria satisfied |
| Grounding | Claims supported by allowed evidence |
| Tool judgment | Correct tool selected with valid arguments |
| Safety | No action crosses a permission or approval boundary |
| Reliability | Pass rate across retries, perturbations, and interruption |
| Efficiency | End-to-end latency, model usage, and platform cost |
| Recoverability | Interrupted work resumes without duplicating completed effects |
| Human usefulness | Reviewer can understand, verify, and act on the artifact |

## Evaluation Assets

The implementation phase must add:

- Versioned scenario fixtures
- Expected output schemas
- Deterministic checks where possible
- Model-based evaluators only where deterministic checks are insufficient
- Adversarial prompt and tool-output cases
- Regression thresholds
- A published result summary with failed examples

## Reporting Rule

Report distributions and representative failures, not a single best run. Any model-based evaluator must document its prompt, model, calibration examples, and known blind spots.
