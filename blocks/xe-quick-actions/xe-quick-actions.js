import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const BACKGROUNDS = ['default', 'subtle', 'muted'];
const CARD_COUNTS = ['3-up', '4-up', '5-up'];

// xe-quick-action child cell order (matches model field declaration):
// 0 label | 1 actionIcon | 2 actionLink | 3 imageBackground
const CELL = {
  LABEL: 0,
  ACTION_ICON: 1,
  ACTION_LINK: 2,
  IMAGE_BG: 3,
};

const ACTION_ICON_CLASSES = {
  'internal-link': 'xe-quick-actions__icon--internal',
  'external-link': 'xe-quick-actions__icon--external',
  download: 'xe-quick-actions__icon--download',
};

const val = (node) => (node ? node.textContent.trim() : '');
const isTrue = (text) => text.toLowerCase() === 'true';

export default function decorate(block) {
  const rows = [...block.children];

  // Action item rows carry > 1 cell; config rows carry exactly 1.
  const actionRows = rows.filter((row) => row.children.length > 1);
  const fieldRows = rows.filter((row) => !actionRows.includes(row));

  const backgroundRow = fieldRows.find((row) => BACKGROUNDS.includes(val(row).toLowerCase()));
  const cardCountRow = fieldRows.find((row) => CARD_COUNTS.includes(val(row).toLowerCase()));
  const toggleRows = fieldRows.filter((row) => ['true', 'false'].includes(val(row).toLowerCase()));
  const [showIconsRow, showActionIconRow] = toggleRows;

  const background = backgroundRow ? val(backgroundRow).toLowerCase() : 'default';
  const cardCount = cardCountRow ? val(cardCountRow).toLowerCase() : '3-up';
  const showIcons = showIconsRow ? isTrue(val(showIconsRow)) : true;
  const showActionIcon = showActionIconRow ? isTrue(val(showActionIconRow)) : true;

  const countNum = parseInt(cardCount, 10);

  block.classList.add(`xe-quick-actions--bg-${background}`, `xe-quick-actions--${cardCount}`);
  block.style.setProperty('--xe-qa-count', countNum);

  // --- grid -----------------------------------------------------------------
  const grid = document.createElement('ul');
  grid.className = 'xe-quick-actions__grid';

  actionRows.forEach((row) => {
    const cells = [...row.children];
    const label = val(cells[CELL.LABEL]);
    if (!label) return;

    const linkAnchor = cells[CELL.ACTION_LINK]?.querySelector('a');
    const href = linkAnchor?.getAttribute('href') || val(cells[CELL.ACTION_LINK]);

    const actionIconVal = val(cells[CELL.ACTION_ICON]).toLowerCase() || 'internal-link';
    const imgCell = cells[CELL.IMAGE_BG];
    const img = imgCell?.querySelector('img');
    const imgAnchor = imgCell?.querySelector('a');
    const imgSrc = img?.src || imgAnchor?.getAttribute('href');

    const item = document.createElement('li');
    item.className = 'xe-quick-actions__item';
    moveInstrumentation(row, item);

    // Background image (5-up last card style)
    if (imgSrc) {
      item.classList.add('xe-quick-actions__item--image-bg');
      const picture = createOptimizedPicture(imgSrc, '', false, [{ width: '400' }]);
      picture.querySelector('img').setAttribute('role', 'presentation');
      picture.className = 'xe-quick-actions__bg-media';
      if (img) moveInstrumentation(img, picture.querySelector('img'));
      item.append(picture);
    }

    if (showIcons) {
      const icon = document.createElement('span');
      icon.className = `xe-quick-actions__icon ${ACTION_ICON_CLASSES[actionIconVal] || ''}`;
      icon.setAttribute('aria-hidden', 'true');
      item.append(icon);
    }

    const labelEl = document.createElement('span');
    labelEl.className = 'xe-quick-actions__label';
    labelEl.textContent = label;
    item.append(labelEl);

    if (showActionIcon) {
      const arrow = document.createElement('span');
      arrow.className = 'xe-quick-actions__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      item.append(arrow);
    }

    if (href) {
      const link = document.createElement('a');
      link.className = 'xe-quick-actions__link';
      link.href = href;
      link.setAttribute('aria-label', label);
      if (actionIconVal === 'external-link') link.setAttribute('target', '_blank');
      item.append(link);
    }

    grid.append(item);
  });

  block.textContent = '';
  if (grid.children.length) block.append(grid);
}
