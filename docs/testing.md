# Test what can actually break

The November 2026 audit reduced 318 discovered checks (313 Chromium + 5 WebKit)
to 97 (95 Chromium + 2 WebKit). Most were browser tests, not unit tests. The
problem was duplicated work and claims beyond what the fixtures could prove.
The e2e TypeScript sources fell from 6,572 to 3,838 lines. Deleted cases remain
in Git history, not in skipped suites or an excluded test archive.

## What stays, and why

Each row owns a separate observable contract. Test names identify the particular
scenario. A new test must name a credible failure and explain why these owners
do not already catch it; prefer extending or replacing an existing journey.

| Owner                                    | Contract and credible failure                                                                                                                                                                                             | Why this layer remains                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `compare.spec.ts`                        | Default/URL/reload state, fixed before-image while dragging, knob/border geometry and safe phone margins; a moving crop or incorrect URL breaks comparison.                                                               | Real browser layout and history, not component snapshots.                                                                                                                |
| `compare-endpoints.spec.ts`              | Actual pixels differ at both ends; keyboard reaches endpoints; touch drag differs from page scroll and edge gestures.                                                                                                     | A range input value alone cannot establish rendered pixels or gesture handling. One narrow width replaces the position/width matrix.                                     |
| `compare-pointer.spec.ts`                | Off-centre grab does not jump, photo clicks set position, wide-screen inset has correct endpoints.                                                                                                                        | Pointer offsets and letterboxing are different from the range/URL contract.                                                                                              |
| `header.spec.ts`                         | Desktop navigation reaches the right edge with balanced margins.                                                                                                                                                          | Explicitly protected layout regression; exact theme/palette assertions removed.                                                                                          |
| `collection.spec.ts`, `home-map.spec.ts` | List/map/search/history journeys, usable pending place, selected row reachability, map failure recovery.                                                                                                                  | Keeps the demonstrated slow-navigation race with CPU throttling and delayed route response. Map code failure and tile failure have different recovery paths.             |
| `story.spec.ts`                          | Whole-photo toggle restores comparison, nearby navigation, rotation preserves a reachable grip, lazy map space, map failure and touch scrolling.                                                                          | Story-local layout/lifecycle differs from collection maps. Per-place map browser runs and repeated width matrices removed.                                               |
| `zen.spec.ts`, `safari.spec.ts`          | Fullscreen exit/history, focus trap, fitting after rotation; WebKit history throttle and non-native-fullscreen Back.                                                                                                      | Android cannot substitute for WebKit. Desktop fullscreen APIs do not prove Android system Back.                                                                          |
| `camera.spec.ts`                         | Simulated capture/review/send, crop shape, disabled send while aligning, preserved failed upload/retry key, cookie-before-upload, retake/release/late acquisition, denied permission; API origin/size/input/rate refusal. | Deterministic application races and adversarial requests are not safely/reliably reproduced in field happy paths. Retains save-data and slow-server regressions.         |
| `matcher-guide.spec.ts`                  | Simulated loading disappears after first run, unsupported notice is brief, shutter works during loading, stalled download/late session/hung inference recover.                                                            | Controls race ordering and timeouts; does not prove GPU support or inference. Orientation matrix removed.                                                                |
| `identity.spec.ts`                       | Photo privacy/idempotency, identity and comment migration, passkey ownership, unissued/replayed challenge rejection, migration past a listing page.                                                                       | A genuine login on one device cannot expose another visitor's access or replay defects. All eight retained; virtual authenticator + in-memory store are explicit limits. |
| `me.spec.ts`                             | Cookie hardening and malformed/missing identity, name/origin/passkey input refusal.                                                                                                                                       | Public server boundary, not signup copy or mocked success.                                                                                                               |
| `comments.spec.ts`                       | Literal text, privacy, validation/rate limits, own/admin deletion, preserved failed drafts/removal, stale-list reconciliation, recovery and cross-visitor visibility.                                                     | Retains server ownership and lost-user-data failures; removes heading/type-size/copy and duplicate UI cases.                                                             |
| `posts.spec.ts`                          | Every image decodes with the dimensions its record declares.                                                                                                                                                              | One data-integrity pass over all assets, independent decoded metadata; no browser per file.                                                                              |
| `preview.spec.ts`                        | Finished and pending story previews serve real optimized images; sitemap excludes private routes.                                                                                                                         | Two representative rendering branches replace browser runs for every content record.                                                                                     |
| `track.spec.ts`                          | Known noisy translation and rejection of blank/repeating/unrelated images.                                                                                                                                                | Independent synthetic ground truth catches a wrong sign or false movement. Does not establish field tracking.                                                            |

Removed `camera-zoom.spec.ts`: it changed reported camera settings without changing
frames. `fake-ort.mjs` calls the **server** matcher and returns constructed model
outputs. Keeping that simulation cannot establish on-phone WebGPU, shader-f16,
model compilation, camera permissions, thermal behaviour, actual zoom or field
alignment. These are device acceptance responsibilities below.

## Fast deterministic gate

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm format:check
# Stop a stale test server before running changed code:
lsof -ti :3100 | xargs -r kill
TN_WEBKIT=1 corepack pnpm test:e2e
```

CI runs the compact Chromium suite and the two WebKit engine checks. Failure
traces/screenshots are retained. A green run means these contracts passed with
the declared fixtures, not that a phone has passed acceptance.

The fake store is confined to the test server. Preview-store checks remain
`scripts/claim-check.mjs <preview-url> <synthetic-jpeg>` and
`scripts/passkey-check.mjs <preview-url>`. They write test data; use a disposable
preview/test identity and a synthetic image, never Boris's photographs. The
passkey script uses a virtual authenticator, not the native Android passkey UI.
No bearer cookies belong in logs.

## Android acceptance: run it, do not just fill out a checklist

For camera/runtime or mobile interaction changes, exercise real Chrome on the
existing Android emulator and Boris's Pixel when available. A desktop browser
with a phone viewport is neither. Emulator camera/GPU behaviour is not physical
Pixel evidence. Device results supplement the small CI gate; they do not replace
the adversarial ownership checks.

On this laptop use the installed Errands skill at
`/home/boris/.agents/skills/errands/SKILL.md`. Read it first. Claim one lease, reuse
it, and stop on ownership loss, protected state or busy-device refusal. Never use
raw ADB or bypass a refusal. Check Pixel availability with Boris before taking
it away from what he is doing. Do not clear his browser data, reset accounts or
submit/save his personal camera frames as test fixtures.

For the capture/review/retake/close journey, run the bounded smoke command after
claiming a lease and confirming availability. It uses one guarded Errands
session, checks observed Android controls between actions, never sends or saves
a photo, and exits nonzero on refusal or missing postconditions:

```sh
corepack pnpm test:device --device emulator --goal NNNN --commit DEPLOYED_SHA
# When Boris has made the Pixel available:
corepack pnpm test:device --device pixel --goal NNNN --commit DEPLOYED_SHA
```

Optional `--url https://PREVIEW/mission-house/camera` selects a deployment;
`--title` gives the exact story heading if using another place. The caller must
verify the deployed SHA: this command records it, it does not infer it. Private
results go to ignored `device-evidence/`; screenshots remain in Errands evidence.
A PASS means this short journey passed, not that matching/zoom or field use did.
Run the remaining journeys below separately and record their actual outcomes.

For interactive inspection, the equivalent guarded steps are (read each returned
screen before the next action):

```sh
errands lease claim                         # record the returned NNNN
# Use the exact deployed preview/production URL whose commit you recorded.
env ERRANDS_DEVICE=emulator errands checkpoint open_url --goal NNNN \
  --arguments '{"url":"https://thennow.nz/mission-house/camera"}'
env ERRANDS_DEVICE=emulator errands checkpoint observe --goal NNNN \
  --arguments '{"actions":true,"screenshot":"thennow-camera-open.png"}'
# If the returned permission dialog offers it:
env ERRANDS_DEVICE=emulator errands checkpoint tap --goal NNNN \
  --arguments '{"text":"Allow this time"}'
# Observe again; only tap Take photo if that enabled control is actually present.
env ERRANDS_DEVICE=emulator errands checkpoint tap --goal NNNN \
  --arguments '{"desc":"Take photo"}'
env ERRANDS_DEVICE=emulator errands checkpoint observe --goal NNNN \
  --arguments '{"actions":true,"screenshot":"thennow-review.png"}'
# Use the observed Retake/Close control; verify each resulting screen.
```

For an available Pixel, omit `env ERRANDS_DEVICE=emulator`; require the returned
physical-device identity. Keep all screenshots/video/notes in Errands' private
ignored evidence directory or `device-evidence/` (ignored here). A delivered tap
is not a passed check: inspect the postcondition. Native permission controls and
camera imagery must be observed, not mocked with page scripts or routed ORT.

Record these few journeys, with separate observations where hardware matters:

1. **Open and shoot:** cold model load through first inference, visible loading,
   usable shutter while loading; review, retake, close and warm reopen. Record
   actual elapsed time and whether cold cache was genuinely available. Do not
   call a warm load cold or wipe Boris's cache to manufacture one.
2. **Move and recover:** with a suitable real scene, old photo aligns, orange ring
   appears, moving away loses alignment and returning reacquires it; visually
   confirm framing/zoom. Rotate and background/return, then capture and retake.
   A random indoor view or emulator feed cannot pass field alignment.
3. **Fallback:** denied permission explains recovery; unavailable guide or failed
   network still allows a shot/review. Observe the actual failure condition;
   retain deterministic timeout tests for failures not safely inducible live.
4. **Navigate:** compare touch drag/edge margins, rotation and Back; Places map
   selection opens its story and Back restores the map. Record real gestures,
   not just a changed input value.

Native passkey and upload persistence checks use a disposable preview/test
identity and a synthetic scene. Stop before any send containing a personal
photo. Lack of a suitable scene, permitted network setup, native action support
or available Pixel is **blocked/not run**, never a pass inferred from CI.

Copy this record into private evidence for each run; do not commit imagery:

```text
URL and deployed commit:
UTC date/time:
Device identity / Android / Chrome version:
Network / cold or warm model state:
Runtime substitutions: none (otherwise this is simulation)
Journey and expected observable outcome:
Observed outcome: PASS / FAIL / BLOCKED / NOT RUN
Loading elapsed time (or not observed):
Private screenshot/video/log paths:
Limits and next required field check:
```

A release report must say which device journeys actually ran, failed or remain
blocked. Camera changes are not "phone-ready" while physical matching evidence
is missing. Tests/docs-only maintenance does not imply a new field-validation
claim for unchanged application code.

## Evidence from this cleanup

On 11 November 2026, the reviewer exercised production commit
`5212de9d0aed563edbeea1e0fa464d40253dc768` without runtime substitutions:

- Android emulator, Chrome 155: the new command passed enabled shutter → captured
  review → retake → closed story, 02:13:13–02:14:34 UTC. Actual matcher startup
  reported no half-precision WebGPU, so this exercised the unavailable-guide
  path. Screenshots show mixed launcher/page layers even after camera close;
  visual correctness is **inconclusive**, not passed. Cause was not established.
- Pixel 9 Pro XL, Chrome 156: the reviewer observed actual camera startup,
  capture/review and retake; production telemetry reported matcher ready in
  1,822 ms and 59 actual inference runs before capture (zero matches on the
  unrelated indoor scene). Retake restored the stream in 378 ms. Close was
  not verified: the phone returned to ChatGPT and the guarded action refused
  without input. No further Pixel action was attempted.
- Physical field lock/reacquisition/zoom, cold-cache timing, rotation/background
  recovery and native passkeys were not established. No personal photo was
  submitted or committed. Private evidence is retained by the operator.

This is evidence for the new workflow, not a full camera acceptance or a fix for
an application rendering problem. The smoke command's PASS covers its four
control-flow postconditions; its visual review remains a separate requirement.

## Why generated tests can create false confidence

[On the risk of coding before testing](https://arxiv.org/abs/2607.05139) found
that tests generated after faulty code could repeat its errors; detection was
14% versus 25% for independent generation in that study's tasks.
[VibeCheck](https://arxiv.org/abs/2609.05978), studying 15 student repositories,
found runnable generated tests often had weak assertions or missing edge cases.
These are bounded studies, not proof that agents or unit tests are universally
bad. [LLM vs. Human Unit Tests](https://arxiv.org/abs/2606.08588) found targeted
generated tests outperformed its human-test baseline on Python bugs, while
coverage did not distinguish fault detection well.

The practical rule is independence: specify the user outcome or known failure
before deriving an assertion from code. A fixture answering what the application
expects is not an independent oracle. For a new regression test, demonstrate
that the old bug or a small credible fault fails it when feasible; do not build
a mutation-testing programme for every edit. Count, coverage, runnable status
and an agent's approval are not evidence of real device behaviour.

## Camera framing and capture

The matcher-guide journey owns the observed St Heliers regression: an inconsistent
model placement must not move the accepted overlay; lost tracking fades it in
place. A stable coarse fit is only framing assistance and must not fire the
shutter or certify alignment. Manual capture remains available while loading,
searching and with an unsupported matcher. The same journey supplies a deliberately
positive simulated model answer over an unrelated camera frame for traced places:
regional evidence must refuse assistance, the aiming target stays fixed, and a
manual burst falls back to its first frame and exact composed crop. The download
journey also takes an unchecked traced photo while identity assistance is loading. A failed still-frame match must revoke
a live placement; runtime failures remain unchecked. Coarse framing never marks a
submission as geometrically verified.

These existing journeys protect control flow with simulated inference. The manual
photo baseline in [alignment-quality.md](alignment-quality.md) and real field
captures determine photographic quality. Automatic capture remains disabled until
that separate quality evidence exists. Live hardware autozoom remains disabled.

## Decisions camera experiment

One additional browser journey owns the new opt-in image-request boundary: no
request before Start, two fresh agreeing suggestions before a directional icon,
late answers discarded, manual capture during waiting, and failed service still
allowing a photograph. API intake rejection cases extend the existing camera
boundary check. This adds one case (96 total), not a model accuracy suite.

Responses in that journey are simulated. Real Decisions API controls and latency
must be evaluated separately; passing UI checks cannot authorize live directions.
See [the experiment notes](decisions-experiment.md).
