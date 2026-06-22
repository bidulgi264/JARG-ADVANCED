window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 12,
  name: "Signal",
  content: `
    <div class="scope-puzzle">
      <div class="scope-unit scope-broken" aria-label="broken oscilloscope">
        <div class="scope-bezel">
          <div class="scope-screen">
            <canvas class="scope-trace" aria-hidden="true"></canvas>
          </div>
          <div class="scope-label">
            <div class="scope-status">
              <span class="scope-status-text">NO SYNC · ERR</span>
              <span class="scope-power-led" aria-hidden="true"></span>
            </div>
            <span class="scope-channel">CH1 · 1.0V/div</span>
          </div>
        </div>
      </div>
    </div>
  `,
  onRender({ centerpiece }) {
    const MORSE = {
      a: ".-",
      b: "-...",
      c: "-.-.",
      d: "-..",
      e: ".",
      f: "..-.",
      g: "--.",
      h: "....",
      i: "..",
      j: ".---",
      k: "-.-",
      l: ".-..",
      m: "--",
      n: "-.",
      o: "---",
      p: ".--.",
      q: "--.-",
      r: ".-.",
      s: "...",
      t: "-",
      u: "..-",
      v: "...-",
      w: ".--",
      x: "-..-",
      y: "-.--",
      z: "--..",
    };

    const word = "break";
    const unit = 240;
    const symbolGap = unit;
    const letterGap = unit * 3;
    const wordPause = 5000;

    const canvas = centerpiece.querySelector(".scope-trace");
    const powerLed = centerpiece.querySelector(".scope-power-led");
    let morseTimerId = null;
    let frameId = null;
    let resizeObserver = null;
    let samples = [];
    let sampleCount = 0;

    function setupScope() {
      if (!canvas) {
        return () => {};
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return () => {};
      }

      function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        context.setTransform(scale, 0, 0, scale, 0, 0);
        sampleCount = Math.max(120, Math.floor(rect.width));
        samples = Array.from({ length: sampleCount }, () => Math.random() * 2 - 1);
      }

      function drawScope() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const midY = height * 0.5;
        const amplitude = height * 0.34;

        context.clearRect(0, 0, width, height);
        context.fillStyle = "rgba(120, 255, 120, 0.03)";
        context.fillRect(0, 0, width, height);

        samples.shift();
        samples.push((Math.random() * 2 - 1) * (0.35 + Math.random() * 0.65));

        context.beginPath();
        context.strokeStyle = "rgba(120, 255, 120, 0.88)";
        context.lineWidth = 1.6;
        context.shadowColor = "rgba(120, 255, 120, 0.55)";
        context.shadowBlur = 8;

        samples.forEach((value, index) => {
          const x = (index / (sampleCount - 1)) * width;
          const y = midY + value * amplitude;

          if (index === 0) {
            context.moveTo(x, y);
            return;
          }

          context.lineTo(x, y);
        });

        context.stroke();
        context.shadowBlur = 0;

        if (Math.random() < 0.08) {
          const glitchY = Math.random() * height;
          context.strokeStyle = "rgba(120, 255, 120, 0.22)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(0, glitchY);
          context.lineTo(width, glitchY + (Math.random() * 8 - 4));
          context.stroke();
        }

        if (Math.random() < 0.04) {
          context.fillStyle = "rgba(120, 255, 120, 0.08)";
          context.fillRect(0, Math.random() * height * 0.7, width, Math.random() * 18 + 4);
        }

        frameId = window.requestAnimationFrame(drawScope);
      }

      resizeCanvas();
      drawScope();

      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(canvas);
      } else {
        window.addEventListener("resize", resizeCanvas);
      }

      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
          frameId = null;
        }

        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        } else {
          window.removeEventListener("resize", resizeCanvas);
        }
      };
    }

    function setupMorse() {
      if (!powerLed) {
        return () => {};
      }

      powerLed.style.transition = "opacity 40ms linear";

      const sequence = [];

      word
        .toLowerCase()
        .split("")
        .forEach((letter, letterIndex, letters) => {
          const code = MORSE[letter];
          if (!code) {
            return;
          }

          code.split("").forEach((symbol, symbolIndex) => {
            sequence.push({ on: true, duration: symbol === "-" ? unit * 3 : unit });

            if (symbolIndex < code.length - 1) {
              sequence.push({ on: false, duration: symbolGap });
            }
          });

          if (letterIndex < letters.length - 1) {
            sequence.push({ on: false, duration: letterGap });
          }
        });

      sequence.push({ on: false, duration: wordPause });

      let stepIndex = 0;

      function playStep() {
        const step = sequence[stepIndex];
        powerLed.style.opacity = step.on ? "1" : "0.14";
        stepIndex = (stepIndex + 1) % sequence.length;
        morseTimerId = window.setTimeout(playStep, step.duration);
      }

      playStep();

      return () => {
        if (morseTimerId !== null) {
          window.clearTimeout(morseTimerId);
          morseTimerId = null;
        }

        powerLed.style.transition = "";
        powerLed.style.opacity = "";
      };
    }

    const cleanupScope = setupScope();
    const cleanupMorse = setupMorse();

    return () => {
      cleanupScope();
      cleanupMorse();
    };
  },
});
