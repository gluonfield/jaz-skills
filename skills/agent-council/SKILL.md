---
name: agent-council
description: Run a council of independent Jaz agent threads on different models (Codex, Claude, Grok) to widen the search before committing to an answer or a plan. Use it for open-ended or exploratory work where more ideas and caught blind spots matter, such as "how could X be improved", architecture and product decisions, and ambiguous, high-stakes problems. Use it also when your own context is long and a fresh, independent view is worth the cost, and whenever the user asks for a council or for answers from several models. Skip it for narrow edits, factual lookups and tasks with one obvious answer.
---

# Agent Council

A council gives a problem to several strong agents that start with fresh context and come from different model families. Each brings different training, tools, failure modes and taste. Use them to maximise the surface area of ideas and to catch what you would miss, then choose. They are worth most before committing to an implementation, when the task is open-ended, and when your own context is long enough that your judgement may be dulled.

Each seat is a full agent run at high effort, so a council costs real time and money. Convene one when better coverage can change the outcome; skip it when one careful pass would do.

## Roster

Check the current models first with `list_agent_options({})` and prefer each family's newest flagship. As of 2026-10-18:

- Codex: `gpt-6-sol`, `xhigh`.
- Claude: `fable[1m]` (Fable 5.1), `xhigh`; otherwise `opus[1m]` (Opus 5.5), `xhigh`.
- Grok: the newest Grok model `list_agent_options` offers (`grok-4.6` on 2026-10-18), `xhigh`.
- Optional fourth base model through Codex and OpenRouter: agent `codex`, modelProvider `openrouter`, model `google/gemini-4-argon`, thinking `high`. OpenRouter bills per token, so seat it only when coverage matters more than cost.

Prefer distinct base models, and seats from families other than your own; you already bring your own view. Do not seat the same base model twice. If only one other model is available, say the council degraded and critique your own answer hard.

## Tool calls

Council seats are saved Jaz threads:

```text
list_agent_options({})
create_thread({"agent":"codex","model":"gpt-6-sol","thinking":"xhigh","slug":"bot-memory-sol","title":"Bot memory: Sol","prompt":"{TASK}"})
create_thread({"agent":"claude","model":"fable[1m]","thinking":"xhigh","slug":"bot-memory-fable","title":"Bot memory: Fable","prompt":"{TASK}"})
create_thread({"agent":"grok","model":"grok-4.6","thinking":"xhigh","slug":"bot-memory-grok","title":"Bot memory: Grok","prompt":"{TASK}"})
wait_threads({"targets":[{"threadId":"bot-memory-sol"},{"threadId":"bot-memory-fable"},{"threadId":"bot-memory-grok"}]})
read_thread({"threadId":"bot-memory-sol"})
send_message_to_thread({"threadId":"bot-memory-sol","prompt":"Verify this disagreement with evidence: ..."})
```

- Use task-specific slugs.
- A thread does not see your conversation, so put the goal, inputs, file paths and what to report back into its prompt.
- `wait_threads` returns as soon as any target finishes or needs input, and waits at most 50 seconds per call; call it again for the rest. A thread you created also reports back to you when it finishes, so you can end your turn instead of polling.
- `send_message_to_thread` works only on an idle thread. Use `stop_thread` for a seat that is stuck or no longer needed.
- Seats that edit code need `"worktree": true` and disjoint scopes.

## Run

1. Reuse existing council threads that already hold relevant context; otherwise create 3 seats, or 2 when availability is limited.
2. Send each seat the same independent task. Do your own analysis while they work.
3. Build a synthesis map, not a transcript: key claims, supporting evidence, contradictions, assumptions, gaps, and which seat exposed each item.
4. Fill gaps. When evidence is missing, reasoning is weak or seats disagree, send targeted follow-ups that ask the best-placed seat to verify, calculate, inspect code or defend a specific claim.
5. Synthesise one combined answer. Do not majority-vote or force convergence; combine coverage and keep useful minority views.

Tell seats to:

- Answer the original task completely.
- Use source and code evidence where relevant.
- Create intermediate files, scripts, calculations or probes when they help answer the question.
- State assumptions, confidence, risks, and what would change the conclusion.
- In a critique pass, adopt strong peer points, reject weak ones with reasons, and keep plausible minority views.

Iterate actively: send corrections, ask follow-up questions, challenge weak claims, and push seats that miss evidence or get something wrong. The goal is the strongest final answer, not a polite transcript of first drafts.

## Synthesis discipline

- Treat seats as reasoning probes, not panelists to quote.
- Merge overlapping points, drop duplicates, and make the final answer read as one coherent view.
- Use each seat's unique contribution to repair blind spots: missing sources, alternative mechanisms, code paths, risks, counterexamples, implementation details or tests.
- When seats disagree on facts, share the exact evidence and investigate; the dissenting seat may be right and you may be wrong.
- Use later turns to improve coverage and correctness, not to steer seats toward the answer you expected.
- If a disagreement stays unresolved, state the live crux and why it matters.
- Do not write "Codex said / Claude said / Grok said" sections unless the user asks for individual reports or the disagreement itself is the deliverable.

## Guardrails

- Never let two seats edit the same files.
- Mention failed or unavailable seats only when coverage suffers.
- Lead the final answer with the integrated synthesis and an actionable conclusion. Add a short council note only when useful: roster, live disagreements, confidence, next check.
