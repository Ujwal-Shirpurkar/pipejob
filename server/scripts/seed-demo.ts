/**
 * Seeds three fictional, clearly-labelled demo jobs with pre-computed evaluations and
 * rendered documents, so the dashboard can be explored without an API key or network.
 *
 *   npm run seed:demo
 *
 * Live runs replace this data naturally; demo jobs use `demo://` URLs and "(Demo)" company names.
 */
import path from 'path';
import { config } from '../src/config';
import { initDb } from '../src/db/database';
import { findByUrl, insertApplication, saveEvaluation, saveTailoring, setReviewRequest, updateApplicationStatus } from '../src/db/applications';
import { mergeSuggestedStories } from '../src/db/stories';
import { loadMasterCV, loadPreferences } from '../src/profile';
import { aggregateScore } from '../src/services/evaluation/scoring';
import type { EvaluationOutput, JobEvaluation, TailoredContent } from '../src/services/evaluation/schema';
import { enforceGrounding } from '../src/services/tailoring/grounding';
import { closePdfBrowser, renderPdf } from '../src/services/tailoring/pdf';
import { buildCoverLetterHtml, buildCVHtml } from '../src/services/tailoring/templates';

const dim = (score: number, evidence: string) => ({ score, evidence });

const JOBS: { id: string; title: string; company: string; location: string; jd: string; evaluation: EvaluationOutput; tailor: boolean }[] = [
  {
    id: 'demo-agentic-ai-working-student',
    title: 'Working Student – AI Agents & Automation (m/f/d)',
    company: 'Nordlicht AI (Demo)',
    location: 'Nuremberg · Hybrid',
    jd: `About us
Nordlicht AI builds AI agents that automate back-office workflows for mid-sized manufacturers.

Your tasks
- Build and evaluate LLM-powered agents that use tools and APIs to complete multi-step tasks
- Design prompts, tool schemas and evaluation sets together with our engineers
- Integrate agents with customer systems via REST APIs and workflow tools such as n8n
- Add logging and monitoring so every agent decision is traceable

Your profile
- Enrolled student in computer science, AI or a related field
- Solid Python or TypeScript skills; first experience with LLM APIs
- Curiosity about agent design, evaluation and human-in-the-loop systems
- Good English; German is a plus
- 16–20 hours per week during the semester

What we offer
Mentoring by senior engineers, flexible hours, €18/hour, hybrid work in Nuremberg.`,
    evaluation: {
      archetype: 'agentic_ai',
      roleSummary: {
        oneLiner: 'Part-time engineer building and evaluating tool-using LLM agents for workflow automation.',
        seniority: 'working_student',
        employmentType: 'Working student, 16–20 h/week',
        location: 'Nuremberg (hybrid)',
        remotePolicy: 'hybrid',
        languageRequirements: ['English (required)', 'German (plus)'],
        compensation: '€18/hour',
      },
      dimensions: {
        skills_match: dim(5, 'JD asks for Python/TypeScript and LLM APIs; CV shows both plus a RAG assistant in production and n8n automations.'),
        experience_level_fit: dim(5, 'Explicitly a working-student role; candidate is an enrolled M.Sc. AI student with prior working-student experience.'),
        role_alignment: dim(5, 'Agent building and evaluation is exactly the target archetype (agentic_ai).'),
        location_fit: dim(5, 'Hybrid in Nuremberg, where the candidate lives; English is sufficient.'),
        growth_potential: dim(4, 'Mentoring by senior engineers and ownership of evaluation work; small company so scope is broad.'),
        company_signal: dim(3, 'Clear product focus but little information about funding or team size.'),
        compensation_fit: dim(5, '€18/hour sits inside the €16–20 expectation.'),
        legitimacy: dim(5, 'Specific tasks, realistic requirements, stated pay and hours.'),
      },
      strengths: ['Built a production RAG assistant used daily by a support team', 'n8n automation experience matches the integration work', 'PipeJob project demonstrates agent loops, tool schemas and observability'],
      gaps: ['No formal experience building evaluation sets at scale', 'German is only a plus, but customer integrations may involve German-speaking clients'],
      redFlags: [],
      dealBreakersHit: [],
      requiredKeywords: ['LLM', 'agents', 'Python', 'TypeScript', 'REST APIs', 'n8n', 'evaluation', 'logging'],
      missingKeywords: [],
      recommendation: 'apply',
      rationale: 'An unusually direct match: the role is the candidate’s target archetype at the right level, in their city, at the expected pay. Lead with the RAG assistant and the agent-observability work from PipeJob.',
      interviewPrep: {
        likelyQuestions: [
          'Walk us through how you would design tools for an agent that files purchase orders.',
          'How do you evaluate whether an agent is getting better?',
          'Tell us about a time an automation you built failed in production.',
        ],
        talkingPoints: ['Human-in-the-loop checkpoints and budgets as safety rails', 'Structured outputs instead of parsing free text', 'Tracing every tool call for debugging'],
        stories: [
          {
            title: 'Shipping a RAG assistant the support team actually uses',
            situation: 'Support agents searched 2,000+ articles manually for every ticket.',
            task: 'Build an internal Q&A assistant as a working student.',
            action: 'Implemented retrieval-augmented generation over the article base, iterated on retrieval quality with the team and added structured logging.',
            result: 'The assistant became part of the support team’s daily workflow.',
            reflection: 'I would build a small evaluation set on day one instead of relying on anecdotal feedback.',
            tags: ['llm', 'ownership', 'stakeholders'],
          },
          {
            title: 'Automating weekly reporting with n8n',
            situation: 'Operations compiled weekly reports by hand.',
            task: 'Remove the manual work without adding maintenance burden.',
            action: 'Built Python scripts orchestrated by n8n workflows with clear failure alerts.',
            result: 'Saved the operations team about 4 hours per week.',
            reflection: 'Explicit failure notifications mattered as much as the automation itself.',
            tags: ['automation', 'impact'],
          },
        ],
      },
      questionsToAsk: ['How do you currently evaluate agent quality before a customer rollout?', 'What would success look like after my first three months?'],
      language: 'en',
    },
    tailor: true,
  },
  {
    id: 'demo-ml-intern-munich',
    title: 'Machine Learning Intern – Computer Vision',
    company: 'Alpenblick Robotics (Demo)',
    location: 'Munich · On-site',
    jd: `We are looking for a 6-month full-time intern to improve perception models for our warehouse robots.
- Train and evaluate object-detection models in PyTorch
- Work with large image datasets and labelling pipelines
- Deploy models to edge devices (C++, TensorRT)
Requirements: enrolled student, strong PyTorch, experience with CNNs/transformers for vision, C++ is a plus.
Full-time on-site in Munich, 6 months, €2,000/month.`,
    evaluation: {
      archetype: 'ml_engineering',
      roleSummary: { oneLiner: 'Full-time 6-month internship training vision models for robots.', seniority: 'intern', employmentType: 'Internship, full-time, 6 months', location: 'Munich (on-site)', remotePolicy: 'onsite', languageRequirements: ['English'], compensation: '€2,000/month' },
      dimensions: {
        skills_match: dim(3, 'PyTorch experience exists, but no computer-vision or edge-deployment work in the CV.'),
        experience_level_fit: dim(4, 'Internship for enrolled students fits the candidate’s level.'),
        role_alignment: dim(2, 'Computer vision is outside the agentic/LLM target archetypes.'),
        location_fit: dim(2, 'Full-time on-site in Munich conflicts with studying in Nuremberg.'),
        growth_potential: dim(4, 'Hands-on model training and deployment.'),
        company_signal: dim(4, 'Concrete product and deployment environment.'),
        compensation_fit: dim(4, 'Reasonable for a full-time internship.'),
        legitimacy: dim(5, 'Specific and realistic posting.'),
      },
      strengths: ['PyTorch baselines from the ML lab', 'Data-cleaning pipeline experience'],
      gaps: ['No computer-vision projects', 'No C++ / TensorRT experience', 'Full-time on-site does not fit the study schedule'],
      redFlags: [],
      dealBreakersHit: [],
      requiredKeywords: ['PyTorch', 'computer vision', 'object detection', 'C++', 'TensorRT'],
      missingKeywords: ['computer vision', 'object detection', 'C++', 'TensorRT'],
      recommendation: 'consider',
      rationale: 'A solid internship, but it pulls away from the agentic-AI focus and requires relocating to full-time on-site work. Worth it only as a semester-break option.',
      interviewPrep: { likelyQuestions: ['How would you debug a model that performs well offline but poorly on the robot?'], talkingPoints: ['Benchmarking discipline from the ML lab'], stories: [] },
      questionsToAsk: ['Is a part-time extension after the internship possible?'],
      language: 'en',
    },
    tailor: false,
  },
  {
    id: 'demo-senior-ai-lead',
    title: 'Lead AI Engineer (Staff level)',
    company: 'Quanta Systems (Demo)',
    location: 'Berlin',
    jd: `Lead our AI platform team of 8 engineers. You have 8+ years of software engineering experience, 3+ years leading teams, and have shipped LLM systems to millions of users. Native German required for client work.`,
    evaluation: {
      archetype: 'agentic_ai',
      roleSummary: { oneLiner: 'Staff-level leadership role for an AI platform team.', seniority: 'lead', employmentType: 'Full-time', location: 'Berlin', remotePolicy: 'unknown', languageRequirements: ['German (native)'], compensation: '' },
      dimensions: {
        skills_match: dim(3, 'LLM topics overlap, but at a far larger scale than the CV shows.'),
        experience_level_fit: dim(1, 'Requires 8+ years and team leadership; candidate is a student.'),
        role_alignment: dim(4, 'The domain matches, the level does not.'),
        location_fit: dim(3, 'Berlin; native German is required (candidate is a native speaker).'),
        growth_potential: dim(3, 'Not applicable at this level.'),
        company_signal: dim(3, 'Little information in the posting.'),
        compensation_fit: dim(3, 'Not stated.'),
        legitimacy: dim(4, 'Short but plausible.'),
      },
      strengths: ['Relevant LLM domain knowledge'],
      gaps: ['8+ years of experience required', 'No people-management experience'],
      redFlags: [],
      dealBreakersHit: ['Requires 3+ years of full-time professional experience'],
      requiredKeywords: ['leadership', 'LLM', 'platform'],
      missingKeywords: ['leadership'],
      recommendation: 'skip',
      rationale: 'A clear seniority mismatch that triggers a deal-breaker. Not worth an application.',
      interviewPrep: { likelyQuestions: [], talkingPoints: [], stories: [] },
      questionsToAsk: [],
      language: 'en',
    },
    tailor: false,
  },
];

async function main() {
  initDb(config.dbPath);
  const cv = loadMasterCV();
  const prefs = loadPreferences();

  for (const demo of JOBS) {
    const url = `demo://${demo.id}`;
    if (findByUrl(url)) {
      console.log(`• ${demo.company} already seeded`);
      continue;
    }
    insertApplication({
      id: demo.id,
      title: demo.title,
      company: demo.company,
      location: demo.location,
      url,
      source: 'manual',
      rawJD: demo.jd,
      remote: demo.evaluation.roleSummary.remotePolicy === 'remote',
      discoveredAt: new Date().toISOString(),
      status: 'discovered',
    });

    const scored = aggregateScore(demo.evaluation, prefs.scoringWeights);
    const evaluation: JobEvaluation = {
      ...demo.evaluation,
      dimensions: scored.dimensions,
      overallScore: scored.overallScore,
      grade: scored.grade,
      gradeCap: scored.gradeCap,
      weightsUsed: scored.weightsUsed,
      model: 'demo-fixture',
      promptVersion: 'demo',
      evaluatedAt: new Date().toISOString(),
    };
    saveEvaluation(demo.id, evaluation);
    mergeSuggestedStories(evaluation.interviewPrep.stories.map((s) => ({ ...s, sourceJobId: demo.id })));
    updateApplicationStatus(demo.id, 'evaluated', `Grade ${evaluation.grade} (${evaluation.overallScore.toFixed(2)}/5) — demo fixture`, 'system');

    if (demo.tailor) {
      const { content, warnings } = enforceGrounding(
        {
          headline: 'AI Engineering Working Student · Agents & Automation',
          summary:
            'Master’s student in Artificial Intelligence who builds LLM-powered tools that people use every day — from a retrieval-augmented support assistant to n8n automations and a tool-using career agent. Focused on reliable, observable agents with humans in the loop.',
          skills: ['Agentic workflows', 'LLM APIs (Claude, tool use, structured outputs)', 'Python', 'TypeScript', 'n8n', 'REST APIs', 'Retrieval-Augmented Generation', 'Prompt engineering'],
          experience: [
            {
              company: 'Datalytics Solutions GmbH',
              bullets: [
                'Built a retrieval-augmented Q&A assistant over 2,000+ support articles, now part of the support team’s daily workflow.',
                'Automated weekly reporting with Python and n8n workflows, saving operations about 4 hours per week.',
                'Added structured logging and integration tests, making production issues faster to diagnose.',
              ],
            },
          ],
          projects: ['PipeJob – Agentic Career Assistant', 'Browser Research Agent', 'Lecture-Notes RAG Tutor'],
          coverLetter: {
            greeting: 'Dear Nordlicht AI team,',
            paragraphs: [
              'Agents that finish real back-office work — with every decision traceable — are exactly what I want to build, and your working-student role describes the work I have been teaching myself on evenings and weekends.',
              'At Datalytics I built a retrieval-augmented assistant over more than 2,000 support articles that the support team now uses every day, and I replaced a manual weekly report with Python and n8n workflows that save the operations team about 4 hours per week. Both taught me that adoption depends on reliability and clear failure signals as much as on model quality.',
              'In my own project, PipeJob, I designed a tool-using Claude agent with typed tool schemas, per-run budgets, structured outputs and a full trace of every tool call — and deliberately kept a human approval step before anything leaves the system. I would love to bring that mindset to your agent evaluation and integration work.',
              'I can work 16–20 hours per week during the semester in Nuremberg and am happy to discuss how I can contribute from day one.',
            ],
            closing: 'Kind regards,',
          },
          keywordsCovered: ['LLM', 'agents', 'Python', 'TypeScript', 'n8n', 'REST APIs', 'logging'],
          honestyNotes: ['No experience building large evaluation sets yet — mention the 100-question eval from the RAG tutor as a starting point.'],
        },
        cv,
        demo.jd
      );
      const tailoring: TailoredContent = { ...content, groundingWarnings: warnings, model: 'demo-fixture', promptVersion: 'demo', tailoredAt: new Date().toISOString() };
      const dir = path.join(path.resolve(config.outputDir), demo.id);
      const cvPath = path.join(dir, 'cv.pdf');
      const coverLetterPath = path.join(dir, 'cover-letter.pdf');
      await renderPdf(buildCVHtml(cv, tailoring, evaluation), cvPath);
      await renderPdf(buildCoverLetterHtml(cv, tailoring, demo.company, demo.title, 'en'), coverLetterPath);
      saveTailoring(demo.id, tailoring, { jobId: demo.id, cvPath, coverLetterPath, generatedAt: new Date().toISOString(), llmModel: 'demo-fixture', promptVersion: 'demo' });
      updateApplicationStatus(demo.id, 'documents_ready', 'Tailored CV & cover letter generated — demo fixture', 'system');
      setReviewRequest(demo.id, true, 'Direct match for the agentic-AI target at the right level, in Nuremberg, at the expected pay. Lead with the RAG assistant.');
    } else if (demo.evaluation.recommendation === 'skip') {
      updateApplicationStatus(demo.id, 'skipped', demo.evaluation.rationale, 'agent');
    }

    console.log(`✓ ${demo.company}: grade ${evaluation.grade} (${evaluation.overallScore.toFixed(2)})${evaluation.gradeCap ? ` — capped: ${evaluation.gradeCap}` : ''}`);
  }

  await closePdfBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
