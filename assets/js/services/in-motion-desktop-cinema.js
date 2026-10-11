/* assets/js/services/in-motion-desktop-cinema.js
   Pixkuy en movimiento — Desktop cinematic reveal.
   Responsabilidad:
   - insertar una experiencia cinematográfica desktop antes de la galería real
   - controlar vídeo, máscara tipográfica, capítulos, CTAs y progreso
   - activar solo en desktop cuando existe el fragment i18n requerido
   - no modificar el scroll-cinema móvil
   - no modificar la galería existente
*/

(function initInMotionDesktopCinema(window, document) {
  "use strict";

  var DESKTOP_QUERY = "(min-width: 721px)";
  var SECTION_SELECTOR = "[data-in-motion-section]";
  var GALLERY_SELECTOR = "[data-in-motion-gallery]";
  var ROOT_ATTR = "data-in-motion-desktop-cinema";
  var BODY_ACTIVE_ATTR = "data-in-motion-desktop-cinema-active";
  var VIDEO_SRC = "assets/video/pixkuy-lego-scroll-cinema.mp4";
  var POSTER_SRC = "assets/video/pixkuy-lego-scroll-cinema-poster.webp";

  var CHAPTERS = [
    {
      id: "arrival",
      time: 0,
      href: "?service=airport_hotel&airport_id=mex&airport_direction=airport_to_hotel#services"
    },
    {
      id: "driver",
      time: 4.5,
      href: "#fleet"
    },
    {
      id: "cityRide",
      time: 10,
      href: "?service=direct_transfer#services"
    },
    {
      id: "cdmx",
      time: 18,
      href: "?service=hourly_daily#services"
    },
    {
      id: "teotihuacan",
      time: 23,
      href: "?service=tour_private&tour=teotihuacan#services"
    },
    {
      id: "xochimilco",
      time: 28,
      href: "?service=tour_private&tour=xochimilco_coyoacan#services"
    },
    {
      id: "returnHome",
      time: 37,
      href: "?service=airport_hotel&airport_id=mex&airport_direction=hotel_to_airport#services"
    },
    {
      id: "final",
      time: 45,
      href: "?service=direct_transfer#services"
    }
  ];

  var desktopQuery = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;
  var rootNode = null;
  var stageNode = null;
  var videoNode = null;
  var typeNode = null;
  var chapterIndexNode = null;
  var chapterTitleNode = null;
  var chapterTextNode = null;
  var primaryCtaNode = null;
  var playNode = null;
  var soundNode = null;
  var progressBarNode = null;
  var chapterButtons = [];
  var observer = null;
  var rafId = null;
  var activeIndex = 0;
  var isVisible = false;
  var loadObserver = null;
  var initFrameId = null;
  var sourceAssigned = false;
  var playPending = false;
  var pageSuspended = false;
  var pendingSeekTime = null;
  // Both viewport variants preserve the user's pause for this page lifetime.
  var playbackIntent = window.__pixkuyInMotionPlaybackIntent || { pausedByUser: false };
  window.__pixkuyInMotionPlaybackIntent = playbackIntent;

  function isDesktopViewport() {
    return Boolean(desktopQuery && desktopQuery.matches);
  }

  function isReducedMotion() {
    return Boolean(
      window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getI18nValue(path) {
    var dict = window.__pixkuyI18nDict || null;
    var parts;
    var cursor;
    var index;

    if (!dict || !path) {
      return "";
    }

    parts = String(path).split(".");
    cursor = dict;

    for (index = 0; index < parts.length; index += 1) {
      if (!cursor || typeof cursor !== "object") {
        return "";
      }

      cursor = cursor[parts[index]];
    }

    return typeof cursor === "string" ? cursor.trim() : "";
  }

  function getCopy(key) {
    return getI18nValue("inMotionDesktopCinema." + key);
  }

  function getChapterCopy(chapter, key) {
    return getI18nValue(
      "inMotionDesktopCinema.chapters." + chapter.id + "." + key
    );
  }

  function hasRequiredCopy() {
    return Boolean(
      getCopy("ariaLabel") &&
        getCopy("videoLabel") &&
        getCopy("typeMask") &&
        getCopy("play") &&
        getCopy("pause") &&
        getCopy("soundOn") &&
        getCopy("soundOff") &&
        getCopy("timelineLabel") &&
        CHAPTERS.every(function hasChapterCopy(chapter) {
          return (
            getChapterCopy(chapter, "index") &&
            getChapterCopy(chapter, "time") &&
            getChapterCopy(chapter, "label") &&
            getChapterCopy(chapter, "title") &&
            getChapterCopy(chapter, "text") &&
            getChapterCopy(chapter, "primary")
          );
        })
    );
  }

  function createNode(tagName, className) {
    var node = document.createElement(tagName);

    if (className) {
      node.className = className;
    }

    return node;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getScrollProgress() {
    var rect;
    var viewportHeight;
    var travel;

    if (!stageNode) {
      return 0;
    }

    rect = stageNode.getBoundingClientRect();
    viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    travel = Math.max(1, stageNode.offsetHeight - viewportHeight);

    return clamp((0 - rect.top) / travel, 0, 1);
  }

  function getActiveChapterIndexForProgress(progress) {
    var safeProgress = clamp(progress, 0, 1);
    var index = Math.round(safeProgress * (CHAPTERS.length - 1));

    return clamp(index, 0, CHAPTERS.length - 1);
  }

  function getActiveChapterIndexForTime(currentTime) {
    var index;
    var active = 0;

    for (index = 0; index < CHAPTERS.length; index += 1) {
      if (currentTime >= CHAPTERS[index].time) {
        active = index;
      }
    }

    return active;
  }

  function setPlayState() {
    if (!playNode || !videoNode) {
      return;
    }

    if (videoNode.paused) {
      playNode.setAttribute("aria-label", getCopy("play"));
      playNode.setAttribute("data-state", "paused");
      playNode.innerHTML = '<span aria-hidden="true">▶</span>';
      return;
    }

    playNode.setAttribute("aria-label", getCopy("pause"));
    playNode.setAttribute("data-state", "playing");
    playNode.innerHTML = '<span aria-hidden="true">Ⅱ</span>';
  }

  function setSoundState() {
    if (!soundNode || !videoNode) {
      return;
    }

    if (videoNode.muted) {
      soundNode.setAttribute("aria-label", getCopy("soundOn"));
      soundNode.setAttribute("data-state", "muted");
      soundNode.innerHTML = '<span aria-hidden="true">♪</span>';
      return;
    }

    soundNode.setAttribute("aria-label", getCopy("soundOff"));
    soundNode.setAttribute("data-state", "on");
    soundNode.innerHTML = '<span aria-hidden="true">♪</span>';
  }

  function ensureVideoSource() {
    if (!videoNode || sourceAssigned || !isDesktopViewport() || document.hidden || pageSuspended ||
        playbackIntent.completed || playbackIntent.failure) {
      return;
    }

    var rect = rootNode.getBoundingClientRect();
    // Assign media only when the active section actually overlaps the viewport.
    if (!rootNode.isConnected || !rect.width || !rect.height ||
        rect.bottom <= 0 || rect.top >= window.innerHeight ||
        rect.right <= 0 || rect.left >= window.innerWidth) {
      return;
    }

    sourceAssigned = true;
    videoNode.src = VIDEO_SRC;
    if (loadObserver) {
      loadObserver.disconnect();
    }
  }

  function tryPlayVideo(explicit) {
    var promise;
    var target = videoNode;

    if (!target || !isVisible || !isDesktopViewport() || document.hidden || pageSuspended || playPending) {
      return;
    }

    if (explicit === true) {
      // Reload a failed resource only on this explicit action; autoplay rejection needs no load.
      var retryMedia = playbackIntent.failure === "media" || Boolean(target.error);
      playbackIntent.pausedByUser = false;
      playbackIntent.completed = false;
      playbackIntent.failure = null;
      if (retryMedia && sourceAssigned) {
        pendingSeekTime = pendingSeekTime === null ? target.currentTime : pendingSeekTime;
        target.load();
      } else if (target.ended) {
        target.currentTime = 0;
      }
      ensureVideoSource();
    }

    if (!target || !sourceAssigned || !isVisible || !isDesktopViewport() ||
        document.hidden || pageSuspended || playbackIntent.pausedByUser ||
        playbackIntent.completed || playbackIntent.failure || target.ended || playPending || !target.paused ||
        (isReducedMotion() && explicit !== true)) {
      return;
    }

    playPending = true;
    promise = target.play();

    if (promise && typeof promise.then === "function") {
      promise.then(function onPlaying() {
        if (target !== videoNode) {
          target.pause();
          return;
        }
        playPending = false;
        if (!isVisible || document.hidden || pageSuspended || playbackIntent.pausedByUser) {
          pauseVideo();
        }
      }, function onPlayFailure(error) {
        if (target !== videoNode) {
          return;
        }
        playPending = false;
        if (error.name !== "AbortError") {
          playbackIntent.failure = target.error ? "media" :
            (error.name === "NotAllowedError" ? "autoplay" : "play");
        }
        setPlayState();
      });
    } else {
      playPending = false;
    }
  }

  function pauseVideo() {
    if (!videoNode) {
      return;
    }

    videoNode.pause();
  }

  function seekVideoToChapter(chapter) {
    if (!videoNode || !chapter) {
      return;
    }

    if (videoNode.readyState >= 1) {
      videoNode.currentTime = chapter.time;
      return;
    }

    pendingSeekTime = chapter.time;
  }

  function handleMetadata(event) {
    if (event.currentTarget !== videoNode) {
      return;
    }
    if (pendingSeekTime !== null) {
      videoNode.currentTime = pendingSeekTime;
      pendingSeekTime = null;
    }
    updateProgressBar();
  }

  function handleDocumentVisibility() {
    if (document.hidden || pageSuspended) {
      pauseVideo();
      return;
    }
    ensureVideoSource();
    tryPlayVideo();
  }

  function handlePageHide() {
    pageSuspended = true;
    if (initFrameId !== null) {
      window.cancelAnimationFrame(initFrameId);
      initFrameId = null;
    }
    pauseVideo();
  }

  function handlePageShow() {
    pageSuspended = false;
    requestInit();
  }

  function updateProgressBar() {
    var duration;
    var progress;

    if (!progressBarNode || !videoNode) {
      return;
    }

    duration = Number(videoNode.duration);

    if (!Number.isFinite(duration) || duration <= 0) {
      progressBarNode.style.width = "0%";
      return;
    }

    progress = clamp(videoNode.currentTime / duration, 0, 1);
    progressBarNode.style.width = String(progress * 100) + "%";
  }

  function updateActiveChapter(index) {
    var chapter = CHAPTERS[index];

    if (!chapter) {
      return;
    }

    activeIndex = index;

    chapterButtons.forEach(function updateButton(button, buttonIndex) {
      button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
    });

    if (chapterIndexNode) {
      chapterIndexNode.textContent =
        getChapterCopy(chapter, "index") + " · " + getChapterCopy(chapter, "time");
    }

    if (chapterTitleNode) {
      chapterTitleNode.textContent = getChapterCopy(chapter, "title");
    }

    if (chapterTextNode) {
      chapterTextNode.textContent = getChapterCopy(chapter, "text");
    }

    if (primaryCtaNode) {
      primaryCtaNode.href = chapter.href;
      primaryCtaNode.textContent = getChapterCopy(chapter, "primary");
    }
  }

  function syncChapterFromVideoTime() {
    var nextIndex;

    if (!videoNode) {
      return;
    }

    nextIndex = getActiveChapterIndexForTime(videoNode.currentTime);

    if (nextIndex !== activeIndex) {
      updateActiveChapter(nextIndex);
    }

    updateProgressBar();
  }

  function syncScrollReveal() {
    var progress;
    var nextIndex;
    var videoScale;

    rafId = null;

    if (!rootNode || !stageNode) {
      return;
    }

    progress = getScrollProgress();
    nextIndex = getActiveChapterIndexForProgress(progress);

    videoScale = 1;

    rootNode.style.setProperty("--in-motion-desktop-cinema-progress", String(progress));

    if (videoNode && !isReducedMotion()) {
      videoNode.style.transform = "scale(" + String(videoScale) + ")";
    }

    if (nextIndex !== activeIndex) {
      updateActiveChapter(nextIndex);
    }
  }

  function requestScrollRevealSync() {
    if (rafId !== null) {
      return;
    }

    rafId = window.requestAnimationFrame(syncScrollReveal);
  }

  function handleVisibility(entries) {
    var entry = entries && entries[0];

    if (!entry || entry.target !== rootNode) {
      return;
    }

    isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.2;

    if (isVisible) {
      document.body.setAttribute(BODY_ACTIVE_ATTR, "true");
      requestScrollRevealSync();
      tryPlayVideo();
      return;
    }

    document.body.removeAttribute(BODY_ACTIVE_ATTR);
    pauseVideo();
  }

  function setupObserver() {
    if (!rootNode || !window.IntersectionObserver) {
      return;
    }

    observer = new IntersectionObserver(handleVisibility, {
      threshold: [0, 0.2, 0.55]
    });

    observer.observe(rootNode);
    loadObserver = new IntersectionObserver(function onVisibleSection(entries) {
      if (entries.some(function overlaps(entry) {
        return entry.target === rootNode && entry.isIntersecting && entry.intersectionRatio > 0;
      })) {
        ensureVideoSource();
        tryPlayVideo();
      }
    }, { rootMargin: "0px", threshold: [0, 0.001] });
    loadObserver.observe(rootNode);
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = null;
    if (loadObserver) {
      loadObserver.disconnect();
    }
    loadObserver = null;
    isVisible = false;
    document.body.removeAttribute(BODY_ACTIVE_ATTR);
  }

  function buildChapterButton(chapter, index) {
    var button = createNode("button", "in-motion-desktop-cinema__chapter-button");
    var indexNode = createNode("span", "in-motion-desktop-cinema__chapter-button-index");
    var labelNode = createNode("span", "in-motion-desktop-cinema__chapter-button-label");
    var timeNode = createNode("span", "in-motion-desktop-cinema__chapter-button-time");

    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", getChapterCopy(chapter, "label"));

    indexNode.textContent = getChapterCopy(chapter, "index");
    labelNode.textContent = getChapterCopy(chapter, "label");
    timeNode.textContent = getChapterCopy(chapter, "time");

    button.appendChild(indexNode);
    button.appendChild(labelNode);
    button.appendChild(timeNode);

    button.addEventListener("click", function onChapterClick() {
      updateActiveChapter(index);
      seekVideoToChapter(chapter);

      if (isVisible) {
        tryPlayVideo();
      }
    });

    chapterButtons.push(button);

    return button;
  }

  function buildDesktopCinema() {
    var section = document.querySelector(SECTION_SELECTOR);
    var gallery = document.querySelector(GALLERY_SELECTOR);
    var stage = createNode("div", "in-motion-desktop-cinema__stage");
    var mask = createNode("div", "in-motion-desktop-cinema__mask");
    var overlay = createNode("div", "in-motion-desktop-cinema__overlay");
    var content = createNode("div", "in-motion-desktop-cinema__content");
    var chapter = createNode("div", "in-motion-desktop-cinema__chapter");
    var actions = createNode("div", "in-motion-desktop-cinema__actions");
    var chapters = createNode("nav", "in-motion-desktop-cinema__chapters");
    var controls = createNode("div", "in-motion-desktop-cinema__controls");
    var progress = createNode("div", "in-motion-desktop-cinema__progress");

    if (!section || !gallery || !gallery.parentNode) {
      return null;
    }

    rootNode = createNode("div", "in-motion-desktop-cinema");
    rootNode.setAttribute(ROOT_ATTR, "1");
    rootNode.setAttribute("aria-label", getCopy("ariaLabel"));

    stageNode = stage;
    stage.setAttribute("data-in-motion-desktop-cinema-stage", "1");

    mask.setAttribute("data-in-motion-desktop-cinema-mask", "1");

    videoNode = document.createElement("video");
    videoNode.className = "in-motion-desktop-cinema__video";
    videoNode.poster = POSTER_SRC;
    videoNode.muted = true;
    videoNode.loop = false;
    videoNode.playsInline = true;
    videoNode.preload = "metadata";
    videoNode.setAttribute("aria-label", getCopy("videoLabel"));
    videoNode.setAttribute("data-in-motion-desktop-cinema-video", "1");

    typeNode = createNode("div", "in-motion-desktop-cinema__type");
    typeNode.textContent = getCopy("typeMask");
    typeNode.setAttribute("aria-hidden", "true");
    typeNode.setAttribute("data-in-motion-desktop-cinema-type", "1");

    chapterIndexNode = createNode("p", "in-motion-desktop-cinema__chapter-index");
    chapterTitleNode = createNode("h3", "in-motion-desktop-cinema__chapter-title");
    chapterTextNode = createNode("p", "in-motion-desktop-cinema__chapter-text");

    primaryCtaNode = createNode("a", "cta in-motion-desktop-cinema__primary");
    primaryCtaNode.setAttribute("data-in-motion-desktop-cinema-primary", "1");

    chapters.setAttribute("aria-label", getCopy("timelineLabel"));
    chapters.setAttribute("data-in-motion-desktop-cinema-chapters", "1");

    chapterButtons = [];
    CHAPTERS.forEach(function appendChapterButton(item, index) {
      chapters.appendChild(buildChapterButton(item, index));
    });

    playNode = createNode("button", "in-motion-desktop-cinema__control");
    playNode.type = "button";
    playNode.setAttribute("data-in-motion-desktop-cinema-play", "1");

    soundNode = createNode("button", "in-motion-desktop-cinema__control");
    soundNode.type = "button";
    soundNode.setAttribute("data-in-motion-desktop-cinema-sound", "1");

    progress.setAttribute("aria-hidden", "true");
    progress.setAttribute("data-in-motion-desktop-cinema-progress", "1");

    progressBarNode = createNode("span", "");
    progressBarNode.setAttribute("data-in-motion-desktop-cinema-progress-bar", "1");

    progress.appendChild(progressBarNode);

    actions.appendChild(primaryCtaNode);

    chapter.appendChild(chapterIndexNode);
    chapter.appendChild(chapterTitleNode);
    chapter.appendChild(chapterTextNode);
    chapter.appendChild(actions);

    content.appendChild(chapter);
    content.appendChild(chapters);

    controls.appendChild(playNode);
    controls.appendChild(soundNode);
    controls.appendChild(progress);

    mask.appendChild(videoNode);

    stage.appendChild(mask);
    stage.appendChild(typeNode);
    stage.appendChild(overlay);
    stage.appendChild(content);
    stage.appendChild(controls);

    rootNode.appendChild(stage);

    gallery.parentNode.insertBefore(rootNode, gallery);

    videoNode.addEventListener("play", setPlayState);
    videoNode.addEventListener("pause", setPlayState);
    videoNode.addEventListener("timeupdate", syncChapterFromVideoTime);
    videoNode.addEventListener("loadedmetadata", handleMetadata);
    videoNode.addEventListener("ended", function onEnded(event) {
      if (event.currentTarget !== videoNode) {
        return;
      }
      playbackIntent.completed = true;
      setPlayState();
    });
    videoNode.addEventListener("error", function onMediaError(event) {
      if (event.currentTarget !== videoNode) {
        return;
      }
      playbackIntent.failure = "media";
      pauseVideo();
      setPlayState();
    });

    playNode.addEventListener("click", function onPlayClick() {
      if (!videoNode) {
        return;
      }

      if (videoNode.paused) {
        tryPlayVideo(true);
        return;
      }

      playbackIntent.pausedByUser = true;
      pauseVideo();
    });

    soundNode.addEventListener("click", function onSoundClick() {
      if (!videoNode) {
        return;
      }

      videoNode.muted = !videoNode.muted;
      videoNode.volume = videoNode.muted ? 0 : 1;

      setSoundState();
    });

    window.addEventListener("scroll", requestScrollRevealSync, { passive: true });
    window.addEventListener("resize", requestScrollRevealSync);

    updateActiveChapter(0);
    setPlayState();
    setSoundState();
    setupObserver();
    requestScrollRevealSync();

    return rootNode;
  }

  function teardown() {
    teardownObserver();

    window.removeEventListener("scroll", requestScrollRevealSync);
    window.removeEventListener("resize", requestScrollRevealSync);

    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }

    rafId = null;

    if (videoNode) {
      pauseVideo();
      videoNode.removeAttribute("src");
      videoNode.load();
    }

    if (rootNode && rootNode.parentNode) {
      rootNode.parentNode.removeChild(rootNode);
    }

    rootNode = null;
    stageNode = null;
    videoNode = null;
    typeNode = null;
    chapterIndexNode = null;
    chapterTitleNode = null;
    chapterTextNode = null;
    primaryCtaNode = null;
    playNode = null;
    soundNode = null;
    progressBarNode = null;
    chapterButtons = [];
    activeIndex = 0;
    sourceAssigned = false;
    playPending = false;
    pendingSeekTime = null;
  }

  function shouldRender() {
    return isDesktopViewport() && hasRequiredCopy();
  }

  function init() {
    initFrameId = null;

    if (!shouldRender()) {
      teardown();
      return;
    }

    if (rootNode && rootNode.isConnected) {
      rootNode.setAttribute("aria-label", getCopy("ariaLabel"));
      videoNode.setAttribute("aria-label", getCopy("videoLabel"));
      typeNode.textContent = getCopy("typeMask");
      rootNode.querySelector("[data-in-motion-desktop-cinema-chapters]").setAttribute("aria-label", getCopy("timelineLabel"));
      chapterButtons.forEach(function refreshChapter(button, index) {
        var chapter = CHAPTERS[index];
        button.setAttribute("aria-label", getChapterCopy(chapter, "label"));
        button.children[0].textContent = getChapterCopy(chapter, "index");
        button.children[1].textContent = getChapterCopy(chapter, "label");
        button.children[2].textContent = getChapterCopy(chapter, "time");
      });
      updateActiveChapter(activeIndex);
      setPlayState();
      setSoundState();
      handleDocumentVisibility();
      return;
    }

    teardown();
    buildDesktopCinema();
  }

  function requestInit() {
    if (initFrameId === null) {
      initFrameId = window.requestAnimationFrame(init);
    }
  }

  function bindLifecycle() {
    window.addEventListener("pixkuy:i18n-applied", requestInit);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleDocumentVisibility);

    if (desktopQuery && typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", requestInit);
    } else if (desktopQuery && typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(requestInit);
    }

    if (window.__pixkuyI18nDict) {
      requestInit();
    }
  }

  window.PixkuyInMotionDesktopCinema = {
    refresh: requestInit
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLifecycle, { once: true });
  } else {
    bindLifecycle();
  }
})(window, document);
