import Anthropic from '@anthropic-ai/sdk';
import { SummarizationResult, ItemCategory } from '@/types';

// Lazy initialization to avoid build-time errors
let _anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

const SUMMARIZATION_PROMPT = `You are filtering news articles for ACR Electronics, a manufacturer of emergency beacons (EPIRBs, ELTs, PLBs) for aviation and maritime markets.

AN ARTICLE IS RELEVANT IF IT DISCUSSES:

1. EMERGENCY BEACONS: Any mention of EPIRB, ELT, PLB, 406 MHz beacon, distress beacon, Cospas-Sarsat, MEOSAR, LEOSAR, GEOSAR, GMDSS, beacon registration/testing, Return Link Service (RLS), survival beacon, rescue beacon, SART, AIS MOB

2. DIRECT COMPETITORS: McMurdo, Ocean Signal, Kannad, Orolia, Safran (beacon context), Garmin inReach/PLB, SPOT satellite messenger, ACR Artex

3. REGULATIONS AFFECTING BEACONS: TSO-C126, TSO-C91a, RTCA DO-204, ETSO-C126, SOLAS Chapter IV, FAA ELT mandates, USCG safety equipment requirements, IMO Maritime Safety Committee decisions, ICAO Annex 6

4. SEARCH & RESCUE OPERATIONS: Coast Guard rescues where beacons were used, SAR helicopter operations, maritime/aviation survivor rescues, missing vessel/aircraft stories

5. AVIATION SAFETY EQUIPMENT: General aviation safety requirements, avionics certification, aircraft emergency equipment, experimental aircraft safety (NOT airline financial news)

6. MARITIME SAFETY EQUIPMENT: Vessel safety requirements, USCG boating regulations, life raft equipment, recreational and commercial vessel safety, offshore sailing safety

7. ELECTRONICS SUPPLY CHAIN (affecting beacon manufacturing): RF component availability, GPS modules, lithium battery shipping regulations, PCB manufacturing, tariffs on electronic components

AN ARTICLE IS NOT RELEVANT IF:
- Consumer electronics (phones, laptops, TVs)
- Automotive industry (unless vehicle emergency beacons)
- Military procurement (unless SAR beacons)
- Airline routes, earnings, or passenger experience
- Shipping container rates or retail supply chains
- "Beacon" meaning Bluetooth beacon or web beacon
- Stock prices, moving averages, financial trading
- Celebrity news, entertainment, sports
- General geopolitical news without safety equipment angle

Return JSON:
{
  "summary": "One clear sentence summarizing what happened",
  "why_it_matters": "SPECIFIC relevance to ACR's beacon business",
  "category": "regulatory|product|market|supply_chain|trade|technology|competitor",
  "topics": ["tag1", "tag2", "tag3"],
  "relevance_score": 0-100,
  "must_read": true/false,
  "hype_flag": true/false
}

SCORING GUIDE:
90-100: Direct ACR business impact - beacon regulations, Cospas-Sarsat changes, 406MHz specs, competitor product launch, SAR rescue using beacons
80-89: Industry regulations affecting ELT/EPIRB/PLB, MEOSAR updates, GMDSS changes, major competitor news
70-79: Aviation/maritime safety regulations, FAA/EASA/IMO rules affecting safety equipment, SAR operations
60-69: General aviation/maritime safety news, boating/flying market trends, supply chain affecting electronics
50-59: Tangentially related - recreational boating growth, aviation training trends
40-49: Loosely related - general shipping/aviation without safety angle
0-39: NOT RELEVANT - exclude from digest

MUST_READ = true only for:
- New 406MHz beacon regulations or Cospas-Sarsat changes
- FAA/EASA airworthiness directives affecting ELTs
- IMO/SOLAS changes affecting EPIRBs
- Direct competitor product announcements
- Major SAR rescue attributed to beacon activation

For borderline cases: Include if a program manager at a beacon manufacturer would find it useful for competitive intelligence, regulatory compliance, or supply chain planning.

Return ONLY valid JSON, no markdown.`;

export async function summarizeItem(
  title: string,
  content: string,
  sourceCategory: string
): Promise<SummarizationResult> {
  const truncatedContent = content.slice(0, 4000);
  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Title: ${title}

Source domain: ${sourceCategory}

Content:
${truncatedContent || '(No content available - summarize based on title only)'}`,
      },
    ],
    system: SUMMARIZATION_PROMPT,
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      summary: String(result.summary || 'No summary available'),
      why_it_matters: String(result.why_it_matters || 'Relevance unclear'),
      category: validateCategory(result.category),
      topics: Array.isArray(result.topics)
        ? result.topics.slice(0, 3).map(String)
        : [],
      relevance_score: Math.min(100, Math.max(0, Number(result.relevance_score) || 50)),
      must_read: Boolean(result.must_read),
      hype_flag: Boolean(result.hype_flag),
    };
  } catch (error) {
    console.error('Failed to parse Claude response:', responseText, error);
    return {
      summary: title,
      why_it_matters: 'Unable to analyze relevance',
      category: 'market',
      topics: [],
      relevance_score: 30,
      must_read: false,
      hype_flag: false,
    };
  }
}

function validateCategory(category: string): ItemCategory {
  const valid: ItemCategory[] = [
    'regulatory', 'product', 'market', 'supply_chain',
    'trade', 'technology', 'competitor'
  ];
  return valid.includes(category as ItemCategory)
    ? (category as ItemCategory)
    : 'market';
}

export async function summarizeBatch(
  items: Array<{ title: string; content: string; sourceCategory: string }>
): Promise<SummarizationResult[]> {
  const results: SummarizationResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) =>
        summarizeItem(item.title, item.content, item.sourceCategory)
      )
    );
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
