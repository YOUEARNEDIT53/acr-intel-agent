export type SourceType = 'rss' | 'api' | 'scrape';
export type SourceCategory = 'sar' | 'aviation' | 'maritime' | 'manufacturing' | 'geopolitical' | 'customer' | 'competitor';
export type ItemCategory =
  | 'regulatory' | 'product' | 'market' | 'supply_chain'
  | 'trade' | 'technology' | 'competitor';

export interface Source {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  category: SourceCategory;
  enabled: boolean;
  last_fetched: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  source_id: string;
  url: string;
  title: string;
  content: string | null;
  published_at: string | null;
  fetched_at: string;
}

export interface Summary {
  id: string;
  item_id: string;
  summary: string;
  why_it_matters: string;
  category: ItemCategory;
  topics: string[];
  relevance_score: number;
  must_read: boolean;
  hype_flag: boolean;
  created_at: string;
}

export interface Digest {
  id: string;
  date: string;
  content: DigestContent;
  email_sent: boolean;
  created_at: string;
}

export interface DigestContent {
  must_know: DigestItem[];
  worth_a_look: DigestItem[];
  quick_hits: DigestItem[];
}

export interface DigestItem {
  title: string;
  summary: string;
  why_it_matters: string;
  url: string;
  category: ItemCategory;
  topics: string[];
  relevance_score: number;
  must_read: boolean;
}

export interface ItemWithSummary extends Item {
  summary: Summary | null;
  source: Source | null;
}

export interface SummarizationResult {
  summary: string;
  why_it_matters: string;
  category: ItemCategory;
  topics: string[];
  relevance_score: number;
  must_read: boolean;
  hype_flag: boolean;
}

export interface RSSItem {
  title: string;
  link: string;
  content?: string;
  contentSnippet?: string;
  pubDate?: string;
  isoDate?: string;
}

export interface ScrapedItem {
  title: string;
  url: string;
  content?: string;
  published_at?: string;
}
