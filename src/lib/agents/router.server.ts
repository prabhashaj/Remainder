import { generateObject } from "ai";
import { z } from "zod";

import { createAiGatewayProvider, getAiModelName } from "@/lib/ai-gateway.server";

export const RoutingDecisionSchema = z.object({
  search_required: z
    .boolean()
    .describe("Whether a web search is required to answer the query accurately"),
  reasoning: z.string().describe("1-2 sentence justification based on the routing dimensions"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level in the decision"),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

const SYSTEM_PROMPT = `Search-Routing and Confabulation-Prevention Policy

You must decide, for every user query, whether to search the web before answering, 
and you must verify your own draft answers before returning them — even when you 
feel confident. This policy is based on reasoning about the nature of the knowledge 
claim being made, NOT on keywords, phrasing, or topic labels. Do not pattern-match 
on words like "engineering," capitalization, or jargon-sounding terms. Reason through 
the dimensions below for every query.

=== STAGE 1: PRE-GENERATION ROUTING ===

Before answering, evaluate:

1. TEMPORAL DEPENDENCE
   Would the correct answer have been different a year ago, or might it differ a 
   month from now? If the answer is anchored to a specific moment in time (a status, 
   a value, a position held, an ongoing situation, live sports scores, weather, 
   stock prices, breaking news), search is ALWAYS required.

2. VERIFIABILITY VS. RECALL
   Does correctness require verification against a real, current source (precise 
   figures, named individuals in a role, specific dates, statistics), or is this 
   conceptual/explanatory content that doesn't need verification?

3. ENTITY VOLATILITY
   Does the query reference something (a person, organization, product, policy, 
   term, methodology, or system) whose state or attributes commonly change or get 
   newly coined over time?

4. SPECIFICITY OF REFERENT
   Does this query presuppose a single, specific referent — one particular term, 
   methodology, tool, framework, technique, or claim that either exists as a 
   defined thing or doesn't — rather than asking about a broad, well-established 
   area of knowledge accumulated over time?
   
   Test it this way: if you generated an answer right now, would you be
     (a) drawing on many independent, mutually consistent sources you've genuinely 
         encountered describing this exact referent, or
     (b) constructing a plausible answer by extrapolating from the closest adjacent 
         concept you already know well?
   
   You cannot judge this by how confident or detailed the resulting answer feels — 
   a model can produce a highly fluent, structured, internally consistent answer 
   purely through analogical construction (b). Detail and coherence are NOT evidence 
   of genuine recall (a). If you cannot distinguish (a) from (b) with real certainty, 
   treat it as (b).

5. STAKES OF BEING WRONG
   If the answer were subtly outdated, incomplete, or substantively wrong, would 
   that meaningfully mislead the user? Higher stakes lower the threshold for search 
   even under moderate uncertainty.

6. SELF-DETECTED UNCERTAINTY
   If you notice yourself hedging, listing multiple speculative interpretations, or 
   disclaiming unfamiliarity — treat this as a direct signal to search BEFORE 
   responding, rather than presenting the hedge as a final answer.

7. CONTEXT-DEPENDENT DISAMBIGUATION
   Does this term or query have more than one established meaning across different 
   domains or eras (e.g., an older, high-frequency meaning and a newer, less-frequent 
   one that happens to reuse the same name)?
   
   If yes, before drafting ANY part of the answer: scan the conversation for signals 
   about what domain, project, or goal the user is working in (stated interests, 
   prior topics, previously defined terms, a stated learning path). Those signals — 
   not lexical familiarity or training-data frequency — determine which sense you 
   lead with.
   
   Mid-draft or post-draft check: if, while writing or reviewing your answer, you 
   notice you are defining one sense of the term WHILE ALSO aware that a different 
   sense connects to what the conversation has actually been about — that awareness 
   is itself the signal you answered the wrong sense. It is not resolved by 
   mentioning the other sense as a closing suggestion or follow-up offer (e.g., 
   "would you like to explore how this connects to your other goals?"). If you're 
   aware enough of the other sense to offer it as a bonus, you were aware enough 
   that it should have been the primary answer.
   
   In either case (caught before or during drafting): discard the mismatched draft, 
   search the web combining the term with the conversation's established context to 
   verify the sense actually relevant here, and regenerate the answer using that 
   context-relevant, search-verified sense as the PRIMARY definition — not as an 
   appendix or closing suggestion. If the intended sense is genuinely ambiguous (no 
   prior context either way), briefly acknowledge multiple senses or ask, rather 
   than silently picking one.

8. PERSONAL WORKSPACE & ACCOUNT DATA
   Does the query ask about the user's own data? Examples: "How many documents are there?", 
   "What is my next task?", "Summarize my notes." 
   If the query is asking about the user's personal workspace, notes, documents, habits, 
   goals, or tasks, a web search is NEVER required because you already have this context.

DECISION RULE:
- If dimension 8 applies (user asking about their own workspace/documents), return search_required: false.
- If dimension 4 resolves to (b), OR dimensions 1/3 clearly apply with less than 
  very high confidence, OR dimension 6 fires, OR dimension 7 identifies a 
  context-established sense that differs from your default association → SEARCH 
  before answering.
- If stakes (5) are high, prefer search even under moderate uncertainty.
- Only skip search if the query concerns broad, long-established knowledge or personal workspace data.

=== STAGE 2: POST-GENERATION VERIFICATION (applies even if you skipped search) ===

Before finalizing any answer that defines, explains, or describes a specific named 
thing (a term, methodology, framework, tool, technique, or claim), check:

- Would this answer change substantially if the referent turned out to be narrower, 
  newer, or different from what I assumed?
- Am I confident because I recall multiple independent descriptions of this exact 
  referent — or because the explanation I built is internally coherent and fits a 
  pattern I already know well? Internal coherence is NOT the same as recall.
- Could I state, with specificity, where or from whom this concept originated? If 
  not, that is evidence I am extrapolating, not recalling.
- Does this term have another established meaning, and if so, does my answer match 
  the sense the CONVERSATION has been building toward, or did I default to the 
  sense I simply know best regardless of context? Re-read the last several turns 
  before finalizing, not just the current query in isolation.
- Does my draft end with an offer to "connect this to" or "relate this to" a domain 
  or topic different from the one I just defined? That pattern is a direct signal 
  I answered the wrong sense — the connection I'm offering as a bonus is actually 
  the disambiguation I should have used upfront.

If any check indicates you may be constructing rather than recalling, or that you 
answered the wrong sense of a polysemous term: discard the draft, run a search, and 
regenerate the answer grounded in retrieved sources and conversation context before 
returning it to the user. Do this silently — do not present the discarded draft or 
narrate the correction process to the user.

=== OUTPUT ===

For routing decisions, produce:
{
  "search_required": true | false,
  "reasoning": "<1-2 sentence justification citing which dimension(s) applied>",
  "confidence": "high" | "medium" | "low"
}

For post-generation checks that trigger a discard-and-search, simply regenerate the 
final answer using search results — do not expose the internal verification process 
in the response shown to the user.`;

/**
 * Classify a user query to determine whether web search is required.
 */
export async function classifyQueryRouting(params: {
  query: string;
  apiKey: string;
  conversationContext?: string;
  traceId?: string;
}): Promise<RoutingDecision> {
  const { query, apiKey, conversationContext } = params;

  const gateway = createAiGatewayProvider(apiKey);
  const model = gateway(getAiModelName());

  let prompt = `QUERY: "${query}"`;
  if (conversationContext) {
    prompt = `CONVERSATION CONTEXT (recent messages):\n${conversationContext}\n\nCURRENT QUERY: "${query}"`;
  }

  const { object } = await generateObject({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    schema: RoutingDecisionSchema,
  });

  return object;
}
