# Alignment acceptance

Boris's manually photographed comparisons are the minimum standard. New captures
must match or exceed their alignment before publication. Recognising the place,
a steady phone, an orange shutter ring, an inlier count, and passing browser tests
are not evidence that a photograph meets that standard.

## Reference pairs

Use the existing photographs at their intended display geometry, not differently
scaled image previews. These are reference examples, not pictures to delete or
reframe to make a new algorithm look better.

| Pair | What to inspect |
| --- | --- |
| Mission Bay Fountain | Bowl rim and centre, sculptural bases and basin outline. Ignore water jets and changed vegetation. |
| Historic Post Office, Helensville | Surviving front facade, entrance arch, window corners, pediment and roof edges. Ignore new foreground buildings, poles and cars. The archive's existing display crop is intentional; preserve it. |
| Mission Bay Yacht Club | Surviving gable, roof pitch, front wall and seawall convergence. Distinguish additions and changed tide from alignment. |
| Mission House | Both surviving gables, chimney and stone walls. Occluded features cannot count as confirming evidence. |
| Mill House | Visible original roof, chimney and dormers; additions and trees limit the evidence. |
| Rata Street / Commercial Road | Context and viewpoint reference only: too few unambiguously unchanged structures for a strict architectural precision threshold. |

The fountain and Post Office are the primary precision references. Do not use the
least constrained pair to lower the bar for a clearly visible building.

## Publication decision

1. Inspect the actual exported JPEG against its archive in the real comparison
   page, at the same displayed width as the reference pairs. Sweep the divider
   across the subject, including roof corners and outer edges, and alternate the
   whole photographs. A single attractive middle split is insufficient.
2. Compare several unambiguously unchanged features distributed across the
   subject: upper and lower, left and right, and different visible faces. The
   main structure must stay as well registered as the manual references; one
   accurately matched patch must not conceal a jumping roof or another face.
3. Distinguish real historical changes and occlusion from alignment. If there
   is insufficient evidence, mark the result unverified; do not guess a pass.
4. Reject a new pair with a material architectural jump worse than the manual
   references. Remove its modern image and comparison preview from the public
   catalogue and return the archive place to pending. Preserve the private source
   submission for diagnosis or a later verified correction.
5. Record the inspected landmarks, reference pair and decision in the task report.
   An algorithm score must not overrule a visible failure.

This is currently a human publication gate. It is not an implemented automatic
quality classifier. Do not describe it as one.

## Matcher acceptance work

Any automatic gate must be calibrated against these real manual pairs and known
bad captures at the final displayed scale. Measure errors on independently
identified surviving landmarks, including landmarks withheld from fitting, and
report regional errors and uncertainty. Do not invent a pixel threshold and claim
it was measured from these references. Synthetic camera tests protect control
flow; they do not establish photographic alignment quality.

Stability and geometric accuracy are separate requirements. A failed captured-frame
verification must not become "aligned" because an earlier live lock was stable.
Refine coarse matches before asserting precision. Where a permitted crop,
rotation and uniform scale cannot align the subject, require a retake rather than
silently stretching or warping the photograph.

## Known rejection

The St Heliers Library submission published on 11 November 2026 fails: the right
roof hip/eaves and facade do not stay registered across the divider. It must not
be used as a passing example or republished unchanged. Its private original is
retained; the public archive remains available for a better capture.

The Bradley Lane submission from the same date also fails as a complete
comparison: the mural is reasonably registered, but the receding canopy and
shopfront diverge. A good fit on that front wall does not validate the rest of
the principal scene. Its archive also returns to pending, with the source
submission kept private.

## Current camera mitigation

The guide continues to help framing, but a stable coarse placement no longer fires
the shutter or turns its ring orange. Short scene-state instructions replace the
automatic-shot promise. A successful coarse still-frame fit is `framed`, not
verified; submissions carry `checked=false`. A failed still match offers Retake,
even after a held live placement. A runtime failure remains unchecked and retains
the photograph for manual review. These changes remove false assurance; they do
not establish automatic photographic accuracy.
