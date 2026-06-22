window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 5,
  name: "Lucky strike",
  content: `
    <div class="lottery-puzzle">
      <div class="lottery-row">
        <div class="lottery-ticket">
          <div class="lottery-title">Lucky Lottery</div>
          <div class="scratch-area">
            <div class="scratch-result" aria-live="polite"></div>
            <canvas class="scratch-cover" aria-label="scratch ticket cover"></canvas>
          </div>
        </div>
        <div class="lottery-controls" aria-label="lottery controls">
          <button class="lottery-button lottery-buy" type="button" aria-label="buy ticket" data-tooltip="New Lottery">$</button>
          <div class="lottery-count" aria-label="ticket count">1</div>
          <button class="lottery-button lottery-trash" type="button" aria-label="discard ticket">&#128465;</button>
        </div>
      </div>
      <p class="lottery-odds">
        first prize:
        <span class="lottery-chance" contenteditable="true" inputmode="decimal" spellcheck="false">0.1</span>%
      </p>
    </div>
  `,
  onRender({ centerpiece, showNext, hideNext }) {
    const puzzle = centerpiece.querySelector(".lottery-puzzle");
    const ticket = centerpiece.querySelector(".lottery-ticket");
    const canvas = centerpiece.querySelector(".scratch-cover");
    const result = centerpiece.querySelector(".scratch-result");
    const chanceInput = centerpiece.querySelector(".lottery-chance");
    const buyButton = centerpiece.querySelector(".lottery-buy");
    const trashButton = centerpiece.querySelector(".lottery-trash");
    const countLabel = centerpiece.querySelector(".lottery-count");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const scratchRadius = 18;
    const revealRatio = 0.42;
    const celebrationDuration = 2300;
    let ticketCount = 1;
    let hasStarted = false;
    let isDrawing = false;
    let hasRevealed = false;
    let isWinningTicket = false;
    let isCelebrating = false;
    let celebrationTimer = null;

    function readChance() {
      const rawValue = chanceInput.textContent.replace(",", ".").replace(/[^\d.]/g, "");
      const parsed = Number(rawValue);

      if (!Number.isFinite(parsed)) {
        return 0.1;
      }

      return Math.min(Math.max(parsed, 0), 100);
    }

    function syncTicketCount() {
      countLabel.textContent = String(ticketCount);
      ticket.classList.toggle("is-empty", ticketCount <= 0);
      canvas.hidden = ticketCount <= 0;
      trashButton.disabled = ticketCount <= 1;
    }

    function prepareCanvas() {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      canvas.classList.remove("is-revealed");
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, rect.width, rect.height);
      context.fillStyle = "#a7a7a7";
      context.fillRect(0, 0, rect.width, rect.height);

      context.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (let index = 0; index < 120; index += 1) {
        context.fillRect(Math.random() * rect.width, Math.random() * rect.height, 1, 1);
      }
    }

    function resetCurrentTicket() {
      hasStarted = false;
      isDrawing = false;
      hasRevealed = false;
      isWinningTicket = false;
      isCelebrating = false;
      window.clearTimeout(celebrationTimer);
      puzzle.classList.remove("is-celebrating");
      hideNext();
      result.innerHTML = ticketCount > 0 ? "" : '<div class="lottery-blank">EMPTY</div>';

      if (ticketCount > 0) {
        prepareCanvas();
      }

      syncTicketCount();
    }

    function sanitizeChanceInput() {
      const cleaned = chanceInput.textContent.replace(",", ".").replace(/[^\d.]/g, "");
      if (chanceInput.textContent !== cleaned) {
        chanceInput.textContent = cleaned || "0";
      }
    }

    function decideResult() {
      const probability = readChance() / 100;
      const isWinner = Math.random() < probability;
      isWinningTicket = isWinner;
      result.innerHTML = isWinner
        ? '<div class="lottery-star" aria-hidden="true">&#9733;</div><div class="lottery-prize">One in a million</div>'
        : '<div class="lottery-skull" aria-hidden="true">&#128128;</div>';
    }

    function getPoint(event) {
      const rect = canvas.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function getScratchedRatio() {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let clearPixels = 0;

      for (let index = 3; index < imageData.length; index += 4) {
        if (imageData[index] === 0) {
          clearPixels += 1;
        }
      }

      return clearPixels / (imageData.length / 4);
    }

    function revealIfReady() {
      if (hasRevealed || getScratchedRatio() < revealRatio) {
        return;
      }

      hasRevealed = true;
      canvas.classList.add("is-revealed");
    }

    function revealWinningTicket() {
      if (hasRevealed) {
        return;
      }

      hasRevealed = true;
      canvas.classList.add("is-revealed");
      celebrateWin();
    }

    function celebrateWin() {
      if (isCelebrating) {
        return;
      }

      isCelebrating = true;
      window.clearTimeout(celebrationTimer);
      puzzle.classList.add("is-celebrating");
      celebrationTimer = window.setTimeout(() => {
        puzzle.classList.remove("is-celebrating");
        isCelebrating = false;
        showNext();
      }, celebrationDuration);
    }

    function scratchAt(event) {
      const point = getPoint(event);
      context.globalCompositeOperation = "destination-out";
      context.beginPath();
      context.arc(point.x, point.y, scratchRadius, 0, Math.PI * 2);
      context.fill();
      revealIfReady();
    }

    function handlePointerDown(event) {
      if (ticketCount <= 0) {
        return;
      }

      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      if (!hasStarted) {
        hasStarted = true;
        decideResult();
        if (isWinningTicket) {
          revealWinningTicket();
          return;
        }
      }

      isDrawing = true;
      scratchAt(event);
    }

    function handlePointerMove(event) {
      if (!isDrawing) {
        return;
      }

      event.preventDefault();
      scratchAt(event);
    }

    function handlePointerUp(event) {
      isDrawing = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    function buyTicket() {
      ticketCount += 1;
      if (ticketCount === 1) {
        resetCurrentTicket();
        return;
      }

      syncTicketCount();
    }

    function discardTicket() {
      if (ticketCount <= 1) {
        return;
      }

      ticketCount -= 1;
      resetCurrentTicket();
    }

    function preventChanceEnter(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        chanceInput.blur();
      }
    }

    resetCurrentTicket();
    chanceInput.addEventListener("input", sanitizeChanceInput);
    chanceInput.addEventListener("keydown", preventChanceEnter);
    buyButton.addEventListener("click", buyTicket);
    trashButton.addEventListener("click", discardTicket);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      window.clearTimeout(celebrationTimer);
      puzzle.classList.remove("is-celebrating");
      chanceInput.removeEventListener("input", sanitizeChanceInput);
      chanceInput.removeEventListener("keydown", preventChanceEnter);
      buyButton.removeEventListener("click", buyTicket);
      trashButton.removeEventListener("click", discardTicket);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  },
});
