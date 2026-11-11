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
