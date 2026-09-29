import { moveInstrumentation } from '../../scripts/scripts.js';

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const SIZES = ['generous', 'comfortable', 'compact', 'spacious'];
const ALIGNMENTS = ['left', 'center', 'right'];
const COLUMNS = ['single', 'two'];
const BACKGROUNDS = ['default', 'subtle', 'muted'];
const CONTENT_TYPES = ['message', 'message-action'];

const val = (node) => (node ? node.textContent.trim() : '');

export default function decorate(block) {
  const rows = [...block.children];

  const headingLevelRow = rows.find((row) => HEADING_LEVELS.includes(val(row).toLowerCase()));
  const sizeRow = rows.find((row) => SIZES.includes(val(row).toLowerCase()));
  const alignmentRow = rows.find((row) => ALIGNMENTS.includes(val(row).toLowerCase()));
  const columnRow = rows.find((row) => COLUMNS.includes(val(row).toLowerCase()));
  const backgroundRow = rows.find((row) => BACKGROUNDS.includes(val(row).toLowerCase()));
  const contentTypeRow = rows.find((row) => CONTENT_TYPES.includes(val(row).toLowerCase()));

  // actionLink row: contains an anchor element.
  const actionLinkRow = rows.find((row) => row.querySelector('a'));

  const typed = new Set(
    [
      headingLevelRow,
      sizeRow,
      alignmentRow,
      columnRow,
      backgroundRow,
      contentTypeRow,
      actionLinkRow,
    ].filter(Boolean),
  );

  // Remaining text-only rows in document order: heading, message, icon, actionText
  const textRows = rows.filter((row) => !typed.has(row));
  const [headingRow, messageRow, iconRow, actionTextRow] = textRows;

  const headingTag = headingLevelRow ? val(headingLevelRow).toLowerCase() : 'h2';
  const size = sizeRow ? val(sizeRow).toLowerCase() : 'generous';
  const alignment = alignmentRow ? val(alignmentRow).toLowerCase() : 'center';
  const column = columnRow ? val(columnRow).toLowerCase() : 'single';
  const background = backgroundRow ? val(backgroundRow).toLowerCase() : 'default';

  // Fall back to "message-action" when the field hasn't been authored yet
  // (e.g. blocks inserted before the bannerContent field was added).
  const contentType = contentTypeRow
    ? val(contentTypeRow).toLowerCase()
    : 'message-action';
  const showAction = contentType === 'message-action';

  block.classList.add(
    `xe-banner--size-${size}`,
    `xe-banner--align-${alignment}`,
    `xe-banner--col-${column}`,
    `xe-banner--bg-${background}`,
    `xe-banner--content-${showAction ? 'message-action' : 'message'}`,
  );

  const inner = document.createElement('div');
  inner.className = 'xe-banner__inner';

  // --- icon -----------------------------------------------------------------
  const iconName = val(iconRow);
  if (iconName) {
    const icon = document.createElement('span');
    icon.className = `xe-banner__icon icon-${iconName}`;
    icon.setAttribute('aria-hidden', 'true');
    inner.append(icon);
  }

  // --- content group (heading + message) -----------------------------------
  const contentGroup = document.createElement('div');
  contentGroup.className = 'xe-banner__content';

  const headingText = val(headingRow);
  if (headingText) {
    const heading = document.createElement(headingTag);
    heading.className = 'xe-banner__heading';
    heading.textContent = headingText;
    if (headingRow) moveInstrumentation(headingRow, heading);
    contentGroup.append(heading);
  }

  const messageText = val(messageRow);
  if (messageText) {
    const message = document.createElement('p');
    message.className = 'xe-banner__message';
    message.textContent = messageText;
    if (messageRow) moveInstrumentation(messageRow, message);
    contentGroup.append(message);
  }

  inner.append(contentGroup);

  // --- action ---------------------------------------------------------------
  if (showAction) {
    const actionText = val(actionTextRow);
    const anchor = actionLinkRow?.querySelector('a');
    const href = anchor?.getAttribute('href') || val(actionLinkRow) || '#';

    if (actionText) {
      const action = document.createElement('a');
      action.className = 'xe-banner__action';
      action.href = href;
      action.textContent = actionText;
      if (actionTextRow) moveInstrumentation(actionTextRow, action);
      inner.append(action);
    }
  }

  block.textContent = '';
  block.append(inner);
}
