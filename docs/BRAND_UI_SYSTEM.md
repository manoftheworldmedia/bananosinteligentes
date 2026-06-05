# Bananos Inteligentes Brand and Product UI System

## Source of Truth

This product system translates the supplied Bananos Inteligentes brand book, B-mark reference, and one-page sales overview into reusable interface rules.

Brand source files:

- `Bananos_Inteligentes_Brand_Book (4).pdf`
- `bananos-inteligentes-onepager (2).pdf`
- `MOW_Additions_CORBANA VISUALS PRESENTATION (26).png`

The brand is intelligent, direct, editorial, tactile, and slightly playful. It must not become a generic green agricultural dashboard or a decorative marketing theme pasted onto operational software.

## Core Visual Idea

The visual system is built from a deliberate contrast:

- **Ink** is the working environment.
- **Paper** carries primary text and inverse surfaces.
- **Banana** is a sharp accent, never a large-area fill.
- **Leaf** indicates live, healthy, connected, or active status.
- The **B-mark sticker** is applied to selected surfaces where the brand should visibly show up.

The interface should feel like agricultural intelligence with editorial confidence: precise enough for operations, distinctive enough to be remembered.

## Canonical Brand Colors

| Token       | Value     | Product use                                                                 |
| ----------- | --------- | --------------------------------------------------------------------------- |
| Banana      | `#F5D547` | Primary actions, focus, selected states, italic emphasis, important numbers |
| Banana Deep | `#E5BF2A` | Pressed and secondary accent states                                         |
| Ink         | `#0A0A0A` | Primary application canvas and dark navigation                              |
| Ink Soft    | `#1A1A1A` | Raised surfaces, panels, menus, toolbars                                    |
| Paper       | `#F4F1EA` | Primary text, light surfaces, inverse mode                                  |
| Paper Soft  | `#EBE7DC` | Muted light surfaces and separators                                         |
| Leaf        | `#A8B560` | Live, connected, healthy, active status only                                |

Banana yellow must not fill large page regions. Leaf green must not become the general brand color.

## Typography

### Fraunces: Editorial Voice

Use Fraunces for:

- Major product moments.
- Insight titles and meaningful conclusions.
- Selected report headings.
- Pull quotes and human-readable narrative.
- Italic emphasis that communicates what the data is telling us.

Do not use Fraunces for dense tables, settings, compact cards, or routine controls.

### Inter: Working Interface

Inter is the primary product typeface. Use it for:

- Navigation.
- Body copy.
- Buttons.
- Forms.
- Tables.
- Chat messages.
- Operational labels.
- Descriptions and captions.

### JetBrains Mono: System Voice

Use uppercase JetBrains Mono labels for:

- Eyebrows and section identifiers.
- Entity IDs and trace references.
- Timestamps and technical metadata.
- Status labels.
- Geographic coordinates.
- Model, provider, and workflow names.

Mono labels may use `0.16em` letter spacing. Other text uses normal letter spacing.

## Product Modes

### Operational Mode

Used for daily work: ingestion, governance, billing, graph exploration, insights review, and administration.

- Dense, quiet, highly scannable layouts.
- Ink canvas with Ink Soft panels.
- Thin neutral borders.
- Banana reserved for commands, focus, selection, and priority.
- Paper text with restrained secondary text.
- Minimal decorative B-mark usage.
- No oversized marketing composition.

### Intelligence Mode

Used for Banana Chat, insight detail, reports, forecasts, and high-value conclusions.

- More editorial hierarchy.
- Fraunces may frame the main conclusion.
- Evidence, confidence, assumptions, and source type remain visibly structured.
- Banana italic emphasis may highlight the central interpretation.
- The B-mark sticker may appear on generated reports, empty states, or completion moments.

### Brand Moment

Used sparingly for onboarding, report covers, presentations, and selected empty states.

- Dramatic negative space is welcome.
- A real banana, farm, operation, or product image can carry the composition.
- The sticker should look applied, slightly tilted between `-14deg` and `14deg`.
- The brand moment must never slow down a repeated operational workflow.

## Banana Chat Direction

Banana Chat should be the clearest expression of the product idea: **hear everything the banana is telling us**.

Recommended structure:

- Conversation rail for threads and entity context.
- Main transcript as an unframed working surface.
- Evidence rail or expandable evidence drawer.
- Drag-and-drop files directly into the composer.
- Clear source labels: tenant data, insight, graph, memory, network, and public.
- Confidence, assumptions, and escalation shown as operational metadata, not decorative badges.
- Report generation and graph inspection exposed as icon tools.

Memory must always be labeled as context, never presented as evidence.

## Dashboards and Data Surfaces

- Prefer full-width bands and structured grids over floating card collections.
- Use compact panels only for individual tools, repeated records, or modals.
- Use vertical rules and horizontal separators to organize dense information.
- Use large numeric moments selectively, similar to the one-pager metrics row.
- Pair key metrics with concise mono labels.
- Use Leaf only for live/healthy/active status.
- Use functional critical and information colors only where meaning requires them.

## B-Mark Sticker Rules

The B-mark is a secondary asset, not a navigation icon.

Use it:

- On a dashboard only as a deliberate applied brand moment.
- On generated report covers.
- On selected completion, empty, or success states.
- On photography when it feels attached to the physical subject.

Do not use it:

- Inside paragraphs.
- As a repeated bullet or generic icon.
- At exact `0deg` rotation when presented as a sticker.
- Stretched, cropped beyond recognition, or used as background texture.

## Interaction Principles

- Primary commands use Banana with Ink text.
- Selected navigation uses a narrow Banana indicator rather than a large yellow fill.
- Focus rings use Banana and remain highly visible.
- Hover should clarify hierarchy without moving layout.
- Destructive actions must use functional critical color, not Banana.
- Live status uses a small Leaf indicator and explicit text.
- Loading and processing states should show the real workflow stage.

## Accessibility

- Paper on Ink and Ink on Paper are the default high-contrast combinations.
- Banana on Ink is suitable for emphasis; Ink text on Banana is suitable for controls.
- Avoid Paper text directly on Banana for small text.
- Never rely on Leaf, Banana, or critical color alone to communicate status.
- Preserve visible keyboard focus and minimum target dimensions.

## UI Copy

The voice is direct, intelligent, and grounded.

Preferred:

- “3 files need review”
- “Evidence is incomplete”
- “Live with Corbana”
- “Generate report”
- “Ask about this block”

Avoid:

- Empty hype.
- Cute banana puns inside serious operational workflows.
- Technical implementation language exposed to ordinary users.

## Implementation Requirement

All product interfaces must consume `@bananos/brand-tokens`. The canonical values are stored in:

`packages/brand-tokens/tokens/brand.json`

Future UI work should treat this document and those tokens as the baseline design contract.
