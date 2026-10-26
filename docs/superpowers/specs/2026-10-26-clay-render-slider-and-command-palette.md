# Design Specification: Clay vs. Render Showcase & Global Command Palette (Ctrl+K)

**Date**: 2026-10-26  
**Status**: Proposed  
**Author**: Antigravity & Sujal Phapale  

---

## 1. Overview & Objective
To further elevate the portfolio into a technical, high-craft creative developer experience, this update introduces two marquee features:
1. **Interactive 3D "Clay vs. Render" Split-Slider**: An interactive dual-layer viewport comparison positioned inside the 3D Gallery (`#blender-gallery`) allowing visitors to interactively drag a divider across a 3D asset to reveal the raw Blender clay/wireframe topology vs. the final Cycles render pass.
2. **Global Command Palette (`Ctrl + K` / `⌘K`)**: A developer-focused quick navigation and action HUD overlay with keyboard shortcuts, fuzzy search, micro-synthesizer audio feedback, and instant actions (teleport to sections, copy email, toggle audio/ambient mode, view resume).

---

## 2. Feature 1: Interactive Clay vs. Render Split-Slider

### Location & Context
- Placed at the top of the **3D Art Gallery** (`#blender-gallery`) as a spotlight showcase banner before the grid of renders.

### UI/UX Design & Mechanics
- **Split Container**:
  - Two layered synchronized viewports: Bottom layer is the Final Textured Cycles Render (`assets/blender/Skullfinal.png`), top clipped layer is the Studio Clay / MatCap topology pass.
  - Interactive draggable divider line in acid lime (`#c8ff00`) with custom grab handle `[ ◀ ▶ ]`.
  - Mouse drag, touch drag, and direct cursor follow on hover.
  - Percentage badges in top corners: `BLENDER CLAY PASS (MATCAP)` on the left, `FINAL CYCLES RENDER (PBR)` on the right.
- **Micro-Controls HUD**:
  - Reset to 50/50 button.
  - Fullscreen / Zoom inspect toggle.
  - Technical metadata bar: `Render Engine: Cycles X • Samples: 1024 • Geometry: SubD Level 3 • Asset: Cyberpunk Cranium`.

---

## 3. Feature 2: Global Command Palette (`Ctrl + K` / `⌘K`)

### Triggers
1. Keyboard shortcut: `Ctrl + K` (Windows/Linux) or `Meta + K` (macOS).
2. Keyboard shortcut: `/` (when not inside an input).
3. Clickable trigger: Sleek `[ ⌘K ]` micro-badge in masthead actions / mobile bar.
4. Close with `Escape` or clicking backdrop.

### Command Structure & Groups
- **Navigation (Teleport)**:
  - `01 3D Lab` $\rightarrow$ Smooth scroll to `#lab`
  - `02 Featured Projects` $\rightarrow$ Smooth scroll to `#works`
  - `03 3D Art Gallery` $\rightarrow$ Smooth scroll to `#blender-gallery`
  - `04 Technical Capabilities` $\rightarrow$ Smooth scroll to `#capabilities`
  - `05 About & Philosophy` $\rightarrow$ Smooth scroll to `#philosophy`
  - `06 Contact & Connect` $\rightarrow$ Smooth scroll to `#contact`
- **Actions**:
  - `Copy Email Address` (`sujal.phapale@gmail.com`) with toast notification
  - `Toggle Ambient Video Backdrop`
  - `Toggle Synthesizer Audio FX`
  - `Download Resume / CV`
- **Social & External Links**:
  - `GitHub Profile`
  - `LinkedIn Profile`

### Aesthetics & Technical Details
- Backdrop blur: `rgba(9, 9, 11, 0.75)` with `backdrop-filter: blur(16px)`.
- Obsidian Velvet modal card (`#101014`) with hairline titanium border (`rgba(255, 255, 255, 0.12)`) and lime glow focus state.
- Keyboard navigation: `ArrowUp`, `ArrowDown`, `Enter` with active indicator.
- Synthesizer audio clicks on item focus and select when sound is active.

---

## 4. Implementation Steps
1. **Assets & Clay Pass**: Generate and prepare clay matcap pass for the spotlight asset (`Skullfinal.png`).
2. **HTML Structure (`index.html`)**:
   - Add the spotlight Clay vs. Render slider component inside `#blender-gallery`.
   - Add the Command Palette modal container `#command-palette` before closing `</body>`.
   - Add a subtle `[ ⌘K ]` badge in `.masthead-actions`.
3. **CSS Styling (`style.css`)**:
   - Split slider clip-path / width calculation, grab handle styling, and responsive layout.
   - Command palette overlay, search input, categorized results list, active state styling, and mobile responsiveness.
4. **JavaScript Functionality (`script.js`)**:
   - Slider pointer events (mouse/touch/drag) with smooth clipping update.
   - Command palette state management, keybindings (`Ctrl+K`, `Escape`, `ArrowUp/Down`), live filter query, and action handlers.
5. **Testing & Verification**:
   - Test mouse and touch dragging on slider.
   - Test keyboard navigation in command palette.
   - Confirm zero layout regressions and zero console errors.
