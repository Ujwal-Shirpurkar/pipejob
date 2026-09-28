import type { MasterCV } from '../../types/index';
import type { JobEvaluation, TailoredContent } from '../evaluation/schema';

// Visual language adapted from the "Data Science / Tech Resume" Overleaf template in /cvtemplate
// (TLCresume.sty): highlight colour, three-column header, small-caps ruled section titles.
// Plain semantic HTML with real text keeps the PDF ATS-parseable.
const HIGHLIGHT = '#3d5a80';

function esc(str: string | undefined | null): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function link(url: string | undefined): string {
  if (!url) return '';
  return `<a href="${esc(url)}">${esc(stripProtocol(url))}</a>`;
}

const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', 'Source Sans Pro', 'Segoe UI', Arial, sans-serif; color: #1f2328; font-size: 10pt; line-height: 1.35; }
  a { color: ${HIGHLIGHT}; text-decoration: none; }
  .header { display: grid; grid-template-columns: 1.2fr 1.5fr 1.2fr; gap: 8px; align-items: center; padding-bottom: 8px; border-bottom: 1.5px solid ${HIGHLIGHT}; margin-bottom: 8px; }
  .header .left { font-size: 9pt; line-height: 1.45; }
  .header .right { font-size: 9pt; line-height: 1.45; text-align: right; white-space: nowrap; }
  .header .center { text-align: center; }
  .name { font-size: 22pt; font-weight: 700; letter-spacing: 0.01em; }
  .headline { color: ${HIGHLIGHT}; font-size: 12pt; margin-top: 2px; }
`;

export function buildCVHtml(cv: MasterCV, tailored: TailoredContent, evaluation?: JobEvaluation): string {
  const required = new Set((evaluation?.requiredKeywords ?? []).map((k) => k.toLowerCase()));
  const bulletsByCompany = new Map(tailored.experience.map((e) => [e.company, e.bullets]));
  const projectsByName = new Map((cv.projects ?? []).map((p) => [p.name, p]));

  const skills = tailored.skills
    .map((s) => (required.has(s.toLowerCase()) ? `<strong>${esc(s)}</strong>` : esc(s)))
    .join(', ');

  const experienceHtml = cv.experience
    .map((exp) => {
      const bullets = (bulletsByCompany.get(exp.company) ?? exp.bullets).filter(Boolean);
      return `
      <div class="entry">
        <div class="row"><span class="role">${esc(exp.role)}</span><span class="date">${esc(exp.startDate)} – ${esc(exp.endDate ?? 'Present')}</span></div>
        <div class="row sub"><span>${esc(exp.company)}</span><span>${esc(exp.location)}</span></div>
        <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      </div>`;
    })
    .join('');

  const projects = tailored.projects.map((name) => projectsByName.get(name)).filter((p) => p !== undefined);
  const projectsHtml = projects.length
    ? `<h2>Projects</h2>${projects
        .map(
          (p) => `
      <div class="entry">
        <div class="row"><span class="role">${esc(p.name)}</span><span class="date">${p.url ? link(p.url) : ''}</span></div>
        <div class="project-desc">${esc(p.description)}</div>
        <div class="tech">${p.tech.map(esc).join(' · ')}</div>
      </div>`
        )
        .join('')}`
    : '';

  const educationHtml = cv.education
    .map(
      (edu) => `
      <div class="entry edu">
        <div class="row"><span><strong>${esc(edu.degree)} in ${esc(edu.field)}</strong>, <em>${esc(edu.institution)}</em></span><span class="date">${esc(edu.startDate)} – ${esc(edu.endDate ?? 'Present')}</span></div>
        ${edu.gpa ? `<div class="sub">Grade: ${esc(edu.gpa)}</div>` : ''}
      </div>`
    )
    .join('');

  const languages = cv.languages.map((l) => `${esc(l.language)} (${esc(l.level)})`).join(', ');

  return `<!DOCTYPE html>
<html lang="${evaluation?.language ?? 'en'}">
<head>
<meta charset="UTF-8"/>
<title>${esc(cv.fullName)} — CV</title>
<style>
  ${baseStyles}
  h2 { color: ${HIGHLIGHT}; font-variant: small-caps; font-weight: 600; font-size: 13pt; letter-spacing: 0.02em; border-bottom: 0.75px solid #9aa5b1; margin: 10px 0 5px; padding-bottom: 1px; }
  .summary { font-size: 10pt; }
  .skills-table { display: grid; grid-template-columns: 8.5em 1fr; row-gap: 3px; }
  .skills-table .label { font-weight: 700; }
  .entry { margin-bottom: 6px; break-inside: avoid; }
  .row { display: flex; justify-content: space-between; gap: 12px; }
  .role { font-weight: 700; }
  .date { white-space: nowrap; font-size: 9.5pt; }
  .sub { font-style: italic; font-size: 9.5pt; color: #3b434b; }
  ul { padding-left: 1.1em; margin-top: 2px; }
  li { margin-bottom: 1px; }
  .project-desc { font-size: 9.5pt; }
  .tech { font-size: 9pt; color: ${HIGHLIGHT}; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">${esc(cv.phone)}<br/>${esc(cv.location)}<br/><a href="mailto:${esc(cv.email)}">${esc(cv.email)}</a></div>
    <div class="center">
      <div class="name">${esc(cv.fullName)}</div>
      <div class="headline">${esc(tailored.headline || cv.headline)}</div>
    </div>
    <div class="right">${[cv.website, cv.github, cv.linkedin].filter(Boolean).map(link).join('<br/>')}</div>
  </div>

  <p class="summary">${esc(tailored.summary)}</p>

  <h2>Skills</h2>
  <div class="skills-table">
    <span class="label">Technical</span><span>${skills}</span>
    <span class="label">Languages</span><span>${languages}</span>
    ${cv.certifications?.length ? `<span class="label">Certifications</span><span>${cv.certifications.map(esc).join(', ')}</span>` : ''}
  </div>

  <h2>Experience</h2>
  ${experienceHtml}

  ${projectsHtml}

  <h2>Education</h2>
  ${educationHtml}
</body>
</html>`;
}

export function buildCoverLetterHtml(cv: MasterCV, tailored: TailoredContent, company: string, jobTitle: string, lang = 'en'): string {
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const subject = lang === 'de' ? `Bewerbung als ${jobTitle}` : `Application: ${jobTitle}`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>${esc(cv.fullName)} — Cover letter</title>
<style>
  ${baseStyles}
  body { font-size: 10.5pt; line-height: 1.55; }
  .meta { display: flex; justify-content: space-between; margin: 18px 0 14px; font-size: 10pt; }
  .subject { font-weight: 700; margin-bottom: 12px; }
  p { margin-bottom: 10px; }
  .closing { margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">${esc(cv.phone)}<br/>${esc(cv.location)}<br/><a href="mailto:${esc(cv.email)}">${esc(cv.email)}</a></div>
    <div class="center">
      <div class="name">${esc(cv.fullName)}</div>
      <div class="headline">${esc(tailored.headline || cv.headline)}</div>
    </div>
    <div class="right">${[cv.website, cv.github, cv.linkedin].filter(Boolean).map(link).join('<br/>')}</div>
  </div>
  <div class="meta"><span>${esc(company)}</span><span>${esc(date)}</span></div>
  <div class="subject">${esc(subject)}</div>
  <p>${esc(tailored.coverLetter.greeting)}</p>
  ${tailored.coverLetter.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n  ')}
  <p class="closing">${esc(tailored.coverLetter.closing)}<br/><br/>${esc(cv.fullName)}</p>
</body>
</html>`;
}
