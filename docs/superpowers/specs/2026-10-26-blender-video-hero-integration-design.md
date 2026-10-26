# Design: Blender 3D Reel Hero Integration

## 1. Intent & Why
Sujal Phapale is both a Computer Engineering student (Full-Stack / AI / Math) and a 3D Artist (Blender VFX). 
Integrating his 500-frame keyframed Blender animation render reel (`assets/blender/0001-0500.mkv`) directly into the Hero section visually demonstrates this dual capability the moment a recruiter or collaborator lands on the website.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Dual-Mode Hero Viewport**: Add an intuitive mode switch inside the hero frame:
  - **`[01 CODE ENGINE]`**: Real-time 3D mathematical canvas (Icosahedron / Torus Knot / Wave matrix with FPS counter).
  - **`[02 BLENDER REEL]`**: Seamlessly looping 500-frame Blender 3D animation sequence with sleek playback controls and frame counter.
- **Ambient Hero Backdrop Mode**: Provide a subtle, dark-scrimmed ambient video background behind the hero with a dedicated **`[AMBIENT: ON/OFF]`** toggle in the telemetry bar.
- **Micro-Interactions**: Sound effects on tab switch, scrub bar, and smooth crossfade transitions.
- **Mobile Optimized**: Smooth poster fallback and touch-friendly controls.

### Non-Goals
- Replacing the real-time canvas engine (both live side-by-side inside the viewport).
- Forcing unmuted audio playback (must remain muted by default and adhere to the site's sound engine).

### Anti-Goals
- Cluttering hero headline typography or reducing contrast/readability.
- Causing lag, CPU spikes, or battery drain on mobile devices.

---

## 3. Approaches Considered & Trade-Offs

1. **Dual-Mode Hero Viewport (Selected)**:
   - *Pros*: Highlights both coding prowess and 3D artistic rendering in the exact same prime viewport real-estate; zero distraction from text; highest elegance.
   - *Cons*: Video is constrained to the 540px hero frame rather than full-width.
2. **Full-Bleed Ambient Hero Video Only**:
   - *Pros*: Big cinematic punch.
   - *Cons*: Competes with headline text if contrast isn't strictly controlled; hides the interactive code engine.
3. **Dedicated Showreel Section Below Fold**:
   - *Pros*: Widescreen presentation.
   - *Cons*: Misses the critical first impression above the fold.

**Decision**: Approach 1, enhanced with an optional ambient backdrop toggle so visitors can enjoy both full-bleed atmosphere and the focused interactive viewport.

---

## 4. Technical Implementation Plan
1. **HTML (`index.html`)**:
   - Add hero ambient `<video>` layer inside `.hero-section` behind text with dark gradient mask.
   - Add tab switcher to `.canvas-hud-top`: `[01 CODE ENGINE]` and `[02 3D RENDER REEL]`.
   - Add `<video class="hero-video-reel">` element inside `#canvas-container` alongside `#hero-canvas`.
   - Add playback control pill: Play/Pause, Replay, and scrubber readout.
2. **CSS (`style.css`)**:
   - Style `.hero-ambient-video` with `position: absolute; inset: 0; opacity: 0.18; mix-blend-mode: luminosity; object-fit: cover; z-index: 0; pointer-events: none;`.
   - Style `.viewport-mode-tabs`, active highlights, crossfade transitions between canvas and video element.
3. **JS (`script.js`)**:
   - Wire tab click handlers to switch active viewport between Canvas and Video.
   - Manage video play/pause state and update telemetry readouts.
