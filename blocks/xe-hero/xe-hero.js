import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const HEIGHTS = ['responsive', 'tall', 'standard', 'compact'];
const ALIGNS = ['center', 'left'];
const IMAGE_POSITIONS = ['center', 'top', 'bottom'];
const MAX_ACTIONS = 2; // AC02 — first primary, second static light

/** read the text of a config row, or '' */
const val = (row) => (row ? row.textContent.trim() : '');

/** pick a safe value from an allow-list, otherwise fall back */
const oneOf = (value, list, fallback) => (list.includes(value.toLowerCase())
  ? value.toLowerCase()
  : fallback);

export default function decorate(block) {
  // Rows arrive in the order declared in _xe-hero.json:
  // 0 title | 1 subtitle | 2 image | 3 imageAlt | 4 height | 5 textAlign | 6 imagePosition
  // Any remaining rows are xe-hero-action child items.
  const rows = [...block.children];
  const [titleRow, subtitleRow, imageRow, altRow, heightRow, alignRow, posRow] = rows;
  const actionRows = rows.slice(7);

  const height = oneOf(val(heightRow), HEIGHTS, 'responsive');
  const textAlign = oneOf(val(alignRow), ALIGNS, 'center');
  const imagePosition = oneOf(val(posRow), IMAGE_POSITIONS, 'center');

  block.classList.add(
    `xe-hero--${height}`,
    `xe-hero--align-${textAlign}`,
    `xe-hero--img-${imagePosition}`,
  );

  // --- media -------------------------------------------------------------
  const media = document.createElement('div');
  media.className = 'xe-hero__media';
  const img = imageRow?.querySelector('img');
  if (img) {
    const alt = val(altRow);
    const picture = createOptimizedPicture(img.src, alt, true, [
      { media: '(min-width: 900px)', width: '2000' },
      { media: '(min-width: 600px)', width: '1200' },
      { width: '750' },
    ]);
    if (!alt) picture.querySelector('img').setAttribute('role', 'presentation');
    moveInstrumentation(img, picture.querySelector('img'));
    media.append(picture);
  }

  // --- content -----------------------------------------------------------
  const content = document.createElement('div');
  content.className = 'xe-hero__content';

  const title = document.createElement('h1');
  title.className = 'xe-hero__title';
  title.textContent = val(titleRow);
  if (titleRow) moveInstrumentation(titleRow, title);
  content.append(title);

  const subtitleText = val(subtitleRow);
  if (subtitleText) {
    const subtitle = document.createElement('p');
    subtitle.className = 'xe-hero__subtitle';
    subtitle.textContent = subtitleText;
    moveInstrumentation(subtitleRow, subtitle);
    content.append(subtitle);
  }

  // --- actions (max 2: first primary, second static light) ----------------
  const actions = actionRows.slice(0, MAX_ACTIONS);
  if (actions.length) {
    const group = document.createElement('div');
    group.className = 'xe-hero__actions';
    actions.forEach((row, i) => {
      const cells = [...row.children];
      const text = val(cells[0]);
      const anchor = cells[1]?.querySelector('a');
      const href = anchor?.getAttribute('href') || val(cells[1]);
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