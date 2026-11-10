/**
 * NOCTIS — Configuration & Scrollytelling Parameters
 * All tuning values for frame paths, frame counts, section heights,
 * chapter ranges, and dismantle callout positions live here.
 */

const CONFIG = {
  // Global Design Tokens
  tokens: {
    asphalt: '#07080A',
    graphite: '#121418',
    fog: '#8A8F98',
    bone: '#EDEAE4',
    xenon: '#CFE3FF',
    taillight: '#E1251B',
    hairline: 'rgba(237, 234, 228, 0.12)',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },

  // Section 1: Hero Scrollytelling Sequence
  hero: {
    wrapperHeight: '600vh',
    frameCount: 598, // Real verified frame count
    desktopFramesDir: 'assets/frames/hero',
    mobileFramesDir: 'assets/frames/hero-mobile',
    filePrefix: 'frame_',
    fileExt: '.webp',
    padLength: 4, // e.g. frame_0001.webp
    fadeToBlackStart: 0.95, // Last 5% of scroll fades canvas to solid black
    initialPreloadCount: 40, // Preload first 40 frames before revealing site
    hud: {
      maxSpeed: 118, // KM/H
      maxDistance: 4.2, // KM
      totalChapters: 4,
    },
    // Progress thresholds for text chapters
    chapters: [
      {
        id: 'chapter-1',
        range: [0.0, 0.14],
        hudIndex: '01',
        title: 'NOCTIS',
        subtitle: 'The city is asleep.',
        hint: 'SCROLL TO WAKE IT',
      },
      {
        id: 'chapter-2',
        range: [0.22, 0.40],
        hudIndex: '02',
        line: "It doesn’t need the city’s light.",
      },
      {
        id: 'chapter-3',
        range: [0.50, 0.68],
        hudIndex: '03',
        line: 'It brings its own.',
      },
      {
        id: 'chapter-4',
        range: [0.80, 0.98],
        hudIndex: '04',
        model: 'GT-E',
        specs: '0–100 KM/H 3.1S · 640 KM RANGE · DUAL MOTOR',
        cta: 'Discover the GT-E',
        ctaHref: '#lineup',
      },
    ],
  },

  // Section 2: Statement Section (Scroll-driven word illumination)
  statement: {
    label: '02 — ENGINEERING',
    sentence: 'Every part was designed to disappear into one line of light.',
  },

  // Section 3: Dismantle Scrollytelling Sequence
  dismantle: {
    wrapperHeight: '350vh',
    frameCount: 200, // Real verified frame count
    desktopFramesDir: 'assets/frames/dismantle',
    mobileFramesDir: 'assets/frames/dismantle-mobile',
    filePrefix: 'frame_',
    fileExt: '.webp',
    padLength: 4,
    title: 'Look closer.',
    calloutsStart: 0.70, // Callouts begin fading in after 70% scroll progress
    callouts: [
      {
        id: 'callout-body',
        code: 'BODY',
        title: 'Carbon composite monocoque',
        // Percentage coordinates relative to car render box
        x: 52, // % from left
        y: 22, // % from top (lifted roof/monocoque)
        startProgress: 0.72,
        lineDir: 'top-right', // direction of label hairline
      },
      {
        id: 'callout-light',
        code: 'LIGHT',
        title: 'Single-line LED signature',
        x: 17,
        y: 64, // front nose LED strip
        startProgress: 0.79,
        lineDir: 'bottom-left',
      },
      {
        id: 'callout-drive',
        code: 'DRIVE',
        title: 'Dual axial-flux motors, 680 kW',
        x: 31,
        y: 68, // front axle motor unit
        startProgress: 0.86,
        lineDir: 'bottom-left',
      },
      {
        id: 'callout-battery',
        code: 'BATTERY',
        title: '110 kWh structural pack',
        x: 52,
        y: 72, // low structural skateboard pack
        startProgress: 0.93,
        lineDir: 'bottom-right',
      },
    ],
  },

  // Section 4: Lineup Accordion
  lineup: {
    sectionLabel: '03 — THE LINEUP',
    heading: 'Five ways to drive the night.',
    defaultOpenIndex: 0, // GT-E open by default
    hoverDebounceMs: 80,
    cars: [
      {
        id: 'gt-e',
        number: '01',
        name: 'GT-E',
        tagline: 'The grand tourer.',
        range: '640 KM',
        accel: '3.1 S',
        power: '680 KW',
        image: 'assets/cars/gt-e.webp',
        alt: 'NOCTIS GT-E matte graphite electric grand tourer coupe',
        colors: [
          { name: 'Matte Graphite', hex: '#1E2024' },
          { name: 'Satin Carbon', hex: '#121418' },
          { name: 'Obsidian Black', hex: '#07080A' },
          { name: 'Lunar Silver', hex: '#8A8F98' },
        ],
      },
      {
        id: 's',
        number: '02',
        name: 'S',
        tagline: 'Four doors, no compromise.',
        range: '600 KM',
        accel: '3.6 S',
        power: '520 KW',
        image: 'assets/cars/s.webp',
        alt: 'NOCTIS S satin bone white electric sport sedan',
        colors: [
          { name: 'Satin Bone White', hex: '#EDEAE4' },
          { name: 'Slate Grey', hex: '#4A4E57' },
          { name: 'Graphite', hex: '#1E2024' },
          { name: 'Deep Night', hex: '#07080A' },
        ],
      },
      {
        id: 'x',
        number: '03',
        name: 'X',
        tagline: 'Higher, never heavier.',
        range: '560 KM',
        accel: '4.2 S',
        power: '480 KW',
        image: 'assets/cars/x.webp',
        alt: 'NOCTIS X midnight blue performance electric coupe-SUV',
        colors: [
          { name: 'Midnight Blue', hex: '#0D1B2A' },
          { name: 'Shadow Metallic', hex: '#1E2024' },
          { name: 'Satin Bone', hex: '#EDEAE4' },
          { name: 'Obsidian', hex: '#07080A' },
        ],
      },
      {
        id: 'r',
        number: '04',
        name: 'R',
        tagline: 'Built for the track.',
        range: '420 KM',
        accel: '2.4 S',
        power: '900 KW',
        image: 'assets/cars/r.webp',
        alt: 'NOCTIS R track-focused electric coupe in satin black with red aero accents',
        colors: [
          { name: 'Satin Black / Red', hex: '#101010' },
          { name: 'Taillight Crimson', hex: '#E1251B' },
          { name: 'Carbon Ash', hex: '#2B2B2B' },
          { name: 'Pure Asphalt', hex: '#07080A' },
        ],
      },
      {
        id: 'one',
        number: '05',
        name: 'ONE',
        tagline: 'The future, early.',
        range: '780 KM',
        accel: '1.9 S',
        power: 'CONCEPT',
        image: 'assets/cars/one.webp',
        alt: 'NOCTIS ONE liquid silver flagship electric concept hypercar',
        colors: [
          { name: 'Liquid Silver', hex: '#D6DEE8' },
          { name: 'Xenon White', hex: '#CFE3FF' },
          { name: 'Matte Titanium', hex: '#636975' },
          { name: 'Abyss', hex: '#07080A' },
        ],
      },
    ],
  },

  // Section 5: Reserve Section
  reserve: {
    heading: 'Drive the night.',
    body: 'Handcrafted in strictly limited series. Allocations open for 2026 delivery.',
    cta: 'RESERVE YOUR NOCTIS',
  },
};

// Freeze config to prevent unintended modifications
Object.freeze(CONFIG);

