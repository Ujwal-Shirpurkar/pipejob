import type { MasterCV, JDAnalysis } from '../../../types/index';

export function buildCVHtml(masterCV: MasterCV, analysis: JDAnalysis): string {
  const requiredSet = new Set(analysis.requiredKeywords.map((k) => k.toLowerCase()));

  function highlightSkill(skill: string): string {
    return requiredSet.has(skill.toLowerCase())
      ? `<span class="skill skill-match">${esc(skill)}</span>`
      : `<span class="skill">${esc(skill)}</span>`;
  }

  const experienceHtml = masterCV.experience.map((exp) => {
    const bullets = (analysis.tailoredBullets[exp.company] ?? exp.bullets)
      .filter(Boolean)
      .map((b) => `<li>${esc(b)}</li>`)
      .join('');
    const endDate = exp.endDate ?? 'Present';
    return `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-title">${esc(exp.role)}</span>
          <span class="entry-sub">${esc(exp.company)}</span>
          <span class="entry-date">${esc(exp.startDate)} – ${esc(endDate)}</span>
        </div>
        <ul class="bullets">${bullets}</ul>
      </div>`;
  }).join('');

  const educationHtml = masterCV.education.map((edu) => {
    const endDate = edu.endDate ?? 'Present';
    const gpa = edu.gpa ? `<span class="entry-sub">GPA: ${esc(edu.gpa)}</span>` : '';
    return `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-title">${esc(edu.degree)} in ${esc(edu.field)}</span>
          <span class="entry-sub">${esc(edu.institution)}</span>
          <span class="entry-date">${esc(edu.startDate)} – ${esc(endDate)}</span>
        </div>
        ${gpa}
      </div>`;
  }).join('');

  const languagesHtml = masterCV.languages
    .map((l) => `<span class="lang-item"><strong>${esc(l.language)}</strong>: ${esc(l.level)}</span>`)
    .join(' &nbsp;|&nbsp; ');

  const contactParts = [
    masterCV.email,
    masterCV.phone,
    masterCV.location,
    masterCV.linkedin,
    masterCV.github,
  ].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 10.5pt;
    color: #1a1a1a;
    background: #fff;
    padding: 32px 44px;
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.45;
  }
  .name {
    font-size: 22pt;
    font-weight: bold;
    letter-spacing: 0.02em;
    text-align: center;
    margin-bottom: 4px;
  }
  .contact {
    text-align: center;
    font-size: 9pt;
    color: #444;
    margin-bottom: 18px;
  }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1.5px solid #1a1a1a;
    padding-bottom: 2px;
    margin: 16px 0 8px;
  }
  .summary-text { font-size: 10pt; line-height: 1.55; color: #222; }
  .skills-row { display: flex; flex-wrap: wrap; gap: 5px; }
  .skill {
    font-size: 9.5pt;
    background: #f0f0f0;
    border-radius: 3px;
    padding: 2px 7px;
    color: #333;
  }
  .skill-match {
    background: #dbeafe;
    color: #1e40af;
    font-weight: 600;
  }
  .entry { margin-bottom: 10px; }
  .entry-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-bottom: 3px; }
  .entry-title { font-weight: bold; font-size: 10.5pt; }
  .entry-sub { color: #555; font-size: 9.5pt; }
  .entry-date { margin-left: auto; font-size: 9pt; color: #666; font-style: italic; }
  .bullets { list-style: disc; padding-left: 18px; }
  .bullets li { font-size: 9.5pt; color: #222; margin-bottom: 2px; }
  .lang-item { font-size: 9.5pt; }
  @page { size: A4; margin: 20mm 15mm; }
  @media print {
    body { padding: 0; }
    .skill-match { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="name">${esc(masterCV.fullName)}</div>
  <div class="contact">${contactParts}</div>

  <div class="section-title">Summary</div>
  <p class="summary-text">${esc(analysis.suggestedSummary)}</p>

  <div class="section-title">Skills</div>
  <div class="skills-row">${masterCV.skills.map(highlightSkill).join('')}</div>

  <div class="section-title">Experience</div>
  ${experienceHtml}

  <div class="section-title">Education</div>
  ${educationHtml}

  <div class="section-title">Languages</div>
  <p>${languagesHtml}</p>
</body>
</html>`;
}

export function buildCoverLetterHtml(masterCV: MasterCV, analysis: JDAnalysis): string {
  const contactParts = [masterCV.email, masterCV.phone, masterCV.location]
    .filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  const paragraphs = analysis.coverLetterDraft
    .split('\n\n')
    .filter(Boolean)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: #fff;
    padding: 40px 52px;
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.65;
  }
  .sender-name { font-size: 16pt; font-weight: bold; margin-bottom: 4px; }
  .sender-contact { font-size: 9.5pt; color: #555; margin-bottom: 32px; }
  p { margin-bottom: 14px; font-size: 11pt; }
  @page { size: A4; margin: 25mm 20mm; }
</style>
</head>
<body>
  <div class="sender-name">${esc(masterCV.fullName)}</div>
  <div class="sender-contact">${contactParts}</div>
  ${paragraphs}
</body>
</html>`;
}

function esc(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
