/**
 * NOCTIS — Scrollytelling & Interactive Engine
 * Pure Vanilla JavaScript — Zero Frameworks, Zero Libraries, Maximum Performance.
 */

(function () {
  'use strict';

  // State Management
  const state = {
    isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    isFinePointer: window.matchMedia('(pointer: fine)').matches,
    isMobile: window.innerWidth < 768,
    lastScrollY: window.scrollY,
    scrollY: window.scrollY,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,

    // Frames Storage
    heroImages: [],
    dismantleImages: [],
    heroLoadedFlags: [],
    dismantleLoadedFlags: [],

    // Scrollytelling Frame Counters
    hero: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      isStickyActive: false,
      drawRect: { x: 0, y: 0, w: 0, h: 0 },
    },
    dismantle: {
      targetProgress: 0,
      currentProgress: 0,
      targetFrame: 0,
      currentFrame: 0,
      lastDrawnFrame: -1,
      isStickyActive: false,
      drawRect: { x: 0, y: 0, w: 0, h: 0 },
    },

    // Cursor Lerp
    cursor: {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      isHovering: false,
      label: '',
    },

    // Lineup Accordion
    activeSlideIndex: CONFIG.lineup.defaultOpenIndex || 0,
    hoverTimeout: null,
  };

  /* ==========================================================================
     1. UTILITY FUNCTIONS
     ========================================================================== */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  function padNumber(num, length) {
    return String(num).padStart(length, '0');
  }

  function getFramePath(section, index) {
    const isMob = state.isMobile;
    const cfg = CONFIG[section];
    const dir = isMob ? cfg.mobileFramesDir : cfg.desktopFramesDir;
    const fileName = `${cfg.filePrefix}${padNumber(index + 1, cfg.padLength)}${cfg.fileExt}`;
    return `${dir}/${fileName}`;
  }

  /* ==========================================================================
     2. FILM GRAIN CANVAS GENERATOR
     Shifted randomly ~8 times per second (125ms interval), 3-4% opacity
     ========================================================================== */
  function initFilmGrain() {
    const grainCanvas = document.getElementById('film-grain');
    if (!grainCanvas) return;

    const ctx = grainCanvas.getContext('2d');
    const tileSize = 200;

    // Create offscreen noise pattern tile
    const offscreen = document.createElement('canvas');
    offscreen.width = tileSize;
    offscreen.height = tileSize;
    const offCtx = offscreen.getContext('2d');

    const imgData = offCtx.createImageData(tileSize, tileSize);
    const buffer32 = new Uint32Array(imgData.data.buffer);
    const len = buffer32.length;

    // Generate monochrome random noise
    for (let i = 0; i < len; i++) {
      const val = (Math.random() * 255) | 0;
      // RGBA: little-endian format (A, B, G, R)
      buffer32[i] = (255 << 24) | (val << 16) | (val << 8) | val;
    }
    offCtx.putImageData(imgData, 0, 0);

    const pattern = ctx.createPattern(offscreen, 'repeat');

    function resizeGrain() {
      grainCanvas.width = window.innerWidth;
      grainCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeGrain);
    resizeGrain();

    // Random shift ~8 times per second (125ms)
    setInterval(() => {
      ctx.clearRect(0, 0, grainCanvas.width, grainCanvas.height);
      const shiftX = (Math.random() * tileSize) | 0;
      const shiftY = (Math.random() * tileSize) | 0;

      ctx.save();
      ctx.translate(-shiftX, -shiftY);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, grainCanvas.width + tileSize, grainCanvas.height + tileSize);
      ctx.restore();
    }, 125);
  }

  /* ==========================================================================
     3. CUSTOM CURSOR ("THE HEADLIGHT")
     6px solid xenon dot inside 28px ring (1px xenon stroke).
     Morphs into 44x2px light bar with mono label on hover.
     ========================================================================== */
  function initCustomCursor() {
    if (!state.isFinePointer || state.isReducedMotion) return;

    const cursorContainer = document.getElementById('cursor-container');
    const cursorLabel = document.getElementById('cursor-label');
    if (!cursorContainer || !cursorLabel) return;

    window.addEventListener('mousemove', (e) => {
      state.cursor.targetX = e.clientX;
      state.cursor.targetY = e.clientY;
    });

    // Mousedown flash effect (brighter for 120ms)
    window.addEventListener('mousedown', () => {
      cursorContainer.classList.add('is-pressed');
      setTimeout(() => {
        cursorContainer.classList.remove('is-pressed');
      }, 120);
    });

    // Delegate hover detection for links, buttons & interactive elements
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('a, button, [data-cursor], .accordion-slide, .color-swatch');
      if (target) {
        cursorContainer.classList.add('is-hovering');

        // Check if inside lineup accordion slide
        const slide = target.closest('.accordion-slide');
        if (slide) {
          const isOpen = slide.getAttribute('aria-expanded') === 'true';
          cursorLabel.textContent = isOpen ? 'CONFIGURE' : 'OPEN';
        } else {
          const custom = target.getAttribute('data-cursor');
          cursorLabel.textContent = custom || 'VIEW';
        }
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('a, button, [data-cursor], .accordion-slide, .color-swatch');
      if (target) {
        cursorContainer.classList.remove('is-hovering');
        cursorLabel.textContent = '';
      }
    });

    // Smooth cursor movement loop
    function updateCursor() {
      state.cursor.x = lerp(state.cursor.x, state.cursor.targetX, 0.18);
      state.cursor.y = lerp(state.cursor.y, state.cursor.targetY, 0.18);

      cursorContainer.style.transform = `translate3d(${state.cursor.x}px, ${state.cursor.y}px, 0)`;
      requestAnimationFrame(updateCursor);
    }
    requestAnimationFrame(updateCursor);
  }

  /* ==========================================================================
     4. PRELOADER & ASSET LOADING ENGINE
     Priority: Load hero frames 1–40 first, then reveal page.
     Continue background load for remaining hero, then dismantle frames.
     ========================================================================== */
  function initAssetPipeline() {
    const preloader = document.getElementById('preloader');
    const preloaderBar = document.getElementById('preloader-bar');
    const preloaderCounter = document.getElementById('preloader-counter');

    const heroCount = CONFIG.hero.frameCount;
    const dismantleCount = CONFIG.dismantle.frameCount;
    const initialTarget = Math.min(CONFIG.hero.initialPreloadCount, heroCount);

    state.heroImages = new Array(heroCount);
    state.heroLoadedFlags = new Array(heroCount).fill(false);
    state.dismantleImages = new Array(dismantleCount);
    state.dismantleLoadedFlags = new Array(dismantleCount).fill(false);

    let initialLoaded = 0;
    let siteRevealed = false;

    function revealSite() {
      if (siteRevealed) return;
      siteRevealed = true;

      // Finish preloader progress
      preloaderBar.style.width = '100%';
      preloaderCounter.textContent = '100';

      // Flash brighter for 120ms before exit
      preloaderBar.classList.add('is-flashing');
      setTimeout(() => {
        preloader.classList.add('is-hidden');
        // Initial redraw
        requestAnimationFrame(() => {
          renderHeroCanvas(0);
          renderDismantleCanvas(0);
        });
      }, 150);
    }

    function loadSingleFrame(section, index, onLoaded) {
      const img = new Image();
      img.src = getFramePath(section, index);

      if (section === 'hero') {
        state.heroImages[index] = img;
      } else {
        state.dismantleImages[index] = img;
      }

      const markLoaded = () => {
        if (section === 'hero') {
          state.heroLoadedFlags[index] = true;
        } else {
          state.dismantleLoadedFlags[index] = true;
        }
        if (onLoaded) onLoaded();
      };

      if (img.decode) {
        img.decode().then(markLoaded).catch(markLoaded);
      } else {
        img.onload = markLoaded;
        img.onerror = markLoaded;
      }
    }

    // Step 1: Preload Hero frames 1–40
    for (let i = 0; i < initialTarget; i++) {
      loadSingleFrame('hero', i, () => {
        initialLoaded++;
        const pct = Math.min(Math.round((initialLoaded / initialTarget) * 100), 100);
        preloaderBar.style.width = `${pct}%`;
        preloaderCounter.textContent = padNumber(pct, 3);

        if (initialLoaded >= initialTarget) {
          revealSite();
          // Step 2: Begin background loading remaining hero frames, then dismantle
          startBackgroundLoading();
        }
      });
    }

    // Safety fallback: reveal site if network or disk hangs beyond 4s
    setTimeout(revealSite, 4000);

    function startBackgroundLoading() {
      let heroIndex = initialTarget;

      function loadNextHero() {
        if (heroIndex < heroCount) {
          loadSingleFrame('hero', heroIndex, () => {
            heroIndex++;
            loadNextHero();
          });
        } else {
          // Hero done, now load dismantle frames
          loadNextDismantle(0);
        }
      }

      function loadNextDismantle(dIndex) {
        if (dIndex < dismantleCount) {
          loadSingleFrame('dismantle', dIndex, () => {
            loadNextDismantle(dIndex + 1);
          });
        }
      }

      loadNextHero();
    }
  }

  /* ==========================================================================
     5. NAVIGATION CONTROLLER
     Transparent, mix-blend difference, hides on scroll down, shows on scroll up.
     ========================================================================== */
  function initNavigation() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 60 && currentScrollY > state.lastScrollY) {
        // Scrolling down -> hide navbar
        navbar.classList.add('is-hidden');
      } else {
        // Scrolling up -> show navbar
        navbar.classList.remove('is-hidden');
      }

      state.lastScrollY = currentScrollY;
    }, { passive: true });
  }

  /* ==========================================================================
     6. CANVAS DRAWING & FIT CALCULATOR
     Landscape: Cover-fit (immersive cinematic).
     Portrait: Contain-fit vertically centered on --asphalt (#07080A),
               so car is never cropped, with text above and below.
     ========================================================================== */
  function calculateFit(cw, ch, iw, ih, isPortrait) {
    let drawX = 0;
    let drawY = 0;
    let drawW = cw;
    let drawH = ch;

    if (isPortrait) {
      // Contain-fit vertically centered
      const scale = Math.min(cw / iw, ch / ih);
      drawW = iw * scale;
      drawH = ih * scale;
      drawX = (cw - drawW) / 2;
      drawY = (ch - drawH) / 2;
    } else {
      // Cover-fit
      const scale = Math.max(cw / iw, ch / ih);
      drawW = iw * scale;
      drawH = ih * scale;
      drawX = (cw - drawW) / 2;
      drawY = (ch - drawH) / 2;
    }

    return { drawX, drawY, drawW, drawH };
  }

  function getNearestLoadedImage(images, flags, targetIndex) {
    if (flags[targetIndex] && images[targetIndex] && images[targetIndex].naturalWidth > 0) {
      return images[targetIndex];
    }
    // Search backward, then forward for nearest loaded frame
    for (let offset = 1; offset < images.length; offset++) {
      const prev = targetIndex - offset;
      if (prev >= 0 && flags[prev] && images[prev] && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = targetIndex + offset;
      if (next < images.length && flags[next] && images[next] && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  /* ==========================================================================
     7. HERO SECTION SCROLLYTELLING
     - Pinned sticky canvas scrubbing 598 frames
     - Sky chapters text reveal
     - Left HUD velocity & distance metrics
     - Bottom 1px xenon progress line
     - Last 5% fade to solid black
     ========================================================================== */
  function renderHeroCanvas(frameIndex) {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    const img = getNearestLoadedImage(state.heroImages, state.heroLoadedFlags, frameIndex);
    if (!img) return;

    const isPortrait = canvas.width < canvas.height;
    const fit = calculateFit(canvas.width, canvas.height, img.naturalWidth || 1600, img.naturalHeight || 900, isPortrait);

    // Save draw rect for layout/callouts (scaled back to CSS pixels)
    state.hero.drawRect = {
      x: fit.drawX / dpr,
      y: fit.drawY / dpr,
      w: fit.drawW / dpr,
      h: fit.drawH / dpr,
    };

    ctx.fillStyle = CONFIG.tokens.asphalt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, fit.drawX, fit.drawY, fit.drawW, fit.drawH);
  }

  function updateHeroScrollytelling() {
    const wrapper = document.getElementById('hero');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const scrollDistance = wrapper.offsetHeight - window.innerHeight;
    const progress = clamp(-rect.top / Math.max(scrollDistance, 1), 0, 1);

    state.hero.targetProgress = progress;
    state.hero.targetFrame = Math.round(progress * (CONFIG.hero.frameCount - 1));

    // Progress bar update
    const progressBar = document.getElementById('hero-progress-line');
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }

    // Left HUD Metrics
    const speedEl = document.getElementById('hud-speed');
    const distEl = document.getElementById('hud-dist');
    const chapterEl = document.getElementById('hud-chapter');

    if (speedEl) {
      const speed = Math.round(progress * CONFIG.hero.hud.maxSpeed);
      speedEl.textContent = `${padNumber(speed, 3)} KM/H`;
    }
    if (distEl) {
      const dist = (progress * CONFIG.hero.hud.maxDistance).toFixed(1);
      distEl.textContent = `${dist} KM`;
    }

    // Update HUD Chapter indicator cleanly across all scroll ranges
    let activeHudIndex = '01';
    if (progress >= 0.75) {
      activeHudIndex = '04';
    } else if (progress >= 0.45) {
      activeHudIndex = '03';
    } else if (progress >= 0.18) {
      activeHudIndex = '02';
    } else {
      activeHudIndex = '01';
    }

    if (chapterEl) {
      chapterEl.textContent = `${activeHudIndex} / 04`;
    }

    // Sky Text Chapters visibility & line reveals
    const chapters = CONFIG.hero.chapters;
    chapters.forEach((chap, idx) => {
      const el = document.getElementById(`hero-chap-${idx + 1}`);
      if (!el) return;

      const isInside = progress >= chap.range[0] && progress <= chap.range[1];
      if (isInside) {
        el.classList.add('is-visible');
        el.querySelectorAll('.line-mask').forEach(m => m.classList.add('is-active'));
      } else {
        el.classList.remove('is-visible');
        el.querySelectorAll('.line-mask').forEach(m => m.classList.remove('is-active'));
      }
    });

    // Over the last 5% of scroll (0.95 to 1.0), canvas fades to solid black
    const fadeOverlay = document.getElementById('hero-fade-overlay');
    if (fadeOverlay) {
      if (progress >= CONFIG.hero.fadeToBlackStart) {
        const fadeRatio = (progress - CONFIG.hero.fadeToBlackStart) / (1 - CONFIG.hero.fadeToBlackStart);
        fadeOverlay.style.opacity = clamp(fadeRatio, 0, 1);
      } else {
        fadeOverlay.style.opacity = 0;
      }
    }
  }

  /* ==========================================================================
     8. SECTION 2: STATEMENT (WORD-BY-WORD SCROLL ILLUMINATION)
     "Every part was designed to disappear into one line of light."
     Each word illuminates from 15% to 100% opacity as the user scrolls.
     ========================================================================== */
  function initStatementSection() {
    const container = document.getElementById('statement-sentence');
    if (!container) return;

    const sentence = CONFIG.statement.sentence;
    const words = sentence.split(' ');

    container.innerHTML = words
      .map(w => `<span class="statement-word">${w}</span>`)
      .join(' ');
  }

  function updateStatementSection() {
    const section = document.getElementById('statement');
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const windowH = window.innerHeight;

    // Progress when section travels into view
    // Start illuminating when section top is at 85% of viewport
    // Fully illuminated when centered at 25% of viewport
    const start = windowH * 0.85;
    const end = windowH * 0.25;
    const progress = clamp((start - rect.top) / (start - end), 0, 1);

    const wordEls = section.querySelectorAll('.statement-word');
    const totalWords = wordEls.length;
    const activeWordCount = Math.floor(progress * (totalWords + 1));

    wordEls.forEach((el, idx) => {
      if (idx < activeWordCount) {
        el.classList.add('is-illuminated');
      } else {
        el.classList.remove('is-illuminated');
      }
    });
  }

  /* ==========================================================================
     9. SECTION 3: DISMANTLE (PINNED SCROLLYTELLING & CALLOUTS)
     - Pinned sticky canvas scrubbing 200 dismantle frames
     - After 70% progress, 4 technical callouts fade in one by one:
       BODY, LIGHT, DRIVE, BATTERY
     - Positioned relative to the car's bounding box
     ========================================================================== */
  function initDismantleCallouts() {
    const container = document.getElementById('dismantle-callouts');
    if (!container) return;

    container.innerHTML = CONFIG.dismantle.callouts
      .map((c) => `
        <div id="${c.id}" class="dismantle-callout callout-${c.lineDir}" data-x="${c.x}" data-y="${c.y}" data-start="${c.startProgress}">
          <div class="callout-dot"></div>
          <div class="callout-line"></div>
          <div class="callout-info">
            <div class="callout-code font-hud">${c.code}</div>
            <div class="callout-desc font-body">${c.title}</div>
          </div>
        </div>
      `)
      .join('');
  }

  function renderDismantleCanvas(frameIndex) {
    const canvas = document.getElementById('dismantle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }

    const img = getNearestLoadedImage(state.dismantleImages, state.dismantleLoadedFlags, frameIndex);
    if (!img) return;

    const isPortrait = canvas.width < canvas.height;
    const fit = calculateFit(canvas.width, canvas.height, img.naturalWidth || 1600, img.naturalHeight || 900, isPortrait);

    // Save draw rect in CSS pixels
    state.dismantle.drawRect = {
      x: fit.drawX / dpr,
      y: fit.drawY / dpr,
      w: fit.drawW / dpr,
      h: fit.drawH / dpr,
    };

    ctx.fillStyle = CONFIG.tokens.asphalt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, fit.drawX, fit.drawY, fit.drawW, fit.drawH);

    // Reposition callouts based on calculated car image bounds
    updateCalloutPositions();
  }

  function updateCalloutPositions() {
    const callouts = document.querySelectorAll('.dismantle-callout');
    const { x, y, w, h } = state.dismantle.drawRect;
    if (w <= 0 || h <= 0) return;

    callouts.forEach(callout => {
      const pctX = parseFloat(callout.dataset.x) / 100;
      const pctY = parseFloat(callout.dataset.y) / 100;
      const posX = x + pctX * w;
      const posY = y + pctY * h;

      callout.style.left = `${posX}px`;
      callout.style.top = `${posY}px`;
    });
  }

  function updateDismantleScrollytelling() {
    const wrapper = document.getElementById('dismantle');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const scrollDistance = wrapper.offsetHeight - window.innerHeight;
    const progress = clamp(-rect.top / Math.max(scrollDistance, 1), 0, 1);

    state.dismantle.targetProgress = progress;
    state.dismantle.targetFrame = Math.round(progress * (CONFIG.dismantle.frameCount - 1));

    // Progress bar update
    const progressBar = document.getElementById('dismantle-progress-line');
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }

    // Callout visibility after 70% progress
    const callouts = document.querySelectorAll('.dismantle-callout');
    callouts.forEach(callout => {
      const start = parseFloat(callout.dataset.start);
      if (progress >= start) {
        callout.classList.add('is-active');
      } else {
        callout.classList.remove('is-active');
      }
    });
  }

  /* ==========================================================================
     10. SECTION 4: THE LINEUP (HOVER ACCORDION)
     5 vertical slides across full width, 1 slide always open (GT-E by default).
     Debounced hover (80ms), line-by-line staggered reveals, color swatches.
     Full keyboard navigation & ARIA tabs support.
     ========================================================================== */
  function initLineupAccordion() {
    const container = document.getElementById('accordion-wrapper');
    if (!container) return;

    const cars = CONFIG.lineup.cars;

    container.innerHTML = cars
      .map((car, idx) => {
        const isOpen = idx === state.activeSlideIndex;
        const swatchesHtml = car.colors
          .map((col, cIdx) => `
            <button type="button" class="color-swatch ${cIdx === 0 ? 'is-active' : ''}" 
                    style="--swatch-color: ${col.hex}" 
                    data-color-name="${col.name}" 
                    aria-label="Color option: ${col.name}" 
                    data-cursor="COLOR">
            </button>
          `)
          .join('');

        return `
          <button type="button" 
                  class="accordion-slide" 
                  id="lineup-slide-${idx}" 
                  role="tab" 
                  aria-selected="${isOpen}" 
                  aria-expanded="${isOpen}" 
                  aria-controls="lineup-panel-${idx}" 
                  tabindex="0" 
                  data-index="${idx}">
            
            <!-- Closed Slide Presentation (12vw wide) -->
            <div class="slide-closed-content" aria-hidden="true">
              <span class="slide-closed-num font-hud">${car.number}</span>
              <div class="slide-closed-name-wrap">
                <span class="slide-closed-name">${car.name}</span>
              </div>
            </div>

            <!-- Background Car Image Layer -->
            <div class="slide-image-layer">
              <img src="${car.image}" alt="${car.alt}" class="slide-img-closed" loading="lazy">
              <img src="${car.image}" alt="${car.alt}" class="slide-img-open" loading="lazy">
            </div>

            <!-- Open Slide Presentation (52vw wide) -->
            <div class="slide-open-content" id="lineup-panel-${idx}">
              <div class="slide-open-top">
                <span class="slide-open-num font-hud">${car.number} / 05</span>
                <div class="line-mask"><span class="slide-open-name font-display reveal-line">${car.name}</span></div>
              </div>

              <div class="slide-open-bottom">
                <div class="line-mask"><p class="slide-tagline reveal-line">${car.tagline}</p></div>
                
                <div class="slide-specs-row line-mask">
                  <div class="spec-col reveal-line">
                    <span class="spec-label">RANGE</span>
                    <span class="spec-value">${car.range}</span>
                  </div>
                  <div class="spec-col reveal-line">
                    <span class="spec-label">0–100 KM/H</span>
                    <span class="spec-value">${car.accel}</span>
                  </div>
                  <div class="spec-col reveal-line">
                    <span class="spec-label">POWER</span>
                    <span class="spec-value">${car.power}</span>
                  </div>
                </div>

                <div class="slide-action-bar">
                  <div class="color-swatches-wrap">
                    <span class="color-swatches-label font-hud">${car.colors[0].name}</span>
                    <div class="color-swatches-group" role="group" aria-label="Available Finishes">
                      ${swatchesHtml}
                    </div>
                  </div>
                  <a href="#reserve" class="slide-configure-cta" data-cursor="CONFIGURE">
                    <span>Configure →</span>
                  </a>
                </div>
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    const slides = container.querySelectorAll('.accordion-slide');

    function openSlide(index) {
      if (index === state.activeSlideIndex && slides[index].getAttribute('aria-expanded') === 'true') {
        return;
      }
      state.activeSlideIndex = index;

      slides.forEach((slide, sIdx) => {
        const isCurrent = sIdx === index;
        slide.setAttribute('aria-expanded', isCurrent);
        slide.setAttribute('aria-selected', isCurrent);

        const openContent = slide.querySelector('.slide-open-content');
        if (openContent) {
          const masks = openContent.querySelectorAll('.line-mask');
          masks.forEach((mask, mIdx) => {
            if (isCurrent) {
              setTimeout(() => {
                mask.classList.add('is-active');
              }, mIdx * 60); // 0.06s stagger
            } else {
              mask.classList.remove('is-active');
            }
          });
        }
      });
    }

    // Attach interaction handlers
    slides.forEach((slide, idx) => {
      // Hover with 80ms debounce for desktop
      slide.addEventListener('mouseenter', () => {
        if (state.hoverTimeout) clearTimeout(state.hoverTimeout);
        state.hoverTimeout = setTimeout(() => {
          openSlide(idx);
        }, CONFIG.lineup.hoverDebounceMs);
      });

      // Tap / Focus immediately
      slide.addEventListener('click', (e) => {
        if (e.target.closest('.color-swatch') || e.target.closest('.slide-configure-cta')) {
          return; // Let child button handle its event
        }
        openSlide(idx);
      });

      slide.addEventListener('focus', () => {
        openSlide(idx);
      });

      // Keyboard arrow navigation
      slide.addEventListener('keydown', (e) => {
        let newIdx = idx;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          newIdx = (idx + 1) % slides.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          newIdx = (idx - 1 + slides.length) % slides.length;
        } else if (e.key === 'Home') {
          e.preventDefault();
          newIdx = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          newIdx = slides.length - 1;
        }

        if (newIdx !== idx) {
          slides[newIdx].focus();
          openSlide(newIdx);
        }
      });
    });

    // Color Swatch Selection Handler
    container.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      e.stopPropagation();

      const group = swatch.closest('.color-swatches-group');
      group.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-active'));
      swatch.classList.add('is-active');

      const label = group.closest('.color-swatches-wrap')?.querySelector('.color-swatches-label');
      if (label && swatch.dataset.colorName) {
        label.textContent = swatch.dataset.colorName;
      }
    });

    // Initialize line-mask reveals on default open slide
    openSlide(state.activeSlideIndex);

    // Section entrance scroll observer (slides rise 40px with 0.08s stagger)
    const lineupSection = document.getElementById('lineup');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          slides.forEach((slide, i) => {
            setTimeout(() => {
              slide.classList.add('is-entered');
            }, i * 80);
          });
          observer.unobserve(lineupSection);
        }
      });
    }, { threshold: 0.15 });

    observer.observe(lineupSection);
  }

  /* ==========================================================================
     11. SECTION 5: RESERVE MODAL / INTERACTION
     ========================================================================== */
  function initReserveSection() {
    const btnReserve = document.querySelector('.btn-reserve');
    if (!btnReserve) return;

    btnReserve.addEventListener('click', (e) => {
      e.preventDefault();
      alert('NOCTIS 2026 Allocations — Priority reservation window open. Concierge will connect shortly.');
    });
  }

  /* ==========================================================================
     12. MAIN ANIMATION & SCROLL LOOP
     Unified requestAnimationFrame loop:
     current += (target - current) * 0.15
     Redraws only when Math.round(current) changes.
     ========================================================================== */
  function startMainLoop() {
    function tick() {
      // 1. Hero frame lerp & redraw
      state.hero.currentFrame += (state.hero.targetFrame - state.hero.currentFrame) * 0.15;
      const roundedHero = Math.round(state.hero.currentFrame);
      if (roundedHero !== state.hero.lastDrawnFrame) {
        state.hero.lastDrawnFrame = roundedHero;
        renderHeroCanvas(roundedHero);
      }

      // 2. Dismantle frame lerp & redraw
      state.dismantle.currentFrame += (state.dismantle.targetFrame - state.dismantle.currentFrame) * 0.15;
      const roundedDismantle = Math.round(state.dismantle.currentFrame);
      if (roundedDismantle !== state.dismantle.lastDrawnFrame) {
        state.dismantle.lastDrawnFrame = roundedDismantle;
        renderDismantleCanvas(roundedDismantle);
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ==========================================================================
     13. RESIZE & SCROLL EVENT DISPATCHERS
     ========================================================================== */
  function handleScroll() {
    state.scrollY = window.scrollY;
    updateHeroScrollytelling();
    updateStatementSection();
    updateDismantleScrollytelling();
  }

  function handleResize() {
    state.viewportW = window.innerWidth;
    state.viewportH = window.innerHeight;
    state.isMobile = window.innerWidth < 768;

    renderHeroCanvas(Math.round(state.hero.currentFrame));
    renderDismantleCanvas(Math.round(state.dismantle.currentFrame));
    updateCalloutPositions();
  }

  /* ==========================================================================
     14. INITIALIZATION
     ========================================================================== */
  function init() {
    // Apply section heights from config.js
    const heroEl = document.getElementById('hero');
    if (heroEl && CONFIG.hero.wrapperHeight) {
      heroEl.style.height = CONFIG.hero.wrapperHeight;
    }
    const dismantleEl = document.getElementById('dismantle');
    if (dismantleEl && CONFIG.dismantle.wrapperHeight) {
      dismantleEl.style.height = CONFIG.dismantle.wrapperHeight;
    }

    initFilmGrain();
    initCustomCursor();
    initNavigation();
    initStatementSection();
    initDismantleCallouts();
    initLineupAccordion();
    initReserveSection();
    initAssetPipeline();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Initial update
    handleScroll();
    handleResize();

    // Start 60fps smoothing loop
    startMainLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
