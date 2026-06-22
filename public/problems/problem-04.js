window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 4,
  name: "Perfect fit",
  content: `
    <div class="perfect-fit" aria-live="polite">
      <div class="fit-line fit-line-left"></div>
      <div class="fit-line fit-line-right"></div>
      <p class="perfect-answer" hidden>Perfect</p>
    </div>
  `,
  onRender({ centerpiece, showNext, hideNext }) {
    const TARGET_WIDTH = 960;
    const TOLERANCE = 4;
    const answer = centerpiece.querySelector(".perfect-answer");

    function checkFit() {
      const isPerfect = Math.abs(window.innerWidth - TARGET_WIDTH) <= TOLERANCE;
      answer.hidden = !isPerfect;
      if (isPerfect) {
        showNext();
      } else {
        hideNext();
      }
    }

    const intervalId = window.setInterval(checkFit, 250);
    window.addEventListener("resize", checkFit);
    checkFit();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", checkFit);
    };
  },
});
