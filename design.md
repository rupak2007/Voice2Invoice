# Voice2Invoice — Product Design System & UI/UX Specification

## 0. PURPOSE

This document defines the visual design, interaction design, design-system rules, Figma workflow, and frontend quality standards for **Voice2Invoice**.

Use this document together with:

```text
prd.md
architecture.md
plan.md
instruction.md
```

These documents have different responsibilities:

- `prd.md` → what the product does
- `architecture.md` → how the product works technically
- `plan.md` → how it is built
- `instruction.md` → how the implementation should be executed
- `design.md` → how the product should look, feel, and behave

Do not allow the design system to contradict the product requirements.

---

# 1. PRODUCT DESIGN VISION

Voice2Invoice is an AI-powered field-service workflow product.

The interface should communicate:

> **Voice in. Job understood. Invoice out.**

The product should feel:

- Professional
- Fast
- Trustworthy
- Operational
- Modern
- Calm
- Precise
- AI-powered without being gimmicky

The product should NOT feel like:

- A generic AI chatbot
- A flashy AI landing page
- A crypto dashboard
- A developer tool
- A generic admin template
- An overly decorative SaaS template

The design should communicate that this is a **real business operations product**.

---

# 2. CORE UX PRINCIPLE

The central product transformation is:

```text
VOICE
  ↓
TRANSCRIPT
  ↓
UNDERSTANDING
  ↓
STRUCTURED JOB
  ↓
VALIDATION
  ↓
INVOICE
```

The UI should make this transformation visually understandable.

A user should immediately understand:

> "Voice2Invoice took messy spoken information and turned it into a verified business record and invoice."

This transformation is the primary visual story of the product.

---

# 3. PRIMARY USERS

## Field Technician

Primary interaction:

```text
WhatsApp
→ Voice Note
→ Confirmation
```

The technician should NOT need to use a complicated dashboard.

The dashboard is primarily for:

- Business owners
- Office administrators
- Operations staff
- Billing staff

---

# 4. DESIGN HIERARCHY

The product has three major concepts:

### 1. Jobs

What happened in the field.

### 2. Validation

Whether Voice2Invoice safely understood the job.

### 3. Invoices

What the business is charging the customer.

These should form the primary information architecture.

```text
Jobs
  ↓
Validation
  ↓
Invoice
```

---

# 5. INFORMATION ARCHITECTURE

The main application navigation should be:

```text
Voice2Invoice
│
├── Overview
│
├── Jobs
│
├── Invoices
│
└── Settings
```

Keep navigation intentionally small.

Do not add sections that don't have meaningful functionality.

---

# 6. VISUAL DIRECTION

## Overall Style

Use a restrained modern B2B SaaS aesthetic.

Prioritize:

- Strong typography
- Excellent spacing
- Clear hierarchy
- Subtle borders
- Restrained shadows
- High information density
- Clear status indicators
- Strong alignment

Avoid excessive decorative elements.

---

# 7. COLOR SYSTEM

Use semantic design tokens rather than arbitrary colors.

## Background

```text
--background
--surface
--surface-elevated
```

Use a subtle hierarchy between application background and cards.

## Text

```text
--text-primary
--text-secondary
--text-muted
--text-disabled
```

## Borders

```text
--border
--border-subtle
--border-strong
```

## Brand

Define:

```text
--brand-primary
--brand-primary-hover
--brand-primary-active
```

The primary brand color should be used selectively.

Do not make the entire interface the brand color.

## Semantic colors

```text
--success
--warning
--danger
--info
```

Use these only for semantic meaning.

Examples:

```text
Success → Invoice generated
Warning → Needs review
Danger → Processing failed
Info → Processing
```

Do not use semantic colors purely for decoration.

---

# 8. DARK / LIGHT MODE

The default application should use a **light professional operations interface** unless the existing product requirements specify otherwise.

A dark mode can be supported later.

Do not build two separate design systems for the MVP.

---

# 9. TYPOGRAPHY

Use a modern sans-serif typeface.

Prefer an interface font such as:

```text
Inter
Geist
SF Pro equivalent
```

If the existing project already has a typography system, reuse it.

Use a limited type scale.

Example:

```text
Display       32–40px
Page title    24–28px
Section title 18–20px
Body          14–16px
Metadata      12–13px
```

Do not use huge typography for normal dashboard content.

---

# 10. SPACING SYSTEM

Use a consistent spacing scale based around 4px.

Preferred values:

```text
4
8
12
16
20
24
32
40
48
64
```

Do not use arbitrary values unless technically necessary.

Maintain consistent vertical rhythm.

---

# 11. BORDER RADIUS

Use restrained corner radii.

Recommended:

```text
Small controls     6–8px
Cards              10–12px
Large containers   12–16px
Modal              12–16px
```

Avoid making every element extremely rounded.

This is an operations product, not a playful consumer app.

---

# 12. SHADOWS

Use shadows sparingly.

Prefer:

```text
Border
+
Subtle elevation
```

over large shadows.

Cards should generally be distinguishable through:

- Background
- Border
- Spacing

rather than dramatic shadows.

---

# 13. ICONOGRAPHY

Use one consistent icon library.

If the existing project uses Lucide React, continue using Lucide.

Do not mix multiple icon libraries.

Default icon sizes:

```text
12px → tiny metadata
16px → normal controls
18px → navigation
20px → primary actions
24px → major feature icons
```

Maintain consistent stroke weight.

Never use emoji as primary interface icons.

---

# 14. APPLICATION SHELL

The application should use:

```text
┌───────────────────────────────────────────────┐
│ Logo / Voice2Invoice                 Account │
├──────────────┬────────────────────────────────┤
│              │                                │
│ Overview     │                                │
│ Jobs         │           Content              │
│ Invoices     │                                │
│ Settings     │                                │
│              │                                │
└──────────────┴────────────────────────────────┘
```

Desktop:

- Persistent sidebar
- Clear active navigation state
- Comfortable content width
- Consistent page padding

Mobile:

- Collapsed navigation
- Accessible menu
- No horizontal overflow

---

# 15. OVERVIEW PAGE

The Overview page should answer:

> "What is happening in my business?"

It should show a small number of useful metrics.

Example:

```text
Jobs processed
Invoices generated
Needs review
Invoice value
```

Do not fill the page with meaningless analytics.

Example layout:

```text
┌─────────────────────────────────────────────────┐
│ Overview                                        │
│ Here's what's happening with your jobs today.  │
│                                                 │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │
│ │ Jobs   │ │Invoices│ │ Review │ │ Invoiced │ │
│ │  24    │ │  21    │ │   3    │ │ $4,820   │ │
│ └────────┘ └────────┘ └────────┘ └──────────┘ │
│                                                 │
│ Recent Jobs                                     │
│ ─────────────────────────────────────────────── │
│ Bob Vance       Water heater      $250   ✓     │
│ John Smith      AC repair         $420   ✓     │
│ Sarah Lee       Plumbing          —      !     │
└─────────────────────────────────────────────────┘
```

---

# 16. JOBS PAGE

Jobs are the central object.

The Jobs page should prioritize:

- Customer
- Work
- Technician
- Amount
- Status
- Date

Example:

```text
┌──────────────────────────────────────────────────────────┐
│ Jobs                                      [Search] [Filter]│
│                                                          │
│ Customer       Work              Amount      Status       │
│ ──────────────────────────────────────────────────────── │
│ Bob Vance      Water heater      $250        ✓ Invoiced   │
│ John Smith     AC repair         $420        ✓ Invoiced   │
│ Sarah Lee      Plumbing          —           ! Review    │
└──────────────────────────────────────────────────────────┘
```

Avoid excessive table columns.

---

# 17. JOB DETAIL — PRIMARY EXPERIENCE

The Job Detail page is the most important UI in Voice2Invoice.

It should visually demonstrate the AI transformation.

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Jobs                                      Invoice #1042   │
│                                                             │
│ Bob Vance                                      $250         │
│ Water Heater Replacement                       ✓ Invoiced   │
│                                                             │
├───────────────────────────┬─────────────────────────────────┤
│ ORIGINAL VOICE / TRANSCRIPT│ EXTRACTED JOB                  │
│                           │                                 │
│ 🎙 Voice note             │ Customer                        │
│                           │ Bob Vance                       │
│ "Finished the water       │                                 │
│ heater job for Bob..."    │ Work performed                  │
│                           │ Water heater replacement        │
│                           │                                 │
│                           │ Hours            2              │
│                           │ Parts            2              │
│                           │ Amount           $250            │
├───────────────────────────┴─────────────────────────────────┤
│                                                             │
│ VALIDATION                                                  │
│ ✓ Customer identified                                       │
│ ✓ Amount explicitly stated                                  │
│ ✓ Parts identified                                          │
│ ✓ Hours identified                                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ INVOICE                                                     │
│ $250                                                        │
│ Stripe Test Invoice #1042                                   │
│                                                             │
│                         [ View Invoice ]                     │
└─────────────────────────────────────────────────────────────┘
```

This screen should be visually excellent.

It should communicate:

```text
Raw information
       ↓
AI understanding
       ↓
Verified business data
       ↓
Invoice
```

---

# 18. JOB PROCESSING STATE

When a new voice note is being processed, show the processing pipeline.

Example:

```text
Processing Job

✓ Voice received
✓ Audio downloaded
✓ Transcript created
● Extracting job information
○ Validating
○ Creating invoice
```

Use clear status indicators.

Do not create unnecessary animations.

Subtle transitions are enough.

---

# 19. PROCESSING TIMELINE

Use a vertical or horizontal timeline where appropriate:

```text
Voice received
     ↓
Transcribed
     ↓
Structured
     ↓
Validated
     ↓
Invoiced
```

Completed steps:

```text
✓
```

Current:

```text
●
```

Pending:

```text
○
```

Failed:

```text
!
```

---

# 20. VALIDATION UI

Validation is one of the product's most important trust mechanisms.

Make it visible.

Example:

```text
Validation

✓ Customer grounded in transcript
✓ Work description grounded in transcript
✓ Amount explicitly stated
✓ Parts grounded in transcript
✓ Hours grounded in transcript

No issues detected
```

For problems:

```text
Needs review

! Amount could not be confidently identified.

The invoice has not been created.

[ Review Job ]
```

Never make a failed validation look like a successful invoice.

---

# 21. INVOICE PAGE

The Invoice page should be clean and business-like.

Show:

```text
Invoice
Invoice number
Status
Customer
Job
Line items
Subtotal
Total
Created date
```

Primary action:

```text
View invoice
```

Secondary actions can include:

```text
Copy invoice ID
Open Stripe
```

Only show actions that actually work.

---

# 22. STATUS SYSTEM

Use consistent statuses.

## Job statuses

```text
Received
Processing
Needs Review
Completed
Failed
```

## Invoice statuses

```text
Not Created
Draft
Sent
Paid
Failed
```

Use badges.

Example:

```text
✓ Completed
! Needs Review
× Failed
● Processing
```

---

# 23. EMPTY STATES

Never show an empty table with no explanation.

Example:

```text
No jobs yet

When technicians send their first WhatsApp voice note,
processed jobs will appear here.

[ View Demo ]
```

Keep empty states concise.

---

# 24. LOADING STATES

Use skeletons for page-level loading.

Avoid excessive spinners.

For AI processing, use meaningful status text:

```text
Transcribing voice note…
```

rather than:

```text
Loading…
```

The user should know what the system is doing.

---

# 25. ERROR STATES

Errors must be understandable.

Bad:

```text
Error 500
```

Better:

```text
We couldn't create the invoice.

The amount could not be confirmed from the voice note.

No invoice was created.

[ Review Job ]
```

Always distinguish:

```text
System failure
```

from:

```text
Validation failure
```

---

# 26. CONFIRMATION UX

Successful:

```text
✓ Invoice created

Bob Vance
$250

Invoice sent successfully.
```

Validation failure:

```text
Needs review

We couldn't safely determine the invoice amount.

No invoice was created.
```

Never claim an action succeeded unless the backend confirms it.

---

# 27. RESPONSIVE DESIGN

Desktop should be the primary administrative experience.

Mobile should remain fully functional.

At mobile width:

```text
Sidebar
↓
Collapsed navigation

Two-column layouts
↓
Single-column layout
```

Job detail:

```text
Desktop:

Transcript | Extracted Data

Mobile:

Transcript
↓
Extracted Data
↓
Validation
↓
Invoice
```

Never allow horizontal scrolling for normal application content.

---

# 28. ACCESSIBILITY

Follow WCAG-oriented principles.

Ensure:

- Keyboard navigation
- Visible focus
- Semantic HTML
- Proper labels
- Sufficient contrast
- Accessible buttons
- Accessible status information
- Screen-reader-friendly forms

Do not rely only on color to communicate status.

Example:

Bad:

```text
green = success
red = failure
```

Better:

```text
✓ Completed
! Needs Review
× Failed
```

---

# 29. MOTION

Use subtle motion only when it improves comprehension.

Good:

- Page transitions
- Modal transitions
- Toast appearance
- Status changes
- Skeleton transitions

Avoid:

- Constant animations
- Excessive bouncing
- Decorative motion
- Long transitions

Default transition duration:

```text
150–250ms
```

---

# 30. FORMS

Forms should be minimal.

Use:

- Clear labels
- Helpful placeholders
- Inline validation
- Explicit errors
- Appropriate input types

Never rely only on placeholders as labels.

---

# 31. SEARCH AND FILTERS

Jobs and invoices should support simple search/filtering when the underlying implementation supports them.

Recommended:

```text
Search customer
Status
Date
Technician
```

Don't build complex filtering for the MVP if there isn't enough data to justify it.

---

# 32. AI VISUAL LANGUAGE

AI should be communicated through:

- Processing status
- Structured extraction
- Validation
- Confidence/grounding information where supported

Do NOT use:

- Robot illustrations everywhere
- Glowing AI gradients
- "Magic" animations
- Excessive sparkles
- Generic AI imagery

The AI value should be demonstrated through the workflow itself.

---

# 33. TRUST DESIGN

Voice2Invoice deals with money.

Therefore the interface should prioritize trust.

Important billing information should be visually prominent:

```text
Customer
Amount
Invoice status
Validation status
```

Before invoice creation, clearly communicate validation.

Example:

```text
✓ Validation passed

Amount explicitly identified:
$250

Ready to create invoice.
```

For uncertainty:

```text
! Validation required

Amount was not confidently identified.

Invoice creation blocked.
```

---

# 34. DESIGN SYSTEM COMPONENTS

Create reusable components rather than styling every page independently.

Minimum component system:

```text
Button
IconButton
Input
Select
Badge
Card
StatCard
Table
Modal
Toast
Alert
Tabs
Breadcrumb
Sidebar
Navbar
Avatar
EmptyState
LoadingState
ErrorState
StatusIndicator
Timeline
JobCard
JobStatus
InvoiceStatus
ValidationResult
```

Only implement components that are actually needed.

---

# 35. COMPONENT CONSISTENCY

Components must share:

- Typography
- Radius
- Spacing
- Borders
- Shadows
- Interaction states
- Icon sizing

For example, all buttons should use the same:

```text
height
padding
radius
font weight
focus behavior
```

Do not create slightly different buttons on every page.

---

# 36. FIGMA MCP WORKFLOW

When Figma MCP is available, use it.

Do NOT blindly create designs from imagination if a Figma design system already exists.

The workflow should be:

```text
Figma
 ↓
Inspect design
 ↓
Identify components
 ↓
Identify variables/tokens
 ↓
Map to existing code
 ↓
Implement
 ↓
Run application
 ↓
Visual QA
 ↓
Fix differences
```

Use Figma MCP for:

- Reading design context
- Inspecting components
- Inspecting variables
- Inspecting typography
- Inspecting spacing
- Inspecting layouts
- Creating/updating designs when requested
- Design-to-code workflows
- Code Connect where appropriate

---

# 37. FIGMA DESIGN-SYSTEM WORKFLOW

If creating a Figma design from scratch:

First create:

```text
Colors
Typography
Spacing
Radius
Shadows
Icons
```

Then:

```text
Buttons
Inputs
Cards
Badges
Tables
Navigation
Dialogs
```

Then:

```text
Application shell
Overview
Jobs
Job Detail
Invoices
Settings
```

Do not create screens first and attempt to derive a design system afterward.

---

# 38. FIGMA VARIABLES

Where Figma variables are available, define semantic variables rather than hardcoded values.

Example:

```text
color/background
color/surface
color/text-primary
color/text-secondary
color/border
color/brand
color/success
color/warning
color/danger
```

Spacing:

```text
spacing/1
spacing/2
spacing/3
spacing/4
spacing/6
spacing/8
```

Do not create hundreds of unnecessary variables.

---

# 39. FIGMA CODE CONNECT

If Code Connect is available:

Map reusable Figma components to the real frontend components.

Example:

```text
Figma Button
      ↕
src/components/Button.tsx
```

Do the same for important reusable components.

The objective is:

```text
Figma design
=
Actual code component
```

not two separate systems.

---

# 40. DESIGN → CODE RULE

When translating a Figma design:

Do NOT reproduce it as a screenshot.

Instead identify:

- Layout primitives
- Components
- Tokens
- Responsive behavior
- Interaction states

Then implement using the existing project's component system.

---

# 41. VISUAL QA

A page is not finished because the code compiles.

After implementing UI:

```text
Run application
↓
Open page
↓
Inspect actual rendered UI
↓
Check desktop
↓
Check mobile
↓
Check states
↓
Fix visual issues
↓
Re-check
```

Inspect:

### Layout

- Alignment
- Width
- Height
- Spacing
- Grid
- Overflow

### Typography

- Font
- Weight
- Size
- Line height
- Hierarchy

### Components

- Radius
- Borders
- Icons
- States
- Consistency

### UX

- Loading
- Empty
- Error
- Success
- Validation

---

# 42. NO GENERIC AI UI

Do not generate the common AI-generated design pattern:

```text
Huge gradient heading
+
Three rounded cards
+
Purple buttons
+
Glassmorphism
+
Random charts
+
Robot illustration
```

Voice2Invoice is a business operations tool.

Design accordingly.

---

# 43. DESIGN FOR INFORMATION DENSITY

The dashboard should show useful information without becoming crowded.

Prefer:

```text
Customer
Work
Amount
Status
Date
```

over decorative content.

Every visible element should answer:

> "Does this help the user understand or operate the business?"

If not, remove it.

---

# 44. PRIMARY ACTIONS

Each screen should have one obvious primary action.

Examples:

Overview:

```text
View Jobs
```

Jobs:

```text
Open Job
```

Job Detail:

```text
View Invoice
```

Needs Review:

```text
Review Job
```

Avoid having five equally prominent buttons.

---

# 45. BUTTON HIERARCHY

Use:

### Primary

For the main action.

### Secondary

For supporting actions.

### Ghost

For low-emphasis actions.

### Destructive

Only for genuinely destructive actions.

Do not make every button primary.

---

# 46. TABLE DESIGN

Tables should be highly readable.

Use:

- Clear column labels
- Comfortable row height
- Hover state
- Status badges
- Right alignment for money
- Truncated long text
- Responsive behavior

Money:

```text
$250.00
```

should be visually distinct from metadata.

---

# 47. NUMBER FORMATTING

Financial values must be easy to scan.

Prefer:

```text
$250
$1,250
$12,450
```

Avoid inconsistent formatting.

Use the project's configured currency.

Do not silently convert currencies.

---

# 48. JOB DETAIL INFORMATION PRIORITY

The order should generally be:

```text
Customer
↓
Job summary
↓
Amount
↓
Validation
↓
Transcript
↓
Extracted details
↓
Invoice details
```

However, the desktop layout may place transcript and extracted data side by side.

---

# 49. PRODUCT FEEL

The finished product should feel like:

```text
Calm
Precise
Fast
Reliable
Professional
```

Not:

```text
Loud
Flashy
Experimental
Playful
Over-designed
```

---

# 50. IMPLEMENTATION PRIORITY

Because Voice2Invoice is an MVP:

## P0 — Required

```text
Application shell
Jobs
Job detail
Processing state
Validation state
Invoice state
Responsive layout
Core design system
```

## P1 — Important

```text
Overview
Invoice list
Search/filter
Better empty/error states
```

## P2 — Later

```text
Advanced analytics
Advanced settings
Dark mode
CRM dashboards
Complex reporting
```

Do not allow P2 work to delay the functional MVP.

---

# 51. Figma MCP RULES FOR THE CODING AGENT

If Figma MCP is connected:

1. Inspect existing Figma designs before inventing UI.
2. Reuse existing components.
3. Reuse variables/tokens.
4. Maintain component consistency.
5. Use Code Connect where appropriate.
6. Translate designs into reusable frontend components.
7. Verify the rendered implementation visually.

If Figma MCP is NOT available:

Build from this `design.md` and the existing codebase.

Do not stop development because Figma is unavailable.

---

# 52. FINAL UI DEFINITION OF DONE

A UI feature is complete only when:

```text
[ ] Requirements are satisfied
[ ] Existing components were reused
[ ] Design tokens are consistent
[ ] Typography is consistent
[ ] Spacing is consistent
[ ] Icons are consistent
[ ] Loading state exists where necessary
[ ] Empty state exists where necessary
[ ] Error state exists where necessary
[ ] Success state exists where necessary
[ ] Validation state is clear
[ ] Responsive behavior works
[ ] Keyboard navigation works
[ ] No horizontal overflow
[ ] No obvious visual inconsistencies
[ ] Actual rendered UI was inspected
```

---

# 53. FINAL PRODUCT EXPERIENCE

The finished Voice2Invoice experience should communicate this in seconds:

```text
Technician speaks
       ↓
Voice2Invoice understands
       ↓
The job is verified
       ↓
The invoice is created
```

The product's visual design should reinforce that transformation at every stage.

---

# 54. FINAL RULE

Do not optimize for "AI-looking."

Optimize for:

> **A real business product that happens to use AI extremely well.**

The user should trust Voice2Invoice with operational and billing workflows because the interface is:

```text
Clear
+
Predictable
+
Transparent
+
Professional
+
Consistent
```