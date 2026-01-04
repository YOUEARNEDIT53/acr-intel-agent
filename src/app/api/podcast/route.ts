import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export const maxDuration = 300; // 5 minutes for podcast generation

export async function POST(request: NextRequest) {
  // Verify cron secret for automated calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = authHeader?.startsWith('Bearer ');

  if (isCronCall && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the project root directory
    const projectRoot = process.cwd();
    const venvPython = path.join(projectRoot, 'podcast-venv', 'bin', 'python');
    const scriptPath = path.join(projectRoot, 'scripts', 'generate_podcast.py');

    // Run the podcast generation script
    const { stdout, stderr } = await execAsync(
      `${venvPython} ${scriptPath}`,
      {
        cwd: projectRoot,
        timeout: 280000, // 4.5 minutes
        env: {
          ...process.env,
          PATH: `${path.join(projectRoot, 'bin')}:${process.env.PATH}`,
        },
      }
    );

    console.log('Podcast generation output:', stdout);
    if (stderr) {
      console.error('Podcast generation stderr:', stderr);
    }

    // Check if podcast was generated successfully
    const success = stdout.includes('Podcast generation complete');

    return NextResponse.json({
      success,
      message: success ? 'Podcast generated and sent' : 'Podcast generation failed',
      output: stdout.slice(-1000), // Last 1000 chars of output
    });
  } catch (error) {
    console.error('Podcast generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate podcast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
