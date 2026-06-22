(() => {
  const COLS = 17;
  const ROWS = 12;
  const NOUNS = new Set(["BABO", "FLAG", "WALL"]);
  const PROPERTIES = new Set(["YOU", "WIN", "STOP"]);
  const nounToKind = {
    BABO: "babo",
    FLAG: "flag",
    WALL: "wall",
  };

  const startEntities = [
    word("BABO", 1, 8), word("IS", 1, 9), word("YOU", 1, 10),
    word("FLAG", 4, 5),
    word("IS", 9, 5),
    word("WIN", 10, 5),
    word("WALL", 9, 8), word("IS", 9, 9), word("STOP", 9, 10),
    object("babo", 11, 9),
    object("flag", 10, 4),
    ...line("wall", 2, 3, 6, 3),
    ...line("wall", 2, 7, 6, 7),
    ...line("wall", 2, 3, 2, 7),
    ...line("wall", 6, 3, 6, 7),
    ...line("wall", 7, 2, 14, 2),
    ...line("wall", 7, 6, 14, 6),
    ...line("wall", 7, 2, 7, 6),
    ...line("wall", 14, 2, 14, 6),
    ...line("wall", 7, 7, 14, 7),
    ...line("wall", 7, 11, 14, 11),
    ...line("wall", 7, 7, 7, 11),
    ...line("wall", 14, 7, 14, 11),
  ];

  function word(value, x, y) {
    return { id: `w-${value}-${x}-${y}`, type: "word", word: value, x, y };
  }

  function object(kind, x, y) {
    return { id: `o-${kind}-${x}-${y}-${Math.random().toString(36).slice(2)}`, type: "object", kind, x, y };
  }

  function line(kind, x1, y1, x2, y2) {
    const items = [];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let x = x1;
    let y = y1;

    while (x !== x2 || y !== y2) {
      items.push(object(kind, x, y));
      x += dx;
      y += dy;
    }

    items.push(object(kind, x2, y2));
    return items;
  }

  window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
  window.ARG_PROBLEMS.push({
    id: 8,
    name: "babo is you",
    content: `
      <div class="babo-puzzle">
        <div class="babo-board" tabindex="0" aria-label="babo is you level"></div>
        <p class="babo-status">ARROWS TO MOVE / Z UNDO / R RESET</p>
        <button class="babo-restart" type="button">Yes i am babo(restart)</button>
        <p class="babo-reset-flash" aria-hidden="true" hidden>Babo is you</p>
        <p class="babo-answer" hidden>WIN</p>
      </div>
    `,
    onRender({ centerpiece, showNext, hideNext }) {
      const puzzle = centerpiece.querySelector(".babo-puzzle");
      const board = centerpiece.querySelector(".babo-board");
      const status = centerpiece.querySelector(".babo-status");
      const restartButton = centerpiece.querySelector(".babo-restart");
      const resetFlash = centerpiece.querySelector(".babo-reset-flash");
      const answer = centerpiece.querySelector(".babo-answer");
      let entities = cloneStart();
      let history = [];
      let hasWon = false;
      let resetFlashTimer = null;

      function cloneStart() {
        return startEntities.map((entity) => ({ ...entity }));
      }

      function keyOf(x, y) {
        return `${x},${y}`;
      }

      function inBounds(x, y) {
        return x >= 0 && y >= 0 && x < COLS && y < ROWS;
      }

      function wordsAt(x, y) {
        return entities.filter((entity) => entity.type === "word" && entity.x === x && entity.y === y);
      }

      function objectsAt(x, y) {
        return entities.filter((entity) => entity.type === "object" && entity.x === x && entity.y === y);
      }

      function rules() {
        const byCell = new Map();
        const active = new Map();

        entities
          .filter((entity) => entity.type === "word")
          .forEach((entity) => byCell.set(keyOf(entity.x, entity.y), entity.word));

        function addRule(noun, property) {
          if (!active.has(noun)) {
            active.set(noun, new Set());
          }
          active.get(noun).add(property);
        }

        function readWord(x, y) {
          return byCell.get(keyOf(x, y));
        }

        entities
          .filter((entity) => entity.type === "word" && NOUNS.has(entity.word))
          .forEach((entity) => {
            [[1, 0], [0, 1]].forEach(([dx, dy]) => {
              if (readWord(entity.x + dx, entity.y + dy) !== "IS") {
                return;
              }

              const property = readWord(entity.x + dx * 2, entity.y + dy * 2);
              if (PROPERTIES.has(property)) {
                addRule(entity.word, property);
              }
            });
          });

        return active;
      }

      function hasRule(ruleSet, kind, property) {
        const noun = Object.entries(nounToKind).find(([, value]) => value === kind)?.[0];
        return noun ? ruleSet.get(noun)?.has(property) === true : false;
      }

      function canPush(entity, ruleSet) {
        return entity.type === "word" || hasRule(ruleSet, entity.kind, "PUSH");
      }

      function blocks(entity, ruleSet) {
        return entity.type === "object" && hasRule(ruleSet, entity.kind, "STOP");
      }

      function moveEntity(entity, dx, dy, ruleSet, moved = new Set()) {
        const nextX = entity.x + dx;
        const nextY = entity.y + dy;

        if (!inBounds(nextX, nextY) || moved.has(entity.id)) {
          return false;
        }

        const blockers = [
          ...wordsAt(nextX, nextY),
          ...objectsAt(nextX, nextY).filter((other) => other.id !== entity.id),
        ];

        for (const blocker of blockers) {
          if (canPush(blocker, ruleSet)) {
            if (!moveEntity(blocker, dx, dy, ruleSet, moved)) {
              return false;
            }
          } else if (blocks(blocker, ruleSet)) {
            return false;
          }
        }

        moved.add(entity.id);
        entity.x = nextX;
        entity.y = nextY;
        return true;
      }

      function tick(dx, dy) {
        if (hasWon) {
          return;
        }

        const ruleSet = rules();
        const youKinds = Object.values(nounToKind).filter((kind) => hasRule(ruleSet, kind, "YOU"));
        const movers = entities.filter((entity) => entity.type === "object" && youKinds.includes(entity.kind));

        if (movers.length === 0) {
          status.textContent = "NO YOU";
          puzzle.classList.add("is-no-you");
          return;
        }

        history.push(entities.map((entity) => ({ ...entity })));
        movers.forEach((entity) => moveEntity(entity, dx, dy, ruleSet));
        resolveOverlaps();
        render();
      }

      function resolveOverlaps() {
        let ruleSet = rules();
        const deleted = new Set();

        entities
          .filter((entity) => entity.type === "object" && hasRule(ruleSet, entity.kind, "SINK"))
          .forEach((sink) => {
            const others = objectsAt(sink.x, sink.y).filter((other) => other.id !== sink.id);

            if (others.length > 0) {
              deleted.add(sink.id);
              others.forEach((other) => deleted.add(other.id));
            }
          });

        if (deleted.size > 0) {
          entities = entities.filter((entity) => !deleted.has(entity.id));
          ruleSet = rules();
        }

        entities
          .filter((entity) => entity.type === "object" && hasRule(ruleSet, entity.kind, "YOU"))
          .forEach((you) => {
            objectsAt(you.x, you.y).forEach((other) => {
              if (other.id !== you.id && hasRule(ruleSet, other.kind, "WIN")) {
                win();
              }
            });
          });
      }

      function win() {
        hasWon = true;
        answer.hidden = false;
        puzzle.classList.remove("is-no-you");
        puzzle.classList.add("is-won");
        status.textContent = "FLAG IS WIN";
        showNext();
      }

      function reset() {
        entities = cloneStart();
        history = [];
        hasWon = false;
        answer.hidden = true;
        hideNext();
        puzzle.classList.remove("is-won", "is-no-you");
        status.textContent = "ARROWS TO MOVE / Z UNDO / R RESET";
        render();
        board.focus();
        showResetFlash();
      }

      function showResetFlash() {
        window.clearTimeout(resetFlashTimer);
        resetFlash.hidden = false;
        resetFlash.classList.remove("is-visible");
        void resetFlash.offsetWidth;
        resetFlash.classList.add("is-visible");
        resetFlashTimer = window.setTimeout(() => {
          resetFlash.hidden = true;
          resetFlash.classList.remove("is-visible");
        }, 1250);
      }

      function undo() {
        const previous = history.pop();
        if (!previous) {
          return;
        }

        entities = previous;
        hasWon = false;
        answer.hidden = true;
        hideNext();
        puzzle.classList.remove("is-won", "is-no-you");
        render();
      }

      function render() {
        const ruleSet = rules();
        board.replaceChildren();
        board.style.setProperty("--cols", String(COLS));
        board.style.setProperty("--rows", String(ROWS));

        entities.forEach((entity) => {
          const tile = document.createElement("div");
          tile.className = `babo-tile is-${entity.type}`;
          tile.style.setProperty("--x", String(entity.x));
          tile.style.setProperty("--y", String(entity.y));

          if (entity.type === "word") {
            tile.textContent = entity.word;
            tile.classList.add(`word-${entity.word.toLowerCase()}`);
            if (NOUNS.has(entity.word) || entity.word === "IS") {
              tile.classList.add("is-syntax");
            }
          } else {
            tile.classList.add(`object-${entity.kind}`);
            tile.innerHTML = `<img src="assets/problem-08/${entity.kind}.svg" alt="">`;
            if (hasRule(ruleSet, entity.kind, "YOU")) {
              tile.classList.add("is-you");
            }
            if (hasRule(ruleSet, entity.kind, "PUSH")) {
              tile.classList.add("is-push");
            }
          }

          board.append(tile);
        });

        const activeRules = [...ruleSet.entries()]
          .flatMap(([noun, values]) => [...values].map((property) => `${noun} IS ${property}`));
        const hasYou = Object.values(nounToKind).some((kind) => hasRule(ruleSet, kind, "YOU"));
        puzzle.classList.toggle("is-no-you", !hasWon && !hasYou);
        status.textContent = hasWon ? "FLAG IS WIN" : hasYou ? activeRules.join(" / ") : "NO YOU";
      }

      function handleKey(event) {
        const moves = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        };

        if (event.key === "r" || event.key === "R") {
          reset();
          return;
        }

        if (event.key === "z" || event.key === "Z") {
          undo();
          return;
        }

        const move = moves[event.key];
        if (!move) {
          return;
        }

        event.preventDefault();
        tick(move[0], move[1]);
      }

      window.addEventListener("keydown", handleKey);
      board.addEventListener("click", () => board.focus());
      restartButton.addEventListener("click", reset);
      render();
      board.focus();

      return () => {
        window.clearTimeout(resetFlashTimer);
        window.removeEventListener("keydown", handleKey);
        restartButton.removeEventListener("click", reset);
      };
    },
  });
})();
