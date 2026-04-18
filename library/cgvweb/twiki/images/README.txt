CGV Web TWiki — images folder
=============================

Drop PNG / JPG / SVG screenshots here with the exact file names below.
All references from the .twiki topics are resolved relative to this
folder at local-preview time; when publishing to the CERN ATLAS TWiki,
attach each file to its corresponding topic (Foswiki rewrites the
<img src="images/..."/> paths to the attachment URL automatically).

Capture policy: ALWAYS show the full CGV Web window (or a wide crop
that keeps the surrounding UI visible) instead of a tight crop around
the object of interest. The reader needs to know where a panel or
button sits on the screen, so a panel close-up framed inside the whole
app is always preferred to a cropped close-up. Typical capture width is
1920 px; the .twiki topics render them at 900-960 px so that the full
UI still fits the TWiki content column without losing readability.

Keep under ~500 kB per file (use tinypng, `oxipng -strip all`, or
convert to JPEG q=88 for photographic captures).


1. Currently in the folder (already referenced by .twiki topics)
----------------------------------------------------------------

   ui-overview.png            Full CGV Web interface, event loaded.
                              Used in: WebHome, GettingStarted, UserInterface.

   loading-card.png           Loading overlay (CGV logo + pipeline stages).
                              Used in: GettingStarted.

   left-panel.png             Left panel: mode bar, event list, status bar,
                              collision footer.
                              Used in: UserInterface.

   threshold-panel.png        Right-side energy threshold panel (TILE or
                              Cluster tab selected).
                              Used in: UserInterface, EnergyThresholds.

   layers-panel.png           Detector Layers pop-up (TILE/LAr/HEC/FCAL +
                              All / None).
                              Used in: UserInterface.

   ghost-panel.png            ATLAS Ghost panel with the nine envelope
                              switches.
                              Used in: UserInterface.

   cell-tooltip.png           Hover tooltip on a cell (compact ID, η/φ, E).
                              Used in: UserInterface, EventData.

   screenshot-dialog.png      Screenshot resolution picker (HD → 10K) with
                              the two compositing toggles.
                              Used in: UserInterface.

   settings-panel.png         Settings panel with Preferences, Shortcuts,
                              Sponsors visible.
                              Used in: UserInterface.

   mode-bar.png               Close-up of the Live / Local / Samples
                              tri-button.
                              Used in: DataModes.

   live-mode.png              Live mode — green pulsing dot, events
                              streaming.
                              Used in: DataModes.

   local-mode.png             Local mode after folder selection, carousel
                              bar visible.
                              Used in: DataModes, Overview.

   samples-mode.png           Samples list populated from
                              default_xml/index.json.
                              Used in: DataModes.

   calorimeter-overview.png   High-level diagram of the ATLAS calorimeter
                              (Tile + LAr + HEC + FCAL).
                              Used in: Geometry.
                              !! 6.6 MB — PLEASE RE-EXPORT AT < 500 KB.

   geometry-active-cells.png  CGV Web capture with all four sub-detectors
                              ON, rendered as coloured cells.
                              Used in: Overview, Geometry.
                              !! 2.9 MB — PLEASE RE-EXPORT AT < 500 KB.

   ghost-envelopes.png        Capture with all nine ghost envelopes ON and
                              the dashed φ-segmentation overlay visible.
                              Used in: Geometry.

   beam-axis.png              Capture with the beam-axis cones visible
                              (press B). Tight crop around the IP is nice.
                              Used in: Geometry.

   coordinate-frame.png       Labelled diagram showing the η/φ/z axes
                              relative to the detector.
                              Used in: EventData.

   atlas-live-landing.png     Screenshot of https://atlas-live.cern.ch.
                              Used in: DataModes.
                              !! 591 KB — slightly over budget, consider
                                 a quick oxipng pass.


2. Missing images for the new features (please capture and drop here)
---------------------------------------------------------------------

   slicer-cylinder.png        The slicer gizmo active. Capture the FULL
                              CGV Web window — toolbar, panels and canvas
                              — so the reader can see the gizmo's
                              position in context. Inside the scene, the
                              handle should be visible at the origin and
                              a half-sweep (θ ≈ π) should carve the
                              TileCal barrel so the inner LAr EMB is
                              exposed. Camera isometric-ish.
                              Capture width: 1920 px, render at 900 px,
                              ≤ 450 kB.
                              Will be added to: UserInterface.

   all-cells.png              All cells toggle ON. Capture the full CGV
                              Web window so the reader can place the
                              toggle in the bottom toolbar, the right-
                              panel thresholds and the resulting fully-
                              painted geometry in the canvas all at once.
                              Empty cells should use the coldest palette
                              colour; the event's actual hits should be
                              visible as bright spots.
                              Capture width: 1920 px, render at 900 px,
                              ≤ 450 kB.
                              Will be added to: UserInterface, Geometry.

   collision-hud.png          Sidebar collapsed (or cinema mode). Capture
                              the full window so the reader can see that
                              the HUD (DATE, RUN, EVENT, LUMI BLOCK,
                              VERSION, same cyan as the FPS counter) is
                              in the top-left corner relative to the rest
                              of the UI — not a tight crop of the HUD.
                              Capture width: 1920 px, render at 900 px,
                              ≤ 400 kB.
                              Will be added to: UserInterface,
                              GettingStarted.

   cinema-mode.png            CGV Web in cinema mode — full window: UI
                              hidden, the Exit Cinema pill at the bottom,
                              collision HUD at the top-left. Camera
                              mid-rotation.
                              Capture width: 1920 px, render at 900 px,
                              ≤ 450 kB.
                              Optional but useful for UserInterface.


3. Optional extras (not currently referenced)
---------------------------------------------

   atlantis-comparison.png    Side-by-side ATLANTIS vs CGV Web of the same
                              event, for the Overview page.

   high-energy-event.png      A notable high-pT event capture for the
                              WebHome splash.

   threshold-slider-demo.gif  Animated GIF / WebM of the P97 auto-scaling
                              in action. Useful for the EnergyThresholds
                              topic but not required.


4. How to reference from a topic
--------------------------------

For a full-UI capture or panel/dialog shown inside the whole window:

    <img src="images/<name>.png" alt="..." width="900" />

For a hero / landing overview:

    <img src="images/<name>.png" alt="..." width="960" />

For a diagram or a tight close-up (coordinate frame, tooltip, mode-bar
detail — only when the object genuinely makes sense without context):

    <img src="images/<name>.png" alt="..." width="560" />

Never rely on the original pixel size — always pass width= so that the
Pattern skin on CERN doesn't blow the image beyond the content column.
Avoid widths below ~500 px unless the image is a diagram; shifters
should be able to locate every button on the screen from the image
alone.
