import { describe, expect, it } from 'vitest';
import { htmlToText } from './html';
import { extractJsonLdJob, parseAtsUrl } from './importer';
import type { Posting } from './providers';
import { matchesLocation, scorePosting } from './search';

function posting(overrides: Partial<Posting> = {}): Posting {
  return {
    source: 'ashby',
    externalId: '1',
    title: 'Working Student AI Engineering',
    company: 'Acme',
    location: 'Berlin',
    remote: null,
    url: 'https://example.com/1',
    description: 'You will build LLM agents with TypeScript. a1',
    ...overrides,
  };
}

describe('htmlToText', () => {
  it('keeps structure and decodes entities', () => {
    const text = htmlToText('<h2>About</h2><p>We&apos;re hiring &amp; growing</p><ul><li>Python</li><li>LLMs</li></ul>');
    expect(text).toBe("About\nWe're hiring & growing\n\n- Python\n- LLMs");
  });

  it('handles entity-escaped HTML (Greenhouse style)', () => {
    expect(htmlToText('&lt;p&gt;Hello &lt;strong&gt;world&lt;/strong&gt;&lt;/p&gt;')).toBe('Hello world');
  });

  it('drops scripts and styles', () => {
    expect(htmlToText('<style>p{}</style><script>alert(1)</script><p>Hi</p>')).toBe('Hi');
  });
});

describe('scorePosting', () => {
  it('weights title hits above description hits', () => {
    expect(scorePosting(posting(), ['working student'])).toBe(3);
    expect(scorePosting(posting(), ['typescript'])).toBe(1);
    expect(scorePosting(posting(), ['working student', 'llm', 'rust'])).toBe(4);
    expect(scorePosting(posting({ title: 'Director' }), ['a1', 'llm', 'typescript', 'agents', 'build'])).toBe(2);
  });

  it('matches whole words only', () => {
    expect(scorePosting(posting({ title: 'Director, CPG/Retail', description: '' }), ['AI'])).toBe(0);
    expect(scorePosting(posting({ title: '(Intern) AI Automation Engineer', description: '' }), ['AI', 'intern'])).toBe(6);
    expect(scorePosting(posting({ title: 'Werkstudent:in Data', description: '' }), ['werkstudent'])).toBe(3);
  });
});

describe('matchesLocation', () => {
  it('matches German cities for "Germany"', () => {
    expect(matchesLocation(posting({ location: 'München' }), 'Germany', false)).toBe(true);
    expect(matchesLocation(posting({ location: 'London' }), 'Germany', false)).toBe(false);
  });

  it('matches remote roles when "Remote" is requested', () => {
    expect(matchesLocation(posting({ location: 'Anywhere', remote: true }), 'Germany, Remote', false)).toBe(true);
  });

  it('enforces remote_only', () => {
    expect(matchesLocation(posting({ remote: null }), undefined, true)).toBe(false);
    expect(matchesLocation(posting({ remote: true }), undefined, true)).toBe(true);
  });
});

describe('parseAtsUrl', () => {
  it.each([
    ['https://job-boards.greenhouse.io/anthropic/jobs/4567', { ats: 'greenhouse', slug: 'anthropic', id: '4567' }],
    ['https://boards.greenhouse.io/n26/jobs/123?gh_src=x', { ats: 'greenhouse', slug: 'n26', id: '123' }],
    ['https://jobs.lever.co/spotify/abc-123', { ats: 'lever', slug: 'spotify', id: 'abc-123' }],
    ['https://jobs.ashbyhq.com/n8n/b45f/application', { ats: 'ashby', slug: 'n8n', id: 'b45f' }],
  ])('%s', (url, expected) => {
    expect(parseAtsUrl(url)).toEqual(expected);
  });

  it('returns null for other URLs', () => {
    expect(parseAtsUrl('https://careers.example.com/jobs/1')).toBeNull();
    expect(parseAtsUrl('not a url')).toBeNull();
  });
});

describe('extractJsonLdJob', () => {
  it('reads schema.org JobPosting data', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: 'Werkstudent KI',
      description: '<p>Build agents.</p>',
      hiringOrganization: { name: 'Acme GmbH' },
      jobLocation: { address: { addressLocality: 'Nürnberg', addressCountry: 'DE' } },
    })}</script></head></html>`;
    expect(extractJsonLdJob(html)).toMatchObject({
      title: 'Werkstudent KI',
      company: 'Acme GmbH',
      location: 'Nürnberg, DE',
      description: 'Build agents.',
    });
  });

  it('returns null when there is no JobPosting', () => {
    expect(extractJsonLdJob('<script type="application/ld+json">{"@type":"Organization"}</script>')).toBeNull();
  });
});
