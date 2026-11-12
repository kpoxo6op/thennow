# Animated Decisions experiment

Status: prototype, disabled by default. Do not enable for ordinary users: the
initial live-model direction controls failed. Browser integration works; reliable
physical coaching has not been established.

The isolated route is `/<slug>/camera/experiment`, initially for the two places
with curated traces. Start explicitly allows small camera images to go to OpenAI.
The usual camera stays available. No direction words are displayed: one animated
phone shows aiming/rotation, with a static alternative for reduced motion. The
protocol also represents distance suggestions, but the current inference policy
abstains on scale differences because zoom and distance are ambiguous.

The experiment disables automatic local correction so model advice and camera
framing cannot fight each other. Existing faint reference, traces, shutter and
review remain. Model replies never trigger capture, change the crop, claim a
lock, or certify publication quality. Two consecutive fresh agreeing decisions
are required. Responses older than 1.8 seconds are discarded; a displayed cue
expires within 2.2 seconds of sampling. A small image-difference check withdraws
advice after a large view change; this heuristic is not a calibrated pose tracker.
Backgrounding, resizing, archive inspection, capture and retake invalidate work.
There are at most 40 requests per mounted camera; service failure leaves a neutral
crossed-cloud cue and manual capture available.

## Operator setup

Use `corepack pnpm install`, then build normally. In the server process only, set
`TN_DECISIONS_EXPERIMENT=1` and `OPENAI_API_KEY` using an authorized secret source.
Never put the key into a client variable, URL, command argument, Git or screenshots.
Do not enable the flag on production based on these results. No key is needed to
run the browser checks; their key is deliberately unusable and the coaching
endpoint is intercepted in that journey.

`POST /api/camera-decision` validates same-origin browser requests, bounded JSON,
real decoded JPEGs and a catalogue-owned archive. Frames are stripped of metadata
and not retained by the app; they are sent to OpenAI, whose account data controls
apply. No image, location, secret or free-form model output enters telemetry.
Instance-local limits (60 requests/network and 300 total per ten minutes) are
abuse friction, not authentication or a distributed spending ceiling. A public
rollout needs an access/budget decision, independently of model quality.

Run private operator comparisons against a locally enabled server:

```sh
node scripts/decision-experiment.mjs http://127.0.0.1:3101 bradley-lane-line-road /private/frame.jpg
```

The script resizes images, calls the real endpoint and prints only bounded
suggestions/timing. It does not establish a ground-truth camera movement. Use
independently specified image transforms and actual recorded movements to judge
whether advice helps. Keep field photos and raw evidence outside Git.

## Initial real-provider findings — 12 November 2026

Model: `gpt-6-luna` via OpenAI Decisions. Direct image requests through the local
endpoint took approximately 0.3–0.6 seconds in the first three calls. A separate
cold text connection check took about 3 seconds; neither result proves phone/5G
latency. The ten-way action prompt abstained even on an identical-reference pair.

The next prompt decomposed horizontal, vertical, roll and scale observations,
then deterministically mapped them into one physical action. Sixteen controlled
requests compared original and normalized image sizing. Equal sizing recovered
one identical-image hold result, but directional controls still failed. A known
counterclockwise rotation was classified as clockwise with 0.85 confidence.
The combined gates suppressed it in that sample; confidence alone would not.
Normalized controls yielded one hold and seven abstentions. No threshold was
lowered to manufacture a successful direction.

Conclusion: fast enough to investigate; not accurate enough to enable as a live
coach. Keep this experiment isolated until directional errors are resolved with
independent evidence. Model confidence is not geometric verification.
