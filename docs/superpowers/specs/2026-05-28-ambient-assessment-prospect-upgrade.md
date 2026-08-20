# Ambient Assessment: Prospect-Ready Upgrade Spec

**Date:** 2026-05-28  
**Purpose:** Make the Ambient Assessment work as a live discovery tool with skeptical VP-level prospects who haven't deployed ambient AI — and generate results so credible and specific that they feel like the most sophisticated conversation on ambient value they've ever had.

---

## 1. The Core Problem

The entire assessment is written for **existing ambient AI customers**. Every question says "since deployment," "since deploying ambient," or "changes you've observed." A prospect who hasn't deployed ambient AI cannot answer these questions — and a skeptical VP who notices the presupposition will disengage immediately.

The fix is a reframe, not a rebuild. The four maturity levels already describe a ladder any healthcare organization is on, **regardless of whether they have ambient AI**. A prospect maps their current state. The score and gap screens then show what ambient AI would unlock.

The before/after becomes:

| Before | After |
|---|---|
| "What is your ambient program capturing?" | "Where is your organization today on documentation intelligence maturity?" |
| Questions require ambient AI to be live | Questions work for any org — with or without ambient |
| VP sees a product demo | VP sees a mirror of their own operation |
| Output = "here's what you're getting from ambient" | Output = "here's what you're leaving on the table, and here's the exact move" |

---

## 2. Navigation Bug: Back Button Hidden on Domains Screen

**File:** `client/src/pages/switch/AmbientNarrativeFlow.tsx`  
**Current behavior:** `showBack={currentStep !== 5}` — the back button is hidden when the user is on Screen4Domains (step 5). Users are trapped; they cannot return to Scale if they need to change something.  
**Fix:** Remove this exception. The back button should show on every screen. Inside Screen4Domains, the `handleDomainBack()` function already handles internal domain navigation (going back to the previous domain, or back to the FrameworkIntroOverlay warning). The UnifiedHeader back button should invoke `onBack` on Screen4Domains, which exits the domain flow back to ScreenScale.

---

## 3. FrameworkIntroOverlay: Add "Already Seen" Guard

**File:** `client/src/pages/switch/AmbientNarrativeFlow.tsx`  
**Current behavior:** The overlay fires unconditionally when `showFrameworkIntro === true`. If a user navigates back past it (e.g., back from Domains → Scale → Domains again), the full animated intro fires again.  
**Fix:** Add a `hasSeenFrameworkIntro` state flag (boolean, default false). When the overlay is dismissed, set it to true. The overlay should only fire when both `showFrameworkIntro` is true AND `hasSeenFrameworkIntro` is false. On re-entry, skip the overlay and go straight to domains.

---

## 4. Revenue Calculation Bug: revenuePerVisit Default

**File:** `client/src/lib/assessment/assessmentTypes.ts`  
**Current:** `revenuePerVisit: 0`  
**Fix:** `revenuePerVisit: 200`  
The source app has this as 200. A 0 default zeroes out all revenue calculations that use this field, which makes the revenue domain numbers look broken when a user hasn't edited that field.

---

## 5. Patient Experience: Connect to Score or Eliminate

**File:** `client/src/pages/switch/ambient/Screen3Score.tsx`  
**Current behavior:** The PatientExperience screen collects signal, but `patientExperienceSignal` is explicitly NOT added to `totalScore`. It's shown as a decorative strip in the assessment summary card but has no numerical weight. A user who completes that screen and then sees a score with "patient experience: not counted" will feel the screen was wasted time.

**Two options (choose one):**

**Option A — Count it:** Add a patient experience contribution to the score. Simple implementation: map the `patientExperienceAwareness` field to a +0 or +1 modifier, and add a "Patient Experience" signal chip to the score breakdown. This is the higher-impact option.

**Option B — Remove the screen:** Remove ScreenPatientExperience entirely from the flow, remove the signal chip from Screen3Score, and adjust the step count in UnifiedHeader and SwitchPathSelection from 8 steps to 7 steps.

**Recommendation:** Option A. Patient experience is a real dimension that VPs care about. Connecting it to the score adds narrative richness. The chip format already exists in Screen3Score; it just needs weight.

**If choosing Option A, scoring logic:**
```
patientExperienceSignal = 
  inputs.patientExperienceFormalized === true ? 2 :
  inputs.patientExperienceNoticeable === true ? 1 : 0

totalScore = (sum of 4 domain scores) + patientExperienceSignal
maxScore  = 16 + 2 = 18
```

---

## 6. Copy Reframe: Remove "Since Deployment" Language

These are the exact phrases to change, file by file.

### 6a. Screen4Domains.tsx — Question Labels

**Current → Proposed changes:**

| Current | Proposed |
|---|---|
| "What signs of provider relief have you observed since deployment?" | "What signs of documentation burden relief are you seeing across providers?" |
| "Which behavioral changes are you seeing as a consistent pattern across providers?" | "Which provider behaviors are you seeing change — or could change with reduced documentation burden?" |
| "Which downstream changes have you observed since deploying ambient documentation?" | "Which downstream changes are visible in your documentation workflows today?" |
| "Which retention outcomes has your organization formally attributed to ambient?" | "Which workforce outcomes has your organization connected to documentation experience?" |
| "Has a workforce retention impact analysis been completed?" | "Has your organization run a formal retention impact analysis?" |
| "Which documentation quality improvements have you observed?" | "Which documentation quality improvements are visible in your organization today?" |
| MeasurementBlock `liveResult` suffix: "/ yr estimated across your deployment" | "/ yr estimated opportunity" |

### 6b. Domain Card Descriptions (DOMAIN_CONFIGS)

The card descriptions for L1 sometimes say "since deployment":

**Capacity L1** — "Providers are documenting faster. That recovered time hasn't been formally directed anywhere yet..."  
→ This is fine as written. No change needed.

**Revenue L1** — "Documentation quality is improving. Whether it's showing up in coding specificity, denial rates, or collections hasn't been examined..."  
→ This works for both prospects and customers. No change.

**Workforce L1** — "Providers are finishing their days differently — less documentation burden, more presence in the room. The change is visible but hasn't been connected to retention or financial outcomes."  
→ This is fine. For a prospect, they would select this if they believe the potential exists but haven't measured it yet. Actually, a prospect who has no ambient AI would likely select this as "where we want to get to" — that's fine, the framing works.

Actually, for a prospect, the framing is:
- "Where are you NOW on this ladder?" 
- If they have no ambient AI, they're realistically at L1 on every domain (signals of potential, nothing measured)
- If they have human scribes, they might be at L2 on capacity (behavioral change visible, not measured)

This is a valid discovery conversation. The facilitator (Brad) walks through each domain, helps the VP select their current state, and then Screen3Score synthesizes: "Here's your documentation intelligence maturity today. Here's the gap."

**Key change**: The FrameworkIntroOverlay and Screen3Score need to drop any language that presupposes Abridge is deployed.

### 6c. FrameworkIntroOverlay — Reframe the Intro

**Current intro text** (from AmbientNarrativeFlow.tsx, the overlay sequence) needs to say:

> Not: "Your deployment is live. Let's see what it's capturing."  
> Instead: "Every health system is somewhere on this ladder. Most don't know where. In the next few minutes, you're going to find out."

Check the exact overlay copy in AmbientNarrativeFlow.tsx and update any text that implies Abridge is already deployed.

### 6d. Screen3Score.tsx — Score Reveal Language

**Current:** `generatePersonalizedSub()` and `generateDomainNarrative()` use phrasing that presupposes deployment ("your ambient deployment," "since go-live," etc.)

**Needed changes:**
- Replace "your ambient deployment" → "your documentation program" or "your organization"
- Replace "since go-live" → "today"
- Replace "your Abridge deployment" → "your documentation intelligence"
- The score should be framed as: "This is where you are today. Here's the gap ambient AI can close."

**Specific copy for the verdict card (dark card, top):**

Current pattern: States what the deployment is/isn't doing.  
Proposed pattern:
```
[Score]/16 documentation intelligence maturity today.
[What this means for a VP audience based on score range]
```

Score interpretation copy (to add to generatePersonalizedSub or score verdict):
- Score 12–16: "You have more measurement infrastructure than most health systems. The value is already real — the question is whether it's being used strategically."
- Score 8–11: "Confirmed value in [N] domains. The floor is established. The ceiling is most of the work."  
- Score 4–7: "Early signals across [N] domains. A significant measurement gap exists — and a significant opportunity to close it."
- Score 0–3: "No domain has a confirmed figure. The value is almost certainly there. The infrastructure to capture it isn't."

### 6e. Screen5Gap.tsx — Reframe the Gap

The gap screen should make the prospect the protagonist of their own story. For a prospect who's at L1 everywhere, the gap is the entire potential value of deploying Abridge.

**Current opener options:**
- "Here's where to take it."
- "Signal is there. Here's the move."
- "Four streams. Here's where to start."

These work — keep them. But the NEXT_MOVES copy for L1 in each domain should be rewritten as forward-looking:

**Capacity L1 NEXT_MOVES:** Should describe what the first 90 days of an ambient deployment would show, and what measurement to set up on day one.

**Revenue L1 NEXT_MOVES:** Should describe the revenue cycle analysis to run with CFO in month 3, not just "examine your coding data."

**Workforce L1 NEXT_MOVES:** Should describe the baseline survey to run before go-live so you have a before/after.

**Quality/Risk L1 NEXT_MOVES:** Should describe which CDI and coding team members to pull into the measurement conversation from day one.

---

## 7. L4 Elevation: Write for a VP, Not an Auditor

The L4 questions are currently phrased as compliance checkboxes. They read like an internal audit. For a VP audience — the actual decision-maker in a live demo — these should feel like aspirational questions that make them lean forward, not fill out a form.

### Capacity L4 rewrite

**Current questions:**
- "How central is recovered capacity to your current care model strategy?"
- "Which strategic decisions has recovered capacity informed in the past 12 months?"
- "Is recovered capacity embedded in your financial planning?"

**Proposed framing:** Make these feel like a scenario the VP can visualize:

> "Level 4 is when the CFO starts asking, 'How much capacity did we generate last quarter?' — and your answer is a defensible number. Let's see if you're there."

Then the same questions, but reframed:
- "Is recovered capacity a line item in your financial planning process?" (yes / informally / not yet)
- "Has your care model changed — panel size, service lines, visit mix — because of what ambient made possible?" (yes / in progress / no)
- "Does your board or executive committee see documentation-capacity data?" (yes / executive level only / no)

### Revenue L4 rewrite

**Current questions:** Governance (board level / executive / operational), VBC contract use, strategic value.

**Proposed framing:**

> "Level 4 is when your CFO calls documentation quality a revenue strategy, not an IT project."

Questions:
- "Is documentation quality data used in payer contract negotiations?" (yes / in development / no)
- "Does your CDI strategy explicitly model ambient documentation as a quality input?" (yes / discussed / no)
- "Has the financial value of documentation quality been presented to your board?" (yes / executive only / no)

### Workforce L4 rewrite

**Current questions:** Leadership elevation level, workforce strategy integrations, workforce outcomes, agency/locum cost inputs.

**Proposed framing:**

> "Level 4 is when the CMO can say at a board meeting: 'We retained [X] physicians last year in part because we solved the documentation problem.' That's a different kind of health system."

Questions:
- "Is provider experience data — including documentation burden metrics — part of board or executive committee reporting?" (yes / executive only / no)
- "Has your organization used documentation-burden improvement as a recruitment differentiator?" (yes / informally / no)
- "Has ambient documentation changed how you structure panels, coverage, or care model design?" (yes / in progress / no)

### Quality/Risk L4 rewrite

**Current questions:** Executive ownership, strategic integrations, VBC contract use.

**Proposed framing:**

> "Level 4 is when documentation quality is no longer a CDI project — it's your data foundation for everything downstream."

Questions:
- "Is documentation quality a named strategic priority with an executive owner?" (yes / operational only / no)
- "Is documentation quality data used in your value-based care contracts or quality program strategy?" (yes / in development / no)
- "Are you using documentation quality as the foundation for clinical AI initiatives?" (yes / exploring / no)

---

## 8. Screen3Score: Score Architecture Polish

The four-card layout is good. These are surgical polish changes only.

### 8a. The verdict card (dark, top-left)

The score number should be displayed more boldly. Currently `AnimatedCounter` produces the number — keep that. But the surrounding copy needs to feel like a reveal, not a label.

**Before:** "Your ambient maturity score"  
**After:** "Your ambient maturity" with the score as the dominant element — let the number do the work

The sub-copy beneath the score should use the 4-tier interpretation from section 6d above.

### 8b. Pattern card (white, bottom-left)

`generateScorePattern()` produces explanation text for why domains confirm in a particular order. This is actually very smart content — it validates the methodology and makes the VP feel like the framework is doing real work, not just asking questions.

Keep this card. Ensure the copy doesn't say "your Abridge deployment" — it should say "your ambient program" or just "you."

### 8c. "Where to focus" card (dark, bottom-right)

This card shows `FIRST_MOVES` by domain and level. This is the "next action" card.

For a prospect context: Make sure the FIRST_MOVES for L1 in every domain sound like: "Before you deploy ambient AI, here's the baseline to establish..." — forward-looking, not presupposing deployment.

### 8d. Assessment summary card (beige, top-right)

The `patientExperienceSignal` strip is here. If option A from section 5 is implemented, this strip should show a score contribution. If not, remove it.

---

## 9. Screen5Gap: NEXT_MOVES L1 Rewrite

The current `NEXT_MOVES` for L1 across all four domains need to work for a prospect (not just an early-stage customer). Rewrite each to be forward-looking.

### Capacity L1 NEXT_MOVES (rewrite)
```
Set up a capacity baseline before go-live. Pull 6 months of 
encounter data and after-hours note activity — the before/after 
becomes your first ROI story. Most teams that do this in month 
3 wish they'd done it in week 1.
```

### Revenue L1 NEXT_MOVES (rewrite)
```
The before/after revenue analysis is where the CFO becomes 
a champion. Pull E&M distribution, wRVU per encounter, and 
CDI query volume for the 6 months before deployment. Month 3 
is when you run the comparison — and most organizations find 
the number surprises them.
```

### Workforce L1 NEXT_MOVES (rewrite)
```
Run a provider experience baseline survey before go-live — 
5 questions on documentation burden, after-hours time, and 
satisfaction. The before/after is the story that gets ambient 
on the CMO's agenda. Organizations that skip this step spend 
month 6 wishing they had the data.
```

### Quality L1 NEXT_MOVES (rewrite)
```
Pull CDI query volume and coding specificity scores for the 
last 6 months. These are your baseline — the numbers that 
will move in months 3–6 of deployment. Your CDI lead will 
know exactly what to measure. Most don't connect it to 
ambient until someone shows them the before/after.
```

---

## 10. Screen6Invitation: PDF Reframe

The PDF generation screen and the PDF itself should feel like "your report" — something the VP takes back to their CMO and CFO, not a leave-behind from a sales call.

### Screen6Invitation changes

**Current framing** (implied): "Download your results."  
**Proposed framing:** Position this as the artifact the VP authored. They answered the questions. The report reflects their organization.

Suggested header copy change:
```
Before: "Get your full assessment"
After:  "Your Ambient Assessment, ready to share"

Before: "Download PDF"  
After:  "Generate your report"
```

The `exportPreparedBy` field should be prominent and labeled clearly — "Prepared by" — so Brad's name on the PDF signals this is a curated analysis, not an auto-generated output.

### PDF cover (ambient-assessment-pdf.tsx)

The PDF cover should read:

```
[Org Name]
Ambient Assessment

Prepared by: [Name]
[Date]
```

Marketing has signed off on "Ambient Assessment" as the product name. That's the title. The org name above it makes it feel like theirs.

Do NOT include a company logo, tagline, or any language positioning this as a vendor document. The cover is clean: org name, title, preparer, date.

### Inside the PDF

- Domain scores: "Current Maturity Level" — not "score" or any vendor attribution
- Gap section header: "The [Domain] Opportunity"
- Next moves header: "Path Forward"
- No "Powered by" or "Generated by" anywhere visible on non-cover pages
- The voice inside the PDF matches the app: short sentences, benchmark-grounded, specific to the org's inputs

---

## 11. Voice & Tone Principles

The Ambient Assessment is the most sophisticated ambient value conversation a health system VP will have with any vendor. The voice has to earn that position — not claim it.

**The app already has this voice.** The copy in the domain cards, the benchmark references, the closing beat text — these are already written correctly. The risk is drift: new copy that sounds like a vendor pitch instead of a peer who has studied this problem harder than anyone.

### What the voice is

**Specific over general.** "MGMA benchmark: 10–20 min/provider/day" beats "significant time savings." A number with a source earns credibility that an adjective never can.

**Direct over enthusiastic.** "The analysis hasn't been run yet" is honest and confident. "Unlock incredible value" is marketing. The VP has seen marketing. They trust honesty.

**Their world, not ours.** CDI leads, E&M distribution, wRVU per encounter, AMGA replacement cost — the vocabulary should make the VP feel like they're talking to someone who lives in their world, not someone selling into it.

**Acknowledges the gap honestly.** The framework's power is that it shows what hasn't been measured. "Documentation quality is almost certainly affecting your reimbursement. The analysis hasn't been run yet." — this framing creates curiosity, not defensiveness.

**Short sentences. Em dashes for pauses.** The domain transition copy is a good model: "Provider satisfaction and retention rarely appear in a value analysis. They show up in recruiting budgets, exit interviews, and unfilled positions." Two sentences. No filler.

### What the voice is not

- No superlatives ("best-in-class," "industry-leading," "world-class")
- No "solution" or "platform" or "offering"
- No "we at [company]" or any vendor self-reference inside the assessment flow
- No hand-holding or over-explanation — trust the VP to follow
- No hedging with filler phrases ("it's worth noting that," "as you may know")

### The positioning goal

The VP should finish the assessment thinking: *"This is how the most serious people in ambient AI think about value."* Not: *"That was a good product demo."* The assessment is the proof of category expertise — not a pitch for it.

This means Brad's name on the PDF matters. The specificity of the NEXT_MOVES matters. The benchmark sources cited in the benchmark cards matter. Every piece of specificity is a signal that this is a different level of conversation.

---

## 12. Brand & UI Polish (Non-Copy)

These are visual/UX refinements that don't require copy changes.

### 11a. Domain hero transition text

Each domain (except Capacity) has a `transition` field in DOMAIN_CONFIGS that fires as you move between domains. This text appears briefly before the new domain hero loads. The current transitions are good — keep them. Ensure animation timing is ~600ms so it's visible but not slow.

### 11b. "Confirm — Level X Label" CTA button

**Current:** `"Confirm — {config.cards[selectedLevel - 1].label}"`  
**Proposed:** This is fine. It's specific and actionable. No change needed.

### 11c. Domain closing beat (dark card, "What You've Mapped")

This card appears after a domain is confirmed and shows `feedback.context` + `feedback.headlineMetric`. For prospects at L1 who can't enter a specific number, the `headlineMetric` may be empty — in which case the card shows only the context text.

Ensure the context text for L1 is compelling even without a number:
- Capacity L1: "Time recovered but not yet counted. The potential is here — the measurement infrastructure isn't."
- Revenue L1: "Better documentation is almost certainly affecting your reimbursement. The analysis hasn't been run yet."
- Workforce L1: "Provider relief is visible. It hasn't been connected to the workforce economics that would make it defensible."
- Quality L1: "Documentation is improving. What that improvement is worth downstream is an open question."

### 11d. Step footer progress indicator

The UnifiedHeader shows step progress. For the domains screen (step 5 of 8), the user is doing a lot of work within that one "step." Consider showing domain progress inside the screen rather than relying solely on the top progress bar — the domain navigation dots already do this. No change needed.

### 11e. Mobile spacing

Several inputs have `max-w-[220px]` and `max-w-[200px]` on number inputs. On mobile, these are fine. On desktop they look narrow. No change needed — these are numeric inputs where a narrow field is appropriate.

---

## 13. What's Out of Scope

- Scoring algorithm changes beyond the patient experience addition (section 5)
- New domains or new levels
- Chart/visualization changes on any screen
- Authentication or data persistence
- The Human Scribes or Nursing paths
- The ProformaHub/ProformaView business case (separate plan exists)
- Share URL (`https://abridge.com/assess`) — functional, leave as-is

---

## 14. Priority Order for Implementation

These are ordered by impact on the live demo experience with a skeptical VP:

1. **Back button fix** (section 2) — Users get trapped; fix this first
2. **revenuePerVisit default** (section 4) — Silent calculation bug
3. **"Since deployment" copy removal** (section 6) — Credibility with prospects
4. **Score screen language** (section 6d) — What the VP reads first after completing the assessment
5. **NEXT_MOVES L1 rewrite** (section 9) — The forward-looking payoff
6. **FrameworkIntroOverlay guard** (section 3) — Navigation polish
7. **L4 copy rewrite** (section 7) — Elevates the ceiling
8. **PDF reframing** (section 10) — The leave-behind
9. **Patient experience scoring** (section 5) — Nice to have
10. **Domain closing beat L1 copy** (section 12c) — Polish

---

## 15. Acceptance Criteria

A VP-level prospect who hasn't deployed ambient AI should be able to:
1. Complete the assessment in ~8 minutes without hitting a question they can't answer
2. Select a level for each domain that reflects their organization's CURRENT state — no ambient AI required
3. See a score that feels accurate and specific to them — not generic, not a brochure
4. Leave with a PDF titled "[Their Org Name] Ambient Assessment" that they'd hand to their CMO without embarrassment
5. Come away thinking: "I've never had a conversation about ambient AI at this level."

A facilitator should be able to:
1. Navigate backwards if a prospect gives different information mid-flow
2. Show the FrameworkIntroOverlay once, not twice
3. Adjust org name, revenue per visit, and provider count without getting stuck
