import { Resend } from 'resend';
import { DigestContent, DigestItem } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';

// Lazy initialization to avoid build-time errors
let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function formatDigestItem(item: DigestItem): string {
  return `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
        <a href="${item.url}" style="color: #1a1a1a; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${item.title}
        </a>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 13px; line-height: 1.4;">
          ${item.summary}
        </p>
        <p style="margin: 4px 0 0 0; color: #0066cc; font-size: 12px;">
          ${item.why_it_matters}
        </p>
        <p style="margin: 4px 0 0 0;">
          ${item.topics.map(t => `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px;">${t}</span>`).join('')}
        </p>
      </td>
    </tr>
  `;
}

function formatSection(title: string, emoji: string, items: DigestItem[]): string {
  if (items.length === 0) return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding-bottom: 8px; border-bottom: 2px solid #1a1a1a;">
          <h2 style="margin: 0; font-size: 18px; color: #1a1a1a;">
            ${emoji} ${title}
          </h2>
        </td>
      </tr>
      ${items.map(formatDigestItem).join('')}
    </table>
  `;
}

export function generateDigestHtml(date: string, content: DigestContent): string {
  // Parse date string properly to avoid timezone issues
  // date is in format 'YYYY-MM-DD'
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day); // month is 0-indexed
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom: 20px; border-bottom: 3px solid #1a1a1a;">
            <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">
              📡 The ACR Report
            </h1>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">
              ${formattedDate}
            </p>
          </td>
        </tr>
        ${content.executive_summary ? `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
            <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #333;">
              <strong>Today's Brief:</strong> ${content.executive_summary}
            </p>
          </td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding-top: 20px;">
            ${formatSection('Must Know', '🔴', content.must_know)}
            ${formatSection('Worth a Look', '🟡', content.worth_a_look)}
            ${formatSection('Quick Hits', '🔵', content.quick_hits)}
          </td>
        </tr>
        <tr>
          <td style="padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>
              The ACR Report — Industry intelligence for aerospace & marine safety
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generateDigestText(date: string, content: DigestContent): string {
  const lines: string[] = [];
  // Parse date string properly to avoid timezone issues
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  lines.push(`The ACR Report - ${formattedDate}`);
  lines.push('='.repeat(50));
  lines.push('');

  if (content.executive_summary) {
    lines.push('TODAY\'S BRIEF:');
    lines.push(content.executive_summary);
    lines.push('');
    lines.push('-'.repeat(50));
    lines.push('');
  }

  if (content.must_know.length > 0) {
    lines.push('🔴 MUST KNOW');
    lines.push('-'.repeat(20));
    content.must_know.forEach((item) => {
      lines.push(`• ${item.title}`);
      lines.push(`  ${item.summary}`);
      lines.push(`  → ${item.why_it_matters}`);
      lines.push(`  ${item.url}`);
      lines.push('');
    });
  }

  if (content.worth_a_look.length > 0) {
    lines.push('🟡 WORTH A LOOK');
    lines.push('-'.repeat(20));
    content.worth_a_look.forEach((item) => {
      lines.push(`• ${item.title}`);
      lines.push(`  ${item.summary}`);
      lines.push(`  ${item.url}`);
      lines.push('');
    });
  }

  if (content.quick_hits.length > 0) {
    lines.push('🔵 QUICK HITS');
    lines.push('-'.repeat(20));
    content.quick_hits.forEach((item) => {
      lines.push(`• ${item.title} — ${item.url}`);
    });
  }

  return lines.join('\n');
}

// Get recipients from database with env var fallback
async function getDigestRecipients(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'digest_recipients')
      .single();

    if (data?.value) {
      return data.value.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  } catch {
    // Table might not exist yet, fall back to env var
  }

  // Fallback to environment variable
  const toEnv = process.env.DIGEST_EMAIL_TO;
  if (toEnv) {
    return toEnv.split(',').map(email => email.trim()).filter(Boolean);
  }

  return [];
}

export async function sendDigestEmail(
  date: string,
  content: DigestContent
): Promise<{ success: boolean; error?: string }> {
  const from = process.env.DIGEST_EMAIL_FROM || 'ACR Intel Agent <acr-intel@mail.ipguy.co>';
  const to = await getDigestRecipients();

  if (to.length === 0) {
    return { success: false, error: 'No recipients configured' };
  }

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `📡 The ACR Report — ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html: generateDigestHtml(date, content),
      text: generateDigestText(date, content),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
