import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ALIGNMENTS = ['left', 'center'];
const BACKGROUNDS = ['default', 'subtle', 'muted'];
const CARD_STYLES = ['surface', 'image', 'destructured'];
const CARD_COUNTS = ['2', '3', '4', '5', '6'];

// Card cell order, as declared in the xe-featured-card model:
// 0 cardImage | 1 cardImageAlt | 2 icon | 3 cardTitle
// 4 cardDescription | 5 actionText | 6 actionLink
const CELL = {
  IMAGE: 0,
  ALT: 1,
  ICON: 2,
  TITLE: 3,
  DESCRIPTION: 4,
  ACTION_TEXT: 5,
  ACTION_LINK: 6,
};

const val = (node) => (node ? node.textContent.trim() : '');
const isTrue = (text) => text.toLowerCase() === 'true';

export default function decorate(block) {
  const rows = [...block.children];

  // Card items always carry multiple child cells; block-level config
  // rows carry exactly one. Same detection strategy as xe-hero.
  const cardRows = rows.filter((row) => row.children.length > 1);
  const fieldRows = rows.filter((row) => !cardRows.includes(row));

  // Resolve config rows by their value, not by fixed index, so that
  // empty optional fields shifting position cannot mis-assign them.
  const alignmentRow = fieldRows.find((row) => ALIGNMENTS.includes(val(row).toLowerCase()));
  const backgroundRow = fieldRows.find((row) => BACKGROUNDS.includes(val(row).toLowerCase()));
  const cardStyleRow = fieldRows.find((row) => CARD_STYLES.includes(val(row).toLowerCase()));
  const cardCountRow = fieldRows.find((row) => CARD_COUNTS.includes(val(row)));

  // Both toggles share the same possible values, so take them in
  // declared order: Show Icon first, then Show Action Icon.
  const toggleRows = fieldRows.filter((row) => ['true', 'false'].includes(val(row).toLowerCase()));
  const [showIconRow, showActionIconRow] = toggleRows;

  const consumed = new Set(
    [alignmentRow, backgroundRow, cardStyleRow, cardCountRow, ...toggleRows].filter(Boolean),
  );

  // Whatever text rows remain, in order, are Heading then Subheading.
  const [headingRow, subheadingRow] = fieldRows.filter((row) => !consumed.has(row));

  const alignment = alignmentRow ? val(alignmentRow).toLowerCase() : 'left';
  const background = backgroundRow ? val(backgroundRow).toLowerCase() : 'default';
  const cardStyle = cardStyleRow ? val(cardStyleRow).toLowerCase() : 'surface';
  const showIcon = showIconRow ? isTrue(val(showIconRow)) : false;
  const showActionIcon = showActionIconRow ? isTrue(val(showActionIconRow)) : true;

  // Destructured is specified as a 2-up layout only. UE cannot disable the
  // other Card Count options contextually, so the constraint is applied
  // here at render time.
  let cardCount = cardCountRow ? val(cardCountRow) : '4';
  if (cardStyle === 'destructured') cardCount = '2';

  block.classList.add(
    `xe-featured-cards--align-${alignment}`,
    `xe-featured-cards--bg-${background}`,
    `xe-featured-cards--${cardStyle}`,
  );
  block.style.setProperty('--xe-cards-per-row', cardCount);

  // --- header ---------------------------------------------------------------
  const header = document.createElement('div');
  header.className = 'xe-featured-cards__header';

  const headingText = val(headingRow);
  if (headingText) {
    const heading = document.createElement('h2');
    heading.className = 'xe-featured-cards__heading';
    heading.textContent = headingText;
    moveInstrumentation(headingRow, heading);
    header.append(heading);
  }

  const subheadingText = val(subheadingRow);
  if (subheadingText) {
    const subheading = document.createElement('p');
    subheading.className = 'xe-featured-cards__subheading';
    subheading.textContent = subheadingText;
    moveInstrumentation(subheadingRow, subheading);
    header.append(subheading);
  }

  // --- cards ----------------------------------------------------------------
  const grid = document.createElement('ul');
  grid.className = 'xe-featured-cards__grid';

  cardRows.forEach((row) => {
    const cells = [...row.children];
    const title = val(cells[CELL.TITLE]);
    if (!title) return; // a card with no title is not rendered

    const item = document.createElement('li');
    item.className = 'xe-featured-cards__card';
    moveInstrumentation(row, item);

    // Image: only the Image and Destructured styles use it.
    if (cardStyle !== 'surface') {
      const imageCell = cells[CELL.IMAGE];
      const img = imageCell?.querySelector('img');
      const anchor = imageCell?.querySelector('a');
      const src = img?.src || anchor?.getAttribute('href');
      const media = document.createElement('div');
      media.className = 'xe-featured-cards__media';
      if (src) {
        const alt = val(cells[CELL.ALT]);
        const picture = createOptimizedPicture(src, alt, false, [
          { media: '(min-width: 900px)', width: '600' },
          { width: '400' },
        ]);
        if (!alt) picture.querySelector('img').setAttribute('role', 'presentation');
        if (img) moveInstrumentation(img, picture.querySelector('img'));
        media.append(picture);
      } else {
        // Empty placeholder keeps the grid aligned before an author
        // selects an asset, matching the reference design.
        media.classList.add('xe-featured-cards__media--empty');
      }
      item.append(media);
    }

    const body = document.createElement('div');
    body.className = 'xe-featured-cards__body';

    const iconName = val(cells[CELL.ICON]);
    if (showIcon && iconName) {
      const icon = document.createElement('span');
      icon.className = `xe-featured-cards__icon icon-${iconName}`;
      icon.setAttribute('aria-hidden', 'true');
      body.append(icon);
    }

    const cardTitle = document.createElement('h3');
    cardTitle.className = 'xe-featured-cards__card-title';
    cardTitle.textContent = title;
    body.append(cardTitle);

    const descriptionText = val(cells[CELL.DESCRIPTION]);
    if (descriptionText) {
      const description = document.createElement('p');
      description.className = 'xe-featured-cards__card-description';
      description.textContent = descriptionText;
      body.append(description);
    }

    const actionText = val(cells[CELL.ACTION_TEXT]);
    const linkAnchor = cells[CELL.ACTION_LINK]?.querySelector('a');
    const href = linkAnchor?.getAttribute('href') || val(cells[CELL.ACTION_LINK]);
    if (actionText && href) {
      const link = document.createElement('a');
      link.className = 'xe-featured-cards__action';
      link.href = href;
      link.textContent = actionText;
      if (showActionIcon) link.classList.add('xe-featured-cards__action--with-icon');
      body.append(link);
    }

    item.append(body);
    grid.append(item);
  });

  block.textContent = '';
  if (header.children.length) block.append(header);
  if (grid.children.length) block.append(grid);
}