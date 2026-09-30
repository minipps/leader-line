var anim = // @EXPORT@
  (() => {
    'use strict';

    const FUNC_KEYS = {
      ease: [0.25, 0.1, 0.25, 1],
      linear: [0, 0, 1, 1],
      'ease-in': [0.42, 0, 1, 1],
      'ease-out': [0, 0, 0.58, 1],
      'ease-in-out': [0.42, 0, 0.58, 1]
    };

    const // precision ms/frame (FPS: 60)
      MSPF = 1000 / 60 / 2;

    const // Read once: the test pages replace `requestAnimationFrame` before loading this.
      requestAnim = window.requestAnimationFrame;

    const cancelAnim = window.cancelAnimationFrame;
    const isFinite = Number.isFinite;

    /**
     * @callback frameCallback
     * @param {} value - A value that was made by `valueCallback`.
     * @param {boolean} finish
     * @param {number} timeRatio - Progress [0, 1].
     * @param {number} outputRatio - Progress [0, 1].
     * @returns {} `false` to stop.
     */

    /**
     * @typedef {Object} task
     * @property {number} animId
     * @property {frameCallback} frameCallback - Callback that is called each frame.
     * @property {number} duration
     * @property {number} count - `0` as infinite.
     * @property {{value, timeRatio: number, outputRatio: number}[]} frames
     * @property {(number|null)} framesStart - The time when first frame ran, or `null` if it is not playing.
     * @property {number} loopsLeft - A counter for loop.
     * @property {number} lastFrame - index of last frame that ran.
     * @property {boolean} reverse - Play backwards.
     */

    /** @type {task[]} */
    const tasks = [];

    let newAnimId = 0;
    let requestID;

    window.animTasks = tasks; // [DEBUG/]
    window.MSPF = MSPF; // [DEBUG/]

    let playing; // [DEBUG/]

    function step() {
      playing = true; // [DEBUG/]
      const now = Date.now();
      let next = false;
      if (requestID) {
        cancelAnim.call(window, requestID);
        requestID = null;
      }

      tasks.forEach((task) => {
        let timeLen, loops, frame;

        if (!task.framesStart) {
          return;
        }
        timeLen = now - task.framesStart;

        if (timeLen >= task.duration && task.count && task.loopsLeft <= 1) {
          frame = task.frames[(task.lastFrame = task.reverse ? 0 : task.frames.length - 1)];
          task.frameCallback(frame.value, true, frame.timeRatio, frame.outputRatio);
          task.framesStart = null;
          return;
        }
        if (timeLen > task.duration) {
          loops = Math.floor(timeLen / task.duration);
          if (task.count) {
            if (loops >= task.loopsLeft) {
              // Here `task.loopsLeft > 1`
              frame = task.frames[(task.lastFrame = task.reverse ? 0 : task.frames.length - 1)];
              task.frameCallback(frame.value, true, frame.timeRatio, frame.outputRatio);
              task.framesStart = null;
              return;
            }
            task.loopsLeft -= loops;
          }
          task.framesStart += task.duration * loops;
          timeLen = now - task.framesStart;
        }

        if (task.reverse) {
          timeLen = task.duration - timeLen;
        }
        frame = task.frames[(task.lastFrame = Math.round(timeLen / MSPF))];
        if (
          task.frameCallback(
            frame.value,
            false,
            frame.timeRatio,
            frame.outputRatio,
            /* [DEBUG] */ timeLen /* [/DEBUG] */
          ) !== false
        ) {
          next = true;
        } else {
          task.framesStart = null;
        }
      });

      if (next) {
        requestID = requestAnim.call(window, step);
      }
    }

    // [DEBUG]
    window.anim_lastPlaying = false;
    window.anim_watchStart = () => {
      window.anim_watchTimer = setInterval(() => {
        if (playing !== window.anim_lastPlaying) {
          document.body.style.backgroundColor = playing ? '#f7f6cb' : '';
          window.anim_lastPlaying = playing;
        }
        playing = false;
      }, 200);
    };
    window.anim_watchStop = () => {
      clearInterval(window.anim_watchTimer);
    };
    // [/DEBUG]

    function startTask(task, timeRatio) {
      task.framesStart = Date.now();
      if (timeRatio != null) {
        task.framesStart -= task.duration * (task.reverse ? 1 - timeRatio : timeRatio);
      }
      task.loopsLeft = task.count;
      task.lastFrame = null;
      step();
    }

    return {
      /**
       * Callback that makes value that is required by each frame.
       * @callback valueCallback
       * @param {number} outputRatio - Progress [0, 1].
       * @returns {}
       */

      /**
       * @param {(valueCallback|null)} valueCallback - valueCallback
       * @param {frameCallback} frameCallback - task property
       * @param {number} duration - task property
       * @param {number} count - task property
       * @param {(string|number[])} timing - FUNC_KEYS or [x1, y1, x2, y2]
       * @param {(boolean|null)} reverse - playing property
       * @param {number|boolean} [timeRatio] - Play from the midst. [0, 1], or `false` that prevents it starting.
       * @returns {number} animId to control the task.
       */
      add(valueCallback, frameCallback, duration, count, timing, reverse, timeRatio) {
        const animId = ++newAnimId;
        let task;
        let frames;
        let stepX;
        let stepT;
        let nextX;
        let t;
        let point;

        function getPoint(t) {
          const t2 = t * t,
            t3 = t2 * t,
            t1 = 1 - t,
            t12 = t1 * t1,
            p1f = 3 * t12 * t,
            p2f = 3 * t1 * t2;
          return {
            x: p1f * timing[0] + p2f * timing[2] + t3,
            y: p1f * timing[1] + p2f * timing[3] + t3
          };
        }

        function newFrame(timeRatio, outputRatio) {
          return { value: valueCallback(outputRatio), timeRatio, outputRatio };
        }

        if (typeof timing === 'string') {
          timing = FUNC_KEYS[timing];
        }
        valueCallback = valueCallback || (() => {});

        // Generate `frames` list
        if (duration < MSPF) {
          frames = [newFrame(0, 0), newFrame(1, 1)];
        } else {
          stepX = MSPF / duration;
          frames = [newFrame(0, 0)];

          if (timing[0] === 0 && timing[1] === 0 && timing[2] === 1 && timing[3] === 1) {
            // linear
            for (nextX = stepX; nextX <= 1; nextX += stepX) {
              frames.push(newFrame(nextX, nextX)); // x === y
            }
          } else {
            stepT = stepX / 10; // precision for `t`
            nextX = stepX;
            for (t = stepT; t <= 1; t += stepT) {
              point = getPoint(t);
              if (point.x >= nextX) {
                frames.push(newFrame(point.x, point.y));
                nextX += stepX;
              }
            }
          }

          frames.push(newFrame(1, 1)); // for tolerance
        }

        task = {
          animId,
          frameCallback,
          duration,
          count, // task properties
          frames,
          reverse: !!reverse
        };
        tasks.push(task);
        if (timeRatio !== false) {
          startTask(task, timeRatio);
        }

        return animId;
      },

      remove(animId) {
        let iRemove;
        if (
          tasks.some((task, i) => {
            if (task.animId === animId) {
              iRemove = i;
              task.framesStart = null; // for `tasks.forEach` that is playing now.
              return true;
            }
            return false;
          })
        ) {
          tasks.splice(iRemove, 1);
        }
      },

      /**
       * @param {number} animId - Target task.
       * @param {boolean} reverse - Play backwards.
       * @param {number} [timeRatio] - Play from the midst. [0, 1]
       * @returns {void}
       */
      start(animId, reverse, timeRatio) {
        tasks.some((task) => {
          if (task.animId === animId) {
            task.reverse = !!reverse;
            startTask(task, timeRatio);
            return true;
          }
          return false;
        });
      },

      /**
       * @param {number} animId - Target task.
       * @param {boolean} [getTimeRatioByFrame] - Return timeRatio of last frame that ran. [0, 1]
       * @returns {(number|undefined)} timeRatio [0, 1]
       */
      stop(animId, getTimeRatioByFrame) {
        let timeRatio;
        tasks.some((task) => {
          if (task.animId === animId) {
            if (!getTimeRatioByFrame) {
              timeRatio = (Date.now() - task.framesStart) / task.duration;
              if (task.reverse) {
                timeRatio = 1 - timeRatio;
              }
              if (timeRatio < 0) {
                timeRatio = 0;
              } else if (timeRatio > 1) {
                timeRatio = 1;
              }
            } else if (task.lastFrame != null) {
              timeRatio = task.frames[task.lastFrame].timeRatio;
            }
            task.framesStart = null;
            return true;
          }
          return false;
        });
        return timeRatio;
      },

      validTiming(timing) {
        return typeof timing === 'string'
          ? FUNC_KEYS[timing]
          : Array.isArray(timing) && [0, 1, 2, 3].every((i) => isFinite(timing[i]) && timing[i] >= 0 && timing[i] <= 1)
            ? [timing[0], timing[1], timing[2], timing[3]]
            : null;
      }
    };
  })();
// @/EXPORT@
