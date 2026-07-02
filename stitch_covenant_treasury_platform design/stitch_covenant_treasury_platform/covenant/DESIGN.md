---
name: Covenant
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf1'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fa'
  on-surface: '#111c2c'
  on-surface-variant: '#424848'
  inverse-surface: '#263142'
  inverse-on-surface: '#ebf1ff'
  outline: '#727878'
  outline-variant: '#c2c8c7'
  surface-tint: '#506261'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0c1e1e'
  on-primary-container: '#758787'
  inverse-primary: '#b7caca'
  secondary: '#a83635'
  on-secondary: '#ffffff'
  secondary-container: '#ff7670'
  on-secondary-container: '#720b12'
  tertiary: '#765a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cba649'
  on-tertiary-container: '#503c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e6e6'
  primary-fixed-dim: '#b7caca'
  on-primary-fixed: '#0c1e1e'
  on-primary-fixed-variant: '#384a4a'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ae'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#881e20'
  tertiary-fixed: '#ffdf96'
  tertiary-fixed-dim: '#e9c261'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#5a4400'
  background: '#f9f9ff'
  on-background: '#111c2c'
  surface-variant: '#d8e3fa'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is rooted in the concept of a "notarized agreement," evoking the gravitas of legal documents and historical ledgers. It rejects the hyper-saturated, neon aesthetic common in decentralized finance in favor of a **Sophisticated Institutional** style. The personality is quiet, authoritative, and immutable, providing users with a sense of security and permanence.

The visual direction leans into **Modern Minimalist Editorial**. It utilizes heavy whitespace to allow complex financial data to breathe, while employing structured dividers and subtle paper textures to ground the interface in a physical reality. The interface should feel like a premium digital ledger—precise, balanced, and timeless.

## Colors

The palette is inspired by traditional archival materials:
- **Ink (#0B1D1D):** A deep, near-black green used for primary text, deep backgrounds, and structural borders. It provides a more organic feel than pure black.
- **Parchment (#F9F7F2):** The primary background color. It reduces eye strain and reinforces the "contract" metaphor.
- **Signet (#9B2C2C):** Reserved for high-importance actions, critical alerts, and "Locked" state indicators.
- **Brass (#B79438):** Used sparingly for highlighting "Resolved" states, successful transactions, or premium interface accents.
- **Slate (#4A5568):** Applied to secondary text, captions, and inactive UI elements to maintain a clear hierarchy.

## Typography

This design system uses a triple-font strategy to balance authority, readability, and technical precision:
1. **Source Serif 4** (Headlines): Provides the literary, authoritative weight of a formal contract.
2. **Public Sans** (Body): A neutral, highly legible grotesque that ensures clarity in complex treasury descriptions.
3. **JetBrains Mono** (Data): Used for all Stacks addresses, transaction hashes, and currency amounts. Its tabular figures ensure that numbers align perfectly in lists and tables.

**Implementation Note:** Always use `label-caps` for table headers and section metadata to create a distinct visual break from body content.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** model on desktop, centered to create a sense of focus and importance. 
- **Grid:** 12-column system with a 24px gutter.
- **Rhythm:** All vertical spacing must be a multiple of 8px.
- **Dividers:** Use 1px solid lines in `Ink` at 10% opacity for standard separation, and 20% opacity for major section breaks. Avoid using shadows to define space; use these "ruled lines" instead.
- **Mobile:** Transition to a single-column fluid layout with 16px side margins. Large data tables should allow horizontal scrolling within their containers to preserve the integrity of the mono-spaced figures.

## Elevation & Depth

This system avoids traditional shadows to maintain its flat, ledger-like aesthetic. Depth is communicated through **Tonal Layers and Rule Lines**:
- **Level 0 (Surface):** The Parchment (#F9F7F2) background.
- **Level 1 (Containers):** Cards or sections are defined by a 1px border of Ink (#0B1D1D) at 10% opacity. No fill change.
- **Level 2 (Modals/Popovers):** A solid 1px Ink border with a very subtle, sharp 2px offset shadow in Ink at 5% opacity (mimicking a stacked sheet of paper).
- **Interactions:** Hover states on interactive rows should use a 2% Ink tint rather than a shadow.

## Shapes

The shape language is **Soft (0.25rem)**. While a historical ledger would be perfectly sharp, a slight radius prevents the digital interface from feeling "hostile." 
- **Buttons:** 4px radius (Small/Medium), 8px radius (Large).
- **Inputs:** 4px radius to maintain a crisp, form-based feel.
- **State Stamps:** Circular or "lozenge" shapes are reserved exclusively for the signature "Seals" (Open, Locked, etc.) to make them stand out against the predominantly rectangular layout.

## Components

### Buttons
- **Primary:** Solid Ink (#0B1D1D) with Parchment text. Bold, direct labels (e.g., "EXECUTE AGREEMENT").
- **Secondary:** Outlined with 1px Ink, no fill.
- **Action Labels:** Labels should use `label-caps` for a formal, button-down feel.

### Signature Seals (Stamps)
These are the distinctive brand elements. They are stylized circular badges with a "rubber stamp" effect (slightly irregular borders or low-opacity fills):
- **Locked:** Signet (#9B2C2C) background with Parchment text.
- **Resolved:** Brass (#B79438) border and text.
- **Open:** Ink (#0B1D1D) border and text.

### Input Fields
Inputs should look like lines on a form. Use a 1px bottom border as the primary visual cue, with a very light Ink background tint. Labels always sit above the field in `label-caps`.

### Data Lists
Tables should use `data-sm` for all values. Use "zebra-striping" with a 2% Ink tint for readability in high-density treasury logs. Every row should be separated by a 1px divider.

### Cards
Cards are simple white-space containers bounded by 1px rules. They should not have rounded corners larger than 4px to maintain the "archival folder" aesthetic.