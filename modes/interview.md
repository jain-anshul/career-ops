# Mode: interview — ML/AI Study Plan with Knowledge Bank

When the user runs `/career-ops interview {input}`, generate a fine-grained study plan for a specific role+company. Topics and priorities are driven entirely by the JD and real interview evidence from the web — not by the candidate's existing skills. Resources are cached in a shared knowledge bank to avoid re-researching topics across different runs.

## Step 0 — Input Detection

Detect which form the user provided:

| Input form | Detection | Action |
|------------|-----------|--------|
| **Form A — Report number** | arg matches `^\d{1,3}$` (e.g. `007`) | Look up `reports/{NNN}-*.md`, extract `**URL:**` field |
| **Form B — URL** | arg starts with `http://` or `https://` | Fetch JD directly from that URL |
| **Form C — Company + role text** | Multiple words, not a number or URL | Use as search signals to find the JD |

If input is ambiguous or empty, ask: "Which role are you preparing for? You can provide: a report number (e.g. `007`), a job URL, or `Company Role Title`."

## Step 1 — Load JD

**Form A (report number):**
1. Glob `reports/{NNN}-*.md` to find the file
2. Read it — extract the `**URL:**` field from the report header and any tech signals already extracted in Block A/B (archetype, required tech stack, gaps)
3. Re-fetch the live JD from that URL using WebFetch → WebSearch fallback
4. If the URL is dead (Google Careers, Greenhouse after ~60 days): use the report's Block A/B content as proxy. Label: `**JD source:** evaluation report proxy (live URL unavailable)`

**Form B (URL):**
- WebFetch the URL directly → WebSearch fallback if blocked or JS-heavy

**Form C (company + role text):**
- WebSearch: `"{company}" "{role}" job description responsibilities requirements`
- If JD not found: proceed on signals only. Label: `**JD source:** not retrieved — inferred from search`

No candidate profile files needed. This mode is entirely JD + interview-evidence driven.

## Step 2 — JD Parse (internal, not shown to user)

Extract structured ML/AI signals:
- **Required methods/models:** explicit technologies, architectures, techniques named in JD (e.g., "diffusion models", "RLHF", "speculative decoding", "VLMs", "LoRA fine-tuning")
- **Domain signals:** areas of focus (e.g., "computer vision", "generative AI", "NLP", "multimodal", "document understanding")
- **Scale/research signals:** e.g., "train at scale", "novel approaches", "you will publish", "state-of-the-art"

**Exclude entirely from parsing:** programming languages (Python, C++, Java, Scala), infrastructure tools (Kubernetes, Docker, AWS, GCP, Azure, Redis, Kafka, MySQL, DynamoDB). These will never become study topics in this mode.

## Step 3 — Interview Experience Mining (run 4 searches in parallel)

```
"{company}" "{role-title}" interview questions site:glassdoor.com
"{company}" "{role-title}" interview experience site:teamblind.com OR site:leetcode.com/discuss
"{company}" engineering blog machine learning
"{company}" "{role-title}" interview 2024 OR 2025
```

Extract: actual ML/AI topics that appear in real interview reports. Label every finding with source + approximate date. Discard data older than 18 months (ML moves fast — a 2022 review of an LLM role is stale).

**Sparse data fallback:** If the company has fewer than 3 interview data points (common for Indian startups like Sarvam, Observe.ai, InMobi):
1. Broaden to: `"{role-archetype}" interview questions machine learning {year}`
2. Note clearly: "Limited interview data for {company} — broadened to similar roles at peer companies"

Exclude from extracted topics: anything purely about programming languages, system administration, cloud infra, or DevOps.

## Step 4 — Topic List Finalization

Merge JD signals + interview evidence → final topic list.

**Priority assignment:**
- `[HIGH]` — confirmed in ≥2 independent interview reports for this company/role, OR explicitly required in JD (not just nice-to-have)
- `[MEDIUM]` — mentioned once in interview data, OR listed as nice-to-have in JD
- `[LOW]` — inferred from JD domain signals without explicit mention or interview corroboration

**Granularity rule — strictly enforced:**
> Topics must be specific enough to name a chapter in a textbook or a specific paper.
> - ❌ "Transformers" → ✅ "Multi-head self-attention: scaled dot-product, why multiple heads, positional encoding variants"
> - ❌ "Reinforcement learning" → ✅ "PPO clipped surrogate objective: why it bounds policy updates, KL divergence penalty alternative"
> - ❌ "Fine-tuning" → ✅ "LoRA: low-rank decomposition of weight updates, rank selection, merging adapters at inference"

Group topics into **3–5 ML/AI domain sections** (e.g., "Model Architecture & Theory", "Training & Optimization", "Generative Models", "Evaluation & Benchmarking", "ML System Design"). Target **15–30 topics total**. Include all topics from JD signals and interview evidence — do not filter by candidate background.

Topic entry format:
```
### {Topic title} [HIGH | MEDIUM | LOW]
**Why:** {one sentence — cite: "[from JD: 'experience with PPO/GRPO']" or "[Glassdoor 2025-Q1, 3 reviews: 'asked about reward shaping']"}
**Time estimate:** {X hours}
```

## Step 5 — Resource Discovery (knowledge-bank-first)

### 5a. Read knowledge bank

Read `interview-prep/knowledge-bank.md`. If the file does not exist, create it with this header and continue:

```markdown
# ML/AI Interview Knowledge Bank

*Shared resource cache across all company-specific study plans. Topics are added and updated automatically each time `/career-ops interview` is run.*

*Format: each entry has a topic title, last-updated date, companies where this topic was seen, and curated resource links.*

---
```

For each topic in the finalized list, check if the knowledge bank already has a matching entry (exact or close match on topic title):
- **Cache hit** → reuse stored resources; mark topic `[from knowledge bank]` in study plan output; no web search needed
- **Cache miss** → proceed to 5b

### 5b. Web search for cache-miss topics

For each topic not in the knowledge bank, run **Search A** first. Only run **Search B** if Search A returns no Tier 1 or Tier 2 result.

```
Search A (blog/video — always run first):
"{specific topic}" explanation tutorial "lilian weng" OR "karpathy" OR "distill.pub" OR "jalammar" OR "3blue1brown" OR "fast.ai" OR "sebastianraschka" OR "huggingface blog" OR youtube 2023 OR 2024 OR 2025

Search B (paper/docs — conditional, only if Search A yields no Tier 1-2 result):
"{specific topic}" site:arxiv.org OR site:pytorch.org OR site:research.google.com 2023 OR 2024 OR 2025
```

**Source quality tiers (ordered by learning value, not source prestige):**

| Tier | Type | Sources | Include? |
|------|------|---------|---------|
| 1 | Expert blog/tutorial | lilianweng.github.io, karpathy.github.io, distill.pub, jalammar.github.io, sebastianraschka.com, fast.ai | **Always — preferred** |
| 2 | Video explanation | YouTube: Andrej Karpathy, 3Blue1Brown, StatQuest, Stanford CS229/CS224N/CS231N, MIT OCW, DeepMind/Google AI | Yes — include if found |
| 3 | Course/interactive | HuggingFace course, official framework tutorials, fast.ai course notebooks | Yes |
| 4 | High-engagement article | Medium / Towards Data Science with ≥1K claps or widely cited | Yes — note engagement |
| 5 | Paper (depth only) | arxiv.org, research.google.com, pytorch.org/docs | Yes — label `_(paper, for depth)_`; include only if topic is too new/niche for a Tier 1-2 resource |
| ❌ | Low-quality | Unknown blogs, generic listicles, marketing content, low-engagement articles | Never |

**NEVER invent URLs.** Every link must come from a web search result. If no Tier 1–4 resource is found: write `_No verified blog or video found — suggested search: "{topic} tutorial site:youtube.com OR site:lilianweng.github.io"_`

**Per topic: aim for 1 blog/tutorial + 1 video (if found) + 1 paper (optional, for depth). Never exceed 3 resources.** If only a paper is available (topic too new/niche): include it labeled `_(paper — no tutorial found)_`.

**Exclude:** resources about programming languages, Kubernetes, Docker, AWS/cloud/infra, databases — even if mentioned in the JD.

### 5c. Update knowledge bank

After all topics are resolved, update `interview-prep/knowledge-bank.md`:

**For new topics (cache miss):** append a new entry:
```markdown
## {Topic title}
*Last updated: {YYYY-MM-DD} | Seen in: {Company} ({Role})*

**Resources:**
- [{Resource title}]({URL}) — {one-line description of what this covers} _(Tier {N})_
- ...
```

**For existing topics (cache hit):** append the current company to the `Seen in:` field only. Do not re-search or overwrite resources unless a materially better source was found this run.

**Never remove existing entries.** Only add or improve.

## Step 6 — Write Study Plan Output

Save to: `interview-prep/{company-slug}-{role-slug}-study.md`

```markdown
# Study Plan: {Company} — {Role}

**Report:** [#{NNN}](../reports/{NNN}-{slug}.md) _(or "N/A — JD fetched directly")_
**Generated:** {YYYY-MM-DD}
**JD source:** {URL | "report proxy (live URL unavailable)" | "not retrieved — inferred from search"}
**Topics:** {N} total — {N-high} HIGH, {N-medium} MEDIUM, {N-low} LOW | {N-cached} from knowledge bank, {N-new} newly researched

---

## How to use this
- **HIGH** topics: confirmed in multiple interview reports and/or explicitly required in JD — study these first
- **MEDIUM** topics: appeared once in interview data or as JD nice-to-haves
- **LOW** topics: inferred from domain signals — review if time allows
- Topics marked `[from knowledge bank]` use cached resources from prior research runs
- Time estimates are rough — adjust to your pace

---

## {Section: Domain Area, e.g. "Model Architecture & Theory"}

### {Topic title} [HIGH] [from knowledge bank]
**Why:** {citation}
**Time estimate:** {X hours}
**Resources:**
- [{Title}]({URL}) — {one-line description}
- ...

### {Topic title} [MEDIUM]
**Why:** {citation}
**Time estimate:** {X hours}
**Resources:**
- [{Title}]({URL}) — {one-line description} _(Medium, ~2.4K claps)_

---

## {Section: Next Domain Area}

...

---

## Suggested Study Schedule

_(Assumes interview in 7 days. Adjust if you have more or less time.)_

| Day | Priority | Focus areas | Topics |
|-----|----------|------------|--------|
| 1–2 | HIGH | {section names} | {topic list} |
| 3–4 | HIGH + MEDIUM | {section names} | {topic list} |
| 5–6 | MEDIUM + LOW | {section names} | {topic list} |
| 7   | Review | All HIGH topics | Quick re-read + practice |

---

*For round structure, reported questions, and story bank → `/career-ops interview-prep {company} {role}`*
*Knowledge bank updated: {N-new} new entries added, {N-cached} existing entries reused.*
```

## Step 7 — Post-delivery

After writing the file and displaying the study plan, ask:
> "Do you have an interview date? I can adjust the schedule. Also, run `/career-ops interview-prep {company} {role}` for the complementary report: round structure, actual reported questions, and story bank mapping."

## Rules

1. **NEVER invent resource links** — every URL must come from a real web search result
2. **NEVER use vague topic names** — "ML fundamentals", "deep learning basics", "Python programming" are not topics
3. **NEVER include resources for** programming languages, cloud infra, or DevOps (Kubernetes, Docker, AWS, etc.) — even if in the JD
4. **Include ALL ML/AI topics** from JD + interview evidence — no filtering by candidate background
5. **Prioritize by** interview evidence frequency + JD emphasis — not by candidate skill level
6. **Always cite** source of topic inclusion: JD quote or interview data source + date
7. **Prefer expert blogs and videos over papers** for every topic. Include papers only when no Tier 1-2 resource exists, OR when the paper adds depth not covered by the blog. Label papers `_(paper, for depth)_` to signal they are optional reading. Medium articles only if ≥1K claps or widely cited — note engagement.
8. **Always read** `interview-prep/knowledge-bank.md` before running any resource web searches
9. **Always update** `interview-prep/knowledge-bank.md` after completing research
10. Generate in the language of the JD (EN default)
