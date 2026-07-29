# YifuMusic Design System

## Design intent

YifuMusic is a desktop music tool for frequent local-library browsing, queue
management, and playback control. The interface prioritizes the currently
playing track, dense lists, predictable keyboard operation, and readable
long-lived desktop layouts.

It is not a marketing landing page, a full-screen poster, or a card gallery.
The design does not use large purple-blue gradients, warm beige or coffee
themes, decorative light orbs, or glass effects that reduce contrast.

## Semantic tokens

Both installed themes define the same semantic token set. Components use these
tokens instead of embedding product colors:

| Purpose                               | Token                                                  |
| ------------------------------------- | ------------------------------------------------------ |
| Application canvas                    | `--surface-canvas`                                     |
| Raised navigation and player surfaces | `--surface-raised`                                     |
| Recessed list and queue surfaces      | `--surface-sunken`                                     |
| Hover and selected surfaces           | `--surface-hover`, `--surface-selected`                |
| Primary and secondary text            | `--text-primary`, `--text-secondary`                   |
| Borders                               | `--border-subtle`, `--border-strong`                   |
| Functional emphasis                   | `--accent`, `--accent-contrast`, `--accent-subtle`     |
| Status colors                         | `--success-color`, `--warning-color`, `--danger-color` |
| Keyboard focus                        | `--focus-color`                                        |

Dark mode uses neutral charcoal and restrained ink-gray surfaces with cyan
functional emphasis. Light mode uses fog white and cool gray surfaces with the
same emphasis semantics. Coral is reserved for warning and destructive states.

## Spacing and dimensions

The spacing scale advances in 4px increments: `4`, `8`, `12`, `16`, `20`,
`24`, `32`, and `40` pixels. Stable desktop dimensions are:

| Item                    | Dimension            |
| ----------------------- | -------------------- |
| Wide navigation rail    | 224px                |
| Compact navigation rail | 64px                 |
| Wide queue panel        | 320px                |
| Bottom player           | 84px                 |
| Icon button hit target  | at least 32px square |
| Play/pause hit target   | at least 40px square |
| Default list row        | 32px minimum         |

Numeric duration and progress values use tabular figures. Title, artist, album,
and queue text truncates instead of changing layout dimensions; the complete
value remains available through the native tooltip and accessible name.

## Typography and interaction

System UI fonts are used for fast, legible Chinese and Latin rendering. Text
uses normal tracking and compact desktop line heights. Interactive states are
always represented by more than color: selected navigation items have an inset
indicator and weight change; disabled controls lower contrast and communicate
their unavailable state in their label.

`hover`, `active`, `selected`, `disabled`, and `focus-visible` are defined by
semantic tokens. Focus is always visible, uses the shared focus ring, and does
not depend on hover. Pure icon controls use localized `aria-label` and native
tooltip (`title`) text; the Chinese locale exposes Chinese labels and tooltips.

## Motion and accessibility

Routine transitions use 120ms to 180ms and never move layout unexpectedly.
`prefers-reduced-motion: reduce` removes nonessential transitions and animation.
Keyboard order follows the visual reading order. Temporary queue panels accept
Escape, receive focus when opened by keyboard or pointer, and return focus to
their trigger after closing. Text, icons, and focus rings retain readable
contrast in both themes.

## Icons and visual assets

Stage 4 reuses the repository's own SVG icon set with its existing 16px, 20px,
and 24px size steps. The `Ellipsis`, `GripVertical`, and `Trash2` additions use
`lucide-react` 1.27.0 with a fixed 2px stroke. The package is ISC licensed;
`Ellipsis` and `Trash2` are listed in its bundled license as Feather-derived
icons carrying the Feather MIT notice. New UI does not copy icons, visual
parameters, screenshots, text, or brand assets from MoeKoeMusic or other music
clients.

No character illustration is added in Stage 4. If the user later provides a
source with explicit redistribution permission, it may appear only in a small
empty state, a dismissible edge background in a now-playing view, or a theme
preview. It must occupy no more than 20% of visible central content, never
cover lists, progress, queue, search, or primary actions, and must be hidden or
static on narrow windows and with reduced motion.
