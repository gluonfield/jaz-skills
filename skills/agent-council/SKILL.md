---
name: agent-council
description: Run an agent council for high-stakes decisions, deep research, architecture/codebase investigations, reviews, or explicit requests for multiple agents, different models, critique rounds, disagreement analysis, or synthesis across spawned agents.
---

# Agent Council

Use for hard tasks where independent model judgment matters. Skip for small factual answers, narrow edits, or work where extra agents add latency without insight.

## Roster

Spawn child agents to get independent, high-quality answers. Each harness/model has different training data, tools, failure modes, and taste, so they may see the problem differently.

- Prefer distinct harnesses and distinct base models.
- Do not run the same base model twice through different harnesses unless the user asks for a harness comparison.
- Use OpenCode only when fewer than 3 other harnesses are available for the task, or when the user explicitly asks for OpenCode; use multiple OpenCode seats only on request.
- If only one harness works, say the council degraded to a single-agent run and do a strong self-critique pass.

Current preferences:

- Codex: `gpt-5.5`, `xhigh`.
- Claude: `fable` if available, otherwise `opus-4.8`, `xhigh`.
- Antigravity: `Gemini 3.5 Flash (High)`.
- Grok: `grok-composer-2.5-fast`.
- OpenCode: `z-ai/glm-5.2`.

## Run

1. Spawn 3-5 agents with stable slugs; use 2 if availability is limited.
2. Send each agent the same independent task.
3. Compare agreements, disagreements, unique evidence, assumptions, and gaps.
4. If disagreement, missing evidence, or high stakes justify it, send a second loop: give each agent the useful insights from the other agents and ask it to revise or defend its view.
5. Synthesize. Do not majority-vote; preserve useful minority views.

Tell child agents to:

- Answer the original task completely.
- Use source/code evidence where relevant.
- Create intermediate files, scripts, calculations, or probes when useful for answering the question.
- State assumptions, confidence, risks, and what would change the conclusion.
- In critique pass: adopt strong peer points, reject weak ones with reasons, and keep plausible minority views.

Iterate actively: send corrections, ask follow-up questions, challenge weak claims, and push agents when they miss evidence or say something incorrect. The goal is the strongest final answer, not a polite transcript of first drafts.

## Guardrails

- Do not let child agents edit the same files. Use disjoint scopes or worktrees.
- Mention failed or unavailable agents only when coverage is affected.
- Final answer should lead with the synthesis, then add a short council note if useful: roster, live disagreements, confidence, next check.
