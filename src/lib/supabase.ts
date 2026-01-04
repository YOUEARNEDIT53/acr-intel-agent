import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL and Anon Key are required');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!supabaseUrl) {
      throw new Error('Supabase URL is required');
    }
    _supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _supabaseAdmin;
}

// Export getters that lazily initialize
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    return (client as unknown as Record<string, unknown>)[prop as string];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseAdminClient();
    return (client as unknown as Record<string, unknown>)[prop as string];
  },
});

export type Database = {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          url: string;
          type: 'rss' | 'api' | 'scrape';
          category: 'research' | 'lab' | 'ecosystem';
          enabled: boolean;
          last_fetched: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sources']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sources']['Insert']>;
      };
      items: {
        Row: {
          id: string;
          source_id: string;
          url: string;
          title: string;
          content: string | null;
          published_at: string | null;
          fetched_at: string;
        };
        Insert: Omit<Database['public']['Tables']['items']['Row'], 'id' | 'fetched_at'>;
        Update: Partial<Database['public']['Tables']['items']['Insert']>;
      };
      summaries: {
        Row: {
          id: string;
          item_id: string;
          summary: string;
          why_it_matters: string;
          category: 'research' | 'product' | 'engineering' | 'policy' | 'security' | 'business';
          topics: string[];
          relevance_score: number;
          must_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['summaries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['summaries']['Insert']>;
      };
      digests: {
        Row: {
          id: string;
          date: string;
          content: Record<string, unknown>;
          email_sent: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['digests']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['digests']['Insert']>;
      };
    };
  };
};
