# Content Hub — Zone Block Filter & Locked Section Structure

Developer guide covering two related features for the Content Hub page in Universal Editor (UE):

1. **Zone Block Filter** — restrict which blocks authors can add inside a specific zone section
2. **Locked Section Structure** — prevent authors from adding, deleting, or moving sections in `main`

---

## Feature 1: Zone Block Filter

### Problem

By default every section shows the full block palette when an author clicks "+". The zone filter restricts a named zone section (e.g. Orientation) so only specific blocks are available inside it.

### Why JavaScript is required

AEM always serves sections with `data-aue-filter="section"` (the generic filter) in the HTML, even when a zone style is set on the section. JavaScript must override this attribute to the restricted filter ID so UE shows only the allowed blocks. This override must be re-applied persistently because UE replaces section HTML every time a content change is made.

---

### Step 1 — Add a Zone Style Option to the Section Model

Edit `models/_section.json`. Under the `style` multiselect field, add a new option:

```json
{ "name": "Zone — My Zone", "value": "zone-my-zone" }
```

The `value` must be lowercase with hyphens only. It becomes a CSS class on the section element after Franklin's `decorateSections()` runs.

Existing zone options in this project:

```json
{ "name": "Zone — Orientation",        "value": "zone-orientation" },
{ "name": "Zone — Awareness",          "value": "zone-awareness" },
{ "name": "Zone — Primary Actions",    "value": "zone-primary-actions" },
{ "name": "Zone — Supporting Content", "value": "zone-supporting" },
{ "name": "Zone — Trust & Credibility","value": "zone-trust" }
```

---

### Step 2 — Add a Restricted Filter

#### 2a. Source file: `models/_section.json`

Add a new entry to the `filters` array:

```json
{
  "id": "section-my-zone",
  "components": ["xe-hero", "xe-featured-cards"]
}
```

`id` must match the component definition (Step 3) and the JavaScript mapping (Step 4).  
`components` lists the block IDs from `component-definition.json` that are allowed.

#### 2b. Compiled file: `component-filters.json`

Add the same entry to the root array. This is the file UE actually reads — keep it in sync with the source.

```json
{
  "id": "section-my-zone",
  "components": ["xe-hero", "xe-featured-cards"]
}
```

---

### Step 3 — Add a New Section Type (optional, for new pages)

Lets authors create a pre-styled zone section from scratch. Skip if the zone is always created by a developer via template.

#### 3a. Source file: `models/_section.json` → `definitions` array

```json
{
  "title": "Content Hub — My Zone",
  "id": "section-my-zone",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/section/v1/section",
        "template": { "model": "section", "style": "zone-my-zone" }
      }
    }
  }
}
```

#### 3b. Compiled file: `component-definition.json` → `Sections` group

Add the same definition inside the `Sections` group's `components` array. Keep in sync with the source.

---

### Step 4 — Register the Zone Mapping in JavaScript

#### `scripts/editor-support.js` → `ZONE_FILTER_MAP`

```js
const ZONE_FILTER_MAP = {
  'zone-orientation': 'section-orientation',
  'zone-my-zone':     'section-my-zone',   // add this line
};
```

**Key** — CSS class added by `decorateSections()` (matches the style `value` from Step 1).  
**Value** — Filter ID from `component-filters.json` (from Step 2).

No other code changes are needed. `startZoneFilterWatcher()` picks up the mapping automatically via the `MutationObserver`.

---

### Step 5 — Author Requirement

For the filter to apply to any **existing** section, the author must open the section's properties in UE and set its **Style** field to the matching zone option (e.g. "Zone — Orientation"). Franklin's `decorateSections()` then adds the CSS class that the watcher targets.

Sections created from the zone section type (Step 3) have the style pre-set automatically.

---

## Feature 2: Locked Section Structure

### Problem

Authors could add new sections to `main` and delete existing ones from the content tree panel in UE. The page's section structure must match the template — authors should only edit content inside sections, not the section layout itself.

### What was implemented

Two changes were made to enforce this:

#### A. Prevent adding sections — `component-filters.json`

The `main` filter was set to an empty components list:

```json
{ "id": "main", "components": [] }
```

UE reads this filter to build the "+" component picker at the `main` level. An empty list removes the picker entirely, so authors have no UI to add a new section.

#### B. Remove delete and move from sections — `scripts/editor-support.js`

UE exposes the `data-aue-behavior` attribute on components. Setting it to `"locked"` tells UE to suppress the delete and move actions for that element in both the inline action bar and the content tree panel.

This attribute is applied to every `main > .section` in `applyZoneSectionFilters()`, which already runs on page load and after every DOM change via `MutationObserver`:

```js
// scripts/editor-support.js

function applyZoneSectionFilters() {
  // --- Zone filter overrides (Feature 1) ---
  Object.entries(ZONE_FILTER_MAP).forEach(([zoneClass, filterId]) => {
    document.querySelectorAll(`main .section.${zoneClass}`).forEach((section) => {
      if (section.getAttribute('data-aue-filter') !== filterId) {
        section.setAttribute('data-aue-filter', filterId);
      }
    });
  });

  // --- Lock all sections (Feature 2) ---
  document.querySelectorAll('main > .section[data-aue-resource]').forEach((section) => {
    if (section.getAttribute('data-aue-behavior') !== 'locked') {
      section.setAttribute('data-aue-behavior', 'locked');
    }
  });
}
```

The `MutationObserver` also watches the `data-aue-behavior` attribute so if UE ever resets it, the lock is re-applied immediately:

```js
function startZoneFilterWatcher() {
  applyZoneSectionFilters();
  const main = document.querySelector('main');
  if (!main) return;
  new MutationObserver(applyZoneSectionFilters).observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-aue-filter', 'data-aue-behavior'],
  });
}
```

#### Why the previous approach (JS event interception) did not work

An earlier version used `aue:content-remove` to detect and block section deletions. This did not prevent the delete button from appearing, and the event itself fires **after** UE has already sent the DELETE request to AEM's JCR — by the time the page JavaScript ran, the section was already gone from the content repository. The `data-aue-behavior="locked"` approach stops the action at the UE shell level before any request is made.

---

## How `editor-support.js` is loaded

`editor-support.js` is not auto-loaded. `scripts/scripts.js` imports it dynamically the moment UE adds the `adobe-ue-edit` class to `<html>`. A `MutationObserver` handles the case where that class is added asynchronously after the script runs:

```js
// scripts/scripts.js — inside loadLazy()
const loadUEEditorSupport = () => import('./editor-support.js');
if (document.documentElement.classList.contains('adobe-ue-edit')) {
  loadUEEditorSupport();
} else {
  const ueClassObserver = new MutationObserver(() => {
    if (document.documentElement.classList.contains('adobe-ue-edit')) {
      ueClassObserver.disconnect();
      loadUEEditorSupport();
    }
  });
  ueClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
```

---

## Summary Checklist

### Feature 1 — Zone Block Filter

| Step | File | What to add |
|------|------|-------------|
| 1 | `models/_section.json` → `style` options | New `{ name, value }` entry |
| 2a | `models/_section.json` → `filters` | New filter with allowed block IDs |
| 2b | `component-filters.json` | Same filter (compiled copy) |
| 3 *(optional)* | `models/_section.json` → `definitions` + `component-definition.json` | New section type definition in both files |
| 4 | `scripts/editor-support.js` → `ZONE_FILTER_MAP` | One new `'zone-class': 'filter-id'` pair |

### Feature 2 — Locked Section Structure

| What | Where | Detail |
|------|-------|--------|
| Prevent adding sections | `component-filters.json` → `main` filter | Set `"components": []` |
| Prevent deleting/moving sections | `scripts/editor-support.js` → `applyZoneSectionFilters` | Sets `data-aue-behavior="locked"` on all `main > .section` elements |
| Re-applies on DOM change | `scripts/editor-support.js` → `startZoneFilterWatcher` | `MutationObserver` watches `data-aue-behavior` in `attributeFilter` |
