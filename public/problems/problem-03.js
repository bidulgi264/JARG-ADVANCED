window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 3,
  name: "Time in a bottle",
  content: `
    <div class="bottle-time">
      <p class="bottle-timer" aria-live="polite">12:00:00</p>
    </div>
  `,
  onRender({ centerpiece, storage, showNext }) {
    const START_KEY = "arg-problem-03-start";
    const DURATION_MS = 12 * 60 * 60 * 1000;
    const timer = centerpiece.querySelector(".bottle-timer");
    const state = {
      revealed: false,
    };

    this.state = state;

    let startTime = Number(storage.getItem(START_KEY));
    if (!Number.isFinite(startTime) || startTime <= 0) {
      startTime = Date.now();
      storage.setItem(START_KEY, String(startTime));
    }

    function formatTime(milliseconds) {
      const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");

      return `${hours}:${minutes}:${seconds}`;
    }

    function revealAnswer() {
      state.revealed = true;
      centerpiece.innerHTML = '<h1 class="time-gold">Time is Gold</h1>';
      showNext();
    }

    function updateTimer() {
      if (state.revealed) {
        return;
      }

      const remaining = DURATION_MS - (Date.now() - startTime);

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        revealAnswer();
        return;
      }

      timer.textContent = formatTime(remaining);
    }

    const intervalId = window.setInterval(updateTimer, 1000);
    updateTimer();

    return () => window.clearInterval(intervalId);
  },
  onSubmit({ value, centerpiece, storage, showNext }) {
    if (value.trim().toLowerCase() !== "nah") {
      return false;
    }

    const START_KEY = "arg-problem-03-start";
    const DURATION_MS = 12 * 60 * 60 * 1000;
    storage.setItem(START_KEY, String(Date.now() - DURATION_MS));

    if (this.state) {
      this.state.revealed = true;
    }

    centerpiece.innerHTML = '<h1 class="time-gold">Time is Gold</h1>';
    showNext();
    return true;
  },
});
