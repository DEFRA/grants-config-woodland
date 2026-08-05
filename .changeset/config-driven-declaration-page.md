---
'grants-config-woodland': minor
---

Move the declaration page copy into the page's `config:` block and drop the `view:` override, so the page renders from the unified grants-ui declaration template. The page heading now comes from the page `title` rather than a duplicate `config.heading`. Presentation only — the heading, button label, body copy, support panel and submitted hidden fields are unchanged.
