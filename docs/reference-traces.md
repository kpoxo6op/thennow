# Sparse reference traces

Bradley Lane and the former Tamaki Road Board offices have an editorial tracing
pilot. Selected reference lines and recognizable details from the archive sit over the
live camera.
A faint full archive underneath supplies context beyond the selected lines,
including lower features and any visible horizon. The target stays fixed while
the photographer aims. This follows Boris's manual tracing-paper technique; it is not automatic feature detection or an accuracy score.

`lib/rephoto/reference-lines.ts` binds normalized vertices to the archive image
path. Inspect those vertices against the exact archive and a recent view before
adding a place. Select surviving, visible features across the subject and more
than one direction where possible. Avoid changed signs, trees, shadows and
occluded architecture. The short gap between the library's roof hip and gutter
is intentional: the hip tiles end above the eaves. Do not extend a trace simply
to connect two features.

## Drawing rules

Choose guides to help the photographer frame the whole view, judge scale and
align it while handheld. Do not limit selection to roofs and windows or to an
arbitrary count of three features.

- Prioritize long, straight references: a visible horizon, roof or wall edge,
  road or kerb line, and strong horizontal or vertical architectural lines.
  Trace the actual reference in the photograph; do not substitute a generic
  level line for a horizon or assume a road edge has survived unchanged.
- Deliberately inspect the frame's left, right, top and bottom. Well-separated
  references near its edges help reveal framing, scale and rotation errors
  that a cluster of central features can hide.
- Include distinctive recognizable details, even when they are not straight
  or architectural. The cowboy's foot in the Bradley Lane mural is a useful
  candidate: a short contour or corner can locate it without tracing the whole
  figure. Check that the detail still exists and is visible today.
- Cover the whole composition: balance upper and lower references, and include
  different visible faces or depths where available. Do not let a good fit on
  one wall conceal a mismatched canopy or the opposite edge of the view.
- Use enough references to make framing understandable, but keep each stroke
  purposeful. Prefer a few useful long segments and distinctive edge details
  over many short lines concentrated in one area. Preserve the faint archive
  underneath for context.
- Inspect every proposed stroke on the full-resolution archive and a recent
  view, then at phone size. Avoid tracing transient objects, shadows, changed
  signs or obscured features. Keep uncertain or missing features out of any
  automatic alignment verdict.

Apply these selection rules to both live aiming and composite/review helpers.
Guides provide framing evidence; they do not by themselves establish an accurate
match or justify an automatic lock/shutter signal.

The camera uses a centred archive-aspect frame with a little margin. It does not
run the matcher for these places or move the lines in response to the scene.
The Old photo toggle shows the source with the same traces, so users can identify
the features. Return to Live camera to shoot. The shutter is disabled only while
viewing the opaque archive, never because an alignment score is low.

Capture uses exactly the displayed frame, with no gravity rotation. Review
preserves that crop rather than replacing it with a new match. The same traces
appear over the captured crop as a comparison aid; holding shows the archive.
SVG traces and the frame border are UI only and are not drawn into the exported
JPEG. Submissions remain unchecked and subject to the manual-photo publication
baseline. If all features cannot be aligned, the guide does not pretend otherwise.

Places without editorial traces retain the live old/photo split and matcher.
Synthetic camera checks cover fixed target/capture geometry and controls. The
pilot still needs Boris's handheld field test; passing those checks does not
establish better photographs, robust outdoor visibility or automatic correction.
