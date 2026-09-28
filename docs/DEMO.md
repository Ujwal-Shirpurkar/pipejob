# Demo guide (≈10 minutes)

A walkthrough for presenting PipeJob, with the talking points that matter for an agentic-AI role.

## Before the demo

- [ ] Put your real CV in **Profile → Master CV** (or `master-cv.json`) and check **Search preferences**.
- [ ] `ANTHROPIC_API_KEY` set in `server/.env`; `npm run dev` running.
- [ ] Do one full agent run beforehand, so the pipeline, review queue and story bank have real content and you know roughly how long a run takes.
- [ ] Backup for flaky Wi-Fi: `npm run seed:demo` loads fictional, clearly labelled demo jobs with pre-computed evaluations and PDFs.

## 1 · The problem (1 min)

> Job boards push you to apply to everything. Recruiters then drown in generic applications. I wanted an agent that does the research, like a good career coach: find, judge and prepare, but leave every decision to the human.

Show **Settings → Automation & safety → "Automatic submission: Never — by design"**.

## 2 · Live agent run (4 min)

**Agent** → pick the first preset → **Run agent**. While it works, narrate the trace:

- **Thinking summaries**: the model plans (adaptive thinking; summaries are displayed).
- **`search_jobs`**: calls official Greenhouse / Lever / Ashby APIs, thousands of postings in seconds. It's a cheap keyword prefilter; the LLM does the judgement.
- **Screening**: the agent skips obvious mismatches (senior or staff roles) *before* spending an evaluation.
- **Parallel `evaluate_job` calls**: each is a focused sub-call with its own structured-output schema.
- **`tailor_application`**: only above the minimum grade, only for the best matches.
- **`shortlist_for_review`**: the hand-off. There is no apply tool.
- Point at the metrics bar: turns, tool calls, tokens, **% served from prompt cache**, cost.

## 3 · Evaluation deep dive (2 min)

Open a shortlisted job → **Evaluation**.

- Hover a scorecard bar: every score cites evidence from the JD and CV.
- "The LLM scores dimensions; **code** computes the grade." Show a capped grade (deal-breaker or seniority) if you have one.
- **Profile → Search preferences → Scoring**: weights are tunable without touching prompts.

## 4 · Grounding and human-in-the-loop (2 min)

**Documents** tab:

- The CV was rewritten for the role, but a code-level check removed anything not in the master CV and flagged unknown metrics.
- "Address honestly": gaps the candidate should own rather than hide.
- **Approve → Open application page → I submitted it**. The status history records who did what (you, the agent or the system).

## 5 · Engineering questions you may get

| Question | Answer |
|---|---|
| Why not the SDK tool runner / a framework? | I wanted full control of the loop: per-step persistence and streaming, budgets, cancellation, and a forced final turn (`tool_choice: none`). It's ~200 lines and easy to reason about. |
| Why one agent, not multi-agent? | Evaluation and tailoring are specialised sub-calls with their own schemas; the orchestrator coordinates. Multi-agent would add coordination cost without a clear benefit at this scale. |
| How do you stop hallucinations? | Structured outputs for shape; a grounding check in code for content; evidence required per score; honesty notes surfaced to the user. |
| How do you control cost? | Prompt caching (stable prefix first), cheap deterministic prefilter, per-run budgets, cached evaluations, effort levels, and per-call cost telemetry. |
| How is it tested? | Unit tests for scoring, grounding, parsing and tools, plus the agent loop against a scripted fake model (parallel tool results, error recovery, forced wrap-up, refusals). |
| Is scraping legal / OK? | It doesn't scrape. It only uses public job-board APIs that companies publish for discovery, and identifies itself honestly. |
| What would you do next? | A labelled eval set to measure grading quality across prompt versions; a web-research tool for company signal; inbox integration for status updates. |
