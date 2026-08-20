# Abridge ROI Calculator Design Guidelines

## Design Approach

**Selected Framework:** Material Design principles adapted for enterprise data applications
**Rationale:** This is a utility-focused, data-heavy professional calculator requiring clarity, precision, and trustworthiness over aesthetic flourishes.

## Core Design Principles

1. **Information Hierarchy:** Clear visual distinction between inputs and outputs
2. **Scanning Efficiency:** Users should quickly locate and modify specific inputs
3. **Data Confidence:** Results must appear authoritative and precise
4. **Progressive Disclosure:** Complex assumptions revealed only when needed

---

## Typography System

**Primary Font:** Inter (via Google Fonts CDN)
**Secondary Font:** JetBrains Mono (for numerical displays)

**Hierarchy:**
- Page Title: Inter Bold, text-2xl (24px)
- Section Headers: Inter Semibold, text-lg (18px)
- Input Labels: Inter Medium, text-sm (14px)
- Body Text: Inter Regular, text-sm (14px)
- Helper Text: Inter Regular, text-xs (12px), reduced opacity
- KPI Values: JetBrains Mono Bold, text-3xl (30px)
- KPI Labels: Inter Medium, text-xs (12px), uppercase, letter-spacing wide
- Table Data: JetBrains Mono Regular, text-sm (14px)

---

## Layout System

**Spacing Units:** Tailwind's 2, 3, 4, 6, 8, 12 units (0.5rem increments)
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- Card spacing: p-6
- Form element spacing: space-y-4
- Tight groupings: space-y-2

**Grid Structure:**
- Left Panel: Fixed width 400px (w-96 + px-6)
- Right Panel: flex-1 with max-width constraint (max-w-7xl)
- Main container: Full height with overflow handling

**Responsive Behavior:** This is a desktop-first application. On tablets/mobile, stack panels vertically with left panel first.

---

## Component Library

### Input Sections

**Section Container:**
- Border: border border-gray-200 (1px solid)
- Corners: rounded-lg (8px)
- Padding: p-6
- Background: bg-white
- Shadow: shadow-sm (subtle elevation)
- Spacing between sections: space-y-6

**Section Headers:**
- Border-b with pb-3 mb-4
- Include icon from Heroicons (outline style) aligned left

**Form Inputs:**
- Height: h-10 (40px) for text/number inputs
- Border: border-gray-300, focus:border-blue-500, focus:ring-2 focus:ring-blue-200
- Corners: rounded-md (6px)
- Padding: px-3
- Font: text-sm
- Disabled state: bg-gray-50, text-gray-500, cursor-not-allowed

**Sliders:**
- Track height: h-2
- Thumb: w-4 h-4, rounded-full
- Active state: scale-110 transform

**Checkboxes:**
- Size: w-5 h-5 (20px)
- Corners: rounded (4px)
- Checked state: bg-blue-600 with white checkmark

**Collapsible Sections (Accordions):**
- Header: flex justify-between items-center, cursor-pointer, py-3
- Chevron icon rotates 180deg when expanded
- Content: Slide down animation (transition-all duration-200)
- Nested content: pl-4 with border-l-2 border-gray-200

### Results Components

**KPI Cards:**
- Grid: grid-cols-4 gap-4 (desktop), adjust to grid-cols-2 on smaller screens
- Background: gradient from bg-blue-50 to bg-white
- Border: border-l-4 border-blue-600 (accent stripe)
- Padding: p-6
- Shadow: shadow-md
- Value above label layout
- Include subtle icon (Heroicons) in top-right at reduced opacity

**Waterfall Chart:**
- Container: bg-white, rounded-lg, shadow-md, p-6
- Height: h-96 (384px)
- Recharts configuration:
  - Bar width: 60px
  - Gap between bars: 10px
  - Positive values: fill with green-500
  - Negative values (Investment): fill with red-500
  - Grid: horizontal only, stroke-dasharray="3 3"
  - Axis labels: text-xs, text-gray-600
  - Tooltips: bg-gray-900, text-white, rounded-md

**Lever Table:**
- Border: border-collapse with border-gray-200
- Header row: bg-gray-50, text-left, font-semibold, py-3 px-4
- Data rows: border-b border-gray-100, py-3 px-4
- Hover state: bg-gray-50
- Checkbox column: w-16 centered
- Value column: text-right, JetBrains Mono font
- Description column: text-gray-600, text-sm

**Commentary Textarea:**
- Min height: h-32 (128px)
- Border: border-gray-300, focus states same as inputs
- Padding: p-4
- Font: text-sm, text-gray-700
- Placeholder: text-gray-400

---

## Visual Patterns

**Read-Only Calculated Fields:**
- Background: bg-gray-100
- Border: border-gray-300
- Font weight: font-semibold
- Prefix with calculator icon (Heroicons)

**Helper Text:**
- Position: below input with mt-1
- Icon: information-circle from Heroicons, inline with text
- Opacity: text-gray-500

**Currency Formatting:**
- Prefix: $ symbol
- Thousands separators: commas
- Decimals: 2 places for dollars, 0 for whole numbers

**Percentage Displays:**
- Suffix: % symbol
- Decimals: 1 place (e.g., 70.0%)

**Numerical Precision:**
- ROI Multiple: 2 decimal places (e.g., 3.45x)
- wRVU: 2 decimal places
- Hours: 0 decimal places

---

## Interaction States

**Focus States:**
- Blue ring: ring-2 ring-blue-200
- Border change: border-blue-500
- Smooth transition: transition-all duration-150

**Disabled States:**
- Opacity: opacity-50
- Cursor: cursor-not-allowed
- No hover effects

**Loading/Calculating:**
- Subtle pulse animation on KPI cards when values update
- Smooth number transitions (animate values counting up/down)

---

## Animations

**Use Sparingly:**
- Accordion expand/collapse: 200ms ease-in-out
- Number value changes: 300ms ease-out (count-up effect)
- Focus ring appearance: 150ms ease-in-out
- NO hover scale effects on cards
- NO page entrance animations

---

## Images

This application does NOT require images. It is a pure data/calculation interface.

---

## Accessibility

- All inputs have associated labels (for/id pairing)
- ARIA labels on icon-only buttons
- Keyboard navigation: Tab order follows visual flow (top-to-bottom, left-to-right)
- Focus indicators: Always visible, never removed
- Color contrast: Minimum WCAG AA (4.5:1 for text)
- Error states: Text-based messages, not color-only