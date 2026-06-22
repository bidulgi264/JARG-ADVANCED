window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 6,
  name: "All-seeing Eye",
  content: `
    <div class="panopticon-puzzle" style="--watch-level: 1; --cursor-x: 50vw; --cursor-y: 50vh;">
      <div class="eye-ring" aria-hidden="true">
        ${Array.from({ length: 14 }, (_, index) => `
          <div class="watching-eye" style="--eye-index: ${index};">
            <span class="eye-white"><span class="eye-pupil"></span></span>
          </div>
        `).join("")}
      </div>

      <button class="prison-button" type="button" aria-label="central prison">
        <span class="prison-roof"></span>
        <span class="prison-bars">
          <i></i><i></i><i></i><i></i><i></i>
        </span>
        <span class="prison-base"></span>
      </button>

      <p class="panopticon-answer" hidden>panopticon</p>

      <div class="celestial-orbit" aria-hidden="true">
        <span class="orbit-body orbit-sun">&#9728;</span>
        <span class="orbit-body orbit-moon">&#9790;</span>
      </div>
      <div class="cursor-crusher" aria-hidden="true">
        <img class="crusher-hand crusher-ready" src="assets/hand_ready.png" alt="">
        <img class="crusher-hand crusher-grab" src="assets/hand_grap.png" alt="">
      </div>
      <div class="blood-stains" aria-hidden="true"></div>
      <div class="punished-cursor" aria-hidden="true"></div>
    </div>
  `,
  onRender({ centerpiece, showNext }) {
    const puzzle = centerpiece.querySelector(".panopticon-puzzle");
    const prison = centerpiece.querySelector(".prison-button");
    const answer = centerpiece.querySelector(".panopticon-answer");
    const sun = centerpiece.querySelector(".orbit-sun");
    const moon = centerpiece.querySelector(".orbit-moon");
    const orbit = centerpiece.querySelector(".celestial-orbit");
    const cursorCrusher = centerpiece.querySelector(".cursor-crusher");
    const bloodStains = centerpiece.querySelector(".blood-stains");
    const punishedCursor = centerpiece.querySelector(".punished-cursor");
    const eyes = Array.from(centerpiece.querySelectorAll(".watching-eye"));
    const ORBIT_RADIUS = 48;
    const DAY_ANGLE = 270;
    const NIGHT_ANGLE = 90;
    const SAFE_ANGLE = 9;
    const WHEEL_STEP = 6;
    const DAY_LOCK_MS = 200;
    const NIGHT_LOCK_MS = 700;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let cycleAngle = -90;
    let orbitTimer = null;
    let fitGlowTimer = null;
    let punishmentTimer = null;
    let bloodRevealTimer = null;
    let audioContext = null;
    const bloodTimers = new Set();
    let fitLockAngle = DAY_ANGLE;
    let fitUnlockAt = performance.now() + DAY_LOCK_MS;
    let isSolved = false;
    let isSafe = false;
    let isCursorDisplaced = false;
    let isPunishing = false;

    function normalizeAngle(angle) {
      return ((angle % 360) + 360) % 360;
    }

    function angleDistance(first, second) {
      const difference = Math.abs(normalizeAngle(first) - normalizeAngle(second));
      return Math.min(difference, 360 - difference);
    }

    function directionalDistance(from, to, direction) {
      const start = normalizeAngle(from);
      const end = normalizeAngle(to);
      return direction > 0 ? (end - start + 360) % 360 : (start - end + 360) % 360;
    }

    function crossedFitAngle(from, direction) {
      return [DAY_ANGLE, NIGHT_ANGLE].find((angle) => {
        const distance = directionalDistance(from, angle, direction);
        return distance > 0 && distance <= WHEEL_STEP;
      });
    }

    function nearestFitAngle(angle) {
      return [DAY_ANGLE, NIGHT_ANGLE].find((fitAngle) => angleDistance(angle, fitAngle) <= WHEEL_STEP);
    }

    function glowFit(angle) {
      const body = angle === NIGHT_ANGLE ? moon : sun;
      window.clearTimeout(fitGlowTimer);
      sun.classList.remove("is-fit-glow");
      moon.classList.remove("is-fit-glow");
      body.classList.add("is-fit-glow");
      fitGlowTimer = window.setTimeout(() => body.classList.remove("is-fit-glow"), 760);
    }

    function placeBody(element, angle) {
      const radians = (angle * Math.PI) / 180;
      const x = cursorX + Math.cos(radians) * ORBIT_RADIUS;
      const y = cursorY + Math.sin(radians) * ORBIT_RADIUS;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }

    function updateCycle() {
      const radians = (cycleAngle * Math.PI) / 180;
      const watchLevel = Math.max(0, Math.min(1, (1 - Math.sin(radians)) / 2));

      isSafe = angleDistance(cycleAngle, NIGHT_ANGLE) <= SAFE_ANGLE;
      puzzle.style.setProperty("--watch-level", String(watchLevel));
      prison.classList.toggle("is-unwatched", isSafe);
      placeBody(sun, cycleAngle);
      placeBody(moon, cycleAngle + 180);
    }

    function trackEyes() {
      eyes.forEach((eye) => {
        const pupil = eye.querySelector(".eye-pupil");
        const rect = eye.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = cursorX - centerX;
        const deltaY = cursorY - centerY;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const travel = Math.min(8, distance * 0.05);

        pupil.style.setProperty("--pupil-x", `${(deltaX / distance) * travel}px`);
        pupil.style.setProperty("--pupil-y", `${(deltaY / distance) * travel}px`);
      });
    }

    function handlePointerMove(event) {
      if (isPunishing) {
        return;
      }

      if (isCursorDisplaced) {
        isCursorDisplaced = false;
        puzzle.classList.remove("is-displaced");
        punishedCursor.classList.remove("is-flying");
      }

      cursorX = event.clientX;
      cursorY = event.clientY;
      puzzle.style.setProperty("--cursor-x", `${cursorX}px`);
      puzzle.style.setProperty("--cursor-y", `${cursorY}px`);
      updateCycle();
      trackEyes();
    }

    function handleWheel(event) {
      event.preventDefault();
      if (isPunishing) {
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      const now = performance.now();
      orbit.classList.add("is-visible");
      window.clearTimeout(orbitTimer);
      orbitTimer = window.setTimeout(() => orbit.classList.remove("is-visible"), 650);

      if (fitLockAngle !== null) {
        cycleAngle = fitLockAngle;
        glowFit(fitLockAngle);

        if (now < fitUnlockAt) {
          updateCycle();
          return;
        }

        cycleAngle = fitLockAngle + direction * WHEEL_STEP;
        fitLockAngle = null;
        updateCycle();
        return;
      }

      const fitAngle = crossedFitAngle(cycleAngle, direction) || nearestFitAngle(cycleAngle + direction * WHEEL_STEP);
      if (fitAngle !== undefined) {
        cycleAngle = fitAngle;
        fitLockAngle = fitAngle;
        fitUnlockAt = now + (fitAngle === NIGHT_ANGLE ? NIGHT_LOCK_MS : DAY_LOCK_MS);
        glowFit(fitAngle);
        updateCycle();
        return;
      }

      cycleAngle += direction * WHEEL_STEP;
      updateCycle();
    }

    function endPunishment() {
      isPunishing = false;
      puzzle.classList.remove("is-punishing", "is-grabbing");
      puzzle.classList.add("is-displaced");
      cursorCrusher.classList.remove("is-active");
      isCursorDisplaced = true;
    }

    function createBloodStain(x, y) {
      const stain = document.createElement("img");
      stain.className = "cursor-blood";
      stain.src = "assets/blood.png";
      stain.alt = "";
      stain.style.left = `${x}px`;
      stain.style.top = `${y}px`;
      bloodStains.append(stain);

      const timer = window.setTimeout(() => {
        stain.remove();
        bloodTimers.delete(timer);
      }, 15000);
      bloodTimers.add(timer);
    }

    function prepareSqueezeSound() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      audioContext = audioContext || new AudioContextClass();
      audioContext.resume();
    }

    function playSqueezeSound() {
      if (!audioContext || audioContext.state !== "running") {
        return;
      }

      const now = audioContext.currentTime;
      const duration = 0.34;
      const sampleCount = Math.floor(audioContext.sampleRate * duration);
      const noiseBuffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);

      for (let index = 0; index < sampleCount; index += 1) {
        const progress = index / sampleCount;
        noiseData[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.4);
      }

      const noise = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const noiseGain = audioContext.createGain();
      noise.buffer = noiseBuffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + duration);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.46, now + 0.025);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      noise.connect(filter).connect(noiseGain).connect(audioContext.destination);

      const thump = audioContext.createOscillator();
      const thumpGain = audioContext.createGain();
      thump.type = "triangle";
      thump.frequency.setValueAtTime(170, now);
      thump.frequency.exponentialRampToValueAtTime(48, now + 0.22);
      thumpGain.gain.setValueAtTime(0.38, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      thump.connect(thumpGain).connect(audioContext.destination);

      noise.start(now);
      noise.stop(now + duration);
      thump.start(now);
      thump.stop(now + 0.3);
    }

    function handlePrisonClick() {
      if (isSolved || isPunishing) {
        return;
      }

      if (isSafe) {
        isSolved = true;
        prison.hidden = true;
        answer.hidden = false;
        showNext();
        return;
      }

      window.clearTimeout(punishmentTimer);
      window.clearTimeout(bloodRevealTimer);
      prepareSqueezeSound();
      isPunishing = true;
      puzzle.classList.remove("is-displaced", "is-grabbing");
      isCursorDisplaced = false;
      punishedCursor.style.left = `${cursorX}px`;
      punishedCursor.style.top = `${cursorY}px`;
      punishedCursor.style.setProperty("--cursor-shift", `${10 - cursorX}px`);
      cursorCrusher.style.left = `${cursorX}px`;
      cursorCrusher.style.top = `${cursorY}px`;
      const bloodX = cursorX;
      const bloodY = cursorY;
      cursorCrusher.classList.remove("is-active");
      punishedCursor.classList.remove("is-flying");
      void cursorCrusher.offsetWidth;
      void punishedCursor.offsetWidth;
      puzzle.classList.add("is-punishing");
      cursorCrusher.classList.add("is-active");
      punishedCursor.classList.add("is-flying");
      bloodRevealTimer = window.setTimeout(() => {
        puzzle.classList.add("is-grabbing");
        createBloodStain(bloodX, bloodY);
        playSqueezeSound();
      }, 300);
      punishmentTimer = window.setTimeout(endPunishment, 1250);
    }

    function blockInteraction(event) {
      if (!isPunishing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerdown", blockInteraction, true);
    window.addEventListener("click", blockInteraction, true);
    window.addEventListener("keydown", blockInteraction, true);
    prison.addEventListener("click", handlePrisonClick);
    updateCycle();
    trackEyes();

    return () => {
      window.clearTimeout(orbitTimer);
      window.clearTimeout(fitGlowTimer);
      window.clearTimeout(punishmentTimer);
      window.clearTimeout(bloodRevealTimer);
      bloodTimers.forEach((timer) => window.clearTimeout(timer));
      bloodTimers.clear();
      bloodStains.replaceChildren();
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      puzzle.classList.remove("is-punishing", "is-displaced", "is-grabbing");
      sun.classList.remove("is-fit-glow");
      moon.classList.remove("is-fit-glow");
      cursorCrusher.classList.remove("is-active");
      punishedCursor.classList.remove("is-flying");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerdown", blockInteraction, true);
      window.removeEventListener("click", blockInteraction, true);
      window.removeEventListener("keydown", blockInteraction, true);
      prison.removeEventListener("click", handlePrisonClick);
    };
  },
});
