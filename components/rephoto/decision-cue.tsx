import type {
  CameraDecisionAction,
  CameraDecisionProgress,
} from "@/lib/rephoto/decision"

import styles from "./decision-cue.module.css"

const labels: Record<CameraDecisionAction, string> = {
  aim_left: "Turn the camera to the left",
  aim_right: "Turn the camera to the right",
  aim_up: "Point the camera upward",
  aim_down: "Point the camera downward",
  roll_left: "Rotate the phone counterclockwise",
  roll_right: "Rotate the phone clockwise",
  farther: "Step back from the subject",
  closer: "Step toward the subject",
  hold: "Keep the camera still",
  unknown: "No movement guidance available",
}

/** Movement advice only: this cue never certifies alignment or controls capture. */
export function DecisionCue({
  action,
  progress = "unknown",
  loading = false,
  unavailable = false,
}: {
  action: CameraDecisionAction
  progress?: CameraDecisionProgress
  loading?: boolean
  unavailable?: boolean
}) {
  const walking = action === "farther" || action === "closer"
  const horizontal = action === "aim_left" || action === "aim_right"
  const vertical = action === "aim_up" || action === "aim_down"
  const rolling = action === "roll_left" || action === "roll_right"
  const reverse =
    action === "aim_left" || action === "aim_down" || action === "roll_left"
  const visible = unavailable || loading || action !== "unknown"
  const state = unavailable ? "unavailable" : loading ? "loading" : action

  return (
    <div className={styles.root} data-testid="decision-cue" data-action={state}>
      <span
        className={styles.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {unavailable
          ? "AI suggestions unavailable; camera still works"
          : loading
            ? "Checking the view"
            : labels[action]}
      </span>
      {visible && (
        <div
          key={state}
          className={styles.badge}
          data-progress={unavailable || loading ? "unknown" : progress}
          aria-hidden="true"
        >
          {unavailable ? (
            <svg
              viewBox="0 0 72 72"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                opacity=".65"
                d="M24 45h-1a9 9 0 0 1-2-18 15 15 0 0 1 27-2 10 10 0 0 1 3 19M32 45h10"
              />
              <path d="m20 19 33 33" />
            </svg>
          ) : loading ? (
            <span className={styles.dots}>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg
              viewBox="0 0 72 72"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {walking ? (
                <g className={styles.steps}>
                  <g transform="translate(0 4)">
                    <ellipse
                      cx="29"
                      cy="35"
                      rx="3.5"
                      ry="7"
                      transform="rotate(-12 29 35)"
                    />
                    <path d="M27 46h4" />
                    <ellipse
                      cx="43"
                      cy="40"
                      rx="3.5"
                      ry="7"
                      transform="rotate(12 43 40)"
                    />
                    <path d="M41 51h4" />
                  </g>
                  <g
                    transform={
                      action === "farther"
                        ? "translate(72 72) rotate(180)"
                        : undefined
                    }
                  >
                    <path d="M36 25V10m-5 5 5-5 5 5" />
                  </g>
                </g>
              ) : (
                <>
                  {action !== "hold" && (
                    <rect
                      className={styles.ghost}
                      x="25"
                      y="17"
                      width="22"
                      height="38"
                      rx="4"
                    />
                  )}
                  <g
                    className={styles.phone}
                    data-motion={
                      horizontal
                        ? "yaw"
                        : vertical
                          ? "pitch"
                          : rolling
                            ? "roll"
                            : "still"
                    }
                    data-reverse={reverse}
                  >
                    <rect x="25" y="17" width="22" height="38" rx="4" />
                    <path d="M33 21h6M34 50h4" />
                    {action === "hold" && <path d="M33 32v8m6-8v8" />}
                  </g>
                  {horizontal && (
                    <g
                      transform={
                        reverse ? "translate(72 0) scale(-1 1)" : undefined
                      }
                    >
                      <path d="M15 40c1 9 38 13 43-1m-6 1 6-1 1 6" />
                    </g>
                  )}
                  {vertical && (
                    <g
                      transform={
                        reverse ? "translate(0 72) scale(1 -1)" : undefined
                      }
                    >
                      <path d="M51 55c12-2 12-38 0-40m0 6v-6h6" />
                    </g>
                  )}
                  {rolling && (
                    <g
                      transform={
                        reverse ? "translate(72 0) scale(-1 1)" : undefined
                      }
                    >
                      <path d="M20 14c11-9 28-4 33 7m-6-2 6 2 2-6" />
                    </g>
                  )}
                </>
              )}
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
