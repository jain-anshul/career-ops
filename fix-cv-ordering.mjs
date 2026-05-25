#!/usr/bin/env node
/**
 * fix-cv-ordering.mjs
 *
 * Fixes wrong reverse-chronology ordering in existing generated CV HTML files.
 * Extracts <div class="job"> blocks, reorders them to the correct chronological order
 * (Adobe → Greenlight → Jupiter → Rephrase → VMware), then regenerates PDFs.
 *
 * Usage: node fix-cv-ordering.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

// Canonical order: company name substring → sort index (lower = more recent).
// More-specific substrings must come before more-general ones (Rephrase before
// Adobe, because "Rephrase.ai (acquired by Adobe)" contains both substrings).
const COMPANY_ORDER = [
  { match: 'Rephrase',   order: 3 },
  { match: 'Adobe',      order: 0 },
  { match: 'Greenlight', order: 1 },
  { match: 'Jupiter',    order: 2 },
  { match: 'VMware',     order: 4 },
];

/**
 * Extract all top-level <div class="job"> blocks from HTML string.
 * Uses bracket counting to handle nested divs correctly.
 */
function extractJobBlocks(html) {
  const blocks = [];
  const openTag = '<div class="job">';
  let searchFrom = 0;

  while (true) {
    const start = html.indexOf(openTag, searchFrom);
    if (start === -1) break;

    // Count nested div depth to find the correct closing </div>
    let depth = 0;
    let i = start;
    while (i < html.length) {
      if (html.slice(i, i + 4) === '<div') {
        depth++;
        i += 4;
      } else if (html.slice(i, i + 6) === '</div>') {
        depth--;
        if (depth === 0) {
          const end = i + 6; // include the closing </div>
          blocks.push({ html: html.slice(start, end), start, end });
          searchFrom = end;
          break;
        }
        i += 6;
      } else {
        i++;
      }
    }
    if (depth !== 0) {
      console.error('  ERROR: Unbalanced divs detected, skipping file');
      return null;
    }
  }

  return blocks;
}

/**
 * Extract company name from <span class="job-company">...</span>.
 */
function extractCompanyName(jobHtml) {
  const m = jobHtml.match(/<span class="job-company">([^<]+)<\/span>/);
  return m ? m[1].trim() : '';
}

/**
 * Determine the canonical sort order for a job block by matching company name.
 * Matches on the extracted <span class="job-company"> text to avoid false
 * positives like "Rephrase.ai (acquired by Adobe)" matching "Adobe".
 */
function getJobOrder(jobHtml) {
  const company = extractCompanyName(jobHtml);
  for (const { match, order } of COMPANY_ORDER) {
    if (company.includes(match)) return order;
  }
  console.log(`    WARNING: unknown company "${company}" — will append at end`);
  return 99; // unknown company — append at end
}

/**
 * Check if job blocks are already in correct order.
 */
function isCorrectOrder(blocks) {
  const orders = blocks.map(b => getJobOrder(b.html));
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] < orders[i - 1]) return false;
  }
  return true;
}

/**
 * Process a single HTML file. Returns true if fixed, false if already correct or skipped.
 */
function fixHtmlFile(htmlPath) {
  const original = readFileSync(htmlPath, 'utf8');
  const blocks = extractJobBlocks(original);

  if (!blocks || blocks.length === 0) {
    console.log(`  SKIP — no job blocks found`);
    return false;
  }

  const orders = blocks.map(b => ({ block: b, order: getJobOrder(b.html), name: extractCompanyName(b.html) }));
  const companies = orders.map(o => o.name.replace(' (acquired by Adobe)', ' (acq.)'));

  console.log(`  Found ${blocks.length} jobs: ${companies.join(' → ')}`);

  if (isCorrectOrder(blocks)) {
    console.log(`  OK — already in correct order`);
    return false;
  }

  // Sort blocks by canonical order
  const sorted = [...orders].sort((a, b) => a.order - b.order);
  const sortedCompanies = sorted.map(o => o.name.replace(' (acquired by Adobe)', ' (acq.)'));
  console.log(`  FIX → ${sortedCompanies.join(' → ')}`);

  if (DRY_RUN) {
    console.log(`  [dry-run] Would rewrite ${htmlPath}`);
    return false;
  }

  // Replace all job blocks in the HTML with the sorted order
  // Strategy: replace from last to first (by position) to preserve offsets
  let fixed = original;

  // We need to replace the region from first block's start to last block's end
  const firstStart = blocks[0].start;
  const lastEnd = blocks[blocks.length - 1].end;

  // Build the replacement: sorted blocks joined with newline
  const sortedHtml = sorted.map(o => o.block.html).join('\n\n    ');

  // Preserve leading whitespace from first block
  const leadingWs = original.slice(firstStart - 4, firstStart); // 4 spaces indent
  fixed = original.slice(0, firstStart) + sortedHtml + original.slice(lastEnd);

  writeFileSync(htmlPath, fixed, 'utf8');
  return true;
}

// --- Main ---

const TMP_DIR = '/tmp';
const OUTPUT_DIR = '/Users/anshulj/personal/career-ops/output';
const SCRIPT = '/Users/anshulj/personal/career-ops/generate-pdf.mjs';

// Find all CV HTML files in /tmp
const htmlFiles = readdirSync(TMP_DIR)
  .filter(f => f.startsWith('cv-anshul-jain-') && f.endsWith('.html'))
  .map(f => join(TMP_DIR, f));

console.log(`Found ${htmlFiles.length} CV HTML files\n`);

let fixed = 0;
let skipped = 0;
let regenerated = 0;
let errors = [];

for (const htmlPath of htmlFiles) {
  const filename = htmlPath.split('/').pop();
  console.log(`\n[${filename}]`);

  let wasFixed;
  try {
    wasFixed = fixHtmlFile(htmlPath);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    errors.push(filename);
    continue;
  }

  if (!wasFixed) {
    skipped++;
    continue;
  }

  fixed++;

  // Determine the matching PDF in output/
  // HTML names end with -batch-{x} or -remainder; PDF names don't have that suffix
  // Extract the company slug: strip prefix 'cv-anshul-jain-' and suffix '-batch-*' or '-remainder'
  const slug = filename
    .replace(/^cv-anshul-jain-/, '')
    .replace(/\.html$/, '')
    .replace(/-batch-[a-z]$/, '')
    .replace(/-remainder$/, '');

  // Find the matching PDF
  let matchingPdf = null;
  try {
    const pdfs = readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith(`cv-anshul-jain-${slug}-`) && f.endsWith('.pdf'));
    if (pdfs.length > 0) {
      // Pick the latest one
      pdfs.sort();
      matchingPdf = join(OUTPUT_DIR, pdfs[pdfs.length - 1]);
    }
  } catch {}

  const outputPath = matchingPdf || join(OUTPUT_DIR, `cv-anshul-jain-${slug}-fixed.pdf`);

  // Detect paper format from the HTML (letter vs a4)
  const htmlContent = readFileSync(htmlPath, 'utf8');
  const formatMatch = htmlContent.match(/width:\s*(8\.5in|210mm)/);
  const format = formatMatch && formatMatch[1] === '8.5in' ? 'letter' : 'a4';

  console.log(`  Regenerating PDF → ${outputPath.split('/').pop()} (${format})`);

  if (!DRY_RUN) {
    try {
      execSync(
        `node "${SCRIPT}" "${htmlPath}" "${outputPath}" --format=${format}`,
        { stdio: 'pipe', cwd: '/Users/anshulj/personal/career-ops' }
      );
      console.log(`  PDF regenerated OK`);
      regenerated++;
    } catch (e) {
      console.error(`  PDF ERROR: ${e.stderr?.toString().slice(0, 200) || e.message}`);
      errors.push(`${filename} (PDF)`);
    }
  } else {
    console.log(`  [dry-run] Would run: node generate-pdf.mjs "${htmlPath}" "${outputPath}" --format=${format}`);
  }
}

console.log(`
===== SUMMARY =====
HTML files processed: ${htmlFiles.length}
Fixed + regenerated:  ${fixed} (${regenerated} PDFs written)
Already correct:      ${skipped}
Errors:               ${errors.length}${errors.length > 0 ? '\n  ' + errors.join('\n  ') : ''}
`);
