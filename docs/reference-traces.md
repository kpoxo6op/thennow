# Reference guides

Every place with a camera has hand-drawn lines bound to its archive image. Camera and
capture review share the same guide. Some guides contain only visual references:
without independently identifiable surviving regions, all strokes stay unscored.
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

## Lessons from Boris's field feedback (11 November 2026)

These requirements come from the failed field shots and Boris's corrections to
our first guides. Apply them to every new reference image, not just the two pilot
places. The shipped coordinates are examples, not a template to copy blindly.

| Observed problem                                                             | Rule for the next reference                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A large instruction panel obscured the view.                                 | Keep the scene visible. Use concise, transient status for loading; do not cover framing with a persistent manual.                                                                                    |
| Three isolated strokes left too little context to aim handheld.              | Keep the old photograph faintly visible underneath and offer a clear full-photo inspection. Minimal UI does not mean too few useful landmarks.                                                       |
| The horizon and cowboy's foot were missed.                                   | Scan the whole image, including the distant horizon and recognizable contours. Do not limit selection to building edges or straight lines.                                                           |
| Good long building lines were left untraced.                                 | Inspect roof ridges, eaves, wall corners, seams, building bases and shopfronts systematically. Include useful surviving lines rather than stopping after the first few.                              |
| The library window near the edge was useful for framing.                     | Prefer recognizable features near the image perimeter. Trace a complete window frame when its sides supply useful width, height and position cues; do not reduce it to an arbitrary isolated stroke. |
| The library roof corner visibly missed despite an apparently aligned result. | Judge separate regions across the whole subject. A central match or steady overlay cannot excuse a wrong roof, edge or foreground.                                                                   |
| Boris's older manual photographs aligned better.                             | Use the [manual-photo baseline](alignment-quality.md) for acceptance. More guides and passing browser checks do not establish photographic accuracy.                                                 |

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

## Procedure for each new reference

1. Inspect the exact uncropped archive at full resolution and a recent view when
   available. Identify surviving features; record uncertainty if there is no
   recent evidence. Never invent a horizon through an obstruction.
2. Scan left, right, top, bottom and centre before choosing strokes. Look for
   long straight lines, horizons, roof/wall edges, windows, road/kerb lines and
   distinctive contours. Seek separated horizontal, vertical and receding
   references so the photographer can judge position, scale and rotation.
3. Select by usefulness, visibility and coverage, not a fixed feature count.
   Inspect all obvious candidates. Omit duplicates, changed or obscured features;
   do not omit a strong edge landmark simply to keep the list short. A few lines
   on one building corner are insufficient when the rest of the image offers
   useful references.
4. Draw against the actual pixels, with meaningful endpoints and corners. Bind
   normalized coordinates to the exact archive path. Do not connect gaps between
   unrelated features or trace every brick/window bar.
5. Inspect the rendered strokes on the opaque archive, then over the faint
   archive and live view at portrait and landscape phone sizes. Check the outer
   frame as carefully as the centre. Keep the scene readable and the shutter
   reachable. Use the same references in capture review and preserve the framed
   crop; never bake the guides into the submitted photograph.
6. In the PR, briefly identify the useful upper/lower/left/right references and
   explain conspicuous omissions or uncertain survival. Include visual evidence
   without committing private field photos. Reuse existing camera checks; do not
   add source-text or feature-count tests to enforce editorial choices. Distinguish
   synthetic UI verification from a real handheld field result.

## Current pilot behaviour

The camera uses a centred archive-aspect target with a little margin. The reference
stays fixed. On supported phones, coarse matching first recognises the place;
signed image-edge checks then refine a bounded crop, roll and uniform scale across
separate required regions. Only supported corrections transform the live video
under the fixed target. This is framing assistance, not an alignment certificate.

Bradley requires wall and canopy evidence; the library requires roof and window
evidence. Changed signs, shutters, road markings and decorative mural contours
remain outside computational acceptance. Weak or missing evidence cannot certify
a region. One observed conflicting feature can be highlighted with a short cue;
the app does not infer a physical walking direction from a 2D discrepancy.

The Old photo toggle shows the source with the same traces. Return to Live camera
to shoot. Capture remains available during loading and unsupported operation.
Freshly recognised scenes use up to three frames over roughly 240 milliseconds;
each frame is independently checked. A later frame replaces the pressed frame
only when its supported regional residuals are no worse and it is sharper (or the
pressed frame lacked supported geometry). Without evidence, keep the pressed
frame and manual crop. If an assisted preview cannot be confirmed at capture,
review requires a retake rather than silently exporting a different framing.

Review preserves the selected crop. Guides never enter the JPEG. These photos
remain unchecked under the [manual-photo baseline](alignment-quality.md), with no
automatic shutter, hardware zoom, perspective warping or automatic publication.
Places without editorial traces retain their existing split-view matcher.

The first evaluation rejects the morning Bradley shot despite 403 coarse inliers;
identity/perturbation controls pass, and unrelated/blank controls refuse. These
controls do not establish real photographic precision or Pixel latency. The
30-second handheld goal remains a field acceptance target, not a measured result.

## Lessons from the Bradley Lane field rounds (14-19 November 2026)

The live camera now checks each reference line against the live picture. A line's
`region` decides whether it counts, and the place's `zones` decide whether the camera
can say where to stand. Set both up for every place with lines.

| Observed problem                                                                                                                                                | Rule                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A line traced the bottom of a sign that has since been replaced (MoneyGram in 2018, a deeper Hi Vape box by 2026), so it could never be lined up from anywhere. | Never give a region to a sign, awning fascia, mural or anything that changes. Trace what survives. An unchanged hanging sign (TAKEAWAY) is fine; mark lettered signs `along: true` so a sideways shift shows. |
| The top of the mural wall corner is now under a new sign, so a fitting corner read 4.6% off.                                                                    | Trim a line to the part that is still visible today; don't run it into areas a later sign, tree or hedge covers.                                                                                              |
| "Lined up" could pass on a fitting wall while the canopy was never measured.                                                                                    | Give each surviving part of the scene its own `region` (wall, canopy, shopfront; roof, facade). Lined up needs every region measured, so only regions that can be seen today. Two regions minimum.            |
| The camera kept asking to step back and forth on noise.                                                                                                         | Add `zones: { near, far }` (archive fractions) only when a clearly near surface and a clearly far, unchanged part both survive. Without them the camera just doesn't give step signs.                         |
| Most of the old view has changed (St Heliers: a tree hides the left wing, the street is a roundabout).                                                          | The matcher accepts a dense match on what survives (45+ agreeing points over at least 12% x 15% of the old view). Put the regions on that surviving part and drop lines over hidden or rebuilt parts.         |
| Line names flashing on screen were unreadable.                                                                                                                  | Use short, recognizable names. The camera names the matched foreground reference and the edge to move.                                                                                         |

Check a new or changed guide offline before shipping: `node --experimental-strip-types
scripts/check-guide.mjs <slug> <recent-photo.jpg>` scores the lines the way the camera does.
Every region should be measured, and a visually good shot should score highest.

## Local feedback in the camera and review

Every traced landmark can respond to its own image evidence, including at places without verified scoring regions. Green marks an overlapping edge. Amber shows a gap, with a dashed outline at the detected edge when its displacement is measurable. The arrow describes where to bring that edge on screen. A single uncorroborated candidate uses a dotted blue outline for manual comparison. The live camera clears lost evidence as the view changes. Only a recognized scene with supported regional measurements can earn “Lined up”.

In the 26 November Mayfair capture, the slide tip was within three pixels at a display width of 900 pixels, while the right blue lamp shaft was about 45 pixels right of its target. A single scale instruction obscured that difference. Keep the slide as the foreground reference and compare the right lamp and mast footing independently. The feedback leaves the preview, shutter and export at the photographer’s chosen framing.

## Neighbourhood guides, November 2026

- **Mayfair Place.** The 25 November field recording shows the yellow slide exit in the foreground, the bench on three block feet beyond it, then the passage across the square. Aim from beside the exit. Its upper lip is a separate scoring region. The underside, foot and bench help judge distance by eye. The birds help locate the viewing side. Keep foliage and changed lettering out of the guide.
- **Apirana Avenue.** Auckland Transport's right-hand ramp photo on page one shows the post office frontage, high white sawtooth, long verandah and pavement end from the other side of the approach. Use the roof and frontage to aim. The far window, lamp and kerb are visual references. Parked cars and shop signs change. [Auckland Transport, June 2024](https://at.govt.nz/media/0nspxrxh/links-to-glen-innes-june-2024-newsletter.pdf) · [Kura archive record](https://kura.aucklandlibraries.govt.nz/digital/collection/photos/id/284852)
- **Bridgeway and Northcote Tavern.** Compare the shop arches and right roof at the cinema, and the gables, windows and upper verandah on the two faces of the tavern. The modern cinema fascia is deeper. The tavern gained a wing, hedge and fence. [October 2026 photographs](https://tmrowe.com/2026/10/26/how-to-time-travel-without-leaving-home/)
- **Northcote Post Office.** Use the front cornice, tall windows and receding side elevation. The 1929 crowd hides the base. The restaurant conversion leaves the exact window correspondence uncertain, so these lines are visual only. [Auckland Council heritage review, Fig. 12](https://new.aucklandcouncil.govt.nz/content/dam/ac/docs/arts-culture-heritage/north-shore-heritage-thematic-review-volume-2.2.pdf)
- **Tāmaki Drive and Gower Point.** The first archive looks along the curved seawall. The second faces the point with the distant harbour skyline to its right. The sea surface, tree canopy and beach waterline change. Use the long curves and separated landforms as visual guides until a matching modern view establishes their correspondence.
- **Riddell Road.** Use the distant road cutting and outside bend to find the view. The 2024 before-and-after photos show the utility poles removed and a changed shop-side streetscape. The old kerbs help read the archive but cannot establish a modern match. [Entrust, page 5](https://www.entrustnz.co.nz/media/hnkpq5bm/entrust-energy-solutions-annual-report-2024_v2.pdf)
