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

const SUMMARIZATION_PROMPT = `You are an industry intelligence analyst for ACR Electronics, a $75M aerospace and marine safety equipment manufacturer that makes ELTs (Emergency Locator Transmitters), EPIRBs (Emergency Position Indicating Radio Beacons), and PLBs (Personal Locator Beacons).

Summarize this item for ACR's daily intelligence briefing. Return a JSON object:
{
  "summary": "One clear sentence summarizing what happened",
  "why_it_matters": "Max 30 words on specific relevance to ACR's business",
  "category": "regulatory|product|market|supply_chain|trade|technology|competitor",
  "topics": ["tag1", "tag2", "tag3"],
  "relevance_score": 0-100,
  "must_read": true/false,
  "hype_flag": true/false
}

Categories (choose most relevant):
- regulatory: FAA/EASA/IMO/USCG rules, Cospas-Sarsat standards, airworthiness directives, SOLAS/GMDSS
- product: Beacon technology, ELT/EPIRB/PLB developments, satellite systems, MEOSAR, Return Link Service
- market: Aviation/marine industry trends, boat shows, aircraft deliveries, customer segment news
- supply_chain: Component availability, manufacturing, electronics supply, logistics
- trade: Tariffs, export controls, international trade policy affecting aerospace/marine
- technology: GPS/GNSS, satellite constellations, battery tech, RF engineering
- competitor: McMurdo, Ocean Signal, Garmin, Orolia, Kannad activities

ACR-CRITICAL topics (score 80+):
- Cospas-Sarsat system changes, MEOSAR updates, beacon specifications
- ELT/EPIRB/PLB regulations (TSO-C126, TSO-C91a, 406 MHz requirements)
- FAA/EASA airworthiness directives affecting ELTs
- IMO/SOLAS/GMDSS maritime safety requirements
- Competitor product launches or certifications
- Supply chain disruptions for aerospace electronics

Scoring guidelines:
- 90-100: Direct regulatory change affecting ACR products, major competitor move
- 75-89: Industry-wide regulatory discussion, significant market shift
- 60-74: Relevant industry news, customer market developments
- 40-59: Tangentially related, general industry context
- 0-39: Low relevance to ACR's business

Rules:
- must_read = true ONLY for: new beacon regulations, Cospas-Sarsat changes, direct competitor announcements, supply chain alerts
- hype_flag = true if: vague claims, marketing fluff, no concrete details
- Be specific about ACR relevance in why_it_matters
- Return ONLY valid JSON, no markdown`;

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
