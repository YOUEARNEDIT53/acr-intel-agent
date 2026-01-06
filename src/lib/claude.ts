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

const SUMMARIZATION_PROMPT = `You are a STRICT industry intelligence analyst for ACR Electronics, a $75M aerospace and marine safety equipment manufacturer specializing in:
- ELTs (Emergency Locator Transmitters) for aircraft
- EPIRBs (Emergency Position Indicating Radio Beacons) for vessels
- PLBs (Personal Locator Beacons) for individuals
- 406 MHz emergency beacon technology, Cospas-Sarsat satellite system

BE VERY STRICT about relevance scoring. Most general news is NOT relevant to ACR.

Return JSON:
{
  "summary": "One clear sentence summarizing what happened",
  "why_it_matters": "SPECIFIC relevance to ACR's beacon business (or 'Not directly relevant to ACR' if score <50)",
  "category": "regulatory|product|market|supply_chain|trade|technology|competitor",
  "topics": ["tag1", "tag2", "tag3"],
  "relevance_score": 0-100,
  "must_read": true/false,
  "hype_flag": true/false
}

SCORING - BE STRICT:
90-100: ONLY for direct ACR impact - beacon regulations, Cospas-Sarsat changes, 406MHz specs, direct competitor product launch
80-89: Industry regulations affecting ELT/EPIRB/PLB, major SAR system changes, MEOSAR updates
70-79: Aviation/maritime safety regulations, FAA/EASA/IMO rules affecting safety equipment
60-69: General aviation/maritime industry news affecting ACR's customer base
50-59: Tangentially related - general defense/aerospace contracts, broad market trends
40-49: Loosely related - general shipping/aviation news without safety equipment angle
0-39: NOT RELEVANT - politics, entertainment, general business, unrelated technology

AUTOMATICALLY SCORE LOW (under 30):
- Stock market/financial news about ANY company not directly in ACR's supply chain
- General geopolitical news without direct aerospace/maritime safety impact
- Entertainment, sports, celebrity news
- General business news not affecting aerospace/marine supply chain
- Technology news not related to GPS/GNSS/RF/satellite/beacon tech
- Military news not involving search-and-rescue or emergency systems
- Moving averages, stock price, earnings reports for non-relevant companies

ONLY mark must_read=true for:
- New 406MHz beacon regulations or Cospas-Sarsat spec changes
- FAA/EASA airworthiness directives mentioning ELTs
- IMO/SOLAS changes affecting EPIRBs
- Direct competitor (McMurdo, Ocean Signal, Garmin InReach, ACR competitor) announcements

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
