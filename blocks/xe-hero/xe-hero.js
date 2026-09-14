import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const HEIGHTS = ['responsive', 'tall', 'standard', 'compact'];
const IMAGE_POSITIONS_EDGE = ['top', 'bottom'];
const MAX_ACTIONS = 2; // AC02 — first primary, second static light.
// NOTE: Universal Editor does not enforce a hard cap on child items at
// authoring time, even when a filter/model implies one (a known UE gap,
// also reported by other AEM EDS/CF authors). This script enforces the
// cap only at render time — a 3rd authored action is silently dropped.

const val = (row) => (row ? row.textContent.trim() : '');
const looksLikeUrl = (text) => /^(https?:)?\//i.test(text);

export default function decorate(block) {
  const rows = [...block.children];

  // Hero Action items always carry 2 child cells (text + link);
  // every other field row carries exactly 1.
  const actionRows = rows.filter((row) => row.children.length > 1);
  const fieldRows = rows.filter((row) => !actionRows.includes(row));

  // Title is required and always the first field row.
  const [titleRow, ...rest] = fieldRows;

  // DAM picker row: identified by containing an actual asset reference.
  const damRow = rest.find((row) => row.querySelector('img, picture'));
  const afterDam = rest.filter((row) => row !== damRow);

  // Image URL row: plain text/link that looks like a URL or path,
  // and isn't the DAM row.
  const urlRow = afterDam.find((row) => looksLikeUrl(val(row)));
  const afterUrl = afterDam.filter((row) => row !== urlRow);

  // Height: unambiguous keyword match.
  const heightRow = afterUrl.find((row) => HEIGHTS.includes(val(row).toLowerCase()));
  const afterHeight = afterUrl.filter((row) => row !== heightRow);

  // Alignment/position: 'left', 'top', 'bottom' are unambiguous;
  // 'center' is shared by both fields, so resolve by elimination.
  const alignLeftRow = afterHeight.find((row) => val(row).toLowerCase() === 'left');
  const posEdgeRow = afterHeight.find((row) => IMAGE_POSITIONS_EDGE.includes(val(row).toLowerCase()));
  const centerRows = afterHeight.filter((row) => val(row).toLowerCase() === 'center');

  let alignRow = alignLeftRow;
  let posRow = posEdgeRow;
  if (!alignRow && centerRows.length) [alignRow] = centerRows;
  if (!posRow && centerRows.length) posRow = centerRows.find((row) => row !== alignRow) || centerRows[0];

  const consumedConfig = new Set([heightRow, alignRow, posRow].filter(Boolean));
  const leftover = afterHeight.filter((row) => !consumedConfig.has(row));

  // Whatever remains, in original order, is Subtitle then Alt —
  // both optional; either or both may be entirely absent.
  const [subtitleRow, altRow] = leftover;

  const height = heightRow ? val(heightRow).toLowerCase() : 'responsive';
  const textAlign = alignRow ? val(alignRow).toLowerCase() : 'center';
  const imagePosition = posRow ? val(posRow).toLowerCase() : 'center';

  block.classList.add(
    `xe-hero--${height}`,
    `xe-hero--align-${textAlign}`,
    `xe-hero--img-${imagePosition}`,
  );

  // --- media ----------------------------------------------------------------
  // AC05 note: served via EDS's own image pipeline (createOptimizedPicture),
  // NOT Adobe Dynamic Media. True Dynamic Media delivery requires org-level
  // DM configuration outside this block's scope.
  const media = document.createElement('div');
  media.className = 'xe-hero__media';

  const damImg = damRow?.querySelector('img');
  const damAnchor = damRow?.querySelector('a');
  const src = damImg?.src || damAnchor?.getAttribute('href') || val(urlRow);

  if (src) {
    const alt = val(altRow);
    const picture = createOptimizedPicture(src, alt, true, [
      { media: '(min-width: 900px)', width: '2000' },
      { media: '(min-width: 600px)', width: '1200' },
      { width: '750' },
    ]);
    if (!alt) picture.querySelector('img').setAttribute('role', 'presentation');
    if (damImg) moveInstrumentation(damImg, picture.querySelector('img'));
    media.append(picture);
  }

  // --- content ----------------------------------------------------------------
  const content = document.createElement('div');
  content.className = 'xe-hero__content';

  const title = document.createElement('h1');
  title.className = 'xe-hero__title';
  title.textContent = val(titleRow);
  if (titleRow) moveInstrumentation(titleRow, title);
  content.append(title);
  // AC07 note: Title is marked required in the model, which flags the field
  // in the properties panel but does not block publish. True publish-time
  // enforcement needs an AEM-side validation rule outside this block's scope.

  const subtitleText = val(subtitleRow);
  if (subtitleText) {
    const subtitle = document.createElement('p');
    subtitle.className = 'xe-hero__subtitle';
    subtitle.textContent = subtitleText;
    moveInstrumentation(subtitleRow, subtitle);
    content.append(subtitle);
  }

  // --- actions (max 2 rendered: first primary, second static light) -----------
  const actions = actionRows.slice(0, MAX_ACTIONS);
  if (actions.length) {
    const group = document.createElement('div');
    group.className = 'xe-hero__actions';
    actions.forEach((row, i) => {
      const cells = [...row.children];
      const text = val(cells[0]);
      const linkAnchor = cells[1]?.querySelector('a');
      const href = linkAnchor?.getAttribute('href') || val(cells[1]);
      if (!text || !href) return; // incomplete pair is not rendered
      const link = document.createElement('a');
      link.className = `xe-hero__action ${i === 0 ? 'xe-hero__action--primary' : 'xe-hero__action--light'}`;
      link.href = href;
      link.textContent = text;
      moveInstrumentation(row, link);
      group.append(link);
    });
    if (group.children.length) content.append(group);
  }

  block.textContent = '';
  if (media.children.length) block.append(media);
  block.append(content);
}
