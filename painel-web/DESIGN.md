# Design Specifications: Translucent Drafting Board

## Concept
A clear, accessible overlay that clarifies complex documents with precision grids. The layout behaves like a translucent acrylic pane placed over an obscured background grid, featuring light blue pastel edges and high-contrast, crisp sans-serif typography.

## Story
Users with visual impairments or their teachers drag PDFs into a clean, distraction-free drafting desk to extract perfectly structured, accessible Markdown.

## Materials
- **Background**: Precision linear gradients creating a drafting grid (`--border` on `--bg`).
- **Surface**: Translucent panes utilizing CSS `backdrop-filter: blur(12px)` over the background grid to simulate frosted glass/acrylic.
- **Typography**: Inter (or system sans-serif) with high-contrast text and bold, literal quoted tags for key actions (e.g., `"ARRASTE OS ARQUIVOS AQUI"`).

## Palette
**Light Theme:**
- Background: `#e2e8f0`
- Surface: `rgba(240, 244, 248, 0.85)`
- Accent: `#3b82f6`

**Dark Theme:**
- Background: `#020617`
- Surface: `rgba(15, 23, 42, 0.85)`
- Accent: `#60a5fa`

## Semantic Accessibility
The UI leverages high contrast and literal instructional text. The implementation ensures that buttons (`.btn`) have strong borders and text, meeting WCAG AA requirements for both light and dark environments.
