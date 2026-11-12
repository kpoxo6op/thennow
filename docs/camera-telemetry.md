# Camera diagnostics

Camera diagnostics explain what the guide decided, not whether a photograph is
accurately registered. Apply [the manual-photo baseline](alignment-quality.md)
separately. A `steady` guide state means temporal stability; a `framed` review is
an unverified coarse fit. Neither certifies photographic accuracy.

Records use an ephemeral camera-session ID, stream-run number, capture number,
batch sequence and deployment build. They include model timing, match outcomes
and rejection reasons, guide transitions, periodic heartbeat summaries, visibility
changes and session end when the page lifecycle permits it. Captured-frame review
can be correlated with the shot without storing the photograph in telemetry.

The browser queues bounded batches and retries transient failures. The receiver
allowlists event fields, enums and numeric ranges, including older cached clients.
It does not log image pixels, feature coordinates, precise location, page paths,
raw user-agent strings, cookies, identity or free-form error messages. Unknown
fields are discarded. Collection is capped; the envelope reports drops, delivery
failures and the event limit when another batch can reach the server.

Export production `camera-telemetry` JSON lines privately with the existing Vercel
operator credentials, then summarise offline:

```sh
node scripts/camera-report.mjs /path/to/private/camera-telemetry.jsonl
```

The report deduplicates retried batches, identifies sequence gaps, and groups the
timeline by session with run/capture correlation. A missing start/end, dropped
records, sequence gap or reached cap means incomplete evidence. Browser crashes,
offline closure and failed final delivery can lose the tail without a later
counter update. Do not infer that nothing happened just because no event arrived.

Do not add private logs or recordings to Git. Do not turn these diagnostics into
additional product analytics dimensions or a user-facing technical dashboard.

## Field experiments and recordings

Each batch includes the client's session-start UTC milliseconds. The offline
report combines this with monotonic event offsets to show a recording-friendly
UTC timeline. The phone clock may be wrong; server receipt time is not capture
time, particularly after retries. Keep the recording's original timestamp.

An `experiment` event identifies the public archive by its numeric catalogue
prefix (for example 14 for Bradley Lane), the trace/split mode, configured overlay
opacity and feature count. No place path or GPS coordinates are logged. `guide
view` records source-photo switches, reveal position and viewport dimensions;
drag/resize updates in split mode are debounced. Each shot includes its actual
normalized crop, overlay/reveal, media time and latest video-frame age. A separate
`framing` event records the resulting review crop, so automatic recropping and
fixed-trace preservation can be distinguished.

A `submissionTag` is the first 16 hexadecimal characters of SHA-256 of the random
per-upload key. It appears in the diagnostic `send` event and the server's
`submit-photo` log, allowing the private submitted photograph to be correlated
with a session/capture. It is not an identity or authentication credential; raw
upload keys are not added to camera telemetry. Existing submission logs retain
their existing operator information. No photos are collected beyond an explicit
Send photo action, and the new fields do not enter product analytics.

For a field session, start screen recording before opening the camera, then use
it normally. Include the review and any retake/send outcome. No special experiment
button or technical overlay is needed. The recording and exported photograph are
still required to judge visual quality: these diagnostics do not measure regional
landmark errors, blur or the quality of hypothetical buffered frames.

## Handheld assistance

`assistance` records bounded refusal reasons alongside supported-feature and region
counts. `sampleMs`, `modelMs` and `refineMs` separate camera readback, coarse
recognition and edge assessment. `ms` is the whole iteration; `frameAge` measures
time since the most recently sampled frame, including worker transfer/processing.
`identityAge` measures the coarse seed age. Do not interpret the old tracing
heartbeat's legacy matcher counters as counts of this separate edge pipeline.

`burst.reason` distinguishes absent/expired identity, rejected geometry and an
assisted selection. An assisted result is still not a publication-quality verdict.
No new pixel data, coordinates or free-form diagnostic strings enter these events.
