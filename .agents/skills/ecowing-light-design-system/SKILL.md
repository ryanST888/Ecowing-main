---
name: ecowing-light-design-system
description: Project-local dual-mode interface system for EcoWing. Use when creating, editing, polishing, or reviewing the React/Vite homepage, dashboard, live map, report flow, cards, dialogs, theme behavior, responsive behavior, or future production UI patterns.
---

# EcoWing Dual-Mode Design System

Read `DESIGN.md` and `.impeccable.md` before changing final-site UI.

## Required Context

- `DESIGN.md` is the source of truth for tokens, components, accessibility, and responsive rules.
- `.impeccable.md` defines the audience, brand personality, and Coastal Field Station direction.
- The React/Vite application lives at the project root, with shared screens in `components/` and global theme rules in `index.css`.

## Rules

- Preserve the existing React/Vite architecture and application behavior.
- Use the centralized dark and light theme tokens before adding component-specific raw values.
- Keep dark mode as the default and persist an explicit user selection.
- Theme-aware components must change all related surfaces together, including map tiles and dialogs.
- Keep the public homepage expressive and the operational screens efficient, but visually related.
- Use deep coastal-green text, white surfaces, pale-green secondary surfaces, emerald actions, and restrained yellow accents.
- Keep white text only on dark action/status backgrounds with sufficient contrast.
- Preserve semantic headings, labels, keyboard support, visible focus, and reduced-motion behavior.
- Verify desktop and mobile layouts after material visual changes.

## Component Additions

1. Confirm an existing pattern cannot cover the use case.
2. Define purpose, variants, and content rules.
3. Use the documented tokens and shared theme selectors.
4. Support narrow and wide layouts.
5. Record reusable additions in `DESIGN.md`.

## Handoff

Report changed files, responsive and browser checks, build results, and any deliberate deviations from `DESIGN.md`.
