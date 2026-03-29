import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import fs from 'fs';
import path from 'path';
import type { MasterCV, JDAnalysis, TailoredOutput } from '../../types/index';
import logger from '../../logger';

const MODEL = 'claude-sonnet-4-20250514';
const PROMPT_VERSION = '1.0';

function bold(text: string): TextRun {
  return new TextRun({ text, bold: true });
}

function plain(text: string): TextRun {
  return new TextRun({ text });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
    spacing: { before: 240, after: 120 },
  });
}

function buildCV(masterCV: MasterCV, analysis: JDAnalysis): Document {
  const requiredSet = new Set(analysis.requiredKeywords.map((k) => k.toLowerCase()));

  const paragraphs: Paragraph[] = [
    // Header
    new Paragraph({
      children: [bold(masterCV.fullName)],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        plain(`${masterCV.email} | ${masterCV.phone} | ${masterCV.location}`),
        plain(` | ${masterCV.linkedin}`),
        ...(masterCV.github ? [plain(` | ${masterCV.github}`)] : []),
      ],
      alignment: AlignmentType.CENTER,
    }),

    // Summary
    sectionHeading('Summary'),
    new Paragraph({ children: [plain(analysis.suggestedSummary)] }),

    // Skills
    sectionHeading('Skills'),
    new Paragraph({
      children: masterCV.skills.flatMap((skill, i) => {
        const isHighlighted = requiredSet.has(skill.toLowerCase());
        const separator = i < masterCV.skills.length - 1 ? plain(' • ') : plain('');
        return [isHighlighted ? bold(skill) : plain(skill), separator];
      }),
    }),

    // Experience
    sectionHeading('Experience'),
    ...masterCV.experience.flatMap((exp) => {
      const tailored = analysis.tailoredBullets[exp.company] ?? exp.bullets;
      const dateRange = `${exp.startDate} – ${exp.endDate ?? 'Present'}`;
      return [
        new Paragraph({
          children: [bold(`${exp.role} at ${exp.company}`), plain(`  ${dateRange}`)],
          spacing: { before: 160 },
        }),
        ...tailored.map((bullet) => new Paragraph({ text: `• ${bullet}`, indent: { left: 360 } })),
      ];
    }),

    // Education
    sectionHeading('Education'),
    ...masterCV.education.flatMap((edu) => {
      const dateRange = `${edu.startDate} – ${edu.endDate ?? 'Present'}`;
      return [
        new Paragraph({
          children: [
            bold(`${edu.degree} in ${edu.field}`),
            plain(` – ${edu.institution}  ${dateRange}`),
            ...(edu.gpa ? [plain(`  GPA: ${edu.gpa}`)] : []),
          ],
          spacing: { before: 160 },
        }),
      ];
    }),

    // Languages
    sectionHeading('Languages'),
    new Paragraph({
      children: masterCV.languages.flatMap((l, i) => {
        const sep = i < masterCV.languages.length - 1 ? plain(' | ') : plain('');
        return [bold(l.language), plain(`: ${l.level}`), sep];
      }),
    }),
  ];

  return new Document({ sections: [{ children: paragraphs }] });
}

function buildCoverLetter(draft: string, masterCV: MasterCV): Document {
  const paragraphs = draft.split('\n\n').map(
    (para) => new Paragraph({ children: [plain(para.trim())], spacing: { after: 200 } })
  );

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [bold(masterCV.fullName)],
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [plain(`${masterCV.email} | ${masterCV.phone}`)],
            spacing: { after: 400 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });
}

export async function generateDocuments(
  masterCV: MasterCV,
  analysis: JDAnalysis,
  outputDir: string
): Promise<TailoredOutput> {
  const jobOutputDir = path.join(outputDir, analysis.jobId);
  if (!fs.existsSync(jobOutputDir)) {
    fs.mkdirSync(jobOutputDir, { recursive: true });
  }

  const cvPath = path.join(jobOutputDir, 'cv.docx');
  const coverLetterPath = path.join(jobOutputDir, 'cover-letter.docx');

  logger.info({ action: 'generate_documents_start', jobId: analysis.jobId });

  const cvDoc = buildCV(masterCV, analysis);
  const cvBuffer = await Packer.toBuffer(cvDoc);
  fs.writeFileSync(cvPath, cvBuffer);

  const clDoc = buildCoverLetter(analysis.coverLetterDraft, masterCV);
  const clBuffer = await Packer.toBuffer(clDoc);
  fs.writeFileSync(coverLetterPath, clBuffer);

  const output: TailoredOutput = {
    jobId: analysis.jobId,
    cvPath,
    coverLetterPath,
    generatedAt: new Date().toISOString(),
    llmModel: MODEL,
    promptVersion: PROMPT_VERSION,
  };

  logger.info({ action: 'generate_documents_done', jobId: analysis.jobId, cvPath, coverLetterPath });
  return output;
}
