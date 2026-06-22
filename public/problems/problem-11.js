window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 11,
  name: "Blackout",
  content: `
    <div class="blackout-puzzle">
      <pre class="blackout-riddle">A man, a plan, a canal, Panama!
Was it a car or a cat I saw?
Madam, I&#39;m Adam.
Mr. Owl ate my metal worm.

X8Y23Z9

X*Y*Z?</pre>
      <div class="blackout-mask"></div>
      <div class="blackout-glow"></div>
      <div class="flashlight" hidden role="button" tabindex="0" aria-label="flashlight">
        <svg viewBox="0 0 100 100" fill="none">
          <g transform="rotate(45 50 50)" stroke="#111" stroke-width="3" stroke-linejoin="round">
            <rect x="44" y="42" width="42" height="16" rx="3" fill="#d9d9d9"/>
            <path d="M44 36 L44 64 L26 70 L26 30 Z" fill="#bdbdbd"/>
            <rect x="18" y="33" width="9" height="34" rx="2" fill="#fff"/>
            <rect x="86" y="45" width="6" height="10" rx="2" fill="#9a9a9a"/>
            <rect x="58" y="36" width="10" height="6" rx="2" fill="#7a7a7a" stroke-width="2"/>
          </g>
        </svg>
      </div>
    </div>
  `,
  onRender({ centerpiece, input }) {
    input.placeholder = "flash";

    const puzzle = centerpiece.querySelector(".blackout-puzzle");
    const flashlight = centerpiece.querySelector(".flashlight");
    this.flashlight = flashlight;

    const BEAM_OFFSET = 70;
    let holding = false;
    let mx = window.innerWidth - 90;
    let my = window.innerHeight - 90;

    function setLight(beamX, beamY) {
      puzzle.style.setProperty("--x", `${beamX}px`);
      puzzle.style.setProperty("--y", `${beamY}px`);
    }

    function placeFlashlight(x, y, held) {
      const half = held ? 75 : 50;
      flashlight.style.left = `${x - half}px`;
      flashlight.style.top = `${y - half}px`;
    }

    function update() {
      placeFlashlight(mx, my, holding);
      if (holding) {
        setLight(mx - BEAM_OFFSET, my - BEAM_OFFSET);
      }
    }

    function toCorner() {
      placeFlashlight(window.innerWidth - 90, window.innerHeight - 90, false);
    }

    function setHold(next) {
      holding = next;
      puzzle.classList.toggle("is-lit", holding);
      flashlight.classList.toggle("is-held", holding);

      if (holding) {
        update();
      } else {
        toCorner();
      }
    }

    function onPick(event) {
      event.stopPropagation();
      setHold(!holding);
    }

    function onMove(event) {
      mx = event.clientX;
      my = event.clientY;
      if (holding) {
        update();
      }
    }

    function onKey(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setHold(!holding);
      }
    }

    flashlight.addEventListener("click", onPick);
    flashlight.addEventListener("keydown", onKey);
    document.addEventListener("mousemove", onMove);
    toCorner();

    return () => {
      input.placeholder = "answer";
      flashlight.removeEventListener("click", onPick);
      flashlight.removeEventListener("keydown", onKey);
      document.removeEventListener("mousemove", onMove);
      this.flashlight = null;
    };
  },
  onSubmit({ value, input }) {
    if (value.trim().toLowerCase() !== "flash") {
      return false;
    }

    input.placeholder = "answer";
    if (this.flashlight) {
      this.flashlight.hidden = false;
    }

    return true;
  },
});
