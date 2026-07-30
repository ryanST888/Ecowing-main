# EcoWing Dual-Mode Interface System

## Market Context

EcoWing is a coastal-waste intelligence platform combining public reporting, AI-assisted evidence review, live mapping, and operational monitoring. The interface serves two modes at once: a public-facing mission website and a data-heavy field operations tool.

## Brand Strategy

The interface supports a focused dark operations mode and an optimistic Coastal Field Station light mode. Dark is the default; users can switch modes from the persistent header control. Both modes keep EcoWing's emerald and yellow recognition cues.

- Primary impression: clean, capable, environmental, trustworthy.
- Brand anchors: emerald action color, deep coastal-green text, warm yellow highlights.
- Photography: real coastlines, people, field work, drones, and evidence imagery.
- Voice: direct, evidence-led, hopeful, and practical.

## Page System

- Global shell: translucent deep-navy header by default, a warm off-white light alternative, clear active navigation, compact utility actions, and a persistent theme toggle at the top right.
- Homepage: bright photographic hero, white information cards, pale-green section bands, strong dark-green headings.
- Dashboard: white data panels, subtle separators, accessible chart colors, restrained shadows.
- Live map: light CARTO base map, white floating controls, high-contrast markers and legend.
- Report flow: white form panels, pale secondary surfaces, clear upload and review states.
- Modals and expanded cards: white elevated surfaces over a soft darkened backdrop.

## Component Inventory

- Header, desktop navigation, mobile navigation, language and authentication controls.
- Hero, statistic cards, capability cards, award cards, video feature, team cards, CTA band, footer.
- Metric cards, charts, report history cards, filters, map controls, map popups, legends.
- Upload dropzone, inputs, selects, severity controls, review panels, confirmation actions.
- Login modal, team/award detail modal, site detail modal, expanded report evidence panel.

## Direction Options

### 1. Coastal Field Station — selected

Warm white canvas, deep green typography, emerald controls, yellow highlights, rounded white panels, and subtle botanical gradients. Best fit for a platform balancing public trust with operational data.

### 2. Civic Research Lab

Cool white and blue-green surfaces, tighter radii, denser tables, and minimal decoration. Strong for institutional users but less distinctive for the public homepage.

### 3. Sunlit Conservation Journal

Cream surfaces, editorial typography, larger photography, and stronger yellow accents. Strong for storytelling but less efficient for dashboards and field reporting.

## Selected Tokens

### Dark Mode — default

- Canvas: `#08111f`
- Surface: `#0f172a`
- Surface strong: `#1e293b`
- Text primary: `#f8fafc`
- Text secondary: `#cbd5e1`
- Text muted: `#94a3b8`
- Border: `#334155`
- Emerald action: `#10b981`
- Yellow accent: `#facc15`

### Light Mode

- Canvas: `#f4f8f4`
- Surface: `#ffffff`
- Surface muted: `#eef5f0`
- Surface strong: `#e2eee7`
- Text primary: `#17352b`
- Text secondary: `#526b61`
- Text muted: `#71847c`
- Border: `#d9e5dd`
- Emerald action: `#07845d`
- Emerald hover: `#066f50`
- Emerald soft: `#e5f5ee`
- Yellow accent: `#d59a00`
- Yellow soft: `#fff5cf`
- Critical: `#c93636`
- High: `#c65d13`
- Medium: `#a86f00`
- Low: `#087f5b`

### Typography

- Family: Inter with Noto Sans TC fallback.
- Display: 700–900 weight, tight tracking, deep coastal-green.
- Body: 400–500 weight, comfortable 1.6–1.8 line height.
- Labels: 600–700 weight, compact size, moderate letter spacing.

### Spacing and Shape

- Base spacing unit: 4px.
- Section rhythm: 64–96px desktop, 48–64px mobile.
- Panel padding: 20–32px.
- Radii: 10px controls, 16px panels, 24–32px feature cards.
- Borders: 1px neutral green-gray.

### Shadows

- Small: `0 1px 2px rgba(18, 53, 42, 0.06)`
- Panel: `0 12px 35px rgba(18, 53, 42, 0.09)`
- Floating control: `0 16px 40px rgba(18, 53, 42, 0.14)`

### Motion

- Standard transition: 180–240ms ease-out.
- Reveal motion: 500–800ms with short vertical travel.
- Respect `prefers-reduced-motion`; remove parallax and nonessential transforms.

## Accessibility Rules

- Maintain WCAG AA contrast for body text, controls, and state labels.
- Keep white text only on sufficiently dark action or status backgrounds.
- Provide visible emerald focus rings with an outer white offset.
- Never rely on color alone for severity or report state.
- Preserve semantic headings, labels, keyboard activation, and modal close controls.
- Keep touch targets at least 40px, preferably 44px, on mobile.
- Give the theme toggle an explicit accessible name that describes the destination mode.

## Theme Behavior

- Dark mode is used when no preference has been saved.
- Save the user's explicit selection in local storage and restore it on later visits.
- Change the homepage art direction, application surfaces, dialogs, scrollbars, and map tiles together.
- The desktop toggle sits at the far right of the header utilities; mobile keeps it beside the navigation button.

## Responsive Rules

- Collapse the header navigation below the existing medium breakpoint.
- Stack dense map filters and dashboard cards when space is constrained.
- Keep horizontal scrolling limited to data visualizations that cannot reflow.
- Use full-width modal panels with 16px outer spacing on small screens.
- Preserve readable content widths even when the page canvas is wide.

## Production-Build Brief

Implement dark and Coastal Field Station light modes through one centralized theme state over the existing React/Vite application. Preserve all current routes, state, API behavior, authentication, mapping, upload, and reporting logic. Dark is the default, explicit choices persist, and the CARTO basemap follows the active theme while satellite remains available. Future components must use the tokens above so the two modes do not drift.
