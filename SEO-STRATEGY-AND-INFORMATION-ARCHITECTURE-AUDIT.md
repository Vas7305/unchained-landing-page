# SEO Strategy & Information Architecture Audit — Unchained Business

**Target:** https://www.unchainedbusiness.com
**Repository:** unchained-landing-page (source of truth for implementation)
**Audit date:** 2026-09-02
**Phase:** Strategy & information architecture — not implementation. This audit does not repeat the technical SEO audit (`TECHNICAL-SEO-AUDIT.md`, 2026-09-01); it assumes that audit's P1 fixes (canonical host, orphaned `/work/[slug]` pages, OG image) land before content production begins.

**Method note on evidence.** This document distinguishes four kinds of claim throughout:

- **FACT** — verified directly from the repository (source of truth for what the business actually offers and says) or from a live web search performed during this audit.
- **INFERENCE** — a conclusion drawn from those facts that isn't stated outright anywhere.
- **RECOMMENDATION** — a strategic choice this audit is making, with its reasoning.
- **ASSUMPTION** — a gap in available evidence, flagged rather than filled with an invented number.

No search volumes, rankings, traffic figures, competitor revenue, or customer counts are invented anywhere in this document. Where live search was used, it returned qualitative SERP composition (who ranks, what content type), never volume — that limitation is real and is stated wherever it matters, consistent with how the business itself treats evidence (§13, §23).

---

## 1. Executive Summary

Unchained Business is an eight-month-old digital infrastructure company with one completed flagship product (TanCerca), five in-development projects, and three genuinely distinct, well-articulated service pillars — Software Development, Business Automation, Growth Systems. **FACT:** the pillar pages (`lib/pillar-content.ts`) already carry substantive, original copy — offerings, a stated point of view, buyer-recognizable signals, and an honest proof statement — not filler. That is a stronger starting point than most companies at this stage have.

Three structural facts shape everything in this document:

1. **There is no content vehicle yet.** `/insights` does not exist. Every SEO recommendation in this audit is therefore additive, not a rescue of an existing blog.
2. **The commercial pillars are underlinked internally.** **FACT:** the primary navigation (`components/Navbar.tsx`) does not link to `/software-development`, `/business-automation`, or `/growth-systems` at all — "What We Build" points to a homepage anchor (`/#what-we-build`), not to the pillar pages. The only paths to the pillar pages are the footer and the homepage Capabilities section's "Learn more" links. Pages that are supposed to be the commercial core of the site are currently second-class in the site's own link graph.
3. **The company's core differentiator is radical transparency about its own stage**, not a claim of authority it hasn't earned. **FACT:** the `/journey` page, the FAQ, and the portfolio page all explicitly state the company won't publish a metric, testimonial, or claim it can't evidence (`lib/journey.ts`, `en.ts` `journeyPage.p1–p4`, `workPage.provesBody`). This is an unusual and valuable stance — most early-stage B2B sites do the opposite — and it should be the organizing principle for the entire content strategy, not a caveat bolted onto it. It also means this strategy explicitly rules out content tactics (fabricated case-study outcomes, invented statistics, generic thought-leadership padding) that would contradict the brand's own stated values.

The realistic, evidence-based read on search competition (§6): head commercial terms like "custom software development company" are dominated by large global outsourcing firms and "Top 10 agency" listicle sites — not a realistic target for a company with one public case study. "Business automation agency" is saturated but with boutique, recently-founded competitors, not enterprise incumbents — a winnable category if entered through specific processes rather than the head term. "Growth systems" as a bare search phrase returns thought-leadership and coaching-framework content, not agencies — it is a strong **brand** term and a weak **search** term, and should be treated as exactly that (§12).

**Strategic status:** the site is not ready to begin content production today — not for technical reasons (those are covered in the technical audit) but for one architectural reason: the pillar pages are not properly linked from primary navigation, and no content-type infrastructure (`/insights`) exists yet to receive the first articles. Both are small, well-scoped fixes. See §27 for the full readiness decision.

---

## 2. Current Positioning Analysis

**What Unchained Business appears to sell (FACT, from `lib/site.ts`, `pillar-content.ts`, homepage copy):** digital infrastructure across three pillars — custom software/web applications/SaaS, business process automation and internal tooling, and client acquisition/growth systems — sold as an integrated system rather than three separate menu items ("Three pillars, one system," `cap.body`).

**Who it appears to serve (INFERENCE):** growing businesses that have outgrown manual processes and off-the-shelf tools but are not enterprise-scale — the PainPoints section's language ("your team re-types the same data," "six subscriptions, six sources of truth," "a spreadsheet holding them together") describes an SMB/scaleup operating reality, not an enterprise procurement process.

**What differentiates it (FACT, stated explicitly):**
- Architecture-first delivery process (Discover → Architect → Build → Launch → Optimize), the same five phases regardless of pillar.
- Client owns everything built — code, infrastructure, documentation (`sd.approach.3`).
- Radical honesty about company stage — explicitly the opposite of typical agency marketing (`journeyPage.p1–p4`).
- A public "journey log" documenting the company building itself as its own first case study (`about.title`: "Our First Case Study Is Ourselves").

**What the positioning communicates poorly (INFERENCE):**
- "Growth Systems" as a pillar name is evocative but not a term a buyer searches (§12) — a visitor arriving from search for "lead generation agency" or "client acquisition system" would not naturally guess that "Growth Systems" is where that lives without reading the summary.
- The three pillars are presented as equally weighted, but the evidence base behind them is not equal: Software Development has one strong flagship proof point (TanCerca); Business Automation's proof is explicitly borrowed from TanCerca's operational layer rather than a dedicated automation engagement; Growth Systems' proof is "we're doing it to ourselves" rather than a client result. A first-time visitor comparing the three "proof" statements side by side would correctly infer Software Development is the most evidenced pillar today — the site should make this legible rather than implicitly ranked.
- "Digital Infrastructure for Businesses Ready to Grow" (the tagline) is a positioning statement, not a search-facing phrase; nobody searches "digital infrastructure for businesses ready to grow." That's fine for a hero headline — but it means every page below the fold needs to do the work of connecting that positioning to the concrete, searchable problems in PainPoints (repetitive manual work, disconnected tools, rigid off-the-shelf software, undisciplined follow-up).

**What's immediately understandable within 10 seconds (INFERENCE, based on hero + badge):** the three-word badge ("Software · Automation · Growth Systems") plus the headline gives a first-time visitor an accurate category (a company that builds software and systems for businesses) within seconds. What is *not* immediately clear without scrolling: pricing model, typical engagement size, or which pillar to start with — appropriately deferred to the FAQ and CTA, not a flaw.

**What Google likely understands from the current architecture (INFERENCE, consistent with the technical audit's findings):** a small, coherent site with three clearly-differentiated service topics and one real portfolio entry. Google has no signal yet that this is a topic the site has *authority* on beyond these seven pages — there's no supporting content, no case-study depth beyond TanCerca, and (per the technical audit) a canonical-host ambiguity that adds unnecessary noise to an otherwise clean signal.

---

## 3. Target Customer Segments

Grounded only in the business as it is described in the repository — not invented personas.

| Segment | Business Problem | Likely Search Behavior | Relevant Unchained Service | Commercial Value |
|---|---|---|---|---|
| **Founders/operators of a growing SMB running on manual processes** | Team re-types data across disconnected tools; reporting is a weekly manual spreadsheet exercise (`pain.manual`, `pain.tools`) | Problem-first searches: "how to stop double data entry between [tool] and [tool]," "automate weekly reporting," "connect [CRM] to [billing tool]" | Business Automation (workflow automation, integrations) | High — a well-defined, budget-holding buyer with an acute, nameable pain |
| **Founders with a product idea or a software requirement generic tools can't fit** | Off-the-shelf SaaS forces a workflow that doesn't match the business; the real process lives in people's heads (`sd.signals`) | Solution-aware searches: "custom software vs SaaS," "build vs buy software," "MVP development agency," "internal tool development" | Software Development (custom software, web applications) | High — largest average engagement size (product builds), longest sales cycle |
| **Businesses with an existing system that can't scale** | A tool that worked at smaller scale breaks at the next order of magnitude (`sd.signals`) | Vendor-evaluation searches: "software modernization services," "legacy system replacement," "when to rebuild vs patch software" | Software Development (modernization framed as a subtopic, not custom-software-from-zero) | Medium-high — often a defensive, time-pressured purchase |
| **Businesses generating leads/attention that isn't converting** | Leads stall, follow-up depends on who has time, no visibility into where the funnel leaks (`pain.growth`, `gs.signals`) | Problem-first and solution-aware: "why aren't my leads converting," "lead nurturing automation," "client acquisition system" | Growth Systems (lead qualification, nurturing, conversion systems) | Medium — real pain, but a crowded category (§6) where Unchained's proof point is currently self-referential, not client-evidenced |
| **Founders evaluating an early-stage vs. established technology partner** | Weighing senior, direct-founder attention against the safety of an established agency with a long case-study history | Vendor-evaluation / decision-stage: "should I hire a startup vs agency for software development," implicitly present in every "[service] agency" comparison search | All three, but this segment converts at the FAQ/trust layer, not at a keyword | Medium — smaller in volume, but this is exactly the objection the site already answers head-on (`faq.a3`) rather than avoids, which is a genuine asset once there's content to carry that argument into search |

**ASSUMPTION:** actual segment-level conversion value (which segment produces the highest-value engagements) is not knowable from the repository or public web data. The ordering above is by evidenced pain clarity and buying-process legibility, not by revenue — that should be corrected against real inquiry data once the lead-capture system (`lib/commercial/leads.ts`) has accumulated some.

---

## 4. Search Intent Model

| Level | Description | Example query shapes | Unchained funnel mapping |
|---|---|---|---|
| **1 — Problem Awareness** | User has a symptom, not a solution name | "why does my team keep double-entering data," "leads stop responding after first contact" | `/insights` problem-explainer articles → link to the relevant pillar |
| **2 — Solution Awareness** | User has named the category of fix | "workflow automation," "custom software," "client acquisition system" | `/insights` solution-explainer articles + pillar pages themselves (pillar pages can rank directly for mid-funnel category terms — they're substantive enough) |
| **3 — Service Intent** | User is looking for a provider of that solution | "business automation agency," "custom software development company," "growth systems agency" | Pillar pages are the landing target; realistic ranking odds vary sharply by exact phrase (§6) |
| **4 — Vendor Evaluation** | User is comparing providers, approaches or costs | "custom software vs SaaS," "how much does business automation cost," "agency vs freelancer vs in-house" | Decision-support `/insights` content, explicitly citing the FAQ's own honest trade-off content (`faq.a3`, `faq.a7`) |
| **5 — Transaction/Inquiry Intent** | User is ready to talk to someone | "[Unchained Business]" branded search, or arriving at the CTA after reading a case study | `StartProjectButton` → Commercial Contact Panel (regional resolver, WhatsApp/Telegram/email/booking) — already built and working (`lib/commercial/*`) |

**INFERENCE:** the site today has real, working infrastructure for Level 5 (the commercial contact panel is unusually sophisticated for a company this size) and Level 3 (the pillar pages), but nothing purpose-built for Levels 1, 2, or 4 — which is precisely the `/insights` gap. A visitor at Level 1 or 2 today has nowhere to land except the pillar page itself, which is written for a visitor who already knows which pillar they need.

---

## 5. Service SEO Analysis

### `/software-development`

1. **Should target:** custom software development (mid-tail, not the unqualified head term — see §6/§14), web application development for internal business use, SaaS product development/MVP development, software modernization for an existing system that can't scale.
2. **Should NOT target:** "software development" bare (too broad — competes with every dev shop, bootcamp, and definitional content on earth), general programming/tutorial content, framework-specific SEO ("Next.js developer," "React developer") — that attracts developers, not clients, and contradicts the entire premise of this audit (qualified vs. vanity traffic).
3. **Subtopics that belong underneath it:** custom software vs. SaaS (build vs. buy), MVP development, internal tools/admin panels, software modernization, SaaS billing/multi-tenancy architecture (a subtopic `pillar-content.ts` already names explicitly: "accounts and permissions, billing and subscriptions, onboarding, admin tooling").
4. **Supporting content that should link to it:** any `/insights` article in the subtopics above; the TanCerca case study (already the pillar's cited proof).
5. **Case studies that should support it:** TanCerca today (marketplace/SaaS architecture). The five in-development projects (Lanna Kamilina, Lazara Sersa, Mensalere, Frito, Unchained OS) become supporting proof the moment each ships and gets a real detail page — Mensalere and Unchained OS in particular are closer to "web application" than "website," which is this pillar's second offering.
6. **CTA:** already correct — "Start a Project" into the commercial panel. No change needed; the gap is upstream content, not the CTA.

### `/business-automation`

1. **Should target:** workflow automation, systems/tool integration, internal tools ("the admin panel no vendor sells" — a genuinely specific, ownable phrase already in the copy), operational systems/reporting automation.
2. **Should NOT target:** generic "AI automation" hype content, "best automation tools" listicles (a tools-comparison category Unchained doesn't compete in — it builds systems, it doesn't review Zapier vs. Make), broad "productivity" content.
3. **Subtopics:** workflow automation for a specific recurring process (intake, approvals, onboarding, invoicing — all named in the copy already), integrations between named categories of tool (CRM↔billing, support↔scheduling), internal tools/ops consoles, reporting automation.
4. **Supporting content:** process-specific `/insights` articles ("how to automate [named recurring process]") — this is the pillar with the clearest path to programmatic-feeling-but-actually-valuable content, because "the recurring sequences your team performs by hand" is a finite, listable set (intake, approvals, onboarding, invoicing, reporting), and each is a legitimate, distinct search intent.
5. **Case studies:** TanCerca's operational layer is the only current proof, and the pillar page is honest that it's borrowed proof, not a dedicated automation client engagement (`ba.proof`). This is the pillar most in need of a real, dedicated client case study once one exists.
6. **CTA:** unchanged — correct as-is.

### `/growth-systems`

1. **Should target (as SEO-facing language, distinct from the brand name — see §12):** client acquisition system, lead qualification/lead scoring process, lead nurturing automation, conversion funnel optimization/instrumentation.
2. **Should NOT target:** "growth systems" as a bare phrase (§12), generic growth-hacking/marketing-tips content, SEO/social-media-management services Unchained doesn't offer.
3. **Subtopics:** client acquisition system design, lead qualification frameworks, nurturing sequences, funnel instrumentation/measurement (the pillar's own "measured honestly" approach point is a legitimate content angle: most growth content oversells results, and a page arguing for honest funnel measurement is differentiated).
4. **Supporting content:** `/insights` articles on the subtopics above, explicitly framed around the pillar's stated point of view ("infrastructure, not tactics" — a genuinely contrarian, defensible angle against tactic-of-the-week growth content).
5. **Case studies:** currently none with a client outcome — the pillar's own proof statement says so outright (`gs.proof`: "we are applying them to our own company first"). This is the most evidence-light pillar and should not be oversold in content until a real client result exists (§13, §25).
6. **CTA:** unchanged — correct as-is.

---

## 6. Search Competition — SERP Composition (Qualitative)

**Method and limitation (stated plainly, per instructions):** live web search was used to observe *what kind of page currently ranks* for representative queries in each pillar. No keyword-volume, ranking-position, or traffic-estimation tool was available in this environment — every claim below is about SERP *composition*, not size of opportunity. Treat "who ranks" as directional evidence for realistic competability, not as a probability of success.

| Query | What ranks today (FACT, observed) | Why Unchained could/couldn't realistically compete |
|---|---|---|
| "custom software development company" | Large global outsourcing/enterprise dev firms (Avenga, Itransition, Luxoft) and "Top N companies" listicle/directory content (Fingent, Milesit) | **Avoid as a head term.** This is an enterprise-outsourcing SERP; a one-flagship-product company cannot out-authority companies with 25 years of enterprise case studies. Compete instead on the mid-tail decision queries below, where the field is smaller agency blogs. |
| "when should a business build custom software vs. SaaS" | Mid-size software agency blogs (Designli, Eleks, Fyin, Insite, Wiara, Tectome, SilverXis) — decision-support articles, not enterprise vendors | **Realistic.** The competing content is exactly the size and shape of company Unchained is; this is a genuinely winnable content pattern (Tier B, §14). |
| "business process automation company" / "AI automation agency for small business" | A wave of recently-founded boutique automation agencies and comparison/roundup articles (AutomateNexus, LOW/CODE, Cohevo, ATI Lab, Systemapic, The AI Automation Agency) | **Crowded but not closed.** The incumbents are new, small, and SEO-content-driven rather than enterprise brands — proof that a company Unchained's size *can* rank here, but also that the head term is contested. The realistic entry point is naming a specific recurring process (§5, §13), not the category term. |
| **"growth systems" (bare)** | Thought-leadership and coaching-framework content — a Medium essay, HBR, Wikipedia's "growth platforms," a business-coaching methodology site (Metronomics), a sales-consulting blog | **Do not target directly (§12).** Google associates this phrase with *concept explainers*, not *service providers*. Nobody ranking here is selling what Unchained sells. |
| "client acquisition system for B2B service business" | Boutique growth/marketing consultancies and coaches (Predictable Profits, Stacklier, SalesFocus) | **Realistic and directly relevant** — this is the SEO-facing equivalent of "Growth Systems" the pillar should actually chase (§12). |
| "unchainedbusiness.com" / "Unchained Business" (brand) | No dedicated visibility for the site today; results surface an unrelated, much larger company also named "Unchained" (a Bitcoin custody/financial-services firm, unchained.com) plus an unrelated "Business Unchained" Instagram account | **Real disambiguation risk**, not a keyword-competition problem — flagged in full in §22/§23. |

**Overall pattern (INFERENCE):** in every pillar, the *head* commercial term is dominated by either enterprise incumbents or a crowded field of similarly-new competitors, while the *decision-support and process-specific* tier is populated by companies the size of Unchained. This is the single most important input to the content roadmap (§17): start narrow and specific, not broad and categorical.

---

## 7. Topical Authority Map

```text
SOFTWARE DEVELOPMENT
│
├── Custom Software
│   ├── Custom software vs. SaaS — how to decide
│   ├── When an existing system can't scale (signals + what to do)
│   ├── What "architecture before code" actually means (methodology content, ties to sd.approach)
│
├── SaaS & Product Development
│   ├── What founders underestimate in a SaaS build (billing, permissions, onboarding)
│   ├── MVP scope: what to build first vs. defer
│
├── Internal Tools & Web Applications
│   ├── When a spreadsheet has become a liability
│   ├── Dashboards/portals your team will actually use
│
└── Software Modernization
    ├── Signals a system needs to be rebuilt vs. patched
    └── Migrating without a "big-bang" rewrite (ties directly to sd.approach.2)

BUSINESS AUTOMATION
│
├── Workflow Automation
│   ├── Automating intake / approvals / onboarding / invoicing / reporting (one article per named process — a finite, real list, not invented volume)
│   └── Why automating a broken process makes it worse (ba.approach.1 — a genuinely contrarian, defensible angle)
│
├── Integrations
│   ├── Signs your tools have stopped talking to each other
│   └── One source of truth vs. six subscriptions
│
├── Internal Tools
│   └── The tool no vendor sells: when to build vs. keep patching a spreadsheet
│
└── Operational Systems
    └── Making automation observable (ba.approach.3 — differentiated: most automation content ignores failure visibility)

GROWTH SYSTEMS
│
├── Client Acquisition Systems
│   ├── What a client acquisition system actually includes (positioning, offer, landing surface, mechanics)
│   └── Why tactics decay and infrastructure doesn't (gs.approach.1)
│
├── Lead Qualification & Nurturing
│   ├── Building qualification into the system instead of the calendar
│   └── Structured follow-up for the "not ready yet" majority
│
└── Conversion & Measurement
    ├── Instrumenting a funnel to find the real leak point
    └── Foundation-first: why more traffic makes a broken funnel worse (gs.approach.2 — directly reusable, already-written argument)
```

**RECOMMENDATION:** every branch above is derived directly from language already committed to in `pillar-content.ts` — this is not a new content universe invented for SEO; it is the existing point of view, broken into publishable units. That is deliberate: it keeps the topical map honest to what the company actually believes and can defend, consistent with the transparency stance (§23).

---

## 8. Content Cluster Architecture

**RECOMMENDATION:** organize `/insights` around **problem/subtopic clusters under the three pillars**, not around industries, technologies, or a separate taxonomy. Reasoning:

- The business itself is organized around three capability pillars, not industries — there's no evidence in the repository of an industry specialization (the portfolio spans beauty, mental health, dating, private equity, marketplace — deliberately varied, not vertical-focused).
- A pillar-first cluster avoids the two failure modes named explicitly in the brief: (a) tag/category sprawl for a site that will have single-digit-to-low-double-digit articles for a long time, and (b) thin category pages that exist only to hold a taxonomy.
- This matches the technical audit's own recommendation (§9 of that document): an `insights` article carries a `pillar` field reusing the existing `pillars` array, no separate taxonomy system.

**What this looks like concretely:**
- `/insights` — an index, filterable by the three existing pillar values, nothing more.
- `/insights/[slug]` — one article, tagged to exactly one primary pillar (an article can *mention* another pillar and link to it, but should have one primary intent — this is also the cannibalization rule, §21).
- No author pages, no date-archive pages, no separate "guides" or "comparisons" URL namespace — those are article *types*, not URL structures, at current and near-term volume.

---

## 9. Pillar → Article → Service Funnel

```text
Search Query
     ↓
Supporting Article
     ↓
Related Articles
     ↓
Service / Pillar Page
     ↓
Case Study
     ↓
Inquiry / CTA
```

Five concrete, realistic examples, using only real pillar content and the one real case study:

1. **"custom software vs SaaS"** → article on that decision → related: "signals your existing system can't scale" → `/software-development` → TanCerca case study (SaaS-shaped architecture) → Start a Project.
2. **"how to automate client onboarding"** → article on automating onboarding specifically → related: "why automating a broken process makes it worse" → `/business-automation` → (case study: none dedicated yet — honest interim state, link to TanCerca's operational layer with the same caveat the pillar page already states) → Start a Project.
3. **"why aren't my leads converting"** → problem-awareness article → related: "building qualification into the system, not the calendar" → `/growth-systems` → (no client case study yet — link to the `/journey` log instead, framed honestly as "we're applying this to ourselves first," reusing `gs.proof` verbatim) → Start a Project.
4. **"MVP development: what to build first"** → article → related: "what founders underestimate in a SaaS build" → `/software-development` → TanCerca → Start a Project.
5. **"signs your tools have stopped talking to each other"** → article → related: "one source of truth vs six subscriptions" → `/business-automation` → TanCerca operational layer → Start a Project.

**RECOMMENDATION:** where a pillar has no dedicated client case study yet (Business Automation, Growth Systems), the funnel should route to `/journey` rather than fabricate proof — this keeps every published article compatible with the site's own transparency rule and gives the journey log real internal-linking purpose instead of being an orphaned changelog.

---

## 10. Content Gaps

### SEO gaps (content needed to rank, not yet present)
- No `/insights` content at any funnel level (§4).
- No decision-support content (custom vs. SaaS, build vs. buy, agency vs. freelancer vs. in-house) — the exact content type §6 shows is realistically winnable.
- No process-specific automation content (the finite, nameable list in §7).
- No comparison/vendor-evaluation content addressing the early-stage-vs-established objection the FAQ already answers on-page but that no search-facing content carries into search (§3, last row).

### Conversion/trust gaps (content needed to convert, not an SEO problem)
- **Only one dedicated case study exists** (TanCerca). Two of three pillars borrow its proof rather than having their own — real and already acknowledged on-page, but it limits how far content can honestly push Business Automation and Growth Systems until a client engagement in each ships.
- **No author/expertise identity anywhere on the site.** No named individual is associated with any piece of content, the FAQ, or the methodology — see §23.
- **No FAQ content beyond the homepage's seven questions**, and none of it is schema-marked yet (a technical-audit item, referenced not repeated).
- **No pricing *anchor*, even a directional one.** The FAQ correctly avoids fake generic pricing (`faq.a7`) — that's the right call given the transparency stance — but a content piece explaining *how* engagements are scoped (without publishing a number) is a legitimate trust-gap fix that doesn't compromise honesty.

**RECOMMENDATION:** do not treat these two gap categories as equally urgent in the same order. SEO gaps compound the longer they're left unaddressed (nothing to rank means nothing to find); conversion gaps mostly self-heal as real client engagements ship, which is already the company's stated near-term plan (`nextMilestone` in `journey.ts`). Content should be planned around the SEO gaps now, while conversion gaps are closed by the business itself shipping projects.

---

## 11. Case Study SEO Strategy

**FACT:** `/work/tancerca` already implements something close to the ideal structure — challenge, solution, capabilities, honest outcome (`lib/projects.ts`). The recommended structure below formalizes what TanCerca already does, so it can be applied consistently as the five in-development projects ship:

```text
Problem           — what the business/market problem was (not "what we built")
Business Context  — industry, constraints, why this problem mattered to this business
Constraints       — real limits (timeline, existing systems, non-negotiables)
Solution          — the approach, in the same "architecture before code" voice as the pillar pages
Architecture      — the technical shape of it, specific enough to read as evidence, not marketing
Implementation    — what shipped
Outcome           — honest: a shipped, working system if that's what exists; a business metric only if evidenced (per the project data model's own `outcome` field rule: "never add an outcome we cannot substantiate")
Lessons           — optional but valuable; ties naturally into the /journey log's existing voice
Related Service   — explicit link to the one primary pillar this project demonstrates
CTA               — "want something like this" (already implemented: `detail.ctaTitle`/`detail.ctaBody`)
```

**Can case studies target problem × industry × solution × technology combinations?** Only where evidenced. TanCerca genuinely supports several angles already present in its data (`industry: 'Local commerce & delivery'`, `technologies: ['Next.js', 'TypeScript', 'PostgreSQL', 'Payments', 'PWA', 'Cloud infrastructure']`) — a case study can legitimately be *referenced* from an article about marketplace architecture, PWA development, or payments/subscriptions infrastructure. **RECOMMENDATION:** do not create separate landing pages per combination (problem×industry×tech) at current volume — one real case study with rich, specific detail, linked from multiple relevant articles, is more valuable and more honest than programmatically generated combination pages with a single data point stretched across them.

**On the five in-development projects:** per the technical audit, these should not have live detail pages until `detailed: true` and real content exists. This audit adds the SEO reasoning: publishing each one, when ready, is itself a natural, evidence-backed content event — "we shipped X" is exactly the kind of update the `/journey` log already exists to carry, and each new detailed case study is a new internal-linking opportunity for whichever pillar and industry-adjacent article already exists.

---

## 12. "Growth Systems" — Critical Analysis

**FACT (from live search, §6):** "growth systems" as a bare query returns thought-leadership essays (Medium), a management-framework explainer (HBR), an encyclopedia entry ("Growth platforms," Wikipedia), and B2B coaching-methodology sites (Metronomics, Value Prop) — not a single agency selling "growth systems" as a service category.

**INFERENCE:** this means the phrase functions in search as a *concept people read about*, not a *service people hire for*. Google's association is with strategic frameworks and internal operating models (closer to "how we run our company") rather than an external growth agency's offering.

**Should the pillar retain the term?** **RECOMMENDATION: yes, keep it as brand positioning — do not rename the pillar.** Three reasons:
1. It's a coherent, differentiated brand concept that ties the pillar's actual point of view together ("infrastructure, not tactics," `gs.approach.1`) — a generic rename to "Lead Generation" or "Marketing Services" would flatten exactly the differentiation the copy works hard to establish, and would misdescribe the pillar (it explicitly isn't tactics-and-channels marketing).
2. The pillar page itself is not thin — it has real substance that can earn rankings for its *actual* subtopics regardless of what the page is titled.
3. Renaming a pillar is a significant content/brand decision this audit is explicitly not authorized to make unilaterally (see constraints) — and the evidence doesn't require it; it requires the page's *supporting content* to speak search-native language.

**What should change:** the pillar's SEO-facing surface — page copy subheadings, meta description, and every supporting `/insights` article — should lead with the searchable equivalents already present in the pillar's own `items` array: **client acquisition (systems)**, **lead qualification**, **lead nurturing**, **conversion systems/funnel optimization**. "Growth Systems" stays as the pillar's name and brand identity (H1, nav, URL slug); it does not need to be the phrase every subordinate piece of content is built to rank for. This is the same pattern strong B2B brands already use — a proprietary-sounding pillar name at the top, ordinary buyer language doing the actual search-matching underneath it — and it requires no code or URL change, only a discipline applied to future meta descriptions and article titles.

---

## 13. "Business Automation" — Critical Analysis

**FACT (§6):** search demand and competition both exist and are real — but the competitive field is a wave of recently founded "AI automation agency" companies producing high volumes of comparison/roundup content, not enterprise incumbents. This is evidence of a genuinely active buyer category, and evidence that companies Unchained's size are already ranking in it.

**Adjacent terminology actually present in the pillar's own copy, all real and all more specific than "automation":** workflow automation, systems integration, internal tools, operational systems. **RECOMMENDATION:** the finite, named list of recurring processes the copy already lists — intake, approvals, onboarding, invoicing, reporting — is the single most concrete, immediately actionable content list in this entire audit. Each is a real, distinct search intent with a plausible buyer behind it, each is defensible content (not invented for SEO — it's already the copy's own example list), and together they form a natural cluster under Workflow Automation (§7) without needing five separate pillar subpages.

**What to explicitly avoid:** generic "AI automation" trend content, tool-comparison content (Zapier vs. Make vs. n8n) — Unchained is not a tools reviewer, and that content type actively works against the pillar's own stated point of view (`ba.approach.1`: map the process before automating it — a tools list is the opposite of that discipline).

---

## 14. "Software Development" — Critical Analysis

**Is the pillar too broad?** As currently written on the page, no — the five offerings (Websites, Web Applications, SaaS, Custom Software, Digital Products) are each already specific and distinguishable, not a generic "we do software" umbrella. The risk is not the pillar page; it's the temptation to chase the bare head term "software development" or "custom software development company" in *content*, which §6 shows is an enterprise-outsourcing SERP Unchained cannot realistically win.

**Smallest useful architecture (RECOMMENDATION):** three content branches, not a sprawling taxonomy —
1. **Custom Software** (the build-vs-buy/SaaS decision, the "process is the competitive advantage" argument already in `sd.offering.custom`)
2. **SaaS & Product Development** (the specific underestimated pieces already named: billing, permissions, onboarding, admin tooling — genuinely good, specific content seeds)
3. **Software Modernization** (signals a system can't scale, migrating without a rewrite)

This deliberately excludes a fourth branch for "Websites" as its own deep cluster — websites are the entry-level offering and the least differentiated one; **RECOMMENDATION:** don't build topical authority around commodity website-building content (a category owned by web-design directories and page-builder SEO content at a scale this company shouldn't chase), and let the "Websites" offering ride on the pillar page itself rather than a dedicated content cluster.

---

## 15. Recommended Information Architecture

Starting structure (current) → recommended target:

```text
/
├── software-development/        (exists — content substantial, needs primary-nav linking, §20)
├── business-automation/         (exists — same)
├── growth-systems/               (exists — same, plus §12's SEO-facing language discipline)
├── work/
│   └── [slug]/                   (exists — gate on `detailed`, per technical audit; publish new
│                                   case studies as projects ship)
├── journey/                       (exists — single page; keep as one page. Its role expands under
│                                   this strategy: it becomes the honest fallback proof-link for
│                                   Business Automation and Growth Systems articles, §9)
└── insights/                      (NEW — the actual content vehicle)
    └── [slug]/                    (article pages; `pillar` field reusing the existing pillars
                                     array — no separate taxonomy, §8)
```

**No other top-level sections are recommended at this stage** — explicitly no `/industries/`, no `/glossary/`, no `/comparisons/` as separate URL namespaces (those are content *types* living inside `/insights`, not IA-level sections, §16), and no locale-prefixed routing unless/until the i18n decision flagged in the technical audit is made deliberately (that decision is out of scope here — it's a technical/business scope call, not a content-architecture one).

**One IA-level correction this audit adds beyond the technical audit's recommendation:** primary navigation must surface the pillar pages directly, not only via footer/homepage-anchor. See §20.

---

## 16. Content Types

| Type | SEO value | Commercial value | Complexity | Needed now? |
|---|---|---|---|---|
| Pillar/service pages | High (already exist, already substantial) | High (direct commercial intent) | Low (mostly done — needs nav linking + meta discipline, §12) | Yes — fix linking now |
| Case studies | Medium today (1 real), high as more ship | High (primary trust asset) | Low incremental (pattern exists, §11) | Yes — as projects ship |
| Insights/articles | High (only real path to Levels 1-2-4 intent) | Medium-high (funnel entry, §9) | Low-medium (typed-array pattern, per technical audit §9) | Yes — the core gap |
| Decision-support/comparison content | High (§6 shows this is the winnable tier) | High (closest to conversion of any informational type) | Low (a subtype of Insights, not a new system) | Yes — prioritize this subtype first |
| FAQ (expanded) | Medium (schema-eligible, per technical audit) | Medium | Low | Should — cheap, pairs with technical audit's FAQPage JSON-LD item |
| Glossary | Low-medium | Low | Low | No — not needed at this content volume; revisit only if internal search data shows visitors bouncing on undefined terms |
| Industry pages | Low today (no vertical specialization evidenced, §3) | Low today | Medium | No — would require inventing an industry focus the business doesn't have |
| Guides (long-form) | Medium | Medium | Medium-high | Wait — valuable once 5-10 articles exist to guide *between*, premature as a first content type |

---

## 17. Prioritized Content Roadmap

### Phase 1 — Foundation (5–10 pieces)

| Priority | Topic | Search Intent | Pillar | Funnel Stage | Commercial Value | Why Now |
|---|---|---|---|---|---|---|
| 1 | Custom software vs. SaaS: how to decide | Solution/decision | Software Dev | L2/L4 | High | §6-validated winnable pattern; directly reuses `sd.offering.custom` argument |
| 2 | Signs your business has outgrown its current software | Problem | Software Dev | L1 | High | Directly reuses `sd.signals` — zero new argument to invent |
| 3 | How to automate client onboarding without breaking it | Problem/solution | Business Automation | L1/L2 | High | First of the finite named-process cluster (§13) |
| 4 | Why automating a broken process makes it worse | Contrarian/solution | Business Automation | L2 | Medium-high | Reuses `ba.approach.1` verbatim argument; differentiates from tools-listicle competitors |
| 5 | What a client acquisition system actually includes | Solution | Growth Systems | L2 | Medium | The SEO-facing equivalent term from §12 |
| 6 | Six subscriptions, no single source of truth: fixing tool sprawl | Problem | Business Automation | L1 | Medium-high | Reuses `pain.tools` language directly |
| 7 | What founders underestimate when building a SaaS product | Problem/solution | Software Dev | L1/L2 | High | Reuses `sd.offering.saas` — billing/permissions/onboarding is genuinely specific |
| 8 | Why more traffic makes a broken funnel worse | Contrarian | Growth Systems | L2 | Medium | Reuses `gs.approach.2` — differentiated, foundation-first argument |

### Phase 2 — Authority (10–15 pieces)

Extend each Phase 1 cluster with the remaining named processes (approvals, invoicing, reporting), the remaining SaaS-build subtopics (admin tooling, data model longevity), software modernization content, and lead qualification/nurturing content — all already scoped in §7's topical map. Begin the first true comparison piece (agency vs. freelancer vs. in-house, addressing the early-stage-vs-established objection directly, per §3's last segment and `faq.a3`).

### Phase 3 — Expansion

Gated on Phase 1/2 performance and, critically, on real client engagements shipping. **RECOMMENDATION:** do not plan Phase 3 topics now — decide them from what Phase 1/2 content and real inquiries reveal about which pillar and which problem framing actually produces qualified contact-panel opens (`track('explore_work_click', ...)` and the inquiry-form events already instrumented in `lib/analytics.ts` are the right data source for this decision when the time comes).

---

## 18. First 10 Content Pieces

1. **"Custom Software or SaaS? A Framework for Deciding"** — Primary query: *custom software vs SaaS*. Intent: decision-support (L4). Audience: founder/operator evaluating build-vs-buy. Pillar: Software Development. Funnel: mid. Why now: §6-validated realistic ranking tier; directly usable argument already exists in `sd.offering.custom`. Internal links: → `/software-development`, → TanCerca case study. CTA: Start a Project.
2. **"Four Signs Your Business Has Outgrown Its Software"** — Query: *signs you need custom software / when to replace business software*. Intent: problem-awareness (L1). Audience: operator feeling the pain but not yet naming the fix. Pillar: Software Development. Funnel: top. Links: → this article's own signals list *is* `sd.signals` reused honestly → `/software-development`. CTA: Start a Project.
3. **"How to Automate Client Onboarding Without Losing the Human Parts"** — Query: *automate client onboarding*. Intent: problem/solution (L1/L2). Audience: ops-focused operator. Pillar: Business Automation. Funnel: top-mid. Links: → `/business-automation`, → "map the process before automating it" companion piece. CTA: Start a Project.
4. **"Why Automating a Broken Process Just Makes the Mess Faster"** — Query: *automation strategy / process before automation*. Intent: solution-aware, contrarian (L2). Audience: operator about to buy automation tools. Pillar: Business Automation. Funnel: mid. Links: → onboarding-automation article, → `/business-automation`. CTA: Start a Project.
5. **"What a Client Acquisition System Actually Includes"** — Query: *client acquisition system*. Intent: solution-aware (L2). Audience: founder frustrated with inconsistent lead flow. Pillar: Growth Systems. Funnel: mid. Links: → `/growth-systems`, → `/journey` (honest proof-in-progress link, §9). CTA: Start a Project.
6. **"Six Subscriptions, Zero Sources of Truth: Fixing Tool Sprawl"** — Query: *disconnected business tools / integration problems*. Intent: problem-awareness (L1). Audience: operator drowning in SaaS tools. Pillar: Business Automation. Funnel: top. Links: → `/business-automation`, → onboarding-automation article. CTA: Start a Project.
7. **"What Founders Usually Underestimate When Building a SaaS Product"** — Query: *SaaS MVP development / what to include in v1*. Intent: solution-aware (L2). Audience: founder scoping a product build. Pillar: Software Development. Funnel: mid. Links: → `/software-development`, → TanCerca (billing/subscriptions/permissions evidence). CTA: Start a Project.
8. **"More Traffic Won't Fix a Leaking Funnel"** — Query: *why leads aren't converting / funnel optimization*. Intent: problem/contrarian (L1/L2). Audience: operator investing in acquisition before fixing conversion. Pillar: Growth Systems. Funnel: top-mid. Links: → `/growth-systems`, → client-acquisition-system article. CTA: Start a Project.
9. **"Custom Software vs. an Agency vs. Building In-House: An Honest Comparison"** — Query: *hire agency vs freelancer vs in-house developer*. Intent: vendor evaluation (L4). Audience: decision-stage founder. Pillar: Software Development (cross-links all three). Funnel: bottom. Links: → `/software-development`, → FAQ's `faq.a3` argument extended, → `/journey`. CTA: Start a Project. *Why it deserves publication ahead of pure keyword logic:* it's the single article most directly aligned with the site's most differentiated, defensible argument (early-stage-but-transparent vs. established-but-opaque) and the one most likely to move a reader who is already close to inquiring.
10. **"Why We Publish What Didn't Work: Inside the Unchained Journey Log"** — Query: low direct search volume, but high linkability and trust value; not written to rank on its own so much as to be the piece every other article can point to when it needs to justify the company's credibility claim. Intent: trust/E-E-A-T support. Audience: any reader evaluating credibility. Pillar: cross-cutting (feeds `/journey`). Funnel: bottom, pre-CTA. Links: → `/journey`, → `/work`. CTA: Start a Project or Follow the Journey.

---

## 19. Content Publishing Sequence

**RECOMMENDATION: mixed sequence, commercial pathway first.** Concretely: do not publish "commercial pages first" in the sense of writing *new* commercial pages — the three pillar pages already exist and are already substantive (§2). The sequencing decision that actually matters is: **fix the internal linking gap (§20) before publishing a single article**, so that every new article has a properly-linked pillar page and CTA to send traffic to. Publishing content into a site where the pillar pages are nav-invisible would generate readers who never see the commercial page the article is supposed to feed.

After that fix, sequence content itself as: **problem-awareness and decision-support content first** (items 1–8 in §18), because §6's evidence shows this is the tier Unchained can realistically win *now*, and because it maps directly to real, already-articulated pain points rather than requiring new positioning work. Save comparison/vendor-evaluation content (item 9) for once 5–8 problem/solution pieces exist to link into it — a comparison page with nothing to compare *to* on-site is weaker than one arriving after a reader has already read two or three of the site's own problem-aware pieces.

---

## 20. Internal Linking Strategy

**The one structural fix this audit requires before content production (elaborating §1's finding):** add the three pillar pages to primary navigation (`components/Navbar.tsx`), or at minimum make "What We Build" a link/dropdown that reaches the pillar pages directly rather than only a homepage anchor. Today, `/software-development`, `/business-automation`, and `/growth-systems` are reachable only via the footer and one homepage section — for pages meant to be the commercial core of the site and the primary landing target for Level 2/3 search intent, that is materially under-linked.

Rules going forward:
- **Article → Pillar:** every `/insights` article links to exactly one primary pillar page (its `pillar` field) in-body, not just via a sidebar/tag — an actual contextual link where the argument naturally reaches it.
- **Pillar → Articles:** each pillar page should eventually list/link its 2-4 most relevant articles (a lightweight "Related reading" block) — not built until enough articles exist per pillar to make it non-empty (Phase 1 completion, §17).
- **Article → Case study:** where a real case study substantiates the article's argument (TanCerca today), link it explicitly, in-body, not just as a nav item.
- **Case study → Service:** already implemented correctly (`detail.ctaBody`, `/work/[slug]` → pillar-flavored CTA).
- **Related article → related article:** 1-3 contextual links per article, chosen by topic proximity (same pillar cluster) — no auto-generated "related posts" widget needed at this volume; hand-picked links are more accurate and avoid the thin-relevance problem auto-widgets create with a small content base.
- **Homepage → pillars:** already present (Capabilities section); should remain, and should be joined by the nav fix above, not replace it.
- **Homepage → strongest commercial pages:** already correct — Hero and CTASection both drive to `StartProjectButton`, and Work/Capabilities both surface the pillars.

**Anchor-text principle (RECOMMENDATION):** favor natural, varied phrasing that matches how the linked page actually talks about itself ("the architecture-first process," "what a client acquisition system includes") over repeated exact-match anchors ("business automation," "business automation," "business automation"). The pillar copy is written in a distinctive, consistent voice already — anchor text should sound like that voice, not like an SEO tool's suggested phrase list.

---

## 21. Cannibalization Rules

**Rule: one page owns one primary search intent.** Concretely for this site:

```text
Primary intent: "custom software development" / "custom software vs SaaS"
→ owned by: /software-development (category) and its one canonical decision-support article
   (not both trying to rank for the same exact phrase)

Supporting, distinct intents — each gets its own article, never folded into the pillar page itself:
  "how much does custom software cost"        → future article, once a defensible answer exists
  "when to build vs buy software"              → article #1 in §18
  "signs your software can't scale"            → article #2 in §18
```

Applied pillar-by-pillar: the **pillar page** owns the mid-tail category/service-intent query ("business automation," "growth systems," "custom software development" as *mid-tail*, not head-term, phrasing per §6). Each **article** owns exactly one narrower problem, decision, or process query, and should state in its own title/meta which one, so a future author can check "does this already exist" before writing a near-duplicate. **RECOMMENDATION:** maintain this as a simple running list (a table of published article → primary target query) inside the repository alongside `lib/pillar-content.ts`, not a separate SEO tool — the existing typed-array content pattern is the right place for it, consistent with the technical audit's content-architecture recommendation.

---

## 22. AI Search / LLM Discoverability

**FACT, established by direct search during this audit (§6):** searching for "unchainedbusiness.com" and "Unchained Business" today surfaces an unrelated, much larger company also named "Unchained" (a Bitcoin custody/financial-services firm at unchained.com) and an unrelated "Business Unchained" Instagram account, with no visibility for the actual site. This is not a ranking-competition problem — it's a **disambiguation** problem, and it matters more for AI answer engines than for classic search: a classic SERP shows ten blue links a user can visually sort through, but a single AI Overview or chat answer that conflates "Unchained" the Bitcoin custody company with "Unchained Business" the software/automation company would misinform a prospective client with no correction mechanism.

**RECOMMENDATION — concrete, non-speculative fixes:**
- **Consistent, disambiguating entity language.** Every page should make "Unchained Business" (not "Unchained") the primary self-reference in visible text, not just the logo — this is already mostly true (`siteConfig.name`), but the layout's `<title>` template and OG title should be checked to ensure "Unchained Business" (full name) appears, not a shortened "Unchained."
- **Organization structured data** (already recommended in the technical audit, §8 Phase 2) — a machine-readable `Organization` entity with `name: "Unchained Business"`, `url`, and `sameAs` links to the real social profiles is the single highest-leverage fix available, because it gives answer engines an explicit, structured disambiguation signal rather than relying on them to infer it from prose.
- **A clear "who we are" surface an answer engine can extract cleanly.** The `/journey` page and homepage About section already contain this in well-written prose ("Unchained Business is an early-stage technology company... a flagship product in production, five more projects in development") — this is good raw material for extractive AI summarization as-is; no rewrite needed, just ensure it stays crawlable and isn't buried behind client-side-only rendering (it isn't, per the technical audit's SSG findings).
- **FAQ content already answers exactly the kind of direct question an AI answer engine surfaces well** ("How established is the company?", "What exactly does Unchained Business build?") — FAQPage schema (technical audit, already recommended) increases the odds this exact Q&A pair gets extracted verbatim rather than paraphrased or hallucinated.
- **Case studies with real technical specificity** (TanCerca's named stack, named capabilities) are good raw material for an AI system trying to answer "has this company built X before" — this argues for finishing the five in-development case studies as they ship, not just for classic SEO reasons but because specific, factual project detail is exactly what retrieval-based answer engines weight over marketing prose.

**ASSUMPTION:** no tool in this environment can measure current AI Overview or chat-assistant visibility for the site. The disambiguation risk above is inferred from organic search results, not confirmed against any specific AI answer-engine output.

---

## 23. E-E-A-T / Trust Architecture

**What the site already demonstrates well (FACT):**
- **Real experience/evidence:** TanCerca is a real, named, externally-verifiable product (`externalUrl: 'https://www.tancercadeti.com'`) with specific architectural detail — this is stronger E-E-A-T material than most early-stage agency sites have, precisely because it's concrete rather than claimed.
- **Radical, structurally-enforced honesty:** the `/journey` log's explicit commitments ("we don't hide mistakes," "we don't fabricate numbers," `journeyPage.p1–p4`) and the codebase's own content rules (`projects.ts`: "never add an outcome we cannot substantiate") are a genuine, unusual trust asset — most companies claim transparency; this one has structurally encoded it into the content model itself.
- **Contact/company identity:** a working, unusually sophisticated commercial contact system (regional resolver, multiple real channels) — this is a stronger "can I actually reach a real business" signal than a bare contact form.
- **Methodology:** the five-phase process (Discover/Architect/Build/Launch/Optimize) is stated clearly and consistently across the homepage and pillar pages.

**The highest-value trust gaps (INFERENCE, prioritized):**
1. **No named individual anywhere on the site.** There is no founder/team bio, no author byline on any page or future article, no LinkedIn-verifiable person a prospective client can research before a call. For a company whose entire differentiator is "senior attention, a documented process, and work you can inspect" (`faq.a3`), the absence of a named, inspectable person is the single largest gap between what the site claims and what it currently shows. **RECOMMENDATION:** this is a content/business decision outside this audit's scope to mandate, but it is the highest-leverage trust fix available — even a single named founder bio on `/journey` or a new `/about` would materially strengthen both classic E-E-A-T and the AI-disambiguation problem in §22 (a named person is much harder for an answer engine to confuse with an unrelated company).
2. **Only one of three pillars has dedicated proof.** Already covered in §2/§5/§11 — the fix is shipping the in-development projects, not a content trick.
3. **No third-party corroboration anywhere** (no press mention, no client testimonial — correctly, per the transparency rule, no fabricated ones either). **ASSUMPTION:** whether any real, evidenced third-party mention exists (a client quote the company could publish with permission, a press mention) is not knowable from the repository; if one exists, it should be added — if none exists, none should be invented, consistent with the site's own rule.

**What NOT to recommend (per the brief's explicit instruction):** no "trust badges," no fake security-seal icons, no generic "as seen in" bar without real placements, no stock-photo team page — all of these would directly contradict the transparency stance that is this company's actual differentiator.

---

## 24. Conversion Architecture

**FACT:** the conversion path is already well-built and consistent. `StartProjectButton` appears in the navbar, hero, CTA section, and case-study detail pages, all routing to one shared `CommercialContactPanel` (mounted once in `app/layout.tsx`) that resolves a regional contact and offers WhatsApp/Telegram/email/scheduled-call channels plus an optional written-inquiry form (`lib/commercial/*`, `docs/commercial-routing.md`, `docs/lead-capture.md`). Secondary, lower-commitment paths exist too ("Not ready? Explore our work," "Or follow the journey" in `CTASection`) — a genuine, appropriately-staged funnel rather than a single hard CTA.

**Where this audit's recommendations touch conversion:**
- Every new `/insights` article must end with the same `StartProjectButton` CTA pattern already used sitewide — no separate, weaker "subscribe" or "download" CTA should be introduced for content; the existing panel is the right single destination (§9's funnel diagrams assume this).
- Articles that route to `/journey` in lieu of a missing case study (§9) are themselves a conversion-relevant choice: a reader who isn't ready to buy but reads the journey log becomes a warmer future inquiry, and the `follow_journey_click` event already exists in analytics to measure this path.
- **Friction check (INFERENCE, not independently browser-tested in this audit):** the regional-resolver pattern is a real strength (a visitor is introduced to a specific person, not a generic form) but also a real dependency — per `lib/commercial/config.ts`'s own documentation, if the resolver endpoint isn't configured, every inquiry silently falls back to a global contact. **RECOMMENDATION:** confirm (outside this audit, as an operational check) that the fallback path is actually being exercised correctly in production before content that will drive first-time visitors into this panel goes live — this is worth a manual click-through test, not a code change this audit is prescribing.

No redesign is recommended — the conversion architecture is not the bottleneck; content volume and internal linking are (§1).

---

## 25. SEO Strategies to Avoid

- **Mass AI-generated articles.** Directly incompatible with the site's own stated values (`journeyPage.p3`: "we don't fabricate numbers... we describe capability instead") — generic AI content is also the exact material flooding the Business Automation SERP already (§6), meaning it wouldn't even be differentiated, just louder noise in an already-loud category.
- **Generic "Top 10 [tools]" listicle content.** Not a category Unchained has any evidenced authority in (it builds systems, it doesn't review SaaS tools), and it's already dominated by content-farm sites in the automation category specifically (§6).
- **Keyword stuffing / exact-match anchor repetition.** Directly contradicts §20's anchor-text principle and the site's own distinctive, deliberate writing voice.
- **Location pages.** No evidence anywhere in the repository of a local/geographic service model — the portfolio spans multiple countries and industries with no local-service pattern; location pages would be entirely fabricated market fit.
- **Tags/categories beyond the three pillars.** Explicitly against §8's recommended architecture — would create thin, near-duplicate taxonomy pages for a content base that will be small for a long time.
- **Programmatic combination pages** (problem × industry × technology, per §11) at current case-study volume (one). This would produce many pages backed by the same single data point — thin-content risk with zero unique value, and directly against the transparency rule.
- **Chasing large informational keywords unrelated to services** ("AI news," "productivity tips," "how to code X") — explicitly named as a trap in the brief, and confirmed by §6: none of the winnable SERPs for Unchained's actual services look anything like that content.
- **Publishing on a fixed daily/weekly cadence to hit a volume target.** The right cadence is "as fast as Phase 1's 8 pieces can be written well," not a calendar quota — a forced cadence is how thin content happens even with good intentions.
- **A page for every keyword variation** ("business automation company," "business automation agency," "business automation services" as three separate pages) — directly against §21's cannibalization rule; one page, one primary intent, synonym variations handled in the same page's copy, not as duplicate URLs.

---

## 26. Final Recommended SEO Strategy

The brief's proposed model holds, with one addition (the internal-linking fix folded in explicitly, since the audit's central finding is that this step was implicit and needs to be structural, not incidental):

```text
BUSINESS POSITIONING (already strong — radical transparency + 3 real pillars)
        ↓
3 CORE SERVICE PILLARS (already substantive — fix: surface them in primary nav)
        ↓
COMMERCIAL SERVICE PAGES (same as pillars here — no separate page type needed)
        ↓
CASE STUDIES (1 real today; publish each in-development project honestly as it ships)
        ↓
PROBLEM / DECISION CONTENT (/insights — the actual gap; start narrow, per §6's evidence)
        ↓
TOPICAL AUTHORITY (accrues from the problem/decision layer, pillar-clustered, §7-§8)
        ↓
INTERNAL LINKING (deliberate, hand-picked, §20-§21 — not an afterthought)
        ↓
ORGANIC DISCOVERY
        ↓
QUALIFIED TRAFFIC (mid-tail and decision-stage, not head-term, per §6)
        ↓
INQUIRY (already well-built — the commercial contact panel, §24)
```

---

## SEO STRATEGIC READINESS

```text
STRATEGIC STATUS: NOT READY
```

Not ready for the same reason the technical audit was a NO-GO: the blockers are small, identified, and low-complexity — not a sign the strategy or the business itself is weak. This flips to READY once these decisions/changes land:

1. **Land the technical audit's three P1 fixes** (canonical host, gate `/work/[slug]` on `detailed`, add an OG image) — content published before these land inherits the same problems at greater scale.
2. **Add the three pillar pages to primary navigation** (§1, §20) — publishing `/insights` content that funnels toward pillar pages the site's own nav doesn't surface is building a funnel with a broken step in the middle.
3. **Build the `/insights` route and its typed-array content model** (§8, mirroring the existing `lib/projects.ts`/`lib/pillar-content.ts` pattern) — there is currently no page to publish Phase 1 content to.
4. **Decide and commit the §12 discipline** (Growth Systems stays as brand name; SEO-facing language uses "client acquisition system," "lead qualification," "lead nurturing," "conversion systems") before writing any Growth Systems-pillar content, so the first articles aren't written against the wrong search-facing vocabulary and then need rework.

### THE NEXT 10 ACTIONS

```text
1. Land the technical audit's P1 fixes (canonical host, work/[slug] gating, OG image) before any of the below ships publicly.
2. Add /software-development, /business-automation, /growth-systems as direct links in Navbar.tsx primary nav (not only footer/anchor).
3. Scaffold /insights and /insights/[slug] using the same typed-content-array pattern as lib/projects.ts and lib/pillar-content.ts.
4. Add a `pillar` field to the insights content type, reusing the existing `pillars` array from lib/site.ts — no new taxonomy.
5. Write and publish content piece #1 from §18 ("Custom Software or SaaS? A Framework for Deciding") as the pattern reference for every piece after it.
6. Write and publish content pieces #2–#4 from §18, completing the Software Development and Business Automation Phase-1 seeds.
7. Write and publish content pieces #5, #6, #8 from §18, completing the Growth Systems and remaining Business Automation Phase-1 seeds, using the §12 SEO-facing language discipline throughout.
8. Add Organization + FAQPage JSON-LD (per the technical audit's Phase 2, and per §22's disambiguation reasoning — this is now doing double duty for classic SEO and AI-answer-engine disambiguation).
9. Publish the next in-development project's case study the moment it ships (`detailed: true`, real challenge/solution/capabilities/outcome) — do not wait for a content calendar slot; ship it the week the product ships, per §11.
10. Instrument and review which Phase 1 articles actually drive `StartProjectButton` opens (the event tracking already exists in lib/analytics.ts) before committing to the full Phase 2 topic list — let real inquiry data, not this audit's ordering alone, decide what Phase 2 prioritizes.
```
