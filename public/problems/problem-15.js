window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
let problem15Cleared = false;

window.ARG_PROBLEMS.push({
  id: 15,
  name: "Strike",
  content: `
    <div class="bowling-puzzle">
      <div class="bowling-lane" aria-label="bowling lane">
        <svg class="bowling-arrow" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <marker id="bowlingArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z"></path>
            </marker>
          </defs>
          <line class="bowling-arrow-line" x1="50" y1="50" x2="50" y2="50"></line>
        </svg>
        <div class="bowling-pin-field"></div>
        <div class="bowling-ball" role="button" aria-label="bowling ball" tabindex="0"></div>
        <div class="bowling-size-menu" hidden>
          <button type="button" data-scale="1.1">+10%</button>
          <button type="button" data-scale="0.9">-10%</button>
        </div>
        <div class="bowling-pin-menu" hidden>
          <button type="button" data-pin-state="stand">stand</button>
          <button type="button" data-pin-state="fall">fall</button>
        </div>
      </div>
    </div>
  `,
  onRender({ centerpiece, showNext, hideNext }) {
    problem15Cleared = false;
    const lane = centerpiece.querySelector(".bowling-lane");
    const field = centerpiece.querySelector(".bowling-pin-field");
    const ball = centerpiece.querySelector(".bowling-ball");
    const arrow = centerpiece.querySelector(".bowling-arrow");
    const arrowLine = centerpiece.querySelector(".bowling-arrow-line");
    const menu = centerpiece.querySelector(".bowling-size-menu");
    const pinMenu = centerpiece.querySelector(".bowling-pin-menu");

    if (!lane || !field || !ball || !arrow || !arrowLine || !menu || !pinMenu) {
      return () => {};
    }

    const pinLayout = [
      [-78, 0],
      [-26, 0],
      [26, 0],
      [78, 0],
      [-52, 34],
      [0, 34],
      [52, 34],
      [-26, 68],
      [26, 68],
      [0, 102],
    ];

    const state = {
      ballX: 0,
      ballY: 0,
      baseRadius: 17,
      scale: 1,
      vx: 0,
      vy: 0,
      dragging: false,
      rolling: false,
      dragStartX: 0,
      dragStartY: 0,
      dragX: 0,
      dragY: 0,
      animationId: 0,
      completed: false,
      pins: [],
      pinMenuTarget: null,
    };

    function getLaneRect() {
      return lane.getBoundingClientRect();
    }

    function radius() {
      return state.baseRadius * state.scale;
    }

    function setBallPosition() {
      const size = radius() * 2;
      ball.style.width = `${size}px`;
      ball.style.height = `${size}px`;
      ball.style.transform = `translate(${state.ballX - radius()}px, ${state.ballY - radius()}px)`;
    }

    function placePins() {
      const rect = getLaneRect();
      const top = Math.max(54, rect.height * 0.12);
      const center = rect.width / 2;

      field.innerHTML = "";
      state.pins = pinLayout.map(([offsetX, offsetY], index) => {
        const pin = document.createElement("div");
        const x = center + offsetX;
        const y = top + offsetY;

        pin.className = "bowling-pin";
        pin.dataset.index = String(index);
        if (index === 0 || index === 3) {
          pin.classList.add("is-adjustable");
        }
        pin.style.left = `${x}px`;
        pin.style.top = `${y}px`;
        field.append(pin);

        return { element: pin, x, y, knocked: false };
      });
    }

    function resetBall() {
      const rect = getLaneRect();
      state.ballX = rect.width / 2;
      state.ballY = rect.height - Math.max(72, rect.height * 0.14);
      state.vx = 0;
      state.vy = 0;
      state.dragging = false;
      state.rolling = false;
      ball.classList.remove("is-rolling");
      arrow.classList.remove("is-visible");
      setBallPosition();
    }

    function resetPuzzle() {
      state.completed = false;
      problem15Cleared = false;
      hideNext();
      hideMenus();
      state.pins.forEach((pin) => {
        standPin(pin);
      });
      resetBall();
    }

    function updateArrow() {
      const rect = getLaneRect();
      const pullX = state.dragX - state.dragStartX;
      const pullY = state.dragY - state.dragStartY;
      const power = Math.min(150, Math.hypot(pullX, pullY));
      const angle = Math.atan2(-pullY, -pullX);
      const endX = state.ballX + Math.cos(angle) * power;
      const endY = state.ballY + Math.sin(angle) * power;

      arrow.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
      arrowLine.setAttribute("x1", String(state.ballX));
      arrowLine.setAttribute("y1", String(state.ballY));
      arrowLine.setAttribute("x2", String(endX));
      arrowLine.setAttribute("y2", String(endY));
      arrow.classList.toggle("is-visible", power > 12);
    }

    function hideMenus() {
      menu.hidden = true;
      pinMenu.hidden = true;
      state.pinMenuTarget = null;
    }

    function showMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      pinMenu.hidden = true;
      state.pinMenuTarget = null;
      const rect = getLaneRect();
      menu.hidden = false;
      menu.style.left = `${Math.min(rect.width - 92, Math.max(8, event.clientX - rect.left))}px`;
      menu.style.top = `${Math.min(rect.height - 78, Math.max(8, event.clientY - rect.top))}px`;
    }

    function standPin(pin) {
      pin.knocked = false;
      pin.element.classList.remove("is-knocked");
      pin.element.style.setProperty("--fall-x", "0px");
      pin.element.style.setProperty("--fall-rotate", "0deg");
    }

    function fallPin(pin, sourceX = state.ballX) {
      pin.knocked = true;
      const fallX = (pin.x - sourceX) * 0.42;
      const rotate = fallX >= 0 ? 82 : -82;
      pin.element.style.setProperty("--fall-x", `${fallX}px`);
      pin.element.style.setProperty("--fall-rotate", `${rotate}deg`);
      pin.element.classList.add("is-knocked");
    }

    function checkCompletion() {
      if (!state.completed && state.pins.every((candidate) => candidate.knocked)) {
        state.completed = true;
        problem15Cleared = true;
        showNext();
      }
    }

    function knockPin(pin) {
      if (pin.knocked) {
        return;
      }

      fallPin(pin);
      checkCompletion();
    }

    function checkCollisions() {
      const hitRadius = radius() + 16;
      state.pins.forEach((pin) => {
        if (pin.knocked) {
          return;
        }

        if (Math.hypot(state.ballX - pin.x, state.ballY - pin.y) <= hitRadius) {
          knockPin(pin);
        }
      });
    }

    function step() {
      if (!state.rolling) {
        return;
      }

      const rect = getLaneRect();
      const r = radius();
      state.ballX += state.vx;
      state.ballY += state.vy;
      state.vx *= 0.988;
      state.vy *= 0.988;

      if (state.ballX < r || state.ballX > rect.width - r) {
        state.ballX = Math.min(rect.width - r, Math.max(r, state.ballX));
        state.vx *= -0.62;
      }

      if (state.ballY < r || state.ballY > rect.height - r) {
        state.ballY = Math.min(rect.height - r, Math.max(r, state.ballY));
        state.vy *= -0.36;
      }

      setBallPosition();
      checkCollisions();

      if (
        Math.hypot(state.vx, state.vy) < 0.18 ||
        state.ballY <= r + 2 ||
        state.ballY >= rect.height - r - 2
      ) {
        state.rolling = false;
        ball.classList.remove("is-rolling");
        window.setTimeout(() => {
          if (state.completed) {
            resetBall();
            return;
          }

          resetPuzzle();
        }, 360);
        return;
      }

      state.animationId = window.requestAnimationFrame(step);
    }

    function launch() {
      const pullX = state.dragX - state.dragStartX;
      const pullY = state.dragY - state.dragStartY;
      const power = Math.min(150, Math.hypot(pullX, pullY));

      state.dragging = false;
      arrow.classList.remove("is-visible");

      if (power < 16) {
        return;
      }

      state.vx = -pullX * 0.105;
      state.vy = -pullY * 0.105;
      state.rolling = true;
      ball.classList.add("is-rolling");
      state.animationId = window.requestAnimationFrame(step);
    }

    function localPoint(event) {
      const rect = getLaneRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function onPointerDown(event) {
      if (event.button !== 0 || state.rolling) {
        return;
      }

      if (state.completed) {
        return;
      }

      hideMenus();
      const point = localPoint(event);
      state.dragging = true;
      state.dragStartX = point.x;
      state.dragStartY = point.y;
      state.dragX = point.x;
      state.dragY = point.y;
      ball.setPointerCapture(event.pointerId);
      updateArrow();
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!state.dragging) {
        return;
      }

      const point = localPoint(event);
      state.dragX = point.x;
      state.dragY = point.y;
      updateArrow();
    }

    function onPointerUp() {
      if (state.dragging) {
        launch();
      }
    }

    function onMenuClick(event) {
      const button = event.target.closest("button[data-scale]");
      if (!button) {
        return;
      }

      state.scale = Math.min(2.585, Math.max(0.55, state.scale * Number(button.dataset.scale)));
      hideMenus();
      setBallPosition();
    }

    function showPinMenu(event) {
      const target = event.target.closest(".bowling-pin.is-adjustable");
      if (!target || state.rolling || state.completed) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      menu.hidden = true;
      const rect = getLaneRect();
      state.pinMenuTarget = state.pins[Number(target.dataset.index)];
      pinMenu.hidden = false;
      pinMenu.style.left = `${Math.min(rect.width - 92, Math.max(8, event.clientX - rect.left))}px`;
      pinMenu.style.top = `${Math.min(rect.height - 78, Math.max(8, event.clientY - rect.top))}px`;
    }

    function onPinMenuClick(event) {
      const button = event.target.closest("button[data-pin-state]");
      if (!button || !state.pinMenuTarget) {
        return;
      }

      if (button.dataset.pinState === "fall") {
        const rect = getLaneRect();
        fallPin(state.pinMenuTarget, rect.width / 2);
        checkCompletion();
      } else {
        standPin(state.pinMenuTarget);
      }

      hideMenus();
    }

    function onWindowPointerDown(event) {
      if (
        (!menu.hidden && !menu.contains(event.target) && event.target !== ball) ||
        (!pinMenu.hidden && !pinMenu.contains(event.target))
      ) {
        hideMenus();
      }
    }

    function onResize() {
      placePins();
      resetBall();
    }

    placePins();
    resetBall();

    ball.addEventListener("pointerdown", onPointerDown);
    ball.addEventListener("pointermove", onPointerMove);
    ball.addEventListener("pointerup", onPointerUp);
    ball.addEventListener("pointercancel", onPointerUp);
    ball.addEventListener("contextmenu", showMenu);
    field.addEventListener("contextmenu", showPinMenu);
    menu.addEventListener("click", onMenuClick);
    pinMenu.addEventListener("click", onPinMenuClick);
    window.addEventListener("pointerdown", onWindowPointerDown);
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(state.animationId);
      hideNext();
      ball.removeEventListener("pointerdown", onPointerDown);
      ball.removeEventListener("pointermove", onPointerMove);
      ball.removeEventListener("pointerup", onPointerUp);
      ball.removeEventListener("pointercancel", onPointerUp);
      ball.removeEventListener("contextmenu", showMenu);
      field.removeEventListener("contextmenu", showPinMenu);
      menu.removeEventListener("click", onMenuClick);
      pinMenu.removeEventListener("click", onPinMenuClick);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("resize", onResize);
    };
  },
  onSubmit({ value, input }) {
    if (value.trim().toLowerCase() !== "click") {
      return false;
    }

    if (problem15Cleared) {
      return false;
    }

    input.classList.remove("is-wrong");
    window.requestAnimationFrame(() => input.classList.add("is-wrong"));
    return true;
  },
});
