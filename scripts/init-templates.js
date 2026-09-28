#!/usr/bin/env node
/**
 * AEM template page initializer.
 *
 * Creates the Category LP and Content LP template pages in AEM with their
 * zone sections pre-configured. Run this once per environment after initial
 * deployment to seed the template pages that authors copy from.
 *
 * Usage:
 *   node scripts/init-templates.js
 *
 * Environment variables:
 *   AEM_HOST          AEM author URL (default: http://localhost:4502)
 *   AEM_USER          AEM username  (default: admin)
 *   AEM_PASSWORD      AEM password  (default: admin)
 *   AEM_BEARER_TOKEN  IMS bearer token — use instead of user/password for AEMaaCS
 *   AEM_CONTENT_ROOT  Parent path where template pages are created
 *                     (default: /content/xcel/en)
 *
 * AEMaaCS (cloud) auth:
 *   Get a bearer token from the AEM Developer Console → Integrations → Local token
 *   then run:
 *     AEM_HOST=https://author-xxx.adobeaemcloud.com \
 *     AEM_BEARER_TOKEN=eyJ... \
 *     node scripts/init-templates.js
 *
 * JCR structure created per template page:
 *   /content/xcel/en/<name>        (cq:Page)
 *   └── jcr:content                (cq:PageContent)
 *       ├── template = "category-lp"  ← drives CSS/JS template on EDS
 *       ├── orientation            (section, zone-orientation)
 *       ├── shortcuts              (section, zone-cat-shortcuts)
 *       └── …
 */

import { env } from 'node:process';

const HOST = env.AEM_HOST || 'http://localhost:4502';
const CONTENT_ROOT = env.AEM_CONTENT_ROOT || '/content/xcel/en';

function authHeader() {
  if (env.AEM_BEARER_TOKEN) return `Bearer ${env.AEM_BEARER_TOKEN}`;
  const user = env.AEM_USER || 'admin';
  const pass = env.AEM_PASSWORD || 'admin';
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: 'category-lp-template',
    title: 'Category Landing Page — Template',
    templateValue: 'category-lp',
    sections: [
      { id: 'orientation',     name: 'Orientation',          style: 'zone-orientation' },
      { id: 'shortcuts',       name: 'Shortcuts',             style: 'zone-cat-shortcuts' },
      { id: 'awareness',       name: 'Awareness',             style: 'zone-cat-awareness' },
      { id: 'primary-actions', name: 'Primary Actions',       style: 'zone-primary-actions' },
      { id: 'supporting',      name: 'Supporting Content',    style: 'zone-cat-supporting' },
      { id: 'trust',           name: 'Trust & Credibility',   style: 'zone-cat-trust' },
      { id: 'support-assist',  name: 'Support & Assistance',  style: 'zone-cat-support-assist' },
    ],
  },
  {
    name: 'content-lp-template',
    title: 'Content Landing Page — Template',
    templateValue: 'content-lp',
    sections: [
      { id: 'orientation',     name: 'Orientation & Awareness', style: 'zone-orientation' },
      { id: 'value-edu',       name: 'Value & Education',        style: 'zone-con-value-edu' },
      { id: 'primary-actions', name: 'Primary Actions',          style: 'zone-primary-actions' },
      { id: 'supporting',      name: 'Supporting Content',       style: 'zone-con-supporting' },
    ],
  },
];

// ---------------------------------------------------------------------------
// AEM Sling POST helpers
// ---------------------------------------------------------------------------

async function post(path, fields) {
  const url = `${HOST}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`POST ${path} → HTTP ${res.status}\n${body.slice(0, 300)}`);
  }
  return res;
}

async function nodeExists(path) {
  const res = await fetch(`${HOST}${path}.json`, {
    headers: { Authorization: authHeader() },
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// Template page builder
// ---------------------------------------------------------------------------

async function createTemplatePage(template) {
  const pagePath = `${CONTENT_ROOT}/${template.name}`;
  const contentPath = `${pagePath}/jcr:content`;

  console.log(`\n── ${template.title}`);
  console.log(`   Path: ${pagePath}`);

  // 1. Create the cq:Page node (skip if already exists)
  if (await nodeExists(pagePath)) {
    console.log('   ⚠  Page already exists — skipping creation, updating content');
  } else {
    await post(CONTENT_ROOT, {
      '_charset_': 'utf-8',
      ':name': template.name,
      'jcr:primaryType': 'cq:Page',
    });
    console.log('   ✓ cq:Page created');
  }

  // 2. Set page metadata on jcr:content
  await post(contentPath, {
    '_charset_': 'utf-8',
    'jcr:primaryType': 'cq:PageContent',
    'sling:resourceType': 'core/franklin/components/page/v1/page',
    'jcr:title': template.title,
    'template': template.templateValue,
  });
  console.log(`   ✓ jcr:content set (template: ${template.templateValue})`);

  // 3. Create zone sections in order
  for (const section of template.sections) {
    const sectionPath = `${contentPath}/${section.id}`;
    await post(sectionPath, {
      '_charset_': 'utf-8',
      'jcr:primaryType': 'nt:unstructured',
      'sling:resourceType': 'core/franklin/components/section/v1/section',
      'name': section.name,
      'style': section.style,
    });
    console.log(`   ✓ Section: ${section.name} [${section.style}]`);
  }

  console.log(`   → Open in UE: ${HOST}/editor.html${pagePath}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run() {
  console.log('AEM Template Page Initializer');
  console.log(`Host:         ${HOST}`);
  console.log(`Content root: ${CONTENT_ROOT}`);
  console.log(`Auth:         ${env.AEM_BEARER_TOKEN ? 'Bearer token' : 'Basic auth'}`);

  for (const template of TEMPLATES) {
    await createTemplatePage(template);
  }

  console.log('\n✓ Done. Both template pages are ready in AEM.');
}

run().catch((err) => {
  console.error('\n✗ Failed:', err.message);
  process.exit(1);
});
