---
name: Garden Tracker
description: Personal raised-bed garden management — task schedule, fertiliser rotation, AI bed analysis.
colors:
  bed-soil-green: "#3d6b35"
  seedling-green: "#5a8f4a"
  fresh-leaf: "#a8d878"
  weathered-linen: "#f5f0e8"
  aged-canvas: "#e8e0d0"
  harvest-amber: "#d4860a"
  root-rot-red: "#8b1a1a"
  garden-soil-brown: "#6b4c2a"
  body-ink: "#2a2a2a"
  muted-stone: "#888888"
typography:
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.5px"
  task:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  pill: "20px"
  card: "10px"
  chip: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.bed-soil-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  button-primary-hover:
    backgroundColor: "{colors.seedling-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  button-pill:
    backgroundColor: "{colors.seedling-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  pill-inactive:
    backgroundColor: "{colors.aged-canvas}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  pill-active:
    backgroundColor: "{colors.bed-soil-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  week-badge:
    backgroundColor: "{colors.bed-soil-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  stage-badge:
    backgroundColor: "{colors.seedling-green}"
    textColor: "{colors.weathered-linen}"
    rounded: "{rounded.chip}"
    padding: "3px 7px"
---

# Design System: Garden Tracker

## 1. Overview

**Creative North Star: "The Working Gardener's Notebook"**

This is a tool used standing in a garden. The person using it has dirt on their hands, the sun is out, and they need to know what to do right now. Every design decision flows from that physical reality: high contrast for legibility in direct sunlight, touch targets large enough for imprecise outdoor taps, information density that answers the question without making the user hunt. The aesthetic is a well-kept field notebook — not precious, not decorative, earned through use.

The palette is drawn directly from the garden it serves: deep soil greens, warm linen backgrounds, amber for urgency, the dull red of a plant in trouble. Nothing is synthetic. The system explicitly rejects the pastel-wellness aesthetic, the chrome-and-glass productivity app, and anything that looks like it was designed to win a design award before being used in a paddock.

The register is product, not brand. The design serves the workflow; it does not perform personality. A good tool feels invisible until you need it. This system aims for that.

**Key Characteristics:**
- High-contrast legibility as a non-negotiable, not a nice-to-have
- Earthy, grounded palette sourced from the subject matter itself
- Generous touch targets (44x44px minimum everywhere)
- Mobile-first with a useful desktop sidebar — not the reverse
- Flat-by-default elevation; shadow used structurally, never decoratively
- System UI font stack — fast, legible, native on every device

## 2. Colors: The Garden Palette

A palette drawn from the beds themselves. Two greens carry the primary action weight. Amber and red are reserved for urgency and error — they are never used decoratively.

### Primary
- **Deep Bed Soil Green** (`#3d6b35`): The primary action color. Navigation active states, primary buttons, section labels, the week badge, and any UI element that says "do this." Its darkness ensures legibility on cream backgrounds at WCAG AAA contrast.
- **Seedling Green** (`#5a8f4a`): Interactive states — apply buttons, task checkboxes when checked, active bed pills, stage badges. Lighter than Deep Bed Soil; used for confirmed or in-progress states.

### Secondary
- **Harvest Amber** (`#d4860a`): Overdue tasks, fertiliser cards in alternate rotation (Liquid Gold), urgency indicators. Never used for positive states. When you see amber, something needs attention.

### Tertiary
- **Root Rot Red** (`#8b1a1a`): Critical failures, urgent banners, overdue-past-tolerance states. Pulsing animation applied when urgent. Appears rarely — its rarity is functional.

### Neutral
- **Fresh Leaf** (`#a8d878`): Accent only — bed pills (unselected background), section label underlines, harvest-ready card borders. The lightest green; never used for text.
- **Weathered Linen** (`#f5f0e8`): Main app background. Warm, off-white — never pure white. All card backgrounds are built on top of this.
- **Aged Canvas** (`#e8e0d0`): Secondary surfaces — inactive pill buttons, week-group current highlight, sidebar active state, modal backdrop tint.
- **Garden Soil Brown** (`#6b4c2a`): Rarely surfaced. Fertiliser detail copy, decoration in the fertiliser card context only.
- **Body Ink** (`#2a2a2a`): All primary text. Warm dark, not pure black.
- **Muted Stone** (`#888888`): Secondary text, timestamps, labels, chevrons.

### Named Rules
**The Amber Reservation Rule.** Amber (`#d4860a`) is for things that need attention. It is never used for branding, decoration, or positive confirmation. If amber appears on screen, it means the user should act.

**The No-White Rule.** `#ffffff` is never used. All backgrounds and card surfaces use Weathered Linen (`#f5f0e8`) or white components on the linen canvas. The warmth is intentional — it reads better outdoors.

## 3. Typography

**Body Font:** system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif (native system stack)

**Character:** No custom fonts loaded. The system UI stack means instant render on every device — critical for an outdoor mobile tool. The hierarchy is achieved entirely through weight and size contrast, not typeface variation.

### Hierarchy
- **Title** (700, 18px, 1.2): Bed names, modal headers, tab page headings. Used sparingly — one per screen region.
- **Section Label** (700, 13px, uppercase, 0.5px letter-spacing): Category dividers — "This Week", "Overdue", "Harvest", fertiliser schedule headers. All-caps with generous letter-spacing ensures legibility at small size.
- **Body / Task** (400, 14–15px, 1.35–1.4): Task titles, notes, descriptions. The reading text. Never goes below 14px.
- **Label** (600, 10–12px, uppercase, 0.5px letter-spacing): Bed pill text, stage badges, week badges, timestamps. Semi-bold to hold at small size.
- **Meta** (400, 10–11px): Timestamps, "completed" text, secondary counts. Muted Stone color only.

### Named Rules
**The Floor Rule.** No text below 10px. On a phone in sunlight, 10px semi-bold uppercase is the floor. Labels below that size disappear outdoors. If the design requires smaller text, redesign the component.

## 4. Elevation

The system is flat by default. Surfaces sit on the Weathered Linen background; they are differentiated by color and border, not by lifting. Shadows appear only when a surface needs to communicate that it is raised above the base layer — cards, modals, the bottom navigation bar.

**The Flat-By-Default Rule.** Surfaces rest at ground level. Depth is earned by function: a card contains interactive content (shadow allowed); a section header divides content (no shadow needed). Never add shadow for decoration.

### Shadow Vocabulary
- **Surface shadow** (`0 2px 8px rgba(0,0,0,0.12)`): Applied to all cards, the bed detail panel, the fertiliser schedule, week groups. The standard raised-surface treatment.
- **Nav shadow** (`0 -2px 8px rgba(0,0,0,0.08)` on mobile, `2px 0 8px rgba(0,0,0,0.05)` on desktop sidebar): Separates the navigation layer from the content. Lighter than surface shadow because the nav is persistent infrastructure, not a focused element.
- **Toast shadow** (`0 4px 12px rgba(0,0,0,0.2)`): The only deeply lifted element. Toasts float above all content; their heavier shadow communicates transient elevation.

## 5. Components

### Buttons
Buttons feel like physical objects you press, not decorative elements you click. Shape is gently rounded (10px), not pill-shaped — that shape is reserved for navigation pills and badges.

- **Shape:** Gently curved corners (10px radius)
- **Primary:** Deep Bed Soil Green background (`#3d6b35`), Weathered Linen text, 14px padding, full-width on mobile (`width: 100%`) for the primary action button
- **Hover / Focus:** Background shifts to Seedling Green (`#5a8f4a`), `transition: opacity 0.15s`
- **Apply button (pill variant):** Seedling Green, pill-shaped (20px radius), used in the fertiliser bed list. Tighter padding (`8px 14px`), 12px semi-bold text.
- **Disabled:** `opacity: 0.5`, cursor default. The button remains visible but signals unavailability without confusion.
- **Undo button:** Ghost style — no background, 1px `#ccc` border, 11px text, `#888` color. Appears inline beside completed tasks; its visual quietness prevents it from competing with the primary task action.

### Chips / Badges
- **Stage badge:** Seedling Green pill (10px radius), white semi-bold text, 10px font size. Color-coded per stage — each stage has a named color in the JS `STAGE_COLORS` map.
- **Week badge:** Deep Bed Soil Green, pill-shaped, white 13px bold text. Appears in the Dashboard header and AI Analysis tab header.
- **Bed pill (navigation):** Inactive: Aged Canvas background, body-ink text. Active: Deep Bed Soil Green, white text. Transition `0.15s`. These are the primary tab-within-tab navigators on the Beds and Analysis screens.
- **Issue badge:** `#fde8e8` background, Root Rot Red text and border. Used in AI analysis results to surface detected problems.

### Cards / Containers
- **Corner style:** Gently curved (10px radius — the card radius)
- **Background:** White (`#ffffff`) on the Weathered Linen canvas. The white card surface lifts slightly above the cream background without needing shadow variation.
- **Shadow:** Standard surface shadow (`0 2px 8px rgba(0,0,0,0.12)`) on all primary cards.
- **Border:** `1px solid rgba(0,0,0,0.05)` on bed cards — a whisper border that helps cards read as distinct objects in low-contrast conditions (cloudy days, cheap phone screens).
- **Internal padding:** 12px standard. Fertiliser detail card uses 14–16px for the wider layout it requires.
- **Harvest cards:** Left accent border (4px) in stage-appropriate color — the one intentional use of a side stripe, because it conveys plant status at a glance before the text is read.

### Inputs / Fields
- **Style:** 1px solid `#d0c8ba` border, Weathered Linen background, 10px radius, 10px padding, 14px body text.
- **Focus:** Border shifts to Seedling Green (`#5a8f4a`), no outline ring. The color change is the only feedback — no glow or shadow added.
- **Notes textarea:** `resize: none`, `min-height: 60px`. Fixed height prevents layout shift on mobile keyboards.

### Navigation
- **Mobile (bottom bar):** 64px fixed height, white background, 1px top border + soft upward shadow. Four tabs: icon (20px) stacked above label (10px semi-bold). Active: Deep Bed Soil Green icon + text, scale(1.1) icon. Inactive: `#888`.
- **Desktop (left sidebar, ≥768px):** 180px wide, sticky full-height, right border + soft shadow. Nav items are horizontal (icon + label side-by-side), 13px semi-bold. Active state: Aged Canvas background pill. A "🌱 Garden" header appears above the nav items via CSS `::before`.
- **Touch targets:** Each nav tab is at minimum 44x44px.

### Signature Components

**Task Checkbox:** A 44x44px circular button — the minimum touch target. Unchecked: Seedling Green border, transparent background, 18px checkmark icon. Checked: Seedling Green fill, white checkmark. Transition `0.15s`. The large size is not optional — this is the most-tapped element in the app, used outdoors with imprecise fingers.

**Plant Stage Badge (color-coded):** Each stage maps to a named color. Stages: SEEDED (grey), GERMINATING (light green), SEEDLING (mid green), GROWING (deeper green), HEADING (purple — cauliflower curd), FLOWERING (orange-pink), HARVEST_READY (green-dark), OVERDUE (red). The colors follow a biological arc — grey to green to warm to red.

**Fertiliser Card (gradient):** The two fertiliser products each have a gradient card: Liquid Gold uses a deep teal-blue gradient (`#1a4a6b → #2a6b9b`), Eco Booch uses a green gradient (`#3d6b35 → #5a8f4a`). These are the only gradient surfaces in the system — justified because they communicate a distinct product identity at a glance, not decorative.

## 6. Do's and Don'ts

### Do:
- **Do** maintain WCAG AAA contrast for all task titles, bed names, and stage labels. These are read outdoors. Test at `4.5:1` minimum; target `7:1` for critical text.
- **Do** keep all touch targets at 44x44px minimum. The task checkbox and nav tabs must never shrink below this.
- **Do** use Deep Bed Soil Green (`#3d6b35`) for primary actions and active states only. Its weight makes it a reliable signal; diluting it across decorative uses weakens that signal.
- **Do** reserve Harvest Amber (`#d4860a`) and Root Rot Red (`#8b1a1a`) for urgency and error states. When users see amber, they expect to act. Betray that expectation once and the color loses its meaning.
- **Do** keep the Weathered Linen background (`#f5f0e8`) as the base canvas. Never use pure white (`#ffffff`) as a page background.
- **Do** use the pill shape (20px radius) only for navigation elements and badges — things users tap to select or filter. Buttons that execute an action get the card radius (10px).
- **Do** pair every color-based status signal with a text label or icon. Color blindness is real; outdoor glare makes color distinctions harder. Stage badges always show the stage name, not just a color.

### Don't:
- **Don't** use the Better Homes and Gardens aesthetic — no soft pastels, no floral illustration, no lifestyle-magazine warmth. This is a working tool, not a content publication.
- **Don't** reach for the wellness or mindfulness app aesthetic — no inspirational copy, no rounded-everything softness, no muted mint and blush palettes. The personality is logical and practical, not soothing.
- **Don't** add gradients except on the two named fertiliser product cards (Liquid Gold, Eco Booch). Gradients on buttons, headers, or background surfaces are prohibited. They read as decorative, which contradicts the tool-grade character.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on general cards. The harvest card left border is a documented exception tied to stage signalling — it is not a pattern to extend.
- **Don't** add animations to layout properties (`height`, `width`, `padding`, `top`, `left`). Only `opacity`, `transform`, `color`, and `background-color` may animate. Transition durations: 0.15s for state changes, 0.2s–0.28s for entrances.
- **Don't** make the app feel like a dashboard. No metric tiles with big numbers, no progress rings, no charts. The gardener needs tasks, not analytics.
- **Don't** add features that require the user to think before using the app. If an interaction requires explanation, it should be redesigned. The interface should work like a good tool: obvious on first contact.
- **Don't** use pure black (`#000000`) or pure white (`#ffffff`) for any background or text. Body ink is `#2a2a2a`; page background is `#f5f0e8`.
