---
name: JanSetu Civic Pulse
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#ab0b1c'
  on-tertiary: '#ffffff'
  tertiary-container: '#cf2c30'
  on-tertiary-container: '#ffecea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-number:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies a modern civic-utility aesthetic that fuses the operational clarity of Linear, the refined precision of Stripe, and the spatial ergonomics of Apple Human Interface Guidelines. It exists to transform chaotic civic and environmental emergency data—specifically urban flood management and public infrastructure grievances—into lucid, actionable, and anxiety-reducing interactions.

The visual style is **Daylight Minimalist**: high-luminance canvas backgrounds, pure white tactile card elevations, hyper-crisp hairline dividers, and decisive typographic hierarchy. Every pixel emphasizes utility, transparency, and authoritative calm during high-stress civic events. Visual clutter is eliminated in favor of generous micro-spacing, crystalline contrast, and explicit state signaling through institutional badge palettes.

## Colors

The palette is engineered around high daytime legibility and instant civic triage:

- **Canvas & Surface Tier:** Canvas foundation rests strictly on Slate-50 (`#F8FAFC`). Primary cards, sheets, and overlay elements use pure White (`#FFFFFF`). Secondary well/inset sections use Slate-100 (`#F1F5F9`).
- **Hairlines & Dividers:** Crisp structural boundaries are drawn using Slate-200 (`#E2E8F0`). Subdued borders for nested modules utilize Slate-100 (`#F1F5F9`).
- **Typography & Content:** Slate-900 (`#0F172A`) commands all primary titles, stats, and active headers. Slate-600 (`#475569`) governs body copy, and Slate-400 (`#94A3B8`) handles supplementary meta labels.
- **Action & State Roles:**
  - **Primary Action (Trust Blue):** `#2563EB` anchors verification seals, active submissions, primary buttons, and system telemetry.
  - **Pending / Cautionary (Amber):** `#F59E0B` flags in-review grievances and waterlogged drainage alerts.
  - **Resolved / Stable (Emerald):** `#10B981` signals verified remediations, safe zones, and clearing pumps.
  - **Urgent / Life-Safety (Coral Red):** `#EF4444` denotes flood flash alerts, breached embankments, and SOS escalations.

## Typography

The dual-type system delivers structure and legibility:

- **Headlines & Display (Plus Jakarta Sans):** Crafted with subtle geometric openness and contemporary clarity. It conveys modern civic authority without feeling institutional or outdated. Generous negative tracking is applied to sizes 22px and up to enforce visual cohesion.
- **Body & Labels (Inter):** Leveraged for all critical operational text, civic report logs, and data matrices due to its unmatched x-height consistency, numeric legibility, and technical neutrality.
- **Numerical Telemetry:** Tabular lining (`font-variant-numeric: tabular-nums`) is mandatory across all water levels, incident IDs, geo-coordinates, and countdown timers to prevent visual jitter in dynamic feeds.

## Layout & Spacing

The layout is built on an exact 8-point spatial model with 4-point micro-adjustments for badges and icons. 

- **Grid Framework:** Desktop layouts employ a 12-column responsive fluid grid with `2rem` outer page margins and `1.5rem` gutters. Tablet devices scale down to an 8-column system with `1.5rem` margins and `1rem` gutters. Mobile screen sizes compress into a 4-column layout with `1rem` margins and `0.75rem` gutters.
- **Visual Rhythm:** Operational dashboards, telemetry streams, and incident feeds leverage compact component gaps (`space-xs` to `space-sm`) to maximize density, while public informational sections and landing dashboards employ `space-lg` to `space-xl` for an airy, accessible atmosphere.
- **Screen Reflow:** Incident feeds on desktop maintain a pinned two-column split (60% live situational map, 40% incident queue); on mobile devices, this seamlessly stacks with a quick-toggle sticky bottom floating segment control.

## Elevation & Depth

Visual hierarchy uses a refined hybrid of **low-contrast 1px outlines** and **diffused ambient shadows**:

- **Level 0 (Flat Canvas):** `#F8FAFC` base surface with no shadow or border.
- **Level 1 (Default Cards & Data Tiles):** `#FFFFFF` surface enclosed in a 1px solid `#E2E8F0` border, accompanied by a micro-ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)`.
- **Level 2 (Hovered Cards & Interactive Controls):** `#FFFFFF` surface, 1px solid `#CBD5E1` border, lifted via `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, Slide-over Panels, Alert Toasts):** Pure `#FFFFFF` surface suspended with a deep, diffused drop: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Glassmorphic Floating Accents:** Floating map filters and persistent navigation bars employ `#FFFFFF` at 85% opacity with an active `backdrop-filter: blur(12px)` and a crisp 1px border of `rgba(226, 232, 240, 0.8)`.

## Shapes

The interface embraces a balanced modern curvature (Scale 2):
- **Base Components (Inputs, Buttons, Badges):** Standard elements use `0.5rem` (8px) radius to ensure tactile clickability and crisp alignment.
- **Structural Modules (Cards, Modals, Map Panels):** Use `1rem` (16px) corner radiuses (`rounded-lg`), imparting a polished, consumer-grade Apple HIG feel.
- **Status Indicators & Avatars:** Micro status indicators, emergency alert chips, and civic tags adopt full pill shapes (`rounded-full` / `9999px`) for quick visual grouping.

## Components

### Buttons & Interactive Controls
- **Primary:** Solid Trust Blue (`#2563EB`) with pure white label, `0.5rem` radius, 1px `#1D4ED8` inset top-highlight. Subtle hover transition to `#1D4ED8`. Active state scales subtly to `98%`.
- **Secondary:** Clean White (`#FFFFFF`) with Slate-900 (`#0F172A`) label, 1px solid `#E2E8F0`, ambient micro-shadow. Hover triggers border color change to `#CBD5E1` with Slate-50 background.
- **Critical / SOS:** Solid Urgent Coral Red (`#EF4444`) with white typography, accompanied by a soft pulsing radial ring (`rgba(239, 68, 68, 0.2)`).

### Badges & Civic Status Chips
- Built with a compact height of 24px, pill-radiused (`9999px`), 11px uppercase bold typography (`label-sm`), featuring a leading 6px circular status dot.
- **Pending:** Amber background (`#FEF3C7`), text and dot `#B45309`, border 1px solid `#FDE68A`.
- **Resolved:** Emerald background (`#D1FAE5`), text and dot `#047857`, border 1px solid `#A7F3D0`.
- **Urgent / Flood Alert:** Coral Red background (`#FEE2E2`), text and dot `#B91C1C`, border 1px solid `#FECACA`.
- **Verified Ward/Dept:** Trust Blue background (`#EFF6FF`), text and dot `#1D4ED8`, border 1px solid `#BFDBFE`.

### Data Cards & Incident Containers
- White background (`#FFFFFF`), `1rem` border radius, 1px border in `#E2E8F0`. 
- Headers feature clean division lines separating metadata (Ward number, timestamp, severity) from descriptive grievance text and imagery.

### Inputs & Civic Form Fields
- 40px standard touch target height, 1px solid border (`#CBD5E1`), background `#FFFFFF`, text `#0F172A`, placeholder `#94A3B8`.
- Focus state brings an instantaneous 1px border transition to `#2563EB` along with a 3px outer glow ring of `rgba(37, 99, 235, 0.15)`.

### Checkboxes, Radios & Toggles
- Checkbox/Radio borders use 1.5px `#CBD5E1` that transitions to `#2563EB` upon selection, marked with an interior white check or pip.
- Toggles use a standard Apple HIG switch proportion with a 24px height, `#E2E8F0` track (inactive), `#2563EB` track (active), and a crisp white circular thumb with a 1px drop shadow.

### Domain-Specific Components
- **Flood Water Gauge Tile:** Minimal linear bar metric featuring danger thresholds (Green < 1.5m, Amber 1.5m–2.5m, Red > 2.5m) paired with tabular numeric readouts and an immediate delta trend icon (rising/falling).
- **Incident Timeline Stepper:** Hairline vertical guide rail (`#E2E8F0`) with 20px nodes indicating chronological lifecycle stages: *Reported*, *Dispatched*, *Field Action*, and *Resolved*.