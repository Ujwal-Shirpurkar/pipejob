import Anthropic from '@anthropic-ai/sdk';
import type { MasterCV, JDAnalysis } from '../../types/index';
import { config } from '../../config';
import logger from '../../logger';

const MODEL = 'claude-sonnet-4-20250514';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

export async function analyseJD(
  masterCV: MasterCV,
  rawJD: string,
  jobId: string
): Promise<JDAnalysis> {
  logger.info({ action: 'analyse_jd_start', jobId, model: MODEL });

  const systemPrompt = `You are a professional CV consultant. You will receive a master CV and a job description.
Return ONLY valid JSON with no markdown fences matching this exact schema:
{
  "jobId": string,
  "matchScore": number (0-100),
  "requiredKeywords": string[],
  "missingKeywords": string[],
  "suggestedSummary": string,
  "tailoredBullets": { [company: string]: string[] },
  "coverLetterDraft": string,
  "language": "en" | "de",
  "analysedAt": string (ISO timestamp)
}
Detect the job description language and respond with all text fields in the same language.`;

  const userPrompt = `Master CV:
${JSON.stringify(masterCV, null, 2)}

Job Description:
${rawJD}

Job ID: ${jobId}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const usage = response.usage;
  logger.info({
    action: 'analyse_jd_tokens',
    jobId,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in LLM response');
  }

  const cleaned = stripMarkdownFences(textContent.text);
  const analysis = JSON.parse(cleaned) as JDAnalysis;
  analysis.jobId = jobId;
  analysis.analysedAt = new Date().toISOString();

  logger.info({ action: 'analyse_jd_done', jobId, matchScore: analysis.matchScore });
  return analysis;
}
