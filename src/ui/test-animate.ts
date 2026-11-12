/**
 * jsdom has no Web Animations API. This fake `Element.animate` records what
 * would play, so a test can see the motion and end it when it wants.
 */
export interface Played {
  readonly el: Element;
  readonly keyframes: Keyframe[];
  readonly options: KeyframeAnimationOptions;
  cancelled: boolean;
  /** Ends the animation as the browser would: `onfinish` runs. */
  finish(): void;
}

type FakeRun = Played & { onfinish: (() => void) | null; oncancel: (() => void) | null; cancel(): void };

export function fakeAnimate() {
  const played: Played[] = [];
  const proto = Element.prototype as { animate?: unknown };
  proto.animate = function animate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const run: FakeRun = {
      el: this,
      keyframes,
      options,
      cancelled: false,
      onfinish: null,
      oncancel: null,
      finish() {
        run.onfinish?.();
      },
      cancel() {
        run.cancelled = true;
        run.oncancel?.();
      },
    };
    played.push(run);
    return run;
  };
  return {
    played,
    /** What played on `el`. */
    on: (el: Element | null) => played.filter((run) => run.el === el),
    finishAll: () => [...played].forEach((run) => run.finish()),
    restore: () => {
      delete proto.animate;
    },
  };
}
