---
name: agent-council
description: Run an agent council for high-stakes decisions, deep research, architecture/codebase investigations, reviews, or explicit requests for multiple agents, different models, critique rounds, disagreement analysis, or synthesis across spawned agents.
---

# Agent Council

Use multiple agents to reach the maximum-coverage answer: more evidence, more failure modes, more counterarguments. Skip small factual answers, narrow edits, or work where extra agents add latency without insight.

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

## Tool Calls

When Jaztools exposes agent tools, use explicit calls like:

```text
agent_list({})
agent_spawn({"acp_agent":"codex","slug":"gluon-mass-codex","reasoning_effort":"xhigh"})
agent_spawn({"acp_agent":"claude","slug":"gluon-mass-claude","reasoning_effort":"xhigh"})
agent_spawn({"acp_agent":"opencode","model":"z-ai/glm-5.2","slug":"gluon-mass-glm"})
agent_send({"session":"gluon-mass-codex","message":"{TASK}","wait":false})
agent_send({"session":"gluon-mass-claude","message":"{TASK}","wait":false})
agent_send({"session":"gluon-mass-glm","message":"{TASK}","wait":false})
agent_wait({"session":"gluon-mass-codex"})
agent_wait({"session":"gluon-mass-claude"})
agent_wait({"session":"gluon-mass-glm"})
```

Use task-specific slugs, not generic names. Agents report when done; wait for them. `agent_wait` only limits how long the main agent waits for a snapshot; it does not cancel work. Do not set `timeout_seconds` for long research. If one looks stuck, check:

```text
agent_status({"session":"gluon-mass-codex"})
```

Agents are multi-turn. Use follow-ups to resolve gaps or factual disagreement:

```text
agent_send({"session":"gluon-mass-codex","message":"Verify this factual disagreement with evidence: ...","wait":false})
```

## Run

1. Reuse existing council agents with relevant context when possible; otherwise spawn 3-5 agents with stable slugs, or 2 if availability is limited.
2. Send each agent the same independent task.
3. Build a synthesis map, not a transcript: key claims, supporting evidence, contradictions, assumptions, gaps, and which agent exposed each item.
4. Use agents to fill gaps. If evidence is missing, reasoning is weak, or agents disagree, send targeted follow-ups that ask the best-positioned agent to verify, calculate, inspect code, or defend a specific claim.
5. Synthesize one combined answer. Do not majority-vote and do not force convergence; combine coverage and preserve useful minority views.

Tell child agents to:

- Answer the original task completely.
- Use source/code evidence where relevant.
- Create intermediate files, scripts, calculations, or probes when useful for answering the question.
- State assumptions, confidence, risks, and what would change the conclusion.
- In critique pass: adopt strong peer points, reject weak ones with reasons, and keep plausible minority views.

Iterate actively: send corrections, ask follow-up questions, challenge weak claims, and push agents when they miss evidence or say something incorrect. The goal is the strongest final answer, not a polite transcript of first drafts.

## Synthesis Discipline

- Treat child agents as reasoning probes, not panelists to quote.
- Merge overlapping points, delete duplicated reports, and make the final answer read as one coherent view.
- Use each agent's unique contribution to repair blind spots: missing sources, alternate mechanisms, code paths, risks, counterexamples, implementation details, or tests.
- When agents disagree factually, share exact evidence between them and investigate; the dissenting agent may be right and the main agent may be wrong.
- Use later turns to improve coverage and correctness, not to push agents toward the answer you expected.
- If disagreement remains unresolved, state the live crux and why it matters.
- Do not present sections like "Codex said / Claude said / Grok said" unless the user explicitly asks for individual reports or the disagreement itself is the deliverable.

## Guardrails

- Do not let child agents edit the same files. Use disjoint scopes or worktrees.
- Mention failed or unavailable agents only when coverage is affected.
- Final answer should lead with the integrated synthesis and actionable conclusion. Add only a short council note if useful: roster, live disagreements, confidence, next check.
