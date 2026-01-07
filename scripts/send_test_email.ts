const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const Anthropic = require('@anthropic-ai/sdk').default;

const supabase = createClient('https://avksusadyirjolxljmbe.supabase.co', process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  const { data: digest } = await supabase.from('digests').select('*').eq('date', '2026-01-07').single();
  if (!digest) return console.log('No digest found');

  const content = digest.content;
  const allItems = [...(content.must_know || []), ...(content.worth_a_look || []), ...(content.quick_hits || [])];

  console.log('Generating executive summary...');
  const itemsList = allItems.slice(0, 10).map(i => `• ${i.title}: ${i.summary}`).join('\n');
  const summaryResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are writing the executive summary for ACR Electronics' daily intelligence briefing. ACR makes emergency beacons (EPIRBs, ELTs, PLBs) for aviation and maritime markets.

Write a single paragraph (3-4 sentences max) summarizing the key takeaways from today's news. Be direct, specific, and actionable. Focus on business implications for the emergency beacon industry.

Today's headlines:
${itemsList}

Write ONLY the summary paragraph, no intro or sign-off.`
    }]
  });

  const execSummary = summaryResponse.content[0].text.trim();

  const formatItem = (item: any) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
        <a href="${item.url}" style="color: #1a1a1a; text-decoration: none; font-weight: 600; font-size: 15px;">${item.title}</a>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 13px; line-height: 1.6;">${item.summary}</p>
        <p style="margin: 4px 0 0 0; color: #0066cc; font-size: 12px;">${item.why_it_matters}</p>
      </td>
    </tr>
  `;

  const formatSection = (title: string, emoji: string, items: any[]) => items.length === 0 ? '' : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr><td style="padding-bottom: 8px; border-bottom: 2px solid #1a1a1a;">
        <h2 style="margin: 0; font-size: 18px; color: #1a1a1a;">${emoji} ${title}</h2>
      </td></tr>
      ${items.map(formatItem).join('')}
    </table>
  `;

  const [year, month, day] = '2026-01-07'.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom: 20px; border-bottom: 3px solid #1a1a1a;">
          <h1 style="margin: 0; font-size: 24px;">📡 The ACR Report</h1>
          <p style="margin: 4px 0 0 0; color: #666;">${dateStr}</p>
        </td></tr>
        <tr><td style="padding: 16px 0; border-bottom: 1px solid #eee;">
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #333;">
            <strong>Today's Brief:</strong> ${execSummary}
          </p>
        </td></tr>
        <tr><td style="padding-top: 20px;">
          ${formatSection('Must Know', '🔴', content.must_know || [])}
          ${formatSection('Worth a Look', '🟡', content.worth_a_look || [])}
          ${formatSection('Quick Hits', '🔵', content.quick_hits || [])}
        </td></tr>
        <tr><td style="padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
          <p>The ACR Report — Industry intelligence for aerospace & marine safety</p>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  console.log('Sending ONLY to: youearnedit@gmail.com');
  const result = await resend.emails.send({
    from: 'ACR Intel Agent <acr-intel@mail.ipguy.co>',
    to: ['youearnedit@gmail.com'],
    subject: '📡 The ACR Report — Jan 7',
    html: html
  });

  console.log('Email sent:', result.data?.id || result.error);
}

main().catch(console.error);
