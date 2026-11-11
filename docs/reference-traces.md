# Sparse reference traces

Bradley Lane and the former Tamaki Road Board offices have an editorial tracing
pilot. A few structural lines from the archive sit over the clear live camera.
A faint full archive underneath supplies context beyond the selected lines,
including lower features and any visible horizon. The target stays fixed while
the photographer aims. This follows Boris's manual
tracing-paper technique; it is not automatic feature detection or an accuracy score.

`lib/rephoto/reference-lines.ts` binds normalized vertices to the archive image
path. Inspect those vertices against the exact archive and a recent view before
adding a place. Select surviving, visible features across the subject and more
than one direction where possible. Avoid changed signs, trees, shadows and
occluded architecture. The short gap between the library's roof hip and gutter
is intentional: the hip tiles end above the eaves. Do not extend a trace simply
to connect two features.

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
