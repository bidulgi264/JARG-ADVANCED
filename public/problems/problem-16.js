window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
let problem16Cleared = false;

window.ARG_PROBLEMS.push({
  id: 16,
  name: "Protect",
  content: `
    <div class="protect-puzzle">
      <div class="protect-arena" aria-label="survive for fifteen seconds">
        <canvas class="protect-canvas" aria-hidden="true"></canvas>

        <div class="protect-hud" aria-live="polite">
          <span class="protect-timer">15.0</span>
          <span class="protect-progress" aria-hidden="true"><i></i></span>
        </div>

        <button class="protect-plane" type="button" aria-label="aircraft">
          <span class="protect-shield" aria-hidden="true"></span>
          <svg viewBox="0 0 64 72" aria-hidden="true">
            <path class="protect-plane-body" d="M32 3c4 0 7 7 8 18l2 13 17 12v8l-17-5-3 13 7 5v4l-14-3-14 3v-4l7-5-3-13-17 5v-8l17-12 2-13C25 10 28 3 32 3Z"></path>
            <path class="protect-plane-glass" d="M32 12c2 0 4 5 4 10h-8c0-5 2-10 4-10Z"></path>
          </svg>
        </button>

        <div class="protect-result" hidden></div>
      </div>
    </div>
  `,
  onRender({ centerpiece, showNext, hideNext }) {
    problem16Cleared = false;
    const arena = centerpiece.querySelector(".protect-arena");
    const canvas = centerpiece.querySelector(".protect-canvas");
    const plane = centerpiece.querySelector(".protect-plane");
    const timer = centerpiece.querySelector(".protect-timer");
    const progress = centerpiece.querySelector(".protect-progress i");
    const result = centerpiece.querySelector(".protect-result");
    const problemName = document.getElementById("problemName");

    if (!arena || !canvas || !plane || !timer || !progress || !result || !problemName) {
      return () => {};
    }

    const context = canvas.getContext("2d");
    const duration = 15000;
    const state = {
      width: 0,
      height: 0,
      planeX: 0,
      planeY: 0,
      planeDragging: false,
      tokenDragging: false,
      protected: false,
      tokenOffsetX: 0,
      tokenOffsetY: 0,
      started: false,
      dead: false,
      completed: false,
      remaining: duration,
      startDelay: 2200,
      spawnClock: 0,
      bullets: [],
      sparks: [],
      animationId: 0,
      resetTimer: 0,
      lastFrame: performance.now(),
    };

    function setPlanePosition() {
      const halfWidth = plane.offsetWidth / 2 || 24;
      const halfHeight = plane.offsetHeight / 2 || 27;
      state.planeX = Math.min(state.width - halfWidth, Math.max(halfWidth, state.planeX));
      state.planeY = Math.min(state.height - halfHeight, Math.max(halfHeight, state.planeY));
      plane.style.transform = `translate3d(${state.planeX - halfWidth}px, ${state.planeY - halfHeight}px, 0)`;
    }

    function resizeCanvas() {
      const rect = arena.getBoundingClientRect();
      const previousWidth = state.width || rect.width;
      const previousHeight = state.height || rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      state.width = rect.width;
      state.height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (state.planeX === 0 && state.planeY === 0) {
        state.planeX = state.width / 2;
        state.planeY = state.height * 0.76;
      } else {
        state.planeX *= state.width / previousWidth;
        state.planeY *= state.height / previousHeight;
      }

      setPlanePosition();
    }

    function updateHud() {
      timer.textContent = (state.remaining / 1000).toFixed(1);
      progress.style.transform = `scaleX(${Math.max(0, state.remaining / duration)})`;
    }

    function resetProtectToken() {
      state.tokenDragging = false;
      problemName.classList.remove("is-dragging", "is-protect-used");
      problemName.style.removeProperty("top");
      problemName.style.removeProperty("right");
      problemName.style.removeProperty("bottom");
      problemName.style.removeProperty("left");
    }

    function resetGame() {
      window.clearTimeout(state.resetTimer);
      hideNext();
      state.planeDragging = false;
      state.protected = false;
      state.started = false;
      state.dead = false;
      state.completed = false;
      state.remaining = duration;
      state.startDelay = 2200;
      state.spawnClock = 0;
      state.bullets = [];
      state.sparks = [];
      state.planeX = state.width / 2;
      state.planeY = state.height * 0.76;
      plane.classList.remove("is-protected", "is-hit", "is-complete");
      arena.classList.remove("is-breached");
      arena.dataset.state = "ready";
      resetProtectToken();
      result.hidden = true;
      result.textContent = "";
      setPlanePosition();
      updateHud();
    }

    function spawnBullet(elapsed) {
      const edge = Math.floor(Math.random() * 3);
      const margin = 16;
      let x;
      let y;

      if (edge === 0) {
        x = Math.random() * state.width;
        y = -margin;
      } else if (edge === 1) {
        x = -margin;
        y = Math.random() * state.height * 0.78;
      } else {
        x = state.width + margin;
        y = Math.random() * state.height * 0.78;
      }

      const spread = Math.max(96, Math.min(state.width, state.height) * 0.32 - elapsed * 6);
      const targetX = state.planeX + (Math.random() - 0.5) * spread;
      const targetY = state.planeY + (Math.random() - 0.5) * spread;
      const angle = Math.atan2(targetY - y, targetX - x);
      const distance = Math.hypot(targetX - x, targetY - y);
      const speed = Math.max(220, distance / 2.2) + elapsed * 18 + Math.random() * 46;
      const palette = ["#ff445d", "#f2d84b", "#f5f5f5"];

      state.bullets.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3.4 + Math.random() * 2.2,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }

    function addSpark(x, y, color) {
      for (let index = 0; index < 4; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 65;
        state.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.25,
          color,
        });
      }
    }

    function failGame() {
      if (state.dead || state.completed) {
        return;
      }

      state.dead = true;
      state.planeDragging = false;
      plane.classList.remove("is-protected");
      plane.classList.add("is-hit");
      arena.classList.add("is-breached");
      arena.dataset.state = "breach";
      result.textContent = "BREACH";
      result.hidden = false;
      state.resetTimer = window.setTimeout(resetGame, 1200);
    }

    function completeGame() {
      state.completed = true;
      problem16Cleared = true;
      state.planeDragging = false;
      state.remaining = 0;
      state.bullets = [];
      plane.classList.remove("is-protected");
      plane.classList.add("is-complete");
      arena.dataset.state = "complete";
      result.textContent = "PROTECTED";
      result.hidden = false;
      updateHud();
      showNext();
    }

    function updateBullets(delta) {
      const shieldRadius = Math.max(38, plane.offsetWidth * 0.8);
      const planeHalfWidth = plane.offsetWidth * 0.48;
      const planeHalfHeight = plane.offsetHeight * 0.48;

      state.bullets = state.bullets.filter((bullet) => {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;

        const distance = Math.hypot(bullet.x - state.planeX, bullet.y - state.planeY);
        if (state.protected && distance < shieldRadius + bullet.radius) {
          addSpark(bullet.x, bullet.y, bullet.color);
          return false;
        }

        if (
          !state.protected &&
          Math.abs(bullet.x - state.planeX) < planeHalfWidth + bullet.radius &&
          Math.abs(bullet.y - state.planeY) < planeHalfHeight + bullet.radius
        ) {
          failGame();
          return false;
        }

        return (
          bullet.x > -40 &&
          bullet.x < state.width + 40 &&
          bullet.y > -40 &&
          bullet.y < state.height + 40
        );
      });
    }

    function updateSparks(delta) {
      state.sparks = state.sparks.filter((spark) => {
        spark.x += spark.vx * delta;
        spark.y += spark.vy * delta;
        spark.life -= delta;
        return spark.life > 0;
      });
    }

    function draw() {
      context.clearRect(0, 0, state.width, state.height);

      state.bullets.forEach((bullet) => {
        context.beginPath();
        context.fillStyle = bullet.color;
        context.shadowBlur = 13;
        context.shadowColor = bullet.color;
        context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        context.fill();
      });

      context.shadowBlur = 0;
      state.sparks.forEach((spark) => {
        context.globalAlpha = Math.min(1, spark.life * 4);
        context.fillStyle = spark.color;
        context.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
      });
      context.globalAlpha = 1;
    }

    function frame(now) {
      const deltaMs = Math.min(50, now - state.lastFrame);
      const delta = deltaMs / 1000;
      state.lastFrame = now;

      if (!state.dead && !state.completed) {
        if (!state.started) {
          state.startDelay -= deltaMs;
          if (state.startDelay <= 0) {
            state.started = true;
            arena.dataset.state = state.protected ? "protected" : "active";
          }
        } else {
          state.remaining = Math.max(0, state.remaining - deltaMs);
          const elapsed = (duration - state.remaining) / 1000;
          const spawnInterval = Math.max(55, 360 - elapsed * 29);
          state.spawnClock += deltaMs;

          while (state.spawnClock >= spawnInterval) {
            state.spawnClock -= spawnInterval;
            const burst = 1 + Math.floor(elapsed / 3.2);
            for (let index = 0; index < burst; index += 1) {
              spawnBullet(elapsed);
            }
          }

          updateBullets(delta);
          updateSparks(delta);
          updateHud();

          if (state.remaining <= 0 && !state.dead) {
            completeGame();
          }
        }
      } else {
        updateSparks(delta);
      }

      draw();
      state.animationId = window.requestAnimationFrame(frame);
    }

    function movePlane(event) {
      const rect = arena.getBoundingClientRect();
      state.planeX = event.clientX - rect.left;
      state.planeY = event.clientY - rect.top;
      setPlanePosition();
    }

    function onPointerDown(event) {
      if (event.button !== 0 || state.dead || state.completed) {
        return;
      }

      state.planeDragging = true;
      plane.setPointerCapture(event.pointerId);
      movePlane(event);
      event.preventDefault();
    }

    function releasePlane(event) {
      if (!state.planeDragging) {
        return;
      }

      state.planeDragging = false;
      if (plane.hasPointerCapture(event.pointerId)) {
        plane.releasePointerCapture(event.pointerId);
      }
    }

    function onPointerMove(event) {
      if (state.planeDragging) {
        movePlane(event);
      }
    }

    function protectTokenTouchesPlane() {
      const tokenRect = problemName.getBoundingClientRect();
      const planeRect = plane.getBoundingClientRect();

      return !(
        tokenRect.right < planeRect.left ||
        tokenRect.left > planeRect.right ||
        tokenRect.bottom < planeRect.top ||
        tokenRect.top > planeRect.bottom
      );
    }

    function activateProtection(event) {
      state.protected = true;
      state.tokenDragging = false;
      plane.classList.add("is-protected");
      arena.dataset.state = "protected";
      problemName.classList.remove("is-dragging");
      problemName.classList.add("is-protect-used");

      if (problemName.hasPointerCapture(event.pointerId)) {
        problemName.releasePointerCapture(event.pointerId);
      }
    }

    function moveProtectToken(event) {
      const tokenRect = problemName.getBoundingClientRect();
      const left = Math.min(
        window.innerWidth - tokenRect.width - 6,
        Math.max(6, event.clientX - state.tokenOffsetX),
      );
      const top = Math.min(
        window.innerHeight - tokenRect.height - 6,
        Math.max(6, event.clientY - state.tokenOffsetY),
      );

      problemName.style.left = `${left}px`;
      problemName.style.top = `${top}px`;

      if (protectTokenTouchesPlane()) {
        activateProtection(event);
      }
    }

    function onProtectPointerDown(event) {
      if (event.button !== 0 || state.dead || state.completed || state.protected) {
        return;
      }

      const rect = problemName.getBoundingClientRect();
      state.tokenDragging = true;
      state.tokenOffsetX = event.clientX - rect.left;
      state.tokenOffsetY = event.clientY - rect.top;
      problemName.style.left = `${rect.left}px`;
      problemName.style.top = `${rect.top}px`;
      problemName.style.right = "auto";
      problemName.style.bottom = "auto";
      problemName.classList.add("is-dragging");
      problemName.setPointerCapture(event.pointerId);
      moveProtectToken(event);
      event.preventDefault();
    }

    function onProtectPointerMove(event) {
      if (state.tokenDragging) {
        moveProtectToken(event);
      }
    }

    function releaseProtectToken(event) {
      if (!state.tokenDragging) {
        return;
      }

      moveProtectToken(event);
      if (state.protected) {
        return;
      }

      state.tokenDragging = false;
      problemName.classList.remove("is-dragging");
      if (problemName.hasPointerCapture(event.pointerId)) {
        problemName.releasePointerCapture(event.pointerId);
      }
      resetProtectToken();
    }

    resizeCanvas();
    problemName.classList.add("is-protect-token");
    resetGame();
    state.lastFrame = performance.now();
    state.animationId = window.requestAnimationFrame(frame);

    plane.addEventListener("pointerdown", onPointerDown);
    plane.addEventListener("pointermove", onPointerMove);
    plane.addEventListener("pointerup", releasePlane);
    plane.addEventListener("pointercancel", releasePlane);
    problemName.addEventListener("pointerdown", onProtectPointerDown);
    problemName.addEventListener("pointermove", onProtectPointerMove);
    problemName.addEventListener("pointerup", releaseProtectToken);
    problemName.addEventListener("pointercancel", releaseProtectToken);
    window.addEventListener("pointermove", onProtectPointerMove);
    window.addEventListener("pointerup", releaseProtectToken);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.cancelAnimationFrame(state.animationId);
      window.clearTimeout(state.resetTimer);
      hideNext();
      plane.removeEventListener("pointerdown", onPointerDown);
      plane.removeEventListener("pointermove", onPointerMove);
      plane.removeEventListener("pointerup", releasePlane);
      plane.removeEventListener("pointercancel", releasePlane);
      problemName.removeEventListener("pointerdown", onProtectPointerDown);
      problemName.removeEventListener("pointermove", onProtectPointerMove);
      problemName.removeEventListener("pointerup", releaseProtectToken);
      problemName.removeEventListener("pointercancel", releaseProtectToken);
      window.removeEventListener("pointermove", onProtectPointerMove);
      window.removeEventListener("pointerup", releaseProtectToken);
      problemName.classList.remove("is-protect-token", "is-dragging", "is-protect-used");
      resetProtectToken();
      window.removeEventListener("resize", resizeCanvas);
    };
  },
  onSubmit({ value, input }) {
    if (value.trim().toLowerCase() !== "next" || problem16Cleared) {
      return false;
    }

    input.classList.remove("is-wrong");
    window.requestAnimationFrame(() => input.classList.add("is-wrong"));
    return true;
  },
});
