/* assets/js/services/in-motion-scroll-cinema.js
   Pixkuy en movimiento — Scroll-cinema.
   Responsabilidad:
   - insertar un módulo narrativo antes de la galería real
   - controlar vídeo, capítulos, scrub y CTA dinámico
   - activar solo en móvil cuando el fragment i18n del idioma tenga todas las keys requeridas
   - respetar reduced motion
   - no modificar la galería existente
*/

(function initInMotionScrollCinema(window, document) {
  "use strict";

  var MOBILE_QUERY = "(max-width: 720px)";
  var SECTION_SELECTOR = "[data-in-motion-section]";
  var GALLERY_SELECTOR = "[data-in-motion-gallery]";
  var ROOT_ATTR = "data-in-motion-scroll-cinema";
  var BODY_ACTIVE_ATTR = "data-in-motion-scroll-cinema-active";
  var VIDEO_SRC = "assets/video/pixkuy-lego-scroll-cinema.mp4";
  var POSTER_SRC = "assets/video/pixkuy-lego-scroll-cinema-poster.webp";
  var RETURN_CONTEXT_KEY = "pixkuy_in_motion_scroll_cinema_return";

  var CHAPTERS = [
{
  id: "arrival",
  time: 0,
  href: "?service=airport_hotel&airport_direction=airport_to_hotel&return_to=in_motion_scroll_cinema&return_chapter=arrival&return_time=0#services"
},
    {
      id: "driver",
      time: 4.5,
      href: "#fleet"
    },
{
  id: "cityRide",
  time: 10,
  href: "?service=direct_transfer&return_to=in_motion_scroll_cinema&return_chapter=cityRide&return_time=10#services"
},
{
  id: "cdmx",
  time: 18,
  href: "?service=hourly_daily&return_to=in_motion_scroll_cinema&return_chapter=cdmx&return_time=18#services"
},
    {
      id: "teotihuacan",
      time: 23,
      href: "?service=tour_private&tour=teotihuacan&return_to=in_motion_scroll_cinema&return_chapter=teotihuacan&return_time=23#services"
    },
    {
      id: "xochimilco",
      time: 28,
      href: "?service=tour_private&tour=xochimilco_coyoacan&return_to=in_motion_scroll_cinema&return_chapter=xochimilco&return_time=28#services"
    },
    {
      id: "wc2026",
      time: 33.5,
      href: "#wc2026"
    },
{
  id: "returnHome",
  time: 37,
  href: "?service=airport_hotel&airport_direction=hotel_to_airport&return_to=in_motion_scroll_cinema&return_chapter=returnHome&return_time=37#services"
},
{
  id: "final",
  time: 45,
  href: "?service=direct_transfer&return_to=in_motion_scroll_cinema&return_chapter=final&return_time=45#services"
}
  ];

  var mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
  var rootNode = null;
  var videoNode = null;
  var toggleNode = null;
  var titleNode = null;
  var textNode = null;
  var ctaNode = null;
  var chapterButtons = [];
  var observer = null;
  var frameCallbackId = null;
  var activeIndex = 0;
  var isVisible = false;

  function isMobileViewport() {
    return Boolean(mobileQuery && mobileQuery.matches);
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

  function getChapterText(chapter, key) {
    return getI18nValue(
      "inMotionScrollCinema.chapters." + chapter.id + "." + key
    );
  }

  function hasRequiredCopy() {
    return Boolean(
      getI18nValue("inMotionScrollCinema.ariaLabel") &&
        getI18nValue("inMotionScrollCinema.videoLabel") &&
        getI18nValue("inMotionScrollCinema.progressLabel") &&
        getI18nValue("inMotionScrollCinema.play") &&
        getI18nValue("inMotionScrollCinema.pause") &&
        CHAPTERS.every(function hasChapterCopy(chapter) {
          return (
            getChapterText(chapter, "label") &&
            getChapterText(chapter, "title") &&
            getChapterText(chapter, "text") &&
            getChapterText(chapter, "cta")
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

  function setToggleState() {
    if (!toggleNode || !videoNode) {
      return;
    }

    if (videoNode.paused) {
      toggleNode.setAttribute("data-state", "paused");
      toggleNode.setAttribute("aria-label", getI18nValue("inMotionScrollCinema.play"));
      toggleNode.textContent = getI18nValue("inMotionScrollCinema.play");
      return;
    }

    toggleNode.setAttribute("data-state", "playing");
    toggleNode.setAttribute("aria-label", getI18nValue("inMotionScrollCinema.pause"));
    toggleNode.textContent = getI18nValue("inMotionScrollCinema.pause");
  }

  function tryPlayVideo() {
    var promise;

    if (!videoNode || isReducedMotion()) {
      return;
    }

    promise = videoNode.play();

    if (promise && typeof promise.catch === "function") {
      promise.catch(function ignoreAutoplayFailure() {
        setToggleState();
      });
    }
  }

  function pauseVideo() {
    if (!videoNode) {
      return;
    }

    videoNode.pause();
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

  function updateActiveChapter(index) {
    var chapter = CHAPTERS[index];

    activeIndex = index;

    chapterButtons.forEach(function updateButton(button, buttonIndex) {
      button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
    });

    if (titleNode) {
      titleNode.textContent = getChapterText(chapter, "title");
    }

    if (textNode) {
      textNode.textContent = getChapterText(chapter, "text");
    }

    if (ctaNode) {
      ctaNode.href = chapter.href;
      ctaNode.textContent = getChapterText(chapter, "cta");
    }
  }

  function withViewTransition(updateFn) {
    if (
      document.startViewTransition &&
      !isReducedMotion() &&
      typeof updateFn === "function"
    ) {
      document.startViewTransition(updateFn);
      return;
    }

    updateFn();
  }

  function activateChapter(index, shouldSeek) {
    var chapter = CHAPTERS[index];

    if (!chapter || !videoNode) {
      return;
    }

    withViewTransition(function updateChapterState() {
      updateActiveChapter(index);

      if (shouldSeek) {
        videoNode.currentTime = chapter.time;
      }
    });

    if (shouldSeek && isVisible && !isReducedMotion()) {
      tryPlayVideo();
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
  }

  function requestFrameSync() {
    if (!videoNode || !isVisible || frameCallbackId !== null) {
      return;
    }

    if (typeof videoNode.requestVideoFrameCallback === "function") {
      frameCallbackId = videoNode.requestVideoFrameCallback(function onVideoFrame() {
        frameCallbackId = null;
        syncChapterFromVideoTime();
        requestFrameSync();
      });
      return;
    }

    syncChapterFromVideoTime();
  }

  function cancelFrameSync() {
    if (
      videoNode &&
      typeof videoNode.cancelVideoFrameCallback === "function" &&
      frameCallbackId !== null
    ) {
      videoNode.cancelVideoFrameCallback(frameCallbackId);
    }

    frameCallbackId = null;
  }

  function handleVisibility(entries) {
    var entry = entries && entries[0];

    if (!entry) {
      return;
    }

    isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;

    document.body.setAttribute(BODY_ACTIVE_ATTR, isVisible ? "true" : "false");

    if (isVisible) {
      requestFrameSync();
      tryPlayVideo();
      return;
    }

    cancelFrameSync();
    pauseVideo();
  }

  function setupObserver() {
    if (!rootNode || !window.IntersectionObserver) {
      return;
    }

    observer = new IntersectionObserver(handleVisibility, {
      threshold: [0, 0.35, 0.65]
    });

    observer.observe(rootNode);
  }

  function teardownObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = null;
    isVisible = false;
    document.body.removeAttribute(BODY_ACTIVE_ATTR);
    cancelFrameSync();
  }

  function buildChapterButton(chapter, index) {
    var listItem = createNode("li", "in-motion-scroll-cinema__scrub-item");
    var button = createNode("button", "in-motion-scroll-cinema__chapter");
    var label = createNode("span", "in-motion-scroll-cinema__chapter-label");
    var dot = createNode("span", "in-motion-scroll-cinema__chapter-dot");

    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", getChapterText(chapter, "label"));

    label.textContent = getChapterText(chapter, "label");
    dot.setAttribute("aria-hidden", "true");

    button.appendChild(label);
    button.appendChild(dot);

    button.addEventListener("click", function onChapterClick() {
      activateChapter(index, true);
    });

    listItem.appendChild(button);
    chapterButtons.push(button);

    return listItem;
  }

  function buildScrollCinema() {
    var section = document.querySelector(SECTION_SELECTOR);
    var gallery = document.querySelector(GALLERY_SELECTOR);
    var frame = createNode("div", "in-motion-scroll-cinema__frame");
    var shade = createNode("div", "in-motion-scroll-cinema__shade");
    var scrub = createNode("ol", "in-motion-scroll-cinema__scrub");
    var panel = createNode("div", "in-motion-scroll-cinema__panel");
    var copy = createNode("div", "in-motion-scroll-cinema__copy");

    if (!section || !gallery) {
      return null;
    }

    rootNode = createNode("div", "in-motion-scroll-cinema");
    rootNode.setAttribute(ROOT_ATTR, "1");
    rootNode.setAttribute("aria-label", getI18nValue("inMotionScrollCinema.ariaLabel"));

    videoNode = document.createElement("video");
    videoNode.className = "in-motion-scroll-cinema__video";
    videoNode.src = VIDEO_SRC;
    videoNode.poster = POSTER_SRC;
    videoNode.muted = true;
    videoNode.loop = true;
    videoNode.playsInline = true;
    videoNode.preload = "metadata";
    videoNode.setAttribute("aria-label", getI18nValue("inMotionScrollCinema.videoLabel"));

    scrub.setAttribute("aria-label", getI18nValue("inMotionScrollCinema.progressLabel"));

    chapterButtons = [];
    CHAPTERS.forEach(function appendChapter(chapter, index) {
      scrub.appendChild(buildChapterButton(chapter, index));
    });

    titleNode = createNode("h3", "in-motion-scroll-cinema__title");
    textNode = createNode("p", "in-motion-scroll-cinema__text");
    ctaNode = createNode("a", "in-motion-scroll-cinema__cta");

    toggleNode = createNode("button", "in-motion-scroll-cinema__toggle");
    toggleNode.type = "button";

    copy.appendChild(titleNode);
    copy.appendChild(textNode);
    copy.appendChild(ctaNode);

    panel.appendChild(copy);
    panel.appendChild(toggleNode);

    frame.appendChild(videoNode);
    frame.appendChild(shade);
    frame.appendChild(scrub);
    frame.appendChild(panel);

    rootNode.appendChild(frame);

    gallery.parentNode.insertBefore(rootNode, gallery);

    videoNode.addEventListener("play", setToggleState);
    videoNode.addEventListener("pause", setToggleState);
    videoNode.addEventListener("timeupdate", syncChapterFromVideoTime);

    toggleNode.addEventListener("click", function onToggleClick() {
      if (!videoNode) {
        return;
      }

      if (videoNode.paused) {
        tryPlayVideo();
        return;
      }

      pauseVideo();
    });
	
	    ctaNode.addEventListener("click", function onCtaClick(event) {
      var chapter = CHAPTERS[activeIndex] || CHAPTERS[0];

      writeReturnContext(chapter);

      if (openMobileRouteFromChapter(chapter)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    updateActiveChapter(0);
    setToggleState();
    setupObserver();

    return rootNode;
  }

  function teardown() {
    teardownObserver();

    if (videoNode) {
      pauseVideo();
      videoNode.removeAttribute("src");
      videoNode.load();
    }

    if (rootNode && rootNode.parentNode) {
      rootNode.parentNode.removeChild(rootNode);
    }

    rootNode = null;
    videoNode = null;
    toggleNode = null;
    titleNode = null;
    textNode = null;
    ctaNode = null;
    chapterButtons = [];
    activeIndex = 0;
  }

  function shouldRender() {
    return isMobileViewport() && hasRequiredCopy();
  }

  function init() {
    teardown();

    if (!shouldRender()) {
      return;
    }

    buildScrollCinema();
  }

  function requestInit() {
    window.requestAnimationFrame(init);
  }

  function bindLifecycle() {
    window.addEventListener("pixkuy:i18n-applied", requestInit);
    window.addEventListener("pageshow", requestInit);

    if (mobileQuery && typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", requestInit);
    } else if (mobileQuery && typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(requestInit);
    }

    if (window.__pixkuyI18nDict) {
      requestInit();
    }
  }

  function getChapterIndexById(chapterId) {
    var safeChapterId = typeof chapterId === "string" ? chapterId.trim() : "";
    var index;

    if (!safeChapterId) {
      return -1;
    }

    for (index = 0; index < CHAPTERS.length; index += 1) {
      if (CHAPTERS[index].id === safeChapterId) {
        return index;
      }
    }

    return -1;
  }

  function getScrollTopForChapter(target, chapterIndex) {
    var rect;
    var maxScrollable;
    var safeIndex = chapterIndex >= 0 ? chapterIndex : 0;
    var progress;

    if (!target || typeof target.getBoundingClientRect !== "function") {
      return window.scrollY || 0;
    }

    rect = target.getBoundingClientRect();
    maxScrollable = Math.max(0, target.offsetHeight - window.innerHeight);

    if (CHAPTERS.length <= 1 || maxScrollable <= 0) {
      return (window.scrollY || 0) + rect.top;
    }

    progress = safeIndex / (CHAPTERS.length - 1);

    return (window.scrollY || 0) + rect.top + (maxScrollable * progress);
  }

  function seekVideoToTime(time) {
    var safeTime = Number.isFinite(Number(time)) ? Number(time) : 0;

    if (!videoNode) {
      return false;
    }

    if (videoNode.readyState >= 1) {
      videoNode.currentTime = safeTime;
      return true;
    }

    videoNode.addEventListener("loadedmetadata", function onLoadedMetadata() {
      videoNode.currentTime = safeTime;
    }, { once: true });

    return true;
  }
  
    function writeReturnContext(chapter) {
    var safeChapter = chapter && typeof chapter === "object"
      ? chapter
      : CHAPTERS[activeIndex] || CHAPTERS[0];

    try {
      window.sessionStorage.setItem(
        RETURN_CONTEXT_KEY,
        JSON.stringify({
          chapter: safeChapter.id,
          time: videoNode ? videoNode.currentTime : safeChapter.time,
          scrollY: window.scrollY || 0
        })
      );
    } catch (error) {}
  }

  function readReturnContext() {
    try {
      var raw = window.sessionStorage.getItem(RETURN_CONTEXT_KEY);

      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function clearReturnContext() {
    try {
      window.sessionStorage.removeItem(RETURN_CONTEXT_KEY);
    } catch (error) {}
  }
  
    function getChapterService(chapter) {
    var href = chapter && chapter.href ? String(chapter.href) : "";

    try {
      return new URL(href, window.location.href).searchParams.get("service") || "";
    } catch (error) {
      return "";
    }
  }

  function getMobileRouteApiForService(service) {
    var safeService = typeof service === "string" ? service.trim() : "";

    if (safeService === "direct_transfer") {
      return window.PixkuyDirectTransferMobileBookingFlow;
    }

    if (safeService === "hourly_daily") {
      return window.PixkuyHourlyMobileBookingFlow;
    }

    if (safeService === "tour_private") {
      return window.PixkuyToursMobileBookingFlow;
    }

    if (safeService === "airport_hotel") {
      return window.PixkuyAirportMobileBookingFlow;
    }

    return null;
  }

  function getMobileRouteStateKeyForService(service) {
    var safeService = typeof service === "string" ? service.trim() : "";

    if (safeService === "direct_transfer") {
      return "directTransferMobileRoute";
    }

    if (safeService === "hourly_daily") {
      return "hourlyMobileRoute";
    }

    if (safeService === "tour_private") {
      return "toursMobileRoute";
    }

    if (safeService === "airport_hotel") {
      return "airportMobileRoute";
    }

    return "";
  }

  function isSupportedMobileRouteService(service) {
    return (
      service === "direct_transfer" ||
      service === "hourly_daily" ||
      service === "tour_private" ||
      service === "airport_hotel"
    );
  }

  function openMobileRouteFromChapter(chapter) {
    var service = getChapterService(chapter);
    var api = getMobileRouteApiForService(service);
    var routeStateKey = getMobileRouteStateKeyForService(service);
    var historyState;
    var url;

    if (!isMobileViewport() || !isSupportedMobileRouteService(service)) {
      return false;
    }

    writeReturnContext(chapter);

    try {
      url = new URL(chapter.href, window.location.href);
      url.searchParams.set("service", service);
      url.searchParams.set("return_to", "in_motion_scroll_cinema");
      url.searchParams.set("return_chapter", chapter.id);
      url.searchParams.set("return_time", String(chapter.time));
      url.hash = "";

      historyState = {
        inMotionScrollCinema: true,
        returnChapter: chapter.id,
        returnTime: chapter.time
      };

      if (routeStateKey) {
        historyState[routeStateKey] = true;
      }

      window.history.pushState(
        historyState,
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {}

    if (api && typeof api.open === "function") {
      api.open();
      return true;
    }

    window.requestAnimationFrame(function retryOpenMobileRoute() {
      var nextApi = getMobileRouteApiForService(service);

      if (nextApi && typeof nextApi.open === "function") {
        nextApi.open();
      }
    });

    return true;
  }

  function returnToChapter(context) {
    var storedContext = readReturnContext();
    var safeContext = storedContext || (context && typeof context === "object" ? context : {});
    var chapterIndex = getChapterIndexById(safeContext.chapter);
    var chapter = chapterIndex >= 0 ? CHAPTERS[chapterIndex] : CHAPTERS[0];
    var time = Number.isFinite(Number(safeContext.time))
      ? Number(safeContext.time)
      : chapter.time;
    var target = rootNode || document.querySelector("[data-in-motion-scroll-cinema]") || document.querySelector("#pixkuy-in-motion");
    var scrollTop = Number.isFinite(Number(safeContext.scrollY))
      ? Number(safeContext.scrollY)
      : getScrollTopForChapter(target, chapterIndex);

    if (!target) {
      return false;
    }

    window.scrollTo({
      top: scrollTop,
      behavior: "auto"
    });

    if (chapterIndex >= 0) {
      updateActiveChapter(chapterIndex);
    }

    seekVideoToTime(time);

    window.requestAnimationFrame(function syncReturnedChapter() {
      if (chapterIndex >= 0) {
        updateActiveChapter(chapterIndex);
      }

      seekVideoToTime(time);
      clearReturnContext();
    });

    return true;
  }

  window.PixkuyInMotionScrollCinema = {
    returnTo: returnToChapter
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLifecycle, { once: true });
  } else {
    bindLifecycle();
  }
})(window, document);