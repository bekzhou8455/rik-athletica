import type { TrainingSession } from './types.ts';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

async function callClaudeVision(
  apiKey: string,
  fileBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<string> {
  const base64Data = fileBuffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  return data.content[0]?.text || '';
}

async function callClaudeText(apiKey: string, prompt: string, content: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${content}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  return data.content[0]?.text || '';
}

async function callClaudePDF(apiKey: string, fileBuffer: Buffer, prompt: string): Promise<string> {
  const base64Data = fileBuffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { content: { type: string; text: string }[] };
  return data.content[0]?.text || '';
}

const PARSE_TRAINING_PROMPT = `Extract all training sessions from this document and return them as a JSON array.

Each session should have these exact fields:
- date: ISO date string (YYYY-MM-DD). If no year, use today's year. If no date at all, use consecutive dates starting from next Monday.
- type: one of "swim", "bike", "run", "brick", "rest"
- duration: number in minutes (convert hours to minutes if needed)
- intensity: one of "easy", "moderate", "hard", "race-sim"
- description: brief description of the session (1-2 sentences)

Rules:
- For brick sessions (bike+run combination), use type "brick"
- For rest/recovery/off days, use type "rest" with duration 0
- If intensity is not specified, infer from context (long steady = easy/moderate, intervals = hard, race pace = race-sim)
- If duration is not specified, estimate based on context (e.g. "long run" = 90 minutes, "recovery swim" = 30 minutes)
- This may be a screenshot, export, PDF, or text file from TrainingPeaks, Garmin, Final Surge, or a coach — extract whatever sessions are visible

Return ONLY the JSON array, no other text. Example format:
[
  {"date": "2026-04-07", "type": "bike", "duration": 180, "intensity": "moderate", "description": "Long aerobic ride, zone 2"},
  {"date": "2026-04-08", "type": "run", "duration": 45, "intensity": "easy", "description": "Recovery run"}
]`;

function parseSimpleCSV(text: string): TrainingSession[] {
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const hasDate = header.includes('date');
  const hasType = header.includes('type');
  const hasDuration = header.includes('duration');
  const hasIntensity = header.includes('intensity');
  const hasDescription = header.includes('description') || header.includes('notes');

  const sessions: TrainingSession[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    let date = '';
    let type: TrainingSession['type'] = 'run';
    let duration = 60;
    let intensity: TrainingSession['intensity'] = 'moderate';
    let description = '';

    if (hasDate) {
      const dateIdx = header.split(',').findIndex(h => h.includes('date'));
      date = cols[dateIdx] || '';
    }
    if (hasType) {
      const typeIdx = header.split(',').findIndex(h => h.includes('type'));
      const rawType = (cols[typeIdx] || '').toLowerCase();
      if (['swim', 'bike', 'run', 'brick', 'rest'].includes(rawType)) {
        type = rawType as TrainingSession['type'];
      }
    }
    if (hasDuration) {
      const durIdx = header.split(',').findIndex(h => h.includes('duration'));
      duration = parseFloat(cols[durIdx]) || 60;
    }
    if (hasIntensity) {
      const intIdx = header.split(',').findIndex(h => h.includes('intensity'));
      const rawInt = (cols[intIdx] || '').toLowerCase();
      if (['easy', 'moderate', 'hard', 'race-sim'].includes(rawInt)) {
        intensity = rawInt as TrainingSession['intensity'];
      }
    }
    if (hasDescription) {
      const descIdx = header.split(',').findIndex(h => h.includes('description') || h.includes('notes'));
      description = cols[descIdx] || '';
    }

    if (date || type) {
      sessions.push({ date, type, duration, intensity, description });
    }
  }

  return sessions;
}

function extractJSONFromText(text: string): TrainingSession[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Claude response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error('Claude response is not an array');
    }

    return parsed.map((item: Record<string, unknown>) => ({
      date: String(item.date || ''),
      type: (['swim', 'bike', 'run', 'brick', 'rest'].includes(String(item.type)))
        ? (item.type as TrainingSession['type'])
        : 'run',
      duration: Number(item.duration) || 60,
      intensity: (['easy', 'moderate', 'hard', 'race-sim'].includes(String(item.intensity)))
        ? (item.intensity as TrainingSession['intensity'])
        : 'moderate',
      description: String(item.description || ''),
    }));
  } catch (e) {
    throw new Error(`Failed to parse JSON from Claude response: ${(e as Error).message}`);
  }
}

// Strip binary noise from DOCX/XLSX/XML buffers to get readable text
function extractReadableText(fileBuffer: Buffer): string {
  const raw = fileBuffer.toString('utf-8');
  // Strip XML/HTML tags and non-printable chars, keep words and whitespace
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim();
}

export async function parseTrainingPlan(
  apiKey: string,
  fileBuffer: Buffer,
  filename: string
): Promise<TrainingSession[]> {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // PDF
  if (ext === 'pdf') {
    const text = await callClaudePDF(apiKey, fileBuffer, PARSE_TRAINING_PROMPT);
    return extractJSONFromText(text);
  }

  // Images (screenshots, scans)
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'tiff', 'bmp'].includes(ext)) {
    const mimeTypes: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
      tiff: 'image/tiff', bmp: 'image/bmp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';
    const text = await callClaudeVision(apiKey, fileBuffer, mimeType, PARSE_TRAINING_PROMPT);
    return extractJSONFromText(text);
  }

  // CSV — try direct parse first, fall back to Claude
  if (ext === 'csv') {
    const text = fileBuffer.toString('utf-8');
    const sessions = parseSimpleCSV(text);
    if (sessions.length > 0) return sessions;
    const claudeResponse = await callClaudeText(apiKey, PARSE_TRAINING_PROMPT, text);
    return extractJSONFromText(claudeResponse);
  }

  // Plain text, markdown
  if (['txt', 'text', 'md'].includes(ext)) {
    const text = fileBuffer.toString('utf-8');
    const claudeResponse = await callClaudeText(apiKey, PARSE_TRAINING_PROMPT, text);
    return extractJSONFromText(claudeResponse);
  }

  // DOCX, XLSX, XML, or anything else — extract readable text and send to Claude
  const readable = extractReadableText(fileBuffer);
  if (readable.length < 20) {
    throw new Error(`Could not extract readable content from "${filename}". Try exporting as PDF or CSV instead.`);
  }
  const claudeResponse = await callClaudeText(
    apiKey,
    PARSE_TRAINING_PROMPT + `\n\n(Note: this was extracted from a ${ext.toUpperCase()} file — some formatting may be lost)`,
    readable
  );
  return extractJSONFromText(claudeResponse);
}
