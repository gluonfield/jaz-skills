---
name: agent-council
description: Run a deep multi-agent council for high-stakes decisions, hard research questions, architecture/design tradeoffs, codebase investigations, review/audit tasks, or any explicit request for an agent council, ensemble of agents, multiple harnesses, independent agent opinions, critique rounds, disagreement analysis, or synthesis across spawned agents. Use Jaz agent_spawn/agent_send/agent_wait tools when available to create independent child agents, compare their findings, iterate on material disagreements, and return a synthesized answer.
---

# Agent Council

Use this skill to turn one user task into an independent council of child agents, then synthesize the strongest answer. The goal is not a vote. The goal is independent search, disagreement discovery, critique, and a final answer that preserves useful minority views.

## When To Run

Run a council when the user explicitly asks for `$agent-council`, an "agent council", "multiple agents", "different models", or a deep investigation where independent judgment is valuable.

For ordinary factual answers, small edits, or tasks where spawning agents would add latency without improving the result, answer directly and mention that a council is unnecessary.

Default to read-only investigation unless the user asks for implementation. If implementation is needed, keep the council as analysis and let the main agent make the final integrated edit, or give child agents disjoint work scopes.

## Tooling

When Jaztools exposes ACP delegation tools, use them in this order:

1. `agent_list` to see configured agents when available.
2. `agent_spawn` to create idle child sessions.
3. `agent_send` with `wait:false` to start each independent pass.
4. `agent_wait` or `agent_status` to collect results.
5. `agent_send` again for critique rounds when needed.
6. `agent_cancel` only for stuck or clearly obsolete sessions.

Configured Jaz ACP agents are usually `codex`, `claude`, `antigravity`, `grok`, and `opencode`. Some users will not have every harness authenticated. Use the best available subset and disclose degradation.

## Model And Harness Selection

Use a distinct harness for each council seat by default, and enforce base-model diversity within that roster. Do not spawn the same underlying model through different harnesses unless the user explicitly wants to compare harness behavior. Spawn multiple seats on the same harness only when the user requests it or when availability forces it; in that case, each seat must use a distinct base model.

Preferred defaults as of 2026-07-07:

- `codex`: use `gpt-5.5` with `reasoning_effort:"xhigh"` when available.
- `claude`: use `fable` when available; otherwise use `opus-4.8` / `claude-opus-4.8` when available; use `reasoning_effort:"xhigh"` when supported.
- `antigravity`: use the highest-reasoning model/configuration the harness advertises; prefer `xhigh` or the highest accepted effort.
- `grok`: use the strongest available Grok reasoning model/configuration with the highest accepted effort.
- `opencode`: use distinct requested or available models, commonly OpenRouter models. Multiple OpenCode seats are acceptable when the user requests them or when other harnesses are unavailable.

Normalize equivalent model names before deduplicating. For example, `gpt-5.5`, `openai/gpt-5.5`, and `gpt-5.5[xhigh]` count as the same base model; `opus-4.8`, `claude-opus-4.8`, and `anthropic/claude-opus-4.8` count as the same base model.

If a preferred model override fails because the harness does not advertise it, retry that harness without the override before dropping it. If only one harness works, say the council degraded to a single-agent run and compensate with your own critique.

Default council size is 3 to 5 agents. Use 2 when availability is limited. Use more only when the user asks for breadth or the task naturally decomposes.

## Workflow

1. Restate the council question in one sentence.
2. Choose the roster, avoiding duplicate base models.
3. Spawn child agents with stable slugs and clear titles.
4. Send the same independent-pass prompt to every child.
5. Collect results, failures, assumptions, and cited evidence.
6. Compare outputs:
   - agreements
   - disagreements
   - unique useful insights
   - weak assumptions
   - missing evidence
   - recommended next actions
7. Run a critique pass when there is material disagreement, a high-stakes conclusion, or obvious gaps.
8. Synthesize the final answer. Do not majority-vote. Preserve meaningful dissent and explain why rejected ideas were rejected.

Do not run endless rounds. Two passes are the default maximum: one independent pass, one critique/revision pass. Add a third only if the second pass exposes a specific new blocker that another pass can resolve.

## Child Agent Prompts

Independent pass:

```text
You are one member of an independent agent council. Work read-only unless explicitly instructed otherwise.

Original user task:
<task>

Your job:
1. Investigate the task deeply from your own perspective.
2. Use tools and source/code evidence where helpful.
3. State your conclusion, assumptions, confidence, and what would change your mind.
4. Surface risks, missing evidence, and non-obvious alternatives.
5. Do not try to predict or match other agents.

Return a complete answer that a synthesis agent can use without extra context.
```

Critique/revision pass:

```text
This is a later council pass. Improve your answer using peer input, but do not collapse into consensus.

Original user task:
<task>

Your previous answer:
<own_previous_answer>

Peer answers:
<peer_answers>

Update your answer:
1. Adopt strong peer arguments.
2. Reject weak peer arguments with reasons.
3. Preserve minority views when they remain plausible.
4. Identify concrete disagreements that still matter.
5. Return your complete current answer to the original task, not a changelog.
```

Synthesis prompt for the main agent:

```text
Synthesize the council into the answer the user should see.

Use the original task and the latest successful answer from each agent. Use first-pass answers as a diversity guardrail if later agents converged.

Do not majority-vote. Do not flatten meaningful disagreement. Discard weak or duplicated ideas, but do not silently drop important constraints, risks, named options, or action steps.
```

## Final Response Shape

Lead with the synthesized answer. Then include a compact council note when useful:

- roster used and any unavailable/degraded agents
- main agreements
- live disagreements or minority views
- confidence and next verification step

If the task produced code changes, list files changed and verification run. If the council was read-only, say so.

## Guardrails

- Do not pass provider API keys to child agents. Use each harness's normal Jaz auth and only set model/provider fields explicitly requested or selected for the council.
- Do not let child agents mutate shared files unless the user asked for implementation and each child has a disjoint write scope or disposable worktree.
- Do not hide failed agents. Mention them briefly if their failure affects coverage.
- Do not treat consensus as correctness. Treat consensus as one signal to inspect.
- Keep the user's actual task central. The council is a method, not the deliverable.
