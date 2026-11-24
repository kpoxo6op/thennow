# Alignment acceptance

Boris's manually photographed comparisons are the minimum standard. New captures
must match or exceed their alignment before publication. Recognising the place,
a steady phone, an orange shutter ring, an inlier count, and passing browser tests
are not evidence that a photograph meets that standard.

## Reference pairs

Use the existing photographs at their intended display geometry, not differently
scaled image previews. These are reference examples, not pictures to delete or
reframe to make a new algorithm look better.

| Pair                              | What to inspect                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mission Bay Fountain              | Bowl rim and centre, sculptural bases and basin outline. Ignore water jets and changed vegetation.                                                                                                |
| Historic Post Office, Helensville | Surviving front facade, entrance arch, window corners, pediment and roof edges. Ignore new foreground buildings, poles and cars. The archive's existing display crop is intentional; preserve it. |
| Mission Bay Yacht Club            | Surviving gable, roof pitch, front wall and seawall convergence. Distinguish additions and changed tide from alignment.                                                                           |
| Mission House                     | Both surviving gables, chimney and stone walls. Occluded features cannot count as confirming evidence.                                                                                            |
| Mill House                        | Visible original roof, chimney and dormers; additions and trees limit the evidence.                                                                                                               |
| Rata Street / Commercial Road     | Context and viewpoint reference only: too few unambiguously unchanged structures for a strict architectural precision threshold.                                                                  |

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

## Run the cross-place outline baseline

From the repository root, with Python 3, Pillow, NumPy, SciPy and the public Git
history available, run:

```sh
python3 scripts/rephoto/evaluate_outlines.py
```

The default run reads every current catalogue entry with a modern image and the
two November 11 published pairs from commit
`d9e53835de2e0ed41c594439137a28c39a09615d`. It reads the historical JPEGs into
memory. It needs no camera logs, submissions, service credentials or network.
To score an unseen pair, append `--pair ARCHIVE.jpg MODERN.jpg`. Supply
display-oriented exports. Local-pair mode uses the modern aspect ratio. Catalogue
mode uses the declared comparison aspect ratio, including the Helensville crop.

Both images receive the same centre-cover treatment at 640 px display width.
The baseline extracts strong intensity gradients in four orientation bins and
counts archive edge points with a modern edge of the same orientation within
3 px. Each cell of a 3-column, 2-row grid also compares the displayed position
with eight alternatives displaced by 16 px horizontally, vertically or both.
The 24 px margin keeps all samples in frame. Votes read across the top row,
then the bottom. A 1 means the displayed position strictly beat every shift;
0 includes ties. A dash means no archive samples in that cell. Scores describe
the supplied framing. There is no fitted transform or pass/retake threshold.

| Pair (24 Nov 2026 run) | Outline agreement | Regional votes |
| --- | ---: | --- |
| Mill House | 12.8% | 010001 |
| Rata Street (context only) | 16.5% | 100100 |
| Helensville Post Office | 18.0% | 010000 |
| Mission Bay Fountain | 36.5% | 000111 |
| Mission Bay Yacht Club | 28.6% | 111000 |
| Mission House | 25.6% | 010100 |
| Bradley Lane, published Nov 24 | 54.9% | 111110 |
| St Heliers Library, rejected Nov 11 | 26.2% | 000000 |
| Bradley Lane, rejected Nov 11 | 48.7% | 110110 |

The rejected Bradley capture beats all five manual architectural references on
both measures. A grid can count one mural several times. Requiring upper and
lower votes would also discard both the Fountain and the Yacht Club.

### Independent landmarks and place holdout

The landmarks in the reference and rejection sections above were assessed by
comparing the photographs independently of the edge extractor. For example,
at native 1000 × 675 Yacht Club scale, the clubhouse gable peak and far ridge
end are approximately (175,223) and (340,235) in the archive, and (175,225)
and (341,238) in the modern image. They give two checks on one roof. The
seawall joint leading to the bottom edge checks another depth. At the Fountain,
the bowl rim and basin lip survive the changes to trees and water jets. At
rejected Bradley the mural corner is close while the hanging TAKEAWAY sign is
displaced sideways. At rejected St Heliers compare the right roof hip against
the facade below. These observations are evaluation evidence only. The baseline
takes no landmark coordinates. These examples do not constitute a complete
point-labelled dataset or measured tolerances for every structure.

Use the following protocol to compare a future candidate:

1. Group by place. Use leave-one-place-out folds for development: exclude every
   capture, crop and variant of the scored place when fitting or choosing
   thresholds. In particular, keep both Bradley dates together. Aggregate
   decisions per place and also show each capture. All places above are now
   known regression examples. Reserve additional whole places with independently
   judged good and bad captures for a blind run after freezing the candidate.
2. Before viewing candidate output, mark corresponding visible landmarks on
   independent surviving structures or depths. Withhold those annotations from
   fitting. Record annotation repeatability at the evaluation display width.
   Report each structure's worst landmark displacement after the allowed
   transform, in pixels at 640 px width. Set tolerances on development places
   using manual-pair residuals and annotation uncertainty, then freeze them.
3. As a minimum regression hurdle, accept both primary manual references,
   accept neither historical rejection, and report decisions on all other
   places. Count accept, retake and unverified separately for each label.
   Report usable coverage (decisive calls / eligible pairs) alongside false
   accepts and false retakes. Keep Rata Street as context only. An unsupported
   fit, missing independent structure or ambiguous landmark warrants abstention.
   An abstention on a good pair contributes no successful acceptance.
4. Before promotion, predeclare the required coverage and allowable error rates
   for the new-place run. Report numerators, denominators and place-level
   uncertainty against those targets. An accepted capture fails the geometry
   check if any held-out structure exceeds its frozen tolerance. Two known
   negatives cannot establish a deployment false-accept rate. Passing this
   local comparison qualifies a candidate for further evaluation only.

Treat publication as provenance. A new public pair enters the comparison as
unlabelled until its independent landmarks have been assessed. Adding it to a
run increases the catalogue of examples without changing the five manual
reference labels or the two known rejection labels.

### Public catalogue run summaries

The **Public alignment benchmark** workflow runs on relevant pushes to main and
on manual dispatch. Each GitHub Actions run summary records a row for every
current public pair and each pinned historical rejection. Compare summaries
across revisions using the commit attached to each run.

Run `python3 scripts/rephoto/evaluate_outlines.py --public-report` to reproduce
the summary after installing the repository’s pnpm dependencies and the Python packages pinned in
[the workflow](../.github/workflows/public-alignment.yml). This mode supplies
the catalogue's displayed frames to the offline junction diagnostic as well as
the outline baseline. It shows how many corners were found in each image, how
many were matched, and how many matched displacements exceeded 8 px at 1000 px
width. Read the displacement count together with its denominator. In the
24 November run, the junction check abstained on all nine pairs, including both
rejections. Zero matched corners leaves the displacement unmeasured.

The last two columns replay the shipped LoFTR model and production crop fitter
on each pair. A second pass embeds the same modern pixels in a larger, asymmetrically
padded frame. The reported error is the largest difference between corresponding
crop corners after undoing that known offset, in pixels per 1,000 pixels of crop width.
A missing fit in either pass is reported explicitly. This measures repeatability
under a framing change. A repeatably wrong fit can still miss the subject.

### What the MoneyGram fascia taught us

The four front corners of the fascia are roughly 14–17 px left in the 24 November
export, at 1,000 px display width. Its top-right corner is about 6 px low. Fitting
a single similarity transform to the four corners reduced their RMS error from
15.6 to 1.5 px, but increased the error of the recessed TAKEAWAY lettering from
4.4 to 16.3 px. Keep the front and recessed structures independent when judging
a proposed correction. The changed lettering alone cannot identify the cause.

An automatic junction check on a model-aligned replay located the top-right tip
within about 2 px of the independent measurement. The same check abstained on
the directly resized export and on the other places tested. Joining nearby
collinear segments produced no additional matches in the six other fitted places.
Keep these as development observations. Automatic steering or recropping needs
new-place coverage and independent evidence from more than one structure.
