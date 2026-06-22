(function () {
  const TOKEN_KEY = "jarg-advanced-session";
  const authScreen = document.getElementById("authScreen");
  const authForm = document.getElementById("authForm");
  const authTitle = document.getElementById("authTitle");
  const authSubmit = document.getElementById("authSubmit");
  const authSwitch = document.getElementById("authSwitch");
  const authClose = document.getElementById("authClose");
  const authError = document.getElementById("authError");
  const displayNameField = document.getElementById("displayNameField");
  const displayNameInput = document.getElementById("displayNameInput");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const accountBar = document.getElementById("accountBar");
  const accountName = document.getElementById("accountName");
  const logoutButton = document.getElementById("logoutButton");
  let token = window.localStorage.getItem(TOKEN_KEY) || "";
  let authMode = "login";
  let gameStarted = false;

  async function api(path, options = {}) {
    const headers = { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(path, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.reason || "request_failed"), { status: response.status, data });
    return data;
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === "register";
    authTitle.textContent = registering ? "create account" : "sign in";
    authSubmit.textContent = registering ? "create account" : "sign in";
    authSwitch.textContent = registering ? "already have an account" : "create account";
    displayNameField.hidden = !registering;
    displayNameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    authError.textContent = "";
  }

  function showAuth() {
    setAuthMode("login");
    authScreen.hidden = false;
    window.requestAnimationFrame(() => emailInput.focus());
  }

  authSwitch.addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
  authClose.addEventListener("click", () => {
    authScreen.hidden = true;
    document.getElementById("answerInput").focus();
  });
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authError.textContent = "";
    authSubmit.disabled = true;
    try {
      const data = await api(`/api/auth/${authMode}`, { method: "POST", body: { email: emailInput.value, password: passwordInput.value, displayName: displayNameInput.value } });
      token = data.token;
      window.localStorage.setItem(TOKEN_KEY, token);
      window.location.reload();
    } catch (error) {
      const messages = { invalid_credentials: "email or password is incorrect", email_taken: "this email is already registered", invalid_registration: "check the name, email, and 8+ character password" };
      authError.textContent = messages[error.message] || "could not connect to the server";
    } finally { authSubmit.disabled = false; }
  });

  logoutButton.addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    window.localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  });

  async function launch(user) {
    authScreen.hidden = true;
    accountBar.hidden = false;
    accountName.textContent = user.displayName;
    if (!gameStarted) {
      gameStarted = true;
      await startGame(true);
    }
  }

  async function startGame(isAuthenticated) {
    document.body.dataset.gameReady = "loading";
    const lobby = { id: 0, name: "lobby", content: '<h1 class="lobby-title">ARG</h1>' };
    const ending = { id: 17, name: "end", content: '<h1 class="end-title">END</h1>' };
    const counter = document.getElementById("counter");
    const problemName = document.getElementById("problemName");
    const centerpiece = document.getElementById("centerpiece");
    const form = document.getElementById("answerForm");
    const input = document.getElementById("answerInput");
    const nextButton = document.getElementById("nextButton");
    const helpButton = document.getElementById("helpButton");
    const helpPanel = document.getElementById("helpPanel");
    const clearRateText = document.getElementById("clearRateText");
    let manifest = [];
    let currentId = 0;
    let currentView = "stage";
    let activeCleanup = null;
    const loadedModules = new Set();

    function escapeHtml(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    async function loadScript(url) {
      if (!url || loadedModules.has(url)) return;
      await import(url);
      loadedModules.add(url);
    }

    async function applyManifest(rows) {
      manifest = rows;
      await Promise.all(rows.filter((item) => item.moduleUrl).map((item) => loadScript(item.moduleUrl)));
    }

    async function refreshManifest(rows) {
      await applyManifest(rows || (await api("/api/problems")).problems);
      updateClearRateText();
    }

    function stats() {
      const cleared = manifest.filter((item) => item.status === "cleared").length;
      return { cleared, total: manifest.length, rate: manifest.length ? Math.round(cleared / manifest.length * 100) : 0 };
    }

    function updateClearRateText() {
      const value = stats();
      clearRateText.textContent = `clear ${value.cleared}/${value.total} (${value.rate}%)`;
    }

    function getCurrentStage() {
      if (currentId === 0) return lobby;
      if (currentId === 17) return ending;
      return (window.ARG_PROBLEMS || []).find((problem) => problem.id === currentId);
    }

    function focusInput() { input.value = ""; input.classList.remove("is-wrong"); input.focus(); }
    function cleanupStage() { if (typeof activeCleanup === "function") activeCleanup(); activeCleanup = null; }
    function showNext() { nextButton.hidden = false; }
    function hideNext() { nextButton.hidden = true; }
    function setHelpOpen(open) { updateClearRateText(); helpPanel.hidden = !open; helpButton.setAttribute("aria-expanded", String(open)); }

    function renderStage() {
      cleanupStage(); hideNext(); currentView = "stage";
      const stage = getCurrentStage();
      if (!stage) { centerpiece.innerHTML = '<p class="api-status">problem module unavailable</p>'; return; }
      const isEnding = stage === ending;
      counter.hidden = isEnding;
      counter.textContent = isEnding ? "" : `#${stage.id}`;
      problemName.textContent = stage.name;
      centerpiece.innerHTML = stage.content || "";
      if (typeof stage.onRender === "function") activeCleanup = stage.onRender({ counter, centerpiece, advance, showNext, hideNext, input, storage: window.localStorage });
      form.hidden = false; updateClearRateText(); focusInput();
      if (stage.id > 0 && stage.id < 17) api(`/api/problems/${stage.id}`).catch(() => {});
    }

    function renderList() {
      cleanupStage(); hideNext(); currentView = "list"; counter.hidden = false; counter.textContent = "#list";
      problemName.textContent = "problem list"; form.hidden = false; updateClearRateText();
      centerpiece.innerHTML = `<div class="problem-list-wrap"><p class="problem-list-progress">${escapeHtml(clearRateText.textContent)}</p><ol class="problem-list">${manifest.map((problem) => {
        const open = problem.status !== "locked";
        return `<li class="problem-list-item ${open ? "is-open" : "is-locked"} ${currentId === problem.id ? "is-active" : ""}"><span>#${String(problem.id).padStart(2, "0")}</span><span>${open ? escapeHtml(problem.name) : "locked"}</span></li>`;
      }).join("")}</ol></div>`;
      focusInput();
    }

    function renderHelp(message = "") {
      cleanupStage(); hideNext(); currentView = "help"; counter.hidden = false; counter.textContent = "#help"; problemName.textContent = "help"; form.hidden = false; setHelpOpen(false);
      const progressText = isAuthenticated ? "Your progress is saved to this account." : "Enter #login to sign in and load your progress.";
      centerpiece.innerHTML = `<div class="help-page"><h1>help</h1><section class="help-topic"><h2>progress</h2><p>${progressText}</p></section><section class="help-topic"><h2>commands</h2><p><kbd>#login</kbd>, <kbd>#list</kbd>, <kbd>#lobby</kbd>, <kbd>#reset</kbd>, <kbd>#hint</kbd>, <kbd>#number</kbd></p></section>${message ? `<section class="help-topic"><h2>hint</h2><p>${escapeHtml(message)}</p></section>` : ""}</div>`;
      focusInput();
    }

    function nextAvailableId() {
      const next = manifest.find((item) => item.id > currentId && item.status !== "locked");
      return next ? next.id : (manifest.every((item) => item.status === "cleared") ? 17 : currentId);
    }

    function advance() { hideNext(); currentId = nextAvailableId(); renderStage(); }
    function markWrong() { input.classList.remove("is-wrong"); window.requestAnimationFrame(() => input.classList.add("is-wrong")); }

    function goToProblem(id) {
      if (id === 0) { currentId = 0; renderStage(); return true; }
      const target = manifest.find((item) => item.id === id);
      if (!target || target.status === "locked") return false;
      currentId = id; renderStage(); return true;
    }

    async function resetProgress() {
      if (typeof window.localStorage.removeItem === "function") window.localStorage.removeItem("arg-problem-03-start");
      const data = await api("/api/me/progress", { method: "DELETE" });
      await refreshManifest(data.problems); currentId = 0; renderStage(); setHelpOpen(false);
    }

    async function requestHint() {
      if (currentId < 1 || currentId > manifest.length) return false;
      const data = await api(`/api/problems/${currentId}/hint`, { method: "POST" });
      await refreshManifest(); renderHelp(data.hint); return true;
    }

    async function handleCommand(value) {
      const command = value.trim().toLowerCase();
      if (command === "#login") { showAuth(); return true; }
      if (command === "#list") { if (isAuthenticated) renderList(); else showAuth(); return true; }
      if (command === "#help") { renderHelp(); return true; }
      if (command === "#lobby") { currentId = 0; renderStage(); return true; }
      if (command === "#reset") { if (isAuthenticated) await resetProgress(); else showAuth(); return true; }
      if (command === "#hint") { if (isAuthenticated) return requestHint(); showAuth(); return true; }
      const problemCommand = command.match(/^#\s*(\d+)$/);
      if (problemCommand && !isAuthenticated) { showAuth(); return true; }
      return problemCommand ? goToProblem(Number(problemCommand[1])) : false;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      input.disabled = true;
      try {
        if (await handleCommand(input.value)) return;
        if (currentView !== "stage") return markWrong();
        if (currentId === 0) {
          if (input.value.trim().toLowerCase() === "start") {
            if (!isAuthenticated) { showAuth(); return; }
            currentId = manifest.find((item) => item.status !== "locked")?.id || 0;
            renderStage();
            return;
          }
          return markWrong();
        }
        if (currentId === 17) return markWrong();
        const stage = getCurrentStage();
        if (typeof stage.onSubmit === "function" && stage.onSubmit({ value: input.value, centerpiece, showNext, hideNext, input, storage: window.localStorage })) { focusInput(); return; }
        const result = await api(`/api/problems/${currentId}/submit`, { method: "POST", body: { answer: input.value } });
        if (!result.correct) return markWrong();
        await refreshManifest(result.problems); advance();
      } catch (error) { if (error.status === 429) authError.textContent = "too many attempts; wait a minute"; else markWrong(); }
      finally { input.disabled = false; input.focus(); }
    });

    helpButton.addEventListener("click", () => { setHelpOpen(helpPanel.hidden); input.focus(); });
    nextButton.addEventListener("click", async () => {
      nextButton.disabled = true;
      try { const result = await api(`/api/problems/${currentId}/complete`, { method: "POST" }); await refreshManifest(result.problems); advance(); }
      catch { markWrong(); }
      finally { nextButton.disabled = false; }
    });

    window.ARG_PROBLEMS = [];
    if (isAuthenticated) await refreshManifest();
    else updateClearRateText();
    setHelpOpen(false);
    renderStage();
    document.body.dataset.gameReady = "true";
  }

  (async () => {
    if (!token) {
      setAuthMode("login");
      gameStarted = true;
      await startGame(false);
      return;
    }
    try { const data = await api("/api/auth/me"); await launch(data.user); }
    catch (error) {
      console.error("JARG initialization failed", error);
      token = "";
      window.localStorage.removeItem(TOKEN_KEY);
      accountBar.hidden = true;
      authScreen.hidden = true;
      setAuthMode("login");
      window.location.reload();
    }
  })();
})();
