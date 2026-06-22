window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];

const PRINT_POEM = `
  <h2 class="print-document-title">Stopping by Woods on a Snowy Evening</h2>
  <p class="print-document-byline">Robert Frost</p>
  <div class="print-poem">
    <p>Whose woods these are I think I know.<br>His house is in the village though;<br>He will not see me stopping here<br>To watch his woods fill up with snow.</p>
    <p>My little horse must think it queer<br>To stop without a farmhouse near<br>Between the woods and frozen lake<br>The darkest evening of the year.</p>
    <p>He gives his harness bells a shake<br>To ask if there is some mistake.<br>The only other sound's the sweep<br>Of easy wind and downy flake.</p>
    <p>The woods are lovely, dark and deep,<br>But I have promises to keep,<br>And miles to go before I sleep,<br>And miles to go before I sleep.</p>
  </div>
`;

window.ARG_PROBLEMS.push({
  id: 13,
  name: "Print",
  content: `
    <div class="print-puzzle">
      <div class="print-page-wrap">
        <article class="print-document print-document-real">${PRINT_POEM}</article>

        <article class="print-document print-document-decoy" hidden aria-hidden="true">${PRINT_POEM}</article>

        <p class="print-only print-answer">Science</p>

        <button class="print-screen-only print-launch" type="button" aria-label="open print dialog">🖨️</button>
      </div>

      <div class="print-screen-only print-dialog" hidden aria-label="print dialog preview">
        <div class="print-dialog-panel">
          <header class="print-dialog-header">
            <h2 class="print-dialog-title">Print</h2>
            <button class="print-dialog-close" type="button" aria-label="close">×</button>
          </header>

          <div class="print-dialog-body">
            <div class="print-dialog-row">
              <label class="print-dialog-label" for="printDestination">Destination</label>
              <div class="print-dialog-field">
                <select class="print-dialog-select" id="printDestination">
                  <option selected>Microsoft Print to PDF</option>
                  <option>HP LaserJet Pro</option>
                  <option>Save as PDF</option>
                </select>
              </div>
            </div>

            <div class="print-dialog-row">
              <label class="print-dialog-label" for="printPages">Pages</label>
              <div class="print-dialog-field">
                <select class="print-dialog-select" id="printPages">
                  <option selected>All</option>
                  <option>Current page</option>
                  <option>Custom</option>
                </select>
              </div>
            </div>

            <div class="print-dialog-row">
              <span class="print-dialog-label">Layout</span>
              <div class="print-dialog-field print-dialog-radios">
                <label><input type="radio" name="printLayout" value="portrait" checked> Portrait</label>
                <label><input type="radio" name="printLayout" value="landscape"> Landscape</label>
              </div>
            </div>

            <div class="print-dialog-row">
              <label class="print-dialog-label" for="printCopies">Copies</label>
              <div class="print-dialog-field print-dialog-copies">
                <button class="print-stepper" type="button" data-step="-1" aria-label="decrease copies">−</button>
                <input class="print-dialog-input" id="printCopies" type="number" min="1" max="99" value="1">
                <button class="print-stepper" type="button" data-step="1" aria-label="increase copies">+</button>
              </div>
            </div>

            <div class="print-dialog-row">
              <span class="print-dialog-label">Color</span>
              <div class="print-dialog-field print-dialog-radios">
                <label><input type="radio" name="printColor" value="color" checked> Color</label>
                <label><input type="radio" name="printColor" value="bw"> Black and white</label>
              </div>
            </div>
          </div>

          <footer class="print-dialog-footer">
            <button class="print-dialog-btn print-dialog-btn-secondary" type="button">Cancel</button>
            <button class="print-dialog-btn print-dialog-btn-primary" type="button">Print</button>
          </footer>
        </div>
      </div>
    </div>
  `,
  onRender({ centerpiece }) {
    const dialog = centerpiece.querySelector(".print-dialog");
    const launchButton = centerpiece.querySelector(".print-launch");
    if (!dialog || !launchButton) {
      return () => {};
    }

    const header = dialog.querySelector(".print-dialog-header");
    const copiesInput = dialog.querySelector("#printCopies");
    const closeButton = dialog.querySelector(".print-dialog-close");
    const cancelButton = dialog.querySelector(".print-dialog-btn-secondary");
    const printButton = dialog.querySelector(".print-dialog-btn-primary");
    const steppers = dialog.querySelectorAll(".print-stepper");
    let statusTimer = null;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    function placeDialogCentered() {
      const width = dialog.offsetWidth || 520;
      const height = dialog.offsetHeight || 420;
      dialog.style.left = `${Math.max(16, (window.innerWidth - width) / 2)}px`;
      dialog.style.top = `${Math.max(72, (window.innerHeight - height) / 2 - 40)}px`;
    }

    function setStatus(message) {
      dialog.dataset.status = message;
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        delete dialog.dataset.status;
      }, 1400);
    }

    function adjustCopies(step) {
      const next = Math.min(99, Math.max(1, Number(copiesInput.value || 1) + step));
      copiesInput.value = String(next);
      setStatus(`Copies: ${next}`);
    }

    function onCopiesInput() {
      const next = Math.min(99, Math.max(1, Number(copiesInput.value || 1)));
      copiesInput.value = String(next);
    }

    function openDialog() {
      dialog.hidden = false;
      placeDialogCentered();
    }

    function closeDialog() {
      dialog.hidden = true;
      delete dialog.dataset.status;
    }

    function onClose() {
      closeDialog();
    }

    function onCancel() {
      closeDialog();
    }

    function onAfterPrint() {
      document.body.classList.remove("print-via-dialog");
      window.removeEventListener("afterprint", onAfterPrint);
    }

    function onPrint() {
      document.body.classList.add("print-via-dialog");
      window.addEventListener("afterprint", onAfterPrint);
      window.print();
    }

    function onLaunch() {
      openDialog();
    }

    function onFieldChange(event) {
      if (event.target.matches("select, input[type='radio']")) {
        setStatus("Settings updated");
      }
    }

    function onStepperClick(event) {
      adjustCopies(Number(event.currentTarget.dataset.step));
    }

    function onDragStart(event) {
      if (event.target.closest(".print-dialog-close")) {
        return;
      }

      dragging = true;
      const rect = dialog.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dialog.classList.add("is-dragging");
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function onDragMove(event) {
      if (!dragging) {
        return;
      }

      const maxLeft = Math.max(16, window.innerWidth - dialog.offsetWidth - 16);
      const maxTop = Math.max(16, window.innerHeight - dialog.offsetHeight - 16);
      const nextLeft = Math.min(maxLeft, Math.max(16, event.clientX - offsetX));
      const nextTop = Math.min(maxTop, Math.max(16, event.clientY - offsetY));

      dialog.style.left = `${nextLeft}px`;
      dialog.style.top = `${nextTop}px`;
    }

    function onDragEnd(event) {
      dragging = false;
      dialog.classList.remove("is-dragging");
      if (header.hasPointerCapture(event.pointerId)) {
        header.releasePointerCapture(event.pointerId);
      }
    }

    launchButton.addEventListener("click", onLaunch);
    steppers.forEach((button) => {
      button.addEventListener("click", onStepperClick);
    });
    copiesInput.addEventListener("change", onCopiesInput);
    closeButton.addEventListener("click", onClose);
    cancelButton.addEventListener("click", onCancel);
    printButton.addEventListener("click", onPrint);
    dialog.addEventListener("change", onFieldChange);
    header.addEventListener("pointerdown", onDragStart);
    header.addEventListener("pointermove", onDragMove);
    header.addEventListener("pointerup", onDragEnd);
    header.addEventListener("pointercancel", onDragEnd);

    return () => {
      window.clearTimeout(statusTimer);
      document.body.classList.remove("print-via-dialog");
      window.removeEventListener("afterprint", onAfterPrint);
      steppers.forEach((button) => {
        button.removeEventListener("click", onStepperClick);
      });
      copiesInput.removeEventListener("change", onCopiesInput);
      closeButton.removeEventListener("click", onClose);
      cancelButton.removeEventListener("click", onCancel);
      printButton.removeEventListener("click", onPrint);
      dialog.removeEventListener("change", onFieldChange);
      header.removeEventListener("pointerdown", onDragStart);
      header.removeEventListener("pointermove", onDragMove);
      header.removeEventListener("pointerup", onDragEnd);
      header.removeEventListener("pointercancel", onDragEnd);
      launchButton.removeEventListener("click", onLaunch);
    };
  },
});
