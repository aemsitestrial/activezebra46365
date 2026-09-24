# Content Hub Zone Block Filter

How to restrict which blocks authors can add to a specific Content Hub zone section in the Universal Editor (UE).

---

## Overview

By default, every section shows the full block palette when an author clicks "+". This guide explains how to restrict a zone section (e.g. Orientation) so only specific blocks are available.

The solution has three parts:
1. Register a **zone style option** on the Section model
2. Add a **restricted filter** and a **new section type** to the component config files
3. Add **runtime JavaScript** in `editor-support.js` that overrides `data-aue-filter` when UE is active

---

## Step 1 — Add a Zone Style Option to the Section Model

Edit `models/_section.json`. Under the `style` multiselect field, add a new option:

```json
{
  "name": "Zone — My Zone",
  "value": "zone-my-zone"
}
```

**Rule:** The `value` must be lowercase with hyphens only (e.g. `zone-orientation`). This value becomes a CSS class on the section element after Franklin's `decorateSections()` runs.

Example — existing zone options in this project:

```json
{ "name": "Zone — Orientation",       "value": "zone-orientation" },
{ "name": "Zone — Awareness",         "value": "zone-awareness" },
{ "name": "Zone — Primary Actions",   "value": "zone-primary-actions" },
{ "name": "Zone — Supporting Content","value": "zone-supporting" },
{ "name": "Zone — Trust & Credibility","value": "zone-trust" }
```

---

## Step 2 — Add a Restricted Filter

### 2a. Source file: `models/_section.json`

Add a new entry to the `filters` array:

```json
{
  "id": "section-my-zone",
  "components": [
    "xe-hero",
    "xe-featured-cards"
  ]
}
```

The `id` must match what you will reference in the component definition (Step 2b) and in the JavaScript (Step 3).  
The `components` array lists the **block IDs** from `component-definition.json` that authors are allowed to add.

### 2b. Compiled file: `component-filters.json`

Add the same entry to the root array:

```json
{
  "id": "section-my-zone",
  "components": [
    "xe-hero",
    "xe-featured-cards"
  ]
}
```

> **Note:** `component-filters.json` is the file AEM/UE actually reads. `models/_section.json` is the source — keep both in sync.

---

## Step 3 — Add a New Section Type (for new pages)

This lets authors create a pre-configured zone section from scratch. It is optional for existing pages but recommended for new ones.

### 3a. Source file: `models/_section.json`

Add a new entry to the `definitions` array:

```json
{
  "title": "Content Hub — My Zone",
  "id": "section-my-zone",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/section/v1/section",
        "template": {
          "model": "section",
          "style": "zone-my-zone"
        }
      }
    }
  }
}
```

### 3b. Compiled file: `component-definition.json`

Add the same definition inside the `"Sections"` group's `components` array:

```json
{
  "title": "Content Hub — My Zone",
  "id": "section-my-zone",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/section/v1/section",
        "template": {
          "model": "section",
          "style": "zone-my-zone"
        }
      }
    }
  }
}
```

> **Note:** `component-definition.json` is the compiled file UE reads. Keep it in sync with `models/_section.json`.

---

## Step 4 — Register the Zone Filter in JavaScript

### Why JavaScript is needed

AEM serves sections with `data-aue-filter="section"` (the generic filter) in the HTML, even if a zone style is set. The JavaScript intercepts this and overrides it to the restricted filter ID so UE shows only the allowed blocks.

### 4a. Register the mapping — `scripts/editor-support.js`

Find the `ZONE_FILTER_MAP` constant near the top of the file and add your zone:

```js
const ZONE_FILTER_MAP = {
  'zone-orientation': 'section-orientation',
  'zone-my-zone': 'section-my-zone',   // <-- add this
};
```

**Key:** CSS class name added by `decorateSections()` (matches the style `value` from Step 1).  
**Value:** Filter ID from `component-filters.json` (from Step 2).

No other code changes are needed — `startZoneFilterWatcher()` picks up the mapping automatically.

### 4b. How the watcher works (do not modify)

`editor-support.js` is loaded from `scripts/scripts.js` the moment UE adds the `adobe-ue-edit` class to `<html>`. A `MutationObserver` then watches `main` continuously:

- When a section gets the `zone-my-zone` CSS class, it sets `data-aue-filter="section-my-zone"` on it.
- When UE re-renders content and resets `data-aue-filter` to `"section"`, the observer immediately overrides it back.
- A guard condition (`!== filterId`) prevents infinite loops.

```js
// scripts/scripts.js — loads editor-support.js when UE is active
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

```js
// scripts/editor-support.js — persistent watcher
function startZoneFilterWatcher() {
  applyZoneSectionFilters();
  const main = document.querySelector('main');
  if (!main) return;
  new MutationObserver(applyZoneSectionFilters).observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-aue-filter'],
  });
}
```

---

## Step 5 — Author Requirement

For the filter to apply to **any existing section**, the author must set the section's **Style** field in UE properties to the matching zone option (e.g. "Zone — Orientation"). This is what causes `decorateSections()` to add the CSS class that the watcher targets.

New sections created using the "Content Hub — My Zone" type (Step 3) have the style pre-set automatically.

---

## Summary Checklist

| Step | File | What to add |
|------|------|-------------|
| 1 | `models/_section.json` → `style` options | New `{ name, value }` entry |
| 2a | `models/_section.json` → `filters` | New filter with allowed block IDs |
| 2b | `component-filters.json` | Same filter (compiled copy) |
| 3a | `models/_section.json` → `definitions` | New section type definition |
| 3b | `component-definition.json` → Sections group | Same definition (compiled copy) |
| 4 | `scripts/editor-support.js` → `ZONE_FILTER_MAP` | One new key/value pair |
