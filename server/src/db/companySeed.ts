/**
 * German Tech Company Reference Seed
 *
 * IMPORTANT — Scope & Limitations:
 * This is a curated reference dataset (~60 companies), NOT a complete registry of all German GmbHs.
 * A complete registry of all ~3.7M German GmbHs is not feasible to maintain in-repo.
 *
 * What this IS:
 * - A useful starting reference for tech/startup companies actively hiring in Germany
 * - A foundation for the companies table schema
 * - Manually curated, publicly available information only
 *
 * Future data acquisition strategy (out of scope for this seed):
 * - Bundesanzeiger (federal gazette) API — company registrations
 * - Handelsregister — company register data
 * - Commercial APIs: Northdata, Echobot, Dun & Bradstreet Germany
 * - Scraping job boards for employer names + deduplication
 * - Community datasets: OpenCorporates (has DE coverage)
 *
 * Fields:
 * - is_actively_hiring: based on public job board presence at time of seed
 * - hiring_sources: where jobs from this company are typically posted
 * - source_confidence: "high" = verified, "medium" = likely correct, "low" = inferred
 */

import { randomUUID as uuidv4 } from 'crypto';
import type { CompanyRecord } from './companies';

type SeedCompany = Omit<CompanyRecord, 'created_at' | 'updated_at'>;

export const GERMAN_TECH_COMPANIES: SeedCompany[] = [
  // ── DAX / Large Enterprise ───────────────────────────────────────────────
  {
    id: uuidv4(), name: 'SAP SE', name_normalized: 'sap',
    website: 'https://www.sap.com', linkedin_url: 'https://www.linkedin.com/company/sap',
    sector: 'Enterprise Software', city: 'Walldorf', state: 'Baden-Württemberg',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['indeed', 'stepstone', 'linkedin', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Siemens AG', name_normalized: 'siemens',
    website: 'https://www.siemens.com', linkedin_url: 'https://www.linkedin.com/company/siemens',
    sector: 'Engineering & Technology', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'indeed', 'linkedin', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Bosch GmbH', name_normalized: 'bosch',
    website: 'https://www.bosch.de', linkedin_url: 'https://www.linkedin.com/company/bosch',
    sector: 'Engineering & Technology', city: 'Stuttgart', state: 'Baden-Württemberg',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'indeed', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Deutsche Telekom AG', name_normalized: 'deutsche telekom',
    website: 'https://www.telekom.com', linkedin_url: 'https://www.linkedin.com/company/deutsche-telekom',
    sector: 'Telecommunications', city: 'Bonn', state: 'North Rhine-Westphalia',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'indeed', 'linkedin'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Munich Tech Hub ────────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'Allianz Technology SE', name_normalized: 'allianz technology',
    website: 'https://www.allianztechnology.com', sector: 'InsurTech / FinTech',
    city: 'Munich', state: 'Bavaria', country: 'DE', size_range: '5000-10000',
    is_actively_hiring: true, hiring_sources: ['stepstone', 'linkedin'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Celonis SE', name_normalized: 'celonis',
    website: 'https://www.celonis.com', linkedin_url: 'https://www.linkedin.com/company/celonis',
    sector: 'Process Mining / Enterprise Software', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Personio GmbH', name_normalized: 'personio',
    website: 'https://www.personio.de', linkedin_url: 'https://www.linkedin.com/company/personio',
    sector: 'HR Tech / SaaS', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'CHECK24 GmbH', name_normalized: 'check24',
    website: 'https://www.check24.de', sector: 'FinTech / Comparison',
    city: 'Munich', state: 'Bavaria', country: 'DE', size_range: '1000-5000',
    is_actively_hiring: true, hiring_sources: ['stepstone', 'indeed', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Flixbus (FlixMobility GmbH)', name_normalized: 'flixbus',
    website: 'https://www.flixbus.de', linkedin_url: 'https://www.linkedin.com/company/flixbus',
    sector: 'Mobility / Travel Tech', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Liqid Investments GmbH', name_normalized: 'liqid',
    website: 'https://www.liqid.de', sector: 'FinTech / WealthTech',
    city: 'Berlin', state: 'Berlin', country: 'DE', size_range: '50-200',
    is_actively_hiring: true, hiring_sources: ['linkedin', 'stepstone'],
    source: 'seed', source_confidence: 'medium',
  },

  // ── Berlin Tech Hub ────────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'Zalando SE', name_normalized: 'zalando',
    website: 'https://corporate.zalando.com', linkedin_url: 'https://www.linkedin.com/company/zalando',
    sector: 'E-Commerce / Fashion Tech', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'HelloFresh SE', name_normalized: 'hellofresh',
    website: 'https://www.hellofresh.de', linkedin_url: 'https://www.linkedin.com/company/hellofresh',
    sector: 'FoodTech / E-Commerce', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '5000-10000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'N26 GmbH', name_normalized: 'n26',
    website: 'https://n26.com', linkedin_url: 'https://www.linkedin.com/company/n26',
    sector: 'FinTech / Neobank', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Delivery Hero SE', name_normalized: 'delivery hero',
    website: 'https://www.deliveryhero.com', linkedin_url: 'https://www.linkedin.com/company/delivery-hero',
    sector: 'FoodTech / Marketplace', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'SumUp GmbH', name_normalized: 'sumup',
    website: 'https://sumup.de', linkedin_url: 'https://www.linkedin.com/company/sumup',
    sector: 'FinTech / Payments', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Trade Republic Bank GmbH', name_normalized: 'trade republic',
    website: 'https://traderepublic.com', linkedin_url: 'https://www.linkedin.com/company/trade-republic',
    sector: 'FinTech / Neobroker', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'corporate', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Tier Mobility GmbH', name_normalized: 'tier mobility',
    website: 'https://www.tier.app', linkedin_url: 'https://www.linkedin.com/company/tier-mobility',
    sector: 'Mobility / MaaS', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'Contentful GmbH', name_normalized: 'contentful',
    website: 'https://www.contentful.com', linkedin_url: 'https://www.linkedin.com/company/contentful',
    sector: 'CMS / Headless Content', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Adjust GmbH', name_normalized: 'adjust',
    website: 'https://www.adjust.com', linkedin_url: 'https://www.linkedin.com/company/adjust',
    sector: 'AdTech / Mobile Analytics', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Hamburg ─────────────────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'XING SE (New Work SE)', name_normalized: 'xing new work',
    website: 'https://www.new-work.se', linkedin_url: 'https://www.linkedin.com/company/new-work-se',
    sector: 'HR Tech / Professional Network', city: 'Hamburg', state: 'Hamburg',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'About You GmbH', name_normalized: 'about you',
    website: 'https://aboutyou.de', linkedin_url: 'https://www.linkedin.com/company/about-you',
    sector: 'E-Commerce / Fashion', city: 'Hamburg', state: 'Hamburg',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Otto GmbH & Co. KG', name_normalized: 'otto',
    website: 'https://www.otto.de', linkedin_url: 'https://www.linkedin.com/company/otto-group',
    sector: 'E-Commerce / Retail', city: 'Hamburg', state: 'Hamburg',
    country: 'DE', size_range: '10000+', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'indeed', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Frankfurt / Finance ─────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'Deutsche Bank AG Technology', name_normalized: 'deutsche bank',
    website: 'https://careers.db.com', sector: 'Banking / FinTech',
    city: 'Frankfurt', state: 'Hesse', country: 'DE', size_range: '10000+',
    is_actively_hiring: true, hiring_sources: ['stepstone', 'linkedin', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'ING-DiBa AG', name_normalized: 'ing diba',
    website: 'https://www.ing.de', sector: 'Banking / FinTech',
    city: 'Frankfurt', state: 'Hesse', country: 'DE', size_range: '5000-10000',
    is_actively_hiring: true, hiring_sources: ['stepstone', 'linkedin'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Düsseldorf / NRW ────────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'trivago GmbH', name_normalized: 'trivago',
    website: 'https://www.trivago.de', linkedin_url: 'https://www.linkedin.com/company/trivago',
    sector: 'Travel Tech', city: 'Düsseldorf', state: 'North Rhine-Westphalia',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Stuttgart / Automotive ───────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'Mercedes-Benz Tech Innovation GmbH', name_normalized: 'mercedes-benz tech',
    website: 'https://www.mercedes-benz.com/en/career', sector: 'Automotive / Software',
    city: 'Stuttgart', state: 'Baden-Württemberg', country: 'DE', size_range: '5000-10000',
    is_actively_hiring: true, hiring_sources: ['stepstone', 'linkedin', 'corporate'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Porsche Digital GmbH', name_normalized: 'porsche digital',
    website: 'https://www.porsche.digital', linkedin_url: 'https://www.linkedin.com/company/porsche-digital',
    sector: 'Automotive / Digital', city: 'Stuttgart', state: 'Baden-Württemberg',
    country: 'DE', size_range: '200-500', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed', 'stepstone'],
    source: 'seed', source_confidence: 'high',
  },

  // ── Nuremberg / Bavaria ─────────────────────────────────────────────────────
  {
    id: uuidv4(), name: 'Cradle (formerly Stylight GmbH)', name_normalized: 'stylight',
    website: 'https://www.stylight.de', sector: 'Fashion Tech',
    city: 'Munich', state: 'Bavaria', country: 'DE', size_range: '200-500',
    is_actively_hiring: false, hiring_sources: ['linkedin'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'IDnow GmbH', name_normalized: 'idnow',
    website: 'https://www.idnow.io', linkedin_url: 'https://www.linkedin.com/company/idnow',
    sector: 'RegTech / Identity Verification', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '200-500', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone'],
    source: 'seed', source_confidence: 'medium',
  },

  // ── General / Cloud / B2B SaaS ───────────────────────────────────────────────
  {
    id: uuidv4(), name: 'TeamViewer AG', name_normalized: 'teamviewer',
    website: 'https://www.teamviewer.com', linkedin_url: 'https://www.linkedin.com/company/teamviewer',
    sector: 'Remote Connectivity / SaaS', city: 'Göppingen', state: 'Baden-Württemberg',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Scout24 SE', name_normalized: 'scout24',
    website: 'https://www.scout24.com', linkedin_url: 'https://www.linkedin.com/company/scout24',
    sector: 'PropTech / Marketplace', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['stepstone', 'linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Westwing GmbH', name_normalized: 'westwing',
    website: 'https://www.westwing.de', linkedin_url: 'https://www.linkedin.com/company/westwing',
    sector: 'E-Commerce / Home & Living', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'Scalable Capital GmbH', name_normalized: 'scalable capital',
    website: 'https://de.scalable.capital', linkedin_url: 'https://www.linkedin.com/company/scalable-capital',
    sector: 'FinTech / WealthTech', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '200-500', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Paymenttools GmbH (DKB)', name_normalized: 'paymenttools',
    website: 'https://www.paymenttools.com', sector: 'FinTech / Payments',
    city: 'Munich', state: 'Bavaria', country: 'DE', size_range: '50-200',
    is_actively_hiring: true, hiring_sources: ['linkedin'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'Brainlab AG', name_normalized: 'brainlab',
    website: 'https://www.brainlab.com', linkedin_url: 'https://www.linkedin.com/company/brainlab',
    sector: 'MedTech / Software', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'stepstone', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Wirecard successor / Grenke AG', name_normalized: 'grenke',
    website: 'https://www.grenke.de', sector: 'FinTech / Leasing',
    city: 'Baden-Baden', state: 'Baden-Württemberg', country: 'DE', size_range: '1000-5000',
    is_actively_hiring: true, hiring_sources: ['stepstone'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'Commercetools GmbH', name_normalized: 'commercetools',
    website: 'https://commercetools.com', linkedin_url: 'https://www.linkedin.com/company/commercetools',
    sector: 'Commerce Platform / SaaS', city: 'Munich', state: 'Bavaria',
    country: 'DE', size_range: '500-1000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Taxdoo GmbH', name_normalized: 'taxdoo',
    website: 'https://www.taxdoo.com', linkedin_url: 'https://www.linkedin.com/company/taxdoo',
    sector: 'TaxTech / SaaS', city: 'Hamburg', state: 'Hamburg',
    country: 'DE', size_range: '50-200', is_actively_hiring: true,
    hiring_sources: ['linkedin'],
    source: 'seed', source_confidence: 'medium',
  },
  {
    id: uuidv4(), name: 'GetYourGuide GmbH', name_normalized: 'getyourguide',
    website: 'https://www.getyourguide.de', linkedin_url: 'https://www.linkedin.com/company/getyourguide',
    sector: 'Travel Tech / Marketplace', city: 'Berlin', state: 'Berlin',
    country: 'DE', size_range: '1000-5000', is_actively_hiring: true,
    hiring_sources: ['linkedin', 'indeed'],
    source: 'seed', source_confidence: 'high',
  },
  {
    id: uuidv4(), name: 'Gorillas Technologies GmbH (Getir)', name_normalized: 'gorillas',
    website: 'https://gorillas.io', sector: 'Quick Commerce',
    city: 'Berlin', state: 'Berlin', country: 'DE', size_range: '200-500',
    is_actively_hiring: false, hiring_sources: ['linkedin'],
    source: 'seed', source_confidence: 'medium',
  },
];
