(() => {
  const memories = [
    ["sun", "sun", "01-sun.jpg", -30, -18, -12],
    ["full moon", "moon", "02-moon.jpg", 22, 6, 9],
    ["compass", "memory", "03-compass.jpg", -8, -26, 16],
    ["pocket watch", "memory", "04-pocket-watch.jpg", 9, -21, -7],
    ["camera", "memory", "05-camera.jpg", 32, -18, 14],
    ["fountain pen", "memory", "06-fountain-pen.jpg", -39, 5, -18],
    ["candle", "memory", "07-candle.jpg", -17, 4, 7],
    ["teacup", "memory", "08-teacup.jpg", 6, 3, -13],
    ["scissors", "memory", "09-scissors.jpg", 35, 12, 19],
    ["glass bottle", "memory", "10-glass-bottle.jpg", -30, 20, 11],
    ["old book", "memory", "11-old-book.jpg", -4, 20, -8],
    ["eyeglasses", "memory", "12-eyeglasses.jpg", 19, 23, 15],
    ["desk lamp", "memory", "13-desk-lamp.jpg", 38, -2, -10],
    ["mirror", "memory", "14-mirror.jpg", -43, -14, 8],
    ["seashell", "memory", "15-seashell.jpg", -22, -30, -5],
    ["feather", "memory", "16-feather.jpg", 26, -31, 12],
    ["dice", "memory", "17-dice.jpg", 3, -35, -17],
    ["chess piece", "memory", "18-chess-piece.jpg", -46, 20, 18],
    ["hourglass", "memory", "19-hourglass.jpg", 45, 22, -15],
    ["telephone", "memory", "20-telephone.jpg", -12, 33, 10],
    ["padlock", "memory", "21-padlock.jpg", 12, 34, -9],
    ["map", "memory", "22-map.jpg", 43, 34, 6],
    ["coin", "memory", "23-coin.jpg", -36, 36, -14],
    ["spoon", "memory", "24-spoon.jpg", 29, 35, 13],
    ["violin", "memory", "25-violin.jpg", -2, -7, 4],
    ["bell", "memory", "26-bell.jpg", 14, 13, -19],
    ["clock", "memory", "27-clock.jpg", -24, 10, 17],
    ["lantern", "memory", "28-lantern.jpg", 29, -9, -6],
    ["rose", "memory", "29-rose.jpg", -8, 7, -16],
    ["typewriter", "memory", "30-typewriter.jpg", 1, 30, 18],
  ].map(([label, role, file, x, y, rotation], index) => ({
    label,
    role,
    file,
    x,
    y,
    rotation,
    z: index + 1,
  }));

  window.ARG_PROBLEMS = window.ARG_PROBLEMS || [];
  window.ARG_PROBLEMS.push({
    id: 7,
    name: "Eclipse",
    content: `
      <div class="mnestis-puzzle">
        <div class="mnestis-board" aria-label="scattered memories">
          ${memories.map((memory) => `
            <figure
              class="mnestis-photo"
              data-role="${memory.role}"
              data-label="${memory.label}"
              data-x="${memory.x}"
              data-y="${memory.y}"
              data-rotation="${memory.rotation}"
              style="--z: ${memory.z}; --rot: ${memory.rotation}deg;"
            >
              <img src="assets/problem-07/${memory.file}" alt="${memory.label}">
            </figure>
          `).join("")}
        </div>
        <p class="mnestis-answer" hidden>Mnestis</p>
      </div>
    `,
    onRender({ centerpiece, showNext }) {
      const puzzle = centerpiece.querySelector(".mnestis-puzzle");
      const board = centerpiece.querySelector(".mnestis-board");
      const answer = centerpiece.querySelector(".mnestis-answer");
      const photos = Array.from(centerpiece.querySelectorAll(".mnestis-photo"));
      const sunPhoto = centerpiece.querySelector('[data-role="sun"]');
      const moonPhoto = centerpiece.querySelector('[data-role="moon"]');
      let topLayer = photos.length + 10;
      let activePhoto = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let isSolved = false;

      function placePhoto(photo) {
        const offsetX = Number(photo.dataset.x);
        const offsetY = Number(photo.dataset.y);
        const x = window.innerWidth / 2 + (offsetX / 100) * window.innerWidth;
        const y = window.innerHeight / 2 + (offsetY / 100) * window.innerHeight;

        photo.dataset.currentX = String(x);
        photo.dataset.currentY = String(y);
        photo.style.setProperty("--x", `${x}px`);
        photo.style.setProperty("--y", `${y}px`);
      }

      function bringToFront(photo) {
        topLayer += 1;
        photo.style.setProperty("--z", String(topLayer));
      }

      function setPosition(photo, x, y) {
        photo.dataset.currentX = String(x);
        photo.dataset.currentY = String(y);
        photo.style.setProperty("--x", `${x}px`);
        photo.style.setProperty("--y", `${y}px`);
      }

      function clearZoom(exceptPhoto) {
        photos.forEach((photo) => {
          if (photo !== exceptPhoto) {
            photo.classList.remove("is-zoomed");
          }
        });
      }

      function overlapArea(firstRect, secondRect) {
        const width = Math.max(0, Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left));
        const height = Math.max(0, Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top));

        return width * height;
      }

      function hasExtraPhotoInEclipse(sunRect, moonRect) {
        return photos
          .filter((photo) => photo !== sunPhoto && photo !== moonPhoto)
          .some((photo) => {
            const photoRect = photo.getBoundingClientRect();
            const photoArea = photoRect.width * photoRect.height;
            const sunOverlapRatio = photoArea > 0 ? overlapArea(photoRect, sunRect) / photoArea : 0;
            const moonOverlapRatio = photoArea > 0 ? overlapArea(photoRect, moonRect) / photoArea : 0;

            return sunOverlapRatio > 0.18 || moonOverlapRatio > 0.18;
          });
      }

      function trySolveFromDrop(droppedPhoto) {
        if (isSolved) {
          return;
        }

        if (droppedPhoto !== sunPhoto && droppedPhoto !== moonPhoto) {
          return;
        }

        const sunRect = sunPhoto.getBoundingClientRect();
        const moonRect = moonPhoto.getBoundingClientRect();
        const sunCenterX = sunRect.left + sunRect.width / 2;
        const sunCenterY = sunRect.top + sunRect.height / 2;
        const moonCenterX = moonRect.left + moonRect.width / 2;
        const moonCenterY = moonRect.top + moonRect.height / 2;
        const centerDistance = Math.hypot(sunCenterX - moonCenterX, sunCenterY - moonCenterY);
        const snapDistance = Math.max(28, Math.min(sunRect.width, sunRect.height, moonRect.width, moonRect.height) * 0.18);
        const sharedArea = overlapArea(sunRect, moonRect);
        const targetArea = Math.min(sunRect.width * sunRect.height, moonRect.width * moonRect.height);
        const overlapRatio = targetArea > 0 ? sharedArea / targetArea : 0;

        if (centerDistance > snapDistance && overlapRatio < 0.86) {
          return;
        }

        if (hasExtraPhotoInEclipse(sunRect, moonRect)) {
          return;
        }

        const anchorPhoto = droppedPhoto === sunPhoto ? moonPhoto : sunPhoto;
        setPosition(droppedPhoto, Number(anchorPhoto.dataset.currentX), Number(anchorPhoto.dataset.currentY));
        sunPhoto.style.setProperty("--rot", "0deg");
        moonPhoto.style.setProperty("--rot", "0deg");
        sunPhoto.classList.remove("is-zoomed");
        moonPhoto.classList.remove("is-zoomed");
        isSolved = true;
        answer.hidden = false;
        puzzle.classList.add("is-solved");
        showNext();
        bringToFront(sunPhoto);
        bringToFront(moonPhoto);
        gatherMemories();
      }

      function gatherMemories() {
        const baseY = window.innerHeight / 2;

        photos.forEach((photo, index) => {
          const currentX = Number(photo.dataset.currentX);
          const offset = ((index % 5) - 2) * 10;
          const y = baseY + offset;

          photo.classList.remove("is-zoomed", "is-dragging");
          photo.style.setProperty("--rot", `${((index % 7) - 3) * 2}deg`);
          photo.style.setProperty("--z", String(index + 1));
          setPosition(photo, currentX, y);
        });

        bringToFront(sunPhoto);
        bringToFront(moonPhoto);
      }

      function handlePointerDown(event) {
        if (event.button !== 0) {
          return;
        }

        const photo = event.currentTarget;
        const currentX = Number(photo.dataset.currentX);
        const currentY = Number(photo.dataset.currentY);

        activePhoto = photo;
        dragOffsetX = event.clientX - currentX;
        dragOffsetY = event.clientY - currentY;
        clearZoom(photo);
        photo.classList.remove("is-zoomed");
        photo.classList.add("is-dragging");
        bringToFront(photo);
        photo.setPointerCapture(event.pointerId);
      }

      function handlePointerMove(event) {
        if (!activePhoto) {
          return;
        }

        setPosition(activePhoto, event.clientX - dragOffsetX, event.clientY - dragOffsetY);
      }

      function endDrag(event) {
        if (!activePhoto) {
          return;
        }

        const droppedPhoto = activePhoto;
        activePhoto.releasePointerCapture(event.pointerId);
        activePhoto.classList.remove("is-dragging");
        activePhoto = null;
        trySolveFromDrop(droppedPhoto);
      }

      function handleContextMenu(event) {
        event.preventDefault();
        const photo = event.currentTarget;

        clearZoom(photo);
        bringToFront(photo);
        photo.classList.toggle("is-zoomed");
      }

      photos.forEach((photo) => {
        placePhoto(photo);
        photo.addEventListener("pointerdown", handlePointerDown);
        photo.addEventListener("pointermove", handlePointerMove);
        photo.addEventListener("pointerup", endDrag);
        photo.addEventListener("pointercancel", endDrag);
        photo.addEventListener("contextmenu", handleContextMenu);
      });

      function handleOutsidePointerDown(event) {
        if (event.target.closest(".mnestis-photo")) {
          return;
        }

        clearZoom(null);
      }

      window.addEventListener("pointerdown", handleOutsidePointerDown);

      return () => {
        photos.forEach((photo) => {
          photo.removeEventListener("pointerdown", handlePointerDown);
          photo.removeEventListener("pointermove", handlePointerMove);
          photo.removeEventListener("pointerup", endDrag);
          photo.removeEventListener("pointercancel", endDrag);
          photo.removeEventListener("contextmenu", handleContextMenu);
        });
        window.removeEventListener("pointerdown", handleOutsidePointerDown);
      };
    },
  });
})();
