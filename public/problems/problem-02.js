window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
window.ARG_PROBLEMS.push({
  id: 2,
  name: "Smoking gun",
  content: `
    <p class="copy-riddle">
      Answer is
      <span
        class="copy-target"
        tabindex="0"
        data-copy-text="To be, or not to be."
        oncopy="event.clipboardData.setData('text/plain', this.dataset.copyText); event.preventDefault();"
      >"Answer"</span>
    </p>
  `,
});
