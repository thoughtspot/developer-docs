(() => {
    /*
     * Radiance Language renderer - v2.
     *
     * One file for every Radiance surface: the five templates (right-wash,
     * left-wash, neutral, top-wash, bottom-wash) and the fixed product
     * patterns (signup, home, spotterx, liveboard). v1 is frozen at
     * renderer/v1/radiance-renderer.js for reference and comparison.
     *
     * v2 carries the system-level upgrades first built for SpotterX and
     * Liveboard (see RULES.md and CHANGELOG.md):
     *   F1 film    Built on Home's first-launch film: grain that reaches
     *              through faint colour, a fine second noise layer, and a
     *              gentle tone lift - all confined to the colour field
     *              (GRAIN-4), so the bare surface stays clean.
     *   F2 motion  Organic drift: every orbit, size, stretch and tilt is 2-3
     *              sines at incommensurate per-blob frequencies, and every blob
     *              breathes on its own rhythm (MOTION-2).
     *   F3 blend   Clean blends: overlapping colours are wheel neighbours
     *              (mint - blue - violet - pink - peach); peach and mint stay
     *              compact accents (COLOR-5).
     *   Base       A surface sits on its host's own background colour, per
     *              theme (data-radiance-base / --radiance-base, SURFACE-1).
     */
    const RADIANCE_VERSION = "2.0.0";
    const LIGHT_SURFACE = "#ffffff";
    const DARK_SURFACE = "#1a1b1e";
    const RADIANCE_FILM_GRAIN_SIZE = 1.0;
    const MAX_DPR = 2;
    const TIME_ORIGIN_KEY = "radianceLanguageTimeOrigin";
    const MAX_TEXTURE_CACHE_ITEMS = 24;
    const TAU = Math.PI * 2;
    // GRAIN-4: how hard the colour field is stacked before it masks the film.
    // 12 brings the film to ~80% by 12% colour and ~93% by 20% - the texture
    // carries through faint colour the way Home's hero does - while the bare
    // surface (under ~0.5% colour) keeps under ~6% of it. v1 used 4.
    const GRAIN_MASK_SATURATION = 12;
    // The mask is the blurred colour field, so it is smooth: it is built at a
    // quarter of the canvas resolution and upscaled. The film stays full-res.
    const MASK_SCALE = 0.25;
    // F1 - the film stack per theme (built on Home's hero, as SpotterX and
    // Liveboard carry it): grain strength, the dark dither, the fine noise layer
    // and its blend, and the tone lift. The renderer draws all of it, masked to
    // the colour field - consumers still add no CSS filter (BLEND-3). This is
    // the language's one film per theme: every surface, template or product,
    // draws exactly this grain (GRAIN-6). Light is at 1.0's full strength and
    // dark at 0.76, so the grain still reads where the colour is subtle (the
    // admin's 2.0 review).
    const FILM = {
        light: { grain: 1, dither: 0, overlay: 0.22, overlayBlend: "multiply", saturate: 1.16, contrast: 1.06 },
        dark: { grain: 0.76, dither: 0.42 * 0.76, overlay: 0.27, overlayBlend: "screen", saturate: 1.2, contrast: 1.08 }
    };
    // The fine noise layer: SVG fractal noise rendered by the browser at the
    // surface's pixel density and tiled every 56 CSS px - the same layer
    // Home's hero draws over its canvas.
    const FILM_OVERLAY_TILE = 56;
    const FILM_OVERLAY_SVG = {
        light: "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='1.48' numOctaves='3' seed='21' stitchTiles='stitch'/><feComponentTransfer><feFuncR type='linear' slope='1.58' intercept='-0.18'/><feFuncG type='linear' slope='1.22' intercept='-0.12'/><feFuncB type='linear' slope='1.5' intercept='-0.16'/><feFuncA type='linear' slope='0.64'/></feComponentTransfer></filter><rect width='56' height='56' filter='url(#n)'/></svg>",
        dark: "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='1.48' numOctaves='3' seed='21' stitchTiles='stitch'/><feComponentTransfer><feFuncR type='linear' slope='1.64' intercept='-0.2'/><feFuncG type='linear' slope='1.14' intercept='-0.1'/><feFuncB type='linear' slope='1.58' intercept='-0.18'/><feFuncA type='linear' slope='0.7'/></feComponentTransfer></filter><rect width='56' height='56' filter='url(#n)'/></svg>"
    };
    // F2 - every blob breathes: size and brightness swell a few per cent on the
    // blob's own rhythm (ms at speed 1; the tempo follows the square root of the
    // speed, so a fast pattern breathes a little quicker, never frantically).
    const BREATH = { size: 0.05, glow: 0.05, periodMs: [5000, 8000] };

    // Percentage adjustments. 100% is always the pattern's shipped value, so a
    // surface that sets none of these is byte-identical to one that sets 100%.
    // Ranges are what the language still reads as itself; outside them the
    // renderer warns (RULES.md ADJUST-2).
    const ADJUST_RANGES = {
        prominence: { min: 0.5, max: 1.5, rule: "ADJUST-3" },
        spread: { min: 0.75, max: 1.25, rule: "ADJUST-4" },
        speed: { min: 0.5, max: 1.5, rule: "ADJUST-5" }
    };

    // Accepts "120%", "120" or "1.2" — all mean the same thing.
    function parseAdjustment(raw) {
        if (raw === undefined || raw === null || raw === "") return 1;
        const text = String(raw).trim();
        const value = Number(text.replace("%", "").trim());
        if (!Number.isFinite(value) || value <= 0) return 1;
        if (text.includes("%") || value > 5) return value / 100;
        return value;
    }

    // ------------------------------------------------------------------
    // Named patterns. These five are the only sanctioned entry points into
    // the language; every Radiance surface starts from one of them.
    // Canonical values are mirrored in radiance.tokens.json — change both or
    // neither. See RULES.md (PLACE-1, MOTION-6).
    // ------------------------------------------------------------------
    const RADIANCE_PATTERNS = {
        "right-wash": { layout: "right-wash", speeds: { slow: 0.62, fast: 1.02 } },
        "left-wash": { layout: "left-wash", speeds: { slow: 0.62, fast: 1.02 } },
        "neutral": { layout: "neutral", speeds: { slow: 0.86, fast: 1.34 } },
        "top-wash": { layout: "top-wash", speeds: { slow: 0.92, fast: 1.72 } },
        "bottom-wash": { layout: "bottom-wash", speeds: { slow: 0.92, fast: 1.72 } }
    };

    const PLACEMENT_ALIASES = {
        right: "right-wash",
        left: "left-wash",
        top: "top-wash",
        bottom: "bottom-wash",
        neutral: "neutral",
        modal: "neutral",
        developer: "neutral"
    };

    // Shorthand fallbacks are the product-safe values, not the legacy
    // attribute defaults. Agents still spell the full four-part name out.
    const PATTERN_FALLBACKS = { intensity: "subtle", motion: "dynamic", speed: "slow" };

    // ------------------------------------------------------------------
    // Product patterns (RULES.md section 12). Fixed, admin-owned patterns for
    // ThoughtSpot's finished product screens. They take no adjustment, no
    // override and no base colour from the page: every value is locked here,
    // and only the Radiance admin changes them, in this repository.
    //   "template" products are a locked template configuration;
    //   "spotter" products run the Spotter radiance engine (below).
    // Mirrored in radiance.tokens.json and products/manifest.json.
    // ------------------------------------------------------------------
    const PRODUCT_PATTERNS = {
        signup: {
            name: "Sign up",
            engine: "template",
            layout: "right-wash",
            intensity: "prominent",
            speed: { light: 1.02, dark: 1.02 },
            seed: "signin-v2",
            film: "renderer",
            // Under reduced motion Sign up shows right-wash's curated static
            // frame, as the product always has (MOTION-7).
            reducedMotion: "static",
            base: { light: "#ffffff", dark: "#1a1b1e" }
        },
        home: {
            name: "Home page",
            engine: "template",
            layout: "top-wash",
            intensity: "subtle",
            speed: { light: 1.86, dark: 1.72 },
            seed: "home-hero",
            // Home's page recipe carries the fine noise and the tone lift
            // (products/home/radiance-home.css); the renderer draws the grain over
            // the whole hero field, as Home was built. Home's colour sits at the
            // hero's strength (76% light / 66% dark over the base), drawn here so
            // the grain on top is the language's one grain at full value (GRAIN-6).
            film: "page",
            fieldOpacity: { light: 0.76, dark: 0.66 },
            base: { light: "#ffffff", dark: "#131416" }
        },
        spotterx: {
            name: "SpotterX",
            engine: "spotter",
            // The page recipe (products/<id>/radiance-<id>.css) carries the film.
            film: "recipe",
            base: { light: "#ffffff", dark: "#131416" }
        },
        liveboard: {
            name: "Liveboard",
            engine: "spotter",
            // The page recipe (products/<id>/radiance-<id>.css) carries the film.
            film: "recipe",
            base: { light: "#ffffff", dark: "#131416" }
        }
    };
    // data-radiance-state on a spotter product: [reasoning energy, after-answer calm].
    const PRODUCT_STATES = { idle: [0, 0], reasoning: [1, 0], answered: [0, 1] };
    // Everything a product pattern ignores (PRODUCT-2).
    const PRODUCT_LOCKED_ATTRIBUTES = [
        ["radianceProminence", "data-radiance-prominence"],
        ["radianceSpread", "data-radiance-spread"],
        ["radianceSpeedScale", "data-radiance-speed-scale"],
        ["radianceSpeed", "data-radiance-speed"],
        ["radianceBase", "data-radiance-base"],
        ["radianceIntensity", "data-radiance-intensity"],
        ["radianceLayout", "data-radiance-layout"],
        ["radianceVariant", "data-radiance-variant"],
        ["radianceMotion", "data-radiance-motion"],
        ["radianceDarkGlow", "data-radiance-dark-glow"],
        ["radianceSeed", "data-radiance-seed"]
    ];
    // The Spotter engine's locked tuning: the values SpotterX and Liveboard ship.
    const SBG_TUNING = { gain: 1, lift: 0, spread: 1, wash: 1, flow: 2.5, breath: 1, calmGain: 1.5, pace: 1 };
    // The Radiance admin's Spotter lab (spotter-lab/) previews other values on
    // one surface through RadianceLanguageRenderer.admin; nothing else sets them.
    const ADMIN_SPOTTER = new WeakMap();

    /*
     * The Spotter radiance engine - product patterns "spotterx" and "liveboard"
     * (formerly the RADIANCE-OVERRIDE proposal "Spotter radiance BG" v5).
     * Radiance blobs gathered along the product's top bar, spilling soft light
     * below it - drifting organically at rest, breathing while reasoning, and
     * retreating to a faint leak at the top after an answer:
     *
     *  - Blobs: ~6.4 across the view (radius 1.6 spacings, hanging 2x taller
     *    than wide), drifting across the width so no colour owns a region. The
     *    colour sequence is a random walk along the wheel (see SBG_PATH), so
     *    neighbours are wheel-neighbours and overlaps stay clean tints; a blob
     *    that wraps off-screen is reborn, so the sequence never recurs.
     *  - Motion that never loops (MOTION-2): every blob's position, size,
     *    stretch and tilt is a sum of 2-3 sines at incommensurate per-blob
     *    frequencies, on top of a drift whose own speed swells and eases.
     *  - Breathing: every blob breathes - swells and brightens - on its own
     *    random rhythm, so many regions inhale and exhale out of step, never in
     *    one spot. Barely there at rest; while reasoning the swings deepen and
     *    quicken (1.8-3.4s), the whole glow breathes along (3.2s, starting
     *    exhaled at ignition), and a second stream of light flows the other way
     *    along the edge, taking the colour of the light beneath it - so the
     *    crossings brighten colours instead of muddying them.
     *  - States: ONE surface; data-radiance-state = idle | reasoning | answered
     *    (reasoning energy, and the calm after an answer). Both ease
     *    on critically damped springs; the clock is INTEGRATED (clock += dt *
     *    speed), so every speed change is live and phase-continuous. Clock rate
     *    per unit of Motion energy (2.5 by default): default 1.15 (2.88),
     *    reasoning 1.7 (4.25), after an answer 0.32 (0.8 - a slow, visible
     *    drift).
     *  - After an answer the colour drops to a faint leak (x0.5) and the blobs
     *    rise behind the bar; the page contracts its CSS fade toward the top, so
     *    colour and grain retreat together.
     *  - Shape: the vertical fade is the wrapper's CSS mask (the page builds it
     *    from the rig), exactly as on Home - colour, grain and overlay fade
     *    together. The renderer adds only reasoning's extra brightness, confined
     *    to the top band: reasoning never brings colour further down.
     *  - Grain: the language's one grain per theme (FILM, GRAIN-6), over the
     *    whole lit canvas, under the page's CSS fine noise and tone filter.
     *  - Rendering: blobs at quarter resolution with the canonical blur
     *    (BLEND-2, scaled), padded past every edge so the blur never darkens an
     *    edge, upscaled onto a dpr-1 canvas shown pixelated, so the 1.0px grain
     *    stays crisp (GRAIN-1/3).
     *
     * Sanctioned product exceptions (RULES.md PRODUCT-3): state-bound energy
     * (MOTION-1), an integrated per-surface clock (MOTION-4), speeds above 2.0
     * (MOTION-5), per-load randomness (IMPL-4), and the page-level film in
     * products/<name>/radiance-<name>.css (GRAIN-4/5, BLEND-3). Everything is
     * locked: the values below are the only ones these products ever run.
     */
    const SBG_PALETTE = {
        light: { pink: [255, 120, 160], violet: [140, 100, 255], blue: [40, 140, 255], peach: [255, 180, 100], mint: [80, 220, 180] },
        dark: { pink: [255, 93, 142], violet: [138, 93, 255], blue: [39, 140, 255], peach: [255, 180, 90], mint: [45, 220, 177] }
    };
    /* The colour sequence is a random walk with momentum along the wheel -
       mint, blue, violet, pink, peach - so neighbours are always
       wheel-neighbours (blue never meets peach, pink never meets mint: every
       blend a clean tint). Cool colour always leads (COLOR-4): the walk heads
       into peach only 40% of the time it reaches pink, must pass back through
       violet before any second peach, never runs more than 3-4 warm blobs,
       and after a warm run stays cool for at least two - so every six-blob
       screenful holds at least two blues/violets and nothing ever sits warm
       (the yellow-red cast pink + peach makes in dark). A blob that wraps
       off-screen is reborn with the next step of the walk and fresh size,
       timing and shape, so the sequence never recurs. Long-run balance
       (simulated over 1M steps): blue 29%, violet 35%, pink 24%, peach 7%
       (warmth), mint 5% (quiet support). */
    const SBG_PATH = ["mint", "blue", "violet", "pink", "peach"];
    /* Peach and mint stay compact accents so their glow never reaches a hue
       two steps away (peach + violet = mauve, the muddiest blend). */
    const SBG_ROLE = { blue: 1.04, violet: 0.84, pink: 0.92, peach: 0.85, mint: 0.5 };
    const SBG_SIZE = { blue: 1.05, violet: 0.96, pink: 0.98, peach: 0.84, mint: 0.78 };
    /* Blob centre opacity at rest and while reasoning (before the page's
       saturate/contrast filter, which carries dark a little further); `calm`
       is the after-answer leak as a fraction of rest (x the rig's After-answer
       intensity, 1.5 by default).
       `floor` is what reasoning keeps below its bright top band; light's rest
       was raised on its own, so its reasoning keeps the earlier floor and
       reads exactly as before. */
    const SBG_STATES = {
        // 2.0: reasoning +15% (0.235 -> 0.27, floor 0.14 -> 0.155), calm +10% (0.5 -> 0.55).
        light: { rest: 0.165, reason: 0.27, calm: 0.55, floor: 0.155 },
        dark: { rest: 0.12, reason: 0.28, calm: 0.5, floor: 0.12 }
    };
    const SBG_MOTION = {
        speedDefault: 1.15,  // clock rate per unit of Motion energy (x2.5 = 2.88)
        speedReason: 1.7,    // x2.5 = 4.25
        speedSettled: 0.32,  // x2.5 = 0.8 - the calm after an answer: a slow, visible drift
        speedCap: 8,
        flow: 0.016,         // drift, px per clock-ms: ~46 px/s default, ~68 reasoning, ~13 calm
        wanderReason: 0.6,   // blobs wander 1.6x as far while reasoning
        /* Each blob breathes on its own rhythm (ms, random per blob in these
           ranges) with these size / brightness swings - rest, reasoning, calm. */
        breathMs: { rest: [5000, 8000], reason: [1800, 3400], calm: [5500, 8500] },
        breathSize: { rest: 0.05, reason: 0.22, calm: 0.06 },
        breathGlow: { rest: 0.05, reason: 0.2, calm: 0.06 },
        /* While reasoning the whole glow breathes along ... */
        chorusMs: 3200,
        chorusSize: 0.06,
        chorusGlow: 0.08,
        /* ... and a stream of light flows the other way along the edge. */
        streamFlow: -1.6,
        streamGlow: 0.7,
        rise: 3.6,           // spring rates (rad/s): ~1.1s into reasoning,
        fall: 1.45,          // ~2.7s back out,
        settle: 1.3          // ~3s between the default and the after-answer calm
    };
    const SBG_CALM_RISE = 0.1;   // after an answer the blobs rise behind the bar (x radius)
    /* The fade (mirrored by the page's CSS mask builder): a short fall - the
       edge light, "spread" - plus a long faint tail - "wash coverage". The
       reasoning gain lives only in the top `band` px. */
    const SBG_ENVELOPE = { spread: 70, wash: 320, tail: 0.45, band: 80 };
    const SBG_TALL = 2.0;
    const SBG_BASE_LIFT = -8;
    const SBG_BLUR = { light: 40, dark: 64 };
    const SBG_SCALE = 0.25;
    const SBG_PAD = 96;


    const warnedElements = new WeakMap();

    function warnOnce(element, code, message) {
        let codes = warnedElements.get(element);
        if (!codes) {
            codes = new Set();
            warnedElements.set(element, codes);
        }
        if (codes.has(code)) return;
        codes.add(code);
        console.warn(`[Radiance ${code}] ${message}`);
    }

    function resolveRadiancePattern(raw) {
        const tokens = String(raw || "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
        if (!tokens.length) return null;

        let layout = null;
        for (const token of tokens) {
            if (PLACEMENT_ALIASES[token]) {
                layout = PLACEMENT_ALIASES[token];
                break;
            }
        }
        if (!layout) return null;

        const has = (token) => tokens.includes(token);
        const intensity = has("prominent") ? "prominent" : (has("subtle") ? "subtle" : PATTERN_FALLBACKS.intensity);
        const motion = (has("static") || has("still")) ? "static" : PATTERN_FALLBACKS.motion;
        const speedName = has("fast") ? "fast" : (has("slow") ? "slow" : PATTERN_FALLBACKS.speed);
        const appearance = has("dark") ? "dark" : (has("light") ? "light" : null);

        return {
            name: `${layout}-${intensity}-${motion}-${speedName}`,
            layout,
            intensity,
            motion,
            speedName,
            speed: RADIANCE_PATTERNS[layout].speeds[speedName],
            appearance
        };
    }

    const reducedMotionQuery = typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let prefersReducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;

    const LIGHT_BLOBS = [
        { anchorX: 0.9, anchorY: 0.4, color: [255, 120, 160], radius: 0.4, opacity: 0.6, orbitX: 60, orbitY: 80, freqX: 0.0007, freqY: 0.0005, stretchFreq: 0.001 },
        { anchorX: 0.85, anchorY: 0.7, color: [80, 220, 180], radius: 0.36, opacity: 0.32, orbitX: -70, orbitY: -90, freqX: 0.0008, freqY: 0.0006, stretchFreq: 0.0012 },
        { anchorX: 0.95, anchorY: 0.5, color: [140, 100, 255], radius: 0.45, opacity: 0.6, orbitX: 50, orbitY: 100, freqX: 0.0005, freqY: 0.0009, stretchFreq: 0.0008 },
        { anchorX: 0.75, anchorY: 0.3, color: [255, 180, 100], radius: 0.3, opacity: 0.6, orbitX: -60, orbitY: 120, freqX: 0.0009, freqY: 0.0007, stretchFreq: 0.0015 },
        { anchorX: 0.8, anchorY: 0.6, color: [40, 140, 255], radius: 0.4, opacity: 0.6, orbitX: 90, orbitY: -80, freqX: 0.0008, freqY: 0.0011, stretchFreq: 0.0009 },
        { anchorX: 0.3, anchorY: 0.3, color: [200, 220, 255], radius: 0.7, opacity: 0.15, orbitX: 100, orbitY: 50, freqX: 0.0003, freqY: 0.0004, stretchFreq: 0.0005 },
        { anchorX: 0.2, anchorY: 0.7, color: [255, 200, 220], radius: 0.8, opacity: 0.15, orbitX: -80, orbitY: -100, freqX: 0.0004, freqY: 0.0003, stretchFreq: 0.0006 },
        { anchorX: 0.5, anchorY: 0.6, color: [255, 240, 180], radius: 0.6, opacity: 0.15, orbitX: 120, orbitY: -60, freqX: 0.0005, freqY: 0.0004, stretchFreq: 0.0007 }
    ];

    function scaleBlobSet(blobs, opacityScale, orbitScale) {
        return blobs.map((blob) => ({
            ...blob,
            opacity: blob.opacity * opacityScale,
            orbitX: (blob.orbitX || 0) * orbitScale,
            orbitY: (blob.orbitY || 0) * orbitScale
        }));
    }

    function mirrorBlobSet(blobs) {
        return blobs.map((blob) => ({
            ...blob,
            anchorX: 1 - blob.anchorX,
            orbitX: -(blob.orbitX || 0)
        }));
    }

    function topBlobSet(blobs) {
        return blobs.map((blob) => ({
            ...blob,
            anchorX: clamp(blob.anchorY, 0.08, 0.94),
            anchorY: clamp(1 - blob.anchorX, -0.04, 0.34),
            orbitX: (blob.orbitY || 0) * 1.18,
            orbitY: -(blob.orbitX || 0) * 0.58,
            radius: blob.radius * 1.06
        }));
    }

    function bottomBlobSet(blobs) {
        return topBlobSet(blobs).map((blob) => ({
            ...blob,
            anchorY: 1 - blob.anchorY,
            orbitY: -(blob.orbitY || 0)
        }));
    }

    function lockBlobSet(blobs) {
        return blobs.map((blob) => ({
            ...blob,
            orbitX: 0,
            orbitY: 0,
            freqX: 0,
            freqY: 0,
            stretchFreq: 0,
            locked: true
        }));
    }

    function neutralBlobSet(blobs) {
        return blobs.map((blob) => ({
            ...blob,
            surfaceScaled: true
        }));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    const mix = (a, b, t) => a + (b - a) * t;
    const wave = (phase) => 0.5 - 0.5 * Math.cos(phase);

    // SURFACE-1: a base colour is any opaque CSS colour. Parsed once through a
    // canvas, so every syntax the browser accepts works.
    const colourCache = new Map();
    let colourProbe = null;

    function parseColour(value) {
        const text = String(value || "").trim();
        if (!text) return null;
        if (colourCache.has(text)) return colourCache.get(text);
        colourProbe = colourProbe || document.createElement("canvas").getContext("2d");
        let rgb = null;
        for (const sentinel of ["#010203", "#fefdfc"]) {
            colourProbe.fillStyle = sentinel;
            colourProbe.fillStyle = text;
            const normal = String(colourProbe.fillStyle);
            if (normal === sentinel) continue;
            if (normal.startsWith("#")) {
                rgb = [1, 3, 5].map((i) => parseInt(normal.slice(i, i + 2), 16));
            } else {
                const parts = (normal.match(/rgba?\(([^)]+)\)/) || [])[1];
                const values = parts ? parts.split(",").map((part) => Number(part.trim())) : [];
                if (values.length >= 3 && (values.length < 4 || values[3] >= 0.99)) rgb = values.slice(0, 3).map(Math.round);
            }
            break;
        }
        if (!rgb && text.toLowerCase() === "#010203") rgb = [1, 2, 3];
        colourCache.set(text, rgb);
        return rgb;
    }

    function hashSeed(value) {
        let hash = 2166136261;

        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }

    function createSeededRandom(seed) {
        let state = hashSeed(seed) || 1;

        return () => {
            state += 0x6d2b79f5;
            let result = state;
            result = Math.imul(result ^ (result >>> 15), result | 1);
            result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
            return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
        };
    }

    function getAnimationTimeOrigin() {
        const now = Date.now();

        try {
            const storedOrigin = Number(window.sessionStorage.getItem(TIME_ORIGIN_KEY));
            if (Number.isFinite(storedOrigin) && storedOrigin > 0) return storedOrigin;

            window.sessionStorage.setItem(TIME_ORIGIN_KEY, String(now));
        } catch {
            return now;
        }

        return now;
    }

    function getBlobSurfaceScale(config, width, height) {
        if (!config.surfaceScaled) return { radius: 1, orbitX: 1, orbitY: 1 };

        const minSide = Math.max(1, Math.min(width, height));
        const maxSide = Math.max(width, height);
        const aspect = maxSide / minSide;
        const compactBoost = clamp((480 - minSide) / 280, 0, 1);
        const fieldBoost = clamp((maxSide - 760) / 720, 0, 1);

        return {
            radius: 1.06 + clamp(aspect - 1, 0, 1.1) * 0.13 + compactBoost * 0.14 + fieldBoost * 0.05,
            orbitX: clamp(width / 920, 0.28, 1.38),
            orbitY: clamp(height / 680, 0.28, 1.38)
        };
    }

    const LIGHT_SUBTLE_BLOBS = scaleBlobSet(LIGHT_BLOBS, 0.44, 0.62);

    const STATIC_LIGHT_BLOBS = [
        { anchorX: 1.02, anchorY: 0.14, color: [255, 120, 160], radius: 0.48, opacity: 0.58, locked: true },
        { anchorX: 0.96, anchorY: 0.42, color: [140, 100, 255], radius: 0.54, opacity: 0.6, locked: true },
        { anchorX: 0.8, anchorY: 0.62, color: [40, 140, 255], radius: 0.54, opacity: 0.58, locked: true },
        { anchorX: 0.78, anchorY: 0.28, color: [255, 180, 100], radius: 0.36, opacity: 0.44, locked: true },
        { anchorX: 1.02, anchorY: 0.82, color: [80, 220, 180], radius: 0.38, opacity: 0.1, locked: true },
        { anchorX: 0.34, anchorY: 0.34, color: [200, 220, 255], radius: 0.76, opacity: 0.1, locked: true },
        { anchorX: 0.2, anchorY: 0.74, color: [255, 200, 220], radius: 0.84, opacity: 0.075, locked: true },
        { anchorX: 0.52, anchorY: 0.62, color: [255, 240, 180], radius: 0.62, opacity: 0.075, locked: true }
    ];

    const STATIC_LIGHT_SUBTLE_BLOBS = scaleBlobSet(STATIC_LIGHT_BLOBS, 0.48, 1);

    const NEUTRAL_LIGHT_BLOBS = neutralBlobSet([
        { anchorX: 0.12, anchorY: 0.12, color: [255, 180, 100], radius: 0.39, opacity: 0.34, orbitX: 90, orbitY: 68, freqX: 0.00072, freqY: 0.00056, stretchFreq: 0.00108 },
        { anchorX: 0.28, anchorY: 0.28, color: [255, 120, 160], radius: 0.46, opacity: 0.5, orbitX: -118, orbitY: 84, freqX: 0.00086, freqY: 0.00068, stretchFreq: 0.00118 },
        { anchorX: 0.14, anchorY: 0.78, color: [40, 140, 255], radius: 0.54, opacity: 0.56, orbitX: 126, orbitY: -110, freqX: 0.00074, freqY: 0.00092, stretchFreq: 0.00102 },
        { anchorX: 0.44, anchorY: 0.18, color: [140, 100, 255], radius: 0.45, opacity: 0.48, orbitX: 106, orbitY: 92, freqX: 0.00064, freqY: 0.00086, stretchFreq: 0.00112 },
        { anchorX: 0.68, anchorY: 0.32, color: [40, 140, 255], radius: 0.49, opacity: 0.54, orbitX: 108, orbitY: -92, freqX: 0.00084, freqY: 0.00064, stretchFreq: 0.00114 },
        { anchorX: 0.84, anchorY: 0.18, color: [255, 120, 160], radius: 0.42, opacity: 0.45, orbitX: -98, orbitY: 98, freqX: 0.00078, freqY: 0.00088, stretchFreq: 0.00106 },
        { anchorX: 0.88, anchorY: 0.62, color: [140, 100, 255], radius: 0.56, opacity: 0.58, orbitX: -122, orbitY: -104, freqX: 0.00058, freqY: 0.00094, stretchFreq: 0.00098 },
        { anchorX: 0.68, anchorY: 0.86, color: [40, 140, 255], radius: 0.54, opacity: 0.54, orbitX: 108, orbitY: -110, freqX: 0.0009, freqY: 0.00072, stretchFreq: 0.0012 },
        { anchorX: 0.36, anchorY: 0.84, color: [255, 120, 160], radius: 0.42, opacity: 0.38, orbitX: 98, orbitY: -88, freqX: 0.0007, freqY: 0.00082, stretchFreq: 0.00104 },
        { anchorX: 0.48, anchorY: 0.48, color: [80, 220, 180], radius: 0.3, opacity: 0.04, orbitX: 78, orbitY: -72, freqX: 0.00068, freqY: 0.00072, stretchFreq: 0.00092 }
    ]);

    const NEUTRAL_LIGHT_SUBTLE_BLOBS = scaleBlobSet(NEUTRAL_LIGHT_BLOBS, 0.52, 0.86);
    const STATIC_NEUTRAL_LIGHT_BLOBS = lockBlobSet(NEUTRAL_LIGHT_BLOBS);
    const STATIC_NEUTRAL_LIGHT_SUBTLE_BLOBS = lockBlobSet(NEUTRAL_LIGHT_SUBTLE_BLOBS);

    const DARK_SUBTLE_BLOBS = [
        { anchorX: 0.9, anchorY: 0.4, color: [255, 93, 142], radius: 0.42, opacity: 0.34, orbitX: 60, orbitY: 80, freqX: 0.0007, freqY: 0.0005, stretchFreq: 0.001 },
        { anchorX: 0.86, anchorY: 0.72, color: [45, 220, 177], radius: 0.38, opacity: 0.12, orbitX: -70, orbitY: -90, freqX: 0.0008, freqY: 0.0006, stretchFreq: 0.0012 },
        { anchorX: 0.95, anchorY: 0.5, color: [138, 93, 255], radius: 0.48, opacity: 0.36, orbitX: 50, orbitY: 100, freqX: 0.0005, freqY: 0.0009, stretchFreq: 0.0008 },
        { anchorX: 0.74, anchorY: 0.3, color: [255, 180, 90], radius: 0.29, opacity: 0.2, orbitX: -60, orbitY: 120, freqX: 0.0009, freqY: 0.0007, stretchFreq: 0.0015 },
        { anchorX: 0.8, anchorY: 0.62, color: [39, 140, 255], radius: 0.42, opacity: 0.32, orbitX: 90, orbitY: -80, freqX: 0.0008, freqY: 0.0011, stretchFreq: 0.0009 },
        { anchorX: 0.3, anchorY: 0.3, color: [160, 196, 255], radius: 0.62, opacity: 0.055, orbitX: 100, orbitY: 50, freqX: 0.0003, freqY: 0.0004, stretchFreq: 0.0005 },
        { anchorX: 0.2, anchorY: 0.72, color: [255, 170, 210], radius: 0.66, opacity: 0.055, orbitX: -80, orbitY: -100, freqX: 0.0004, freqY: 0.0003, stretchFreq: 0.0006 },
        { anchorX: 0.5, anchorY: 0.6, color: [255, 232, 150], radius: 0.52, opacity: 0.045, orbitX: 120, orbitY: -60, freqX: 0.0005, freqY: 0.0004, stretchFreq: 0.0007 }
    ];

    const DARK_PROMINENT_BLOBS = [
        { anchorX: 0.9, anchorY: 0.4, color: [255, 93, 142], radius: 0.46, opacity: 0.44, orbitX: 60, orbitY: 80, freqX: 0.0007, freqY: 0.0005, stretchFreq: 0.001 },
        { anchorX: 0.86, anchorY: 0.72, color: [45, 220, 177], radius: 0.42, opacity: 0.18, orbitX: -70, orbitY: -90, freqX: 0.0008, freqY: 0.0006, stretchFreq: 0.0012 },
        { anchorX: 0.95, anchorY: 0.5, color: [138, 93, 255], radius: 0.52, opacity: 0.46, orbitX: 50, orbitY: 100, freqX: 0.0005, freqY: 0.0009, stretchFreq: 0.0008 },
        { anchorX: 0.74, anchorY: 0.3, color: [255, 180, 90], radius: 0.32, opacity: 0.28, orbitX: -60, orbitY: 120, freqX: 0.0009, freqY: 0.0007, stretchFreq: 0.0015 },
        { anchorX: 0.8, anchorY: 0.62, color: [39, 140, 255], radius: 0.46, opacity: 0.42, orbitX: 90, orbitY: -80, freqX: 0.0008, freqY: 0.0011, stretchFreq: 0.0009 },
        { anchorX: 0.3, anchorY: 0.3, color: [160, 196, 255], radius: 0.78, opacity: 0.12, orbitX: 100, orbitY: 50, freqX: 0.0003, freqY: 0.0004, stretchFreq: 0.0005 },
        { anchorX: 0.2, anchorY: 0.72, color: [255, 170, 210], radius: 0.82, opacity: 0.12, orbitX: -80, orbitY: -100, freqX: 0.0004, freqY: 0.0003, stretchFreq: 0.0006 },
        { anchorX: 0.5, anchorY: 0.6, color: [255, 232, 150], radius: 0.64, opacity: 0.1, orbitX: 120, orbitY: -60, freqX: 0.0005, freqY: 0.0004, stretchFreq: 0.0007 }
    ];

    const STATIC_DARK_PROMINENT_BLOBS = [
        { anchorX: 1.02, anchorY: 0.14, color: [255, 93, 142], radius: 0.5, opacity: 0.42, locked: true },
        { anchorX: 0.96, anchorY: 0.44, color: [138, 93, 255], radius: 0.56, opacity: 0.46, locked: true },
        { anchorX: 0.8, anchorY: 0.64, color: [39, 140, 255], radius: 0.56, opacity: 0.42, locked: true },
        { anchorX: 0.76, anchorY: 0.28, color: [255, 180, 90], radius: 0.36, opacity: 0.24, locked: true },
        { anchorX: 1.02, anchorY: 0.84, color: [45, 220, 177], radius: 0.38, opacity: 0.07, locked: true },
        { anchorX: 0.34, anchorY: 0.34, color: [160, 196, 255], radius: 0.76, opacity: 0.08, locked: true },
        { anchorX: 0.2, anchorY: 0.74, color: [255, 170, 210], radius: 0.82, opacity: 0.075, locked: true },
        { anchorX: 0.52, anchorY: 0.62, color: [255, 232, 150], radius: 0.62, opacity: 0.055, locked: true }
    ];

    const STATIC_DARK_SUBTLE_BLOBS = scaleBlobSet(STATIC_DARK_PROMINENT_BLOBS, 0.54, 1);

    const NEUTRAL_DARK_PROMINENT_BLOBS = neutralBlobSet([
        { anchorX: 0.12, anchorY: 0.12, color: [255, 180, 90], radius: 0.39, opacity: 0.22, orbitX: 90, orbitY: 68, freqX: 0.00072, freqY: 0.00056, stretchFreq: 0.00108 },
        { anchorX: 0.28, anchorY: 0.28, color: [255, 93, 142], radius: 0.46, opacity: 0.36, orbitX: -118, orbitY: 84, freqX: 0.00086, freqY: 0.00068, stretchFreq: 0.00118 },
        { anchorX: 0.14, anchorY: 0.78, color: [39, 140, 255], radius: 0.54, opacity: 0.4, orbitX: 126, orbitY: -110, freqX: 0.00074, freqY: 0.00092, stretchFreq: 0.00102 },
        { anchorX: 0.44, anchorY: 0.18, color: [138, 93, 255], radius: 0.45, opacity: 0.36, orbitX: 106, orbitY: 92, freqX: 0.00064, freqY: 0.00086, stretchFreq: 0.00112 },
        { anchorX: 0.68, anchorY: 0.32, color: [39, 140, 255], radius: 0.49, opacity: 0.38, orbitX: 108, orbitY: -92, freqX: 0.00084, freqY: 0.00064, stretchFreq: 0.00114 },
        { anchorX: 0.84, anchorY: 0.18, color: [255, 93, 142], radius: 0.42, opacity: 0.32, orbitX: -98, orbitY: 98, freqX: 0.00078, freqY: 0.00088, stretchFreq: 0.00106 },
        { anchorX: 0.88, anchorY: 0.62, color: [138, 93, 255], radius: 0.56, opacity: 0.42, orbitX: -122, orbitY: -104, freqX: 0.00058, freqY: 0.00094, stretchFreq: 0.00098 },
        { anchorX: 0.68, anchorY: 0.86, color: [39, 140, 255], radius: 0.54, opacity: 0.4, orbitX: 108, orbitY: -110, freqX: 0.0009, freqY: 0.00072, stretchFreq: 0.0012 },
        { anchorX: 0.36, anchorY: 0.84, color: [255, 93, 142], radius: 0.42, opacity: 0.28, orbitX: 98, orbitY: -88, freqX: 0.0007, freqY: 0.00082, stretchFreq: 0.00104 },
        { anchorX: 0.48, anchorY: 0.48, color: [45, 220, 177], radius: 0.3, opacity: 0.024, orbitX: 78, orbitY: -72, freqX: 0.00068, freqY: 0.00072, stretchFreq: 0.00092 }
    ]);

    const NEUTRAL_DARK_SUBTLE_BLOBS = scaleBlobSet(NEUTRAL_DARK_PROMINENT_BLOBS, 0.52, 0.86);
    const STATIC_NEUTRAL_DARK_PROMINENT_BLOBS = lockBlobSet(NEUTRAL_DARK_PROMINENT_BLOBS);
    const STATIC_NEUTRAL_DARK_SUBTLE_BLOBS = lockBlobSet(NEUTRAL_DARK_SUBTLE_BLOBS);

    const NEUTRAL_VEIL_BLOBS = [
        { anchorX: 0.08, anchorY: 0.18, radius: 0.56, opacity: 0.28, orbitX: 52, orbitY: 44, freqX: 0.00048, freqY: 0.0004, phase: 0.32 },
        { anchorX: 0.52, anchorY: 0.08, radius: 0.48, opacity: 0.2, orbitX: -56, orbitY: 38, freqX: 0.00038, freqY: 0.00046, phase: 1.18 },
        { anchorX: 0.94, anchorY: 0.26, radius: 0.54, opacity: 0.24, orbitX: -48, orbitY: 54, freqX: 0.00044, freqY: 0.00036, phase: 2.42 },
        { anchorX: 0.22, anchorY: 0.82, radius: 0.6, opacity: 0.22, orbitX: 62, orbitY: -46, freqX: 0.00034, freqY: 0.00042, phase: 3.36 },
        { anchorX: 0.74, anchorY: 0.78, radius: 0.58, opacity: 0.24, orbitX: -64, orbitY: -52, freqX: 0.00042, freqY: 0.00038, phase: 4.72 },
        { anchorX: 0.48, anchorY: 0.5, radius: 0.72, opacity: 0.16, orbitX: 46, orbitY: -42, freqX: 0.0003, freqY: 0.00034, phase: 5.58 }
    ];

    const surfaces = new Set();
    const surfaceByElement = new WeakMap();
    const textureCache = new Map();
    const timeOrigin = getAnimationTimeOrigin();
    let isDocumentVisible = document.visibilityState !== "hidden";
    let mutationObserver;
    let raf = 0;

    function getTimelineTime() {
        return Math.max(0, Date.now() - timeOrigin);
    }

    function rememberTexture(key, texture) {
        if (textureCache.has(key)) return textureCache.get(key);
        textureCache.set(key, texture);

        if (textureCache.size > MAX_TEXTURE_CACHE_ITEMS) {
            const oldestKey = textureCache.keys().next().value;
            textureCache.delete(oldestKey);
        }

        return texture;
    }

    class RadianceBlob {
        constructor(config, random) {
            this.config = config;
            this.phaseX = random() * Math.PI * 2;
            this.phaseY = random() * Math.PI * 2;
            this.phaseStretch = random() * Math.PI * 2;
            this.phaseDrift = random() * Math.PI * 2;
            // F2: the extra sines' ratios and phases, a slow tilt, and the blob's
            // own breath - all seeded (IMPL-4), so a surface is stable on reload.
            this.phases = Array.from({ length: 8 }, () => random() * TAU);
            this.ratios = [
                1.52 + random() * 0.2,
                2.3 + random() * 0.3,
                1.6 + random() * 0.3,
                1.4 + random() * 0.3,
                1.5 + random() * 0.3,
                1.5 + random() * 0.3,
                1.6 + random() * 0.3
            ];
            this.tiltFreq = 0.00022 + random() * 0.00022;
            this.breathMs = BREATH.periodMs[0] + random() * (BREATH.periodMs[1] - BREATH.periodMs[0]);
            this.breathPhase = random() * TAU;
            this.x = 0;
            this.y = 0;
            this.r = 0;
            this.stretchX = 1;
            this.stretchY = 1;
            this.tilt = 0;
            this.hasState = false;
        }

        update(t, width, height, mouse, breathT = 0) {
            const config = this.config;
            const baseX = width * config.anchorX;
            const baseY = height * config.anchorY;
            const minSide = Math.min(width, height);
            const surfaceScale = getBlobSurfaceScale(config, width, height);
            const baseRadius = minSide * config.radius * surfaceScale.radius;

            if (config.locked) {
                this.x = baseX;
                this.y = baseY;
                this.r = baseRadius;
                this.stretchX = 1;
                this.stretchY = 1;
                this.tilt = 0;
                this.opacity = config.opacity;
                this.hasState = true;
                return;
            }

            const freqX = config.freqX || 0.00022;
            const freqY = config.freqY || 0.00022;
            const stretchFreq = config.stretchFreq || 0.00032;
            let targetX;
            let targetY;
            let targetR;
            let targetStretchX;
            let targetStretchY;

            // F2 (MOTION-2): each motion is 2-3 sines at incommensurate per-blob
            // ratios - the same reach as v1's single sines, but a path that
            // never retraces - and the blob breathes on its own rhythm.
            const p = this.phases;
            const k = this.ratios;
            const orbitX = (config.orbitX || 0) * surfaceScale.orbitX;
            const orbitY = (config.orbitY || 0) * surfaceScale.orbitY;
            const breath = wave(TAU * breathT / this.breathMs + this.breathPhase);
            targetX = baseX + orbitX * (
                0.72 * Math.sin(t * freqX + this.phaseX)
                + 0.2 * Math.sin(t * freqX * k[0] + p[0])
                + 0.08 * Math.sin(t * freqX * k[1] + p[1]));
            targetY = baseY + orbitY * (
                0.78 * Math.cos(t * freqY + this.phaseY)
                + 0.22 * Math.sin(t * freqY * k[2] + p[2]));
            targetR = baseRadius
                * (1 + 0.1 * Math.sin(t * 0.001 + this.phaseX) + 0.05 * Math.sin(t * 0.001 * k[3] + p[3]))
                * (1 + BREATH.size * (breath - 0.4));
            targetStretchX = 1 + 0.3 * (0.72 * Math.sin(t * stretchFreq + this.phaseX) + 0.28 * Math.sin(t * stretchFreq * k[4] + p[4]));
            targetStretchY = 1 + 0.3 * (0.72 * Math.cos(t * stretchFreq + this.phaseY) + 0.28 * Math.sin(t * stretchFreq * k[5] + p[5]));
            this.tilt = 0.16 * Math.sin(t * this.tiltFreq + p[6]) + 0.08 * Math.sin(t * this.tiltFreq * k[6] + p[7]);
            this.opacity = config.opacity * (1 + BREATH.glow * (breath - 0.5));

            const ease = 1;
            this.x += (targetX - this.x) * ease;
            this.y += (targetY - this.y) * ease;
            this.r += (targetR - this.r) * ease;
            this.stretchX += (targetStretchX - this.stretchX) * ease;
            this.stretchY += (targetStretchY - this.stretchY) * ease;
            this.hasState = true;
        }

        draw(ctx) {
            const [r, g, b] = this.config.color;
            const opacity = this.opacity ?? this.config.opacity;
            ctx.save();
            ctx.translate(this.x, this.y);
            if (this.tilt) ctx.rotate(this.tilt);
            ctx.scale(this.stretchX, this.stretchY);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
            gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
            gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class RadianceSurface {
        constructor(element) {
            this.element = element;
            this.canvas = document.createElement("canvas");
            this.ctx = this.canvas.getContext("2d", { alpha: false });
            this.mouse = { x: -9999, y: -9999 };
            this.width = 0;
            this.height = 0;
            this.dpr = 1;
            this.textureKey = "";
            this.ready = false;
            this.isInViewport = true;
            this.needsResize = true;
            this.staticFrameKey = "";
            this.blobCanvas = document.createElement("canvas");
            this.blobCtx = this.blobCanvas.getContext("2d");
            this.fieldCanvas = document.createElement("canvas");
            this.fieldCtx = this.fieldCanvas.getContext("2d");
            this.grainCanvas = document.createElement("canvas");
            this.grainMaskCtx = this.grainCanvas.getContext("2d");
            this.maskCanvas = document.createElement("canvas");
            this.maskCtx = this.maskCanvas.getContext("2d");
            this.liftCanvas = document.createElement("canvas");
            this.liftCtx = this.liftCanvas.getContext("2d");
            this.blobs = [];
            this.lastConfigKey = "";
            this.appliedPatternSource = null;
            this.product = null;
            this.productName = "";
            this.cssBase = "";
            this.baseKey = "";
            this.baseRgb = [255, 255, 255];
            this.baseFill = LIGHT_SURFACE;
            this.element.appendChild(this.canvas);
            this.element.dataset.radianceReady = "false";

            if ("ResizeObserver" in window) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.needsResize = true;
                });
                this.resizeObserver.observe(this.element);
            }

            if ("IntersectionObserver" in window) {
                this.intersectionObserver = new IntersectionObserver((entries) => {
                    this.isInViewport = entries.some((entry) => entry.isIntersecting);
                    if (this.isInViewport) startLoop();
                });
                this.intersectionObserver.observe(this.element);
            }
        }

        destroy() {
            this.resizeObserver?.disconnect();
            this.intersectionObserver?.disconnect();
            this.canvas.remove();
        }

        get appearance() {
            return this.element.dataset.radianceAppearance === "dark" ? "dark" : "light";
        }

        // A template product pattern (signup, home), or null.
        get productTemplate() {
            return this.product && this.product.engine === "template" ? this.product : null;
        }

        get isSpotter() {
            return Boolean(this.product && this.product.engine === "spotter");
        }

        get speed() {
            const product = this.productTemplate;
            if (product) return product.speed[this.appearance];
            const value = Number(this.element.dataset.radianceSpeed || "1");
            const base = Number.isFinite(value) ? value : 1;
            return base * this.adjustment("speed", this.element.dataset.radianceSpeedScale);
        }

        // ADJUST-1: every adjustment is a percentage of the pattern's own value,
        // never an absolute. 100% means "exactly what the pattern ships".
        adjustment(kind, raw) {
            const scale = parseAdjustment(raw);
            const range = ADJUST_RANGES[kind];
            if (range && (scale < range.min || scale > range.max)) {
                warnOnce(
                    this.element,
                    range.rule,
                    `${kind} adjusted to ${Math.round(scale * 100)}% — the Radiance range is `
                    + `${Math.round(range.min * 100)}%-${Math.round(range.max * 100)}%. `
                    + "Outside it this surface stops matching the rest of the product. See RULES.md."
                );
            }
            return scale;
        }

        get prominenceScale() {
            if (this.product) return 1;
            return this.adjustment("prominence", this.element.dataset.radianceProminence);
        }

        get spreadScale() {
            if (this.product) return 1;
            return this.adjustment("spread", this.element.dataset.radianceSpread);
        }

        get variant() {
            const product = this.productTemplate;
            if (product) {
                const motion = prefersReducedMotion && product.reducedMotion === "static" ? "static" : "dynamic";
                return `${motion}-${product.intensity}`;
            }
            return this.element.dataset.radianceVariant || "";
        }

        get darkGlow() {
            const product = this.productTemplate;
            if (product) return product.intensity;
            return this.element.dataset.radianceDarkGlow || "subtle";
        }

        get seed() {
            const product = this.productTemplate;
            if (product) return product.seed;
            return this.element.dataset.radianceSeed || "";
        }

        // "renderer": the v2 film stack (F1). "page": the product's own page
        // recipe carries the film; the renderer draws plain full-surface grain.
        get filmMode() {
            const product = this.productTemplate;
            return product ? product.film : "renderer";
        }

        get layout() {
            const product = this.productTemplate;
            if (product) return product.layout;
            const layout = this.element.dataset.radianceLayout || "right-wash";
            if (layout === "left" || layout === "left-wash") return "left-wash";
            if (layout === "top" || layout === "top-wash") return "top-wash";
            if (layout === "bottom" || layout === "bottom-wash") return "bottom-wash";
            if (layout === "neutral" || layout === "home-corners" || layout === "modal-balanced" || layout === "developer-sides") return "neutral";
            return "right-wash";
        }

        get isSubtle() {
            const product = this.productTemplate;
            if (product) return product.intensity === "subtle";
            return this.variant.endsWith("subtle") || this.element.dataset.radianceIntensity === "subtle";
        }

        get isDark() {
            return this.appearance === "dark";
        }

        get isStill() {
            // MOTION-7: a reduced-motion request freezes the surface at its
            // resting frame. Same pattern, same composition, no drift.
            if (prefersReducedMotion) return true;
            if (this.product) return false;
            return this.element.dataset.radianceMotion === "still" || this.variant.startsWith("static");
        }

        applyPatternShorthand() {
            const raw = (this.element.dataset.radiancePattern || "").trim();
            if (raw === this.appliedPatternSource) {
                if (this.product) this.guardProduct();
                return;
            }
            this.appliedPatternSource = raw;

            // PRODUCT-1: a product name selects that product's fixed pattern.
            const productKey = raw.toLowerCase();
            if (Object.prototype.hasOwnProperty.call(PRODUCT_PATTERNS, productKey)) {
                this.product = PRODUCT_PATTERNS[productKey];
                this.productName = productKey;
                this.needsResize = true;
                this.lastConfigKey = "";
                this.staticFrameKey = "";
                this.baseKey = "";
                this.guardProduct();
                return;
            }
            if (this.product) {
                this.product = null;
                this.productName = "";
                this.needsResize = true;
                this.lastConfigKey = "";
                this.baseKey = "";
            }
            if (!raw) return;

            const pattern = resolveRadiancePattern(raw);
            if (!pattern) {
                warnOnce(
                    this.element,
                    "PLACE-1",
                    `Unknown pattern "${raw}". Templates are: ${Object.keys(RADIANCE_PATTERNS).join(", ")}; `
                    + `product patterns are: ${Object.keys(PRODUCT_PATTERNS).join(", ")}. `
                    + "Keeping the data-radiance-* attributes already on this element."
                );
                return;
            }

            const data = this.element.dataset;
            data.radianceLayout = pattern.layout;
            data.radianceIntensity = pattern.intensity;
            data.radianceDarkGlow = pattern.intensity;
            data.radianceVariant = `${pattern.motion}-${pattern.intensity}`;
            data.radianceSpeed = String(pattern.speed);
            if (pattern.appearance) data.radianceAppearance = pattern.appearance;
            if (pattern.motion === "static") data.radianceMotion = "still";
            else delete data.radianceMotion;
        }

        // PRODUCT-2: a product pattern takes no adjustment or override. The
        // attributes stay on the element (the page owns them) but are ignored.
        guardProduct() {
            const data = this.element.dataset;
            const present = PRODUCT_LOCKED_ATTRIBUTES.filter(([key]) => data[key] !== undefined).map(([, attr]) => attr);
            if (!present.length) return;
            warnOnce(
                this.element,
                "PRODUCT-2",
                `data-radiance-pattern="${this.productName}" is a fixed product pattern, so ${present.join(", ")} `
                + `${present.length === 1 ? "is" : "are"} ignored. Product patterns take no adjustment or override; `
                + "only the Radiance admin changes them. See RULES.md section 12."
            );
        }

        // SURFACE-1: the base is the host's own background colour. Product
        // patterns lock theirs; templates take data-radiance-base, then the
        // --radiance-base custom property, then the language default.
        resolveBase() {
            const theme = this.appearance;
            const raw = this.product
                ? this.product.base[theme]
                : (this.element.dataset.radianceBase || this.cssBase || "");
            const key = `${theme}|${raw}`;
            if (key === this.baseKey) return this.baseRgb;
            this.baseKey = key;
            let rgb = raw ? parseColour(raw) : null;
            if (raw && !rgb) {
                warnOnce(
                    this.element,
                    "SURFACE-1",
                    `base colour "${raw}" is not an opaque colour, so the default ${theme} base is used. `
                    + "Set data-radiance-base (or --radiance-base) to the exact, opaque background of the area this surface sits in."
                );
            }
            if (!rgb) rgb = theme === "dark" ? [26, 27, 30] : [255, 255, 255];
            this.baseRgb = rgb;
            this.baseFill = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
            this.staticFrameKey = "";
            return rgb;
        }

        get baseTone() {
            return `${this.baseRgb[0]},${this.baseRgb[1]},${this.baseRgb[2]}`;
        }

        checkConsistency() {
            const data = this.element.dataset;
            if (this.product) return;

            if (data.radianceIntensity && data.radianceDarkGlow && data.radianceIntensity !== data.radianceDarkGlow) {
                warnOnce(
                    this.element,
                    "INT-3",
                    `data-radiance-dark-glow="${data.radianceDarkGlow}" does not match `
                    + `data-radiance-intensity="${data.radianceIntensity}". Dark mode draws a different falloff `
                    + "when these disagree, so the surface will not match the rest of the product. Set both to the same value."
                );
            }

            // MOTION-5 is an absolute guardrail: it applies to the EFFECTIVE speed,
            // after any data-radiance-speed-scale percentage has been applied.
            const effective = this.speed;
            if (Number.isFinite(effective) && (effective < 0.4 || effective > 2)) {
                const scale = parseAdjustment(data.radianceSpeedScale);
                const via = scale === 1
                    ? ""
                    : ` (${data.radianceSpeed} x ${Math.round(scale * 100)}%)`;
                warnOnce(
                    this.element,
                    "MOTION-5",
                    `effective speed ${Math.round(effective * 1000) / 1000}${via} is outside the Radiance `
                    + "range 0.4-2.0. Below 0.4 the drift reads as dead, above 2.0 it reads as nervous. "
                    + "See RULES.md (MOTION-5)."
                );
            }
        }

        isRenderable() {
            if (!isDocumentVisible || !this.element.isConnected || !this.isInViewport) return false;
            if (document.documentElement.dataset.radiancePaused === "true" || document.body?.classList.contains("is-proof-paused")) return false;
            const slide = this.element.closest(".slide");
            if (slide && !slide.classList.contains("is-active")) return false;
            const proofView = this.element.closest(".proof-view");
            if (proofView && !proofView.classList.contains("is-active")) return false;
            const style = window.getComputedStyle(this.element);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
            this.cssBase = style.getPropertyValue("--radiance-base").trim();
            const rect = this.element.getBoundingClientRect();
            return rect.width > 2 && rect.height > 2;
        }

        getConfig() {
            const layout = this.layout;

            if (!this.isDark) {
                if (layout === "neutral") {
                    if (this.variant.startsWith("static")) return this.isSubtle ? STATIC_NEUTRAL_LIGHT_SUBTLE_BLOBS : STATIC_NEUTRAL_LIGHT_BLOBS;
                    return this.isSubtle ? NEUTRAL_LIGHT_SUBTLE_BLOBS : NEUTRAL_LIGHT_BLOBS;
                }
                const base = this.variant.startsWith("static")
                    ? (this.isSubtle ? STATIC_LIGHT_SUBTLE_BLOBS : STATIC_LIGHT_BLOBS)
                    : (this.isSubtle ? LIGHT_SUBTLE_BLOBS : LIGHT_BLOBS);
                if (layout === "top-wash") return topBlobSet(base);
                if (layout === "bottom-wash") return bottomBlobSet(base);
                return layout === "left-wash" ? mirrorBlobSet(base) : base;
            }

            if (layout === "neutral") {
                if (this.variant.startsWith("static")) return this.isSubtle ? STATIC_NEUTRAL_DARK_SUBTLE_BLOBS : STATIC_NEUTRAL_DARK_PROMINENT_BLOBS;
                return this.isSubtle ? NEUTRAL_DARK_SUBTLE_BLOBS : NEUTRAL_DARK_PROMINENT_BLOBS;
            }
            const base = this.variant.startsWith("static")
                ? (this.isSubtle ? STATIC_DARK_SUBTLE_BLOBS : STATIC_DARK_PROMINENT_BLOBS)
                : (this.darkGlow === "subtle" || this.isSubtle ? DARK_SUBTLE_BLOBS : DARK_PROMINENT_BLOBS);
            if (layout === "top-wash") return topBlobSet(base);
            if (layout === "bottom-wash") return bottomBlobSet(base);
            return layout === "left-wash" ? mirrorBlobSet(base) : base;
        }

        ensureSize() {
            if (this.resizeObserver && !this.needsResize && this.width > 0 && this.height > 0) return;

            const rect = this.element.getBoundingClientRect();
            const nextWidth = Math.max(1, Math.round(this.element.clientWidth || rect.width));
            const nextHeight = Math.max(1, Math.round(this.element.clientHeight || rect.height));
            // The spotter engine renders one canvas pixel per CSS pixel and is
            // shown pixelated, so its 1.0px film stays crisp (GRAIN-1/3).
            const nextDpr = this.isSpotter ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR);
            this.canvas.style.imageRendering = this.isSpotter ? "pixelated" : "";

            if (nextWidth === this.width && nextHeight === this.height && nextDpr === this.dpr) {
                this.needsResize = false;
                return;
            }

            this.width = nextWidth;
            this.height = nextHeight;
            this.dpr = nextDpr;
            this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
            this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
            this.canvas.style.width = `${this.width}px`;
            this.canvas.style.height = `${this.height}px`;
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = "high";
            this.textureKey = "";
            this.staticFrameKey = "";
            this.needsResize = false;
        }

        ensureBlobs() {
            const configKey = this.product
                ? [this.appearance, this.productName, this.variant].join(":")
                : [
                    this.appearance,
                    this.darkGlow,
                    this.element.dataset.radianceLayout || "default",
                    this.element.dataset.radianceIntensity || "default",
                    this.variant || "default",
                    this.element.dataset.radianceMotion || "dynamic",
                    this.element.dataset.radianceProminence || "100%",
                    this.element.dataset.radianceSpread || "100%"
                ].join(":");
            if (configKey === this.lastConfigKey && this.blobs.length) return;
            this.lastConfigKey = configKey;
            this.checkConsistency();
            this.staticFrameKey = "";
            const seed = this.seed || configKey;
            const random = createSeededRandom(`radiance-blobs:${seed}`);
            const prominence = this.prominenceScale;
            const spread = this.spreadScale;
            const configs = (prominence === 1 && spread === 1)
                ? this.getConfig()
                : this.getConfig().map((config) => ({
                    ...config,
                    opacity: config.opacity * prominence,
                    radius: config.radius * spread
                }));
            this.blobs = configs.map((config) => new RadianceBlob(config, random));
        }

        createGrain(mode) {
            const texture = document.createElement("canvas");
            texture.width = Math.max(1, Math.floor(this.width));
            texture.height = Math.max(1, Math.floor(this.height));
            const grainCtx = texture.getContext("2d");
            const isDark = mode === "dark";

            const rawTexture = document.createElement("canvas");
            const rawWidth = Math.max(1, Math.ceil(texture.width / RADIANCE_FILM_GRAIN_SIZE));
            const rawHeight = Math.max(1, Math.ceil(texture.height / RADIANCE_FILM_GRAIN_SIZE));
            rawTexture.width = rawWidth;
            rawTexture.height = rawHeight;
            const rawCtx = rawTexture.getContext("2d");
            const image = rawCtx.createImageData(rawWidth, rawHeight);
            const lightFilmBright = [
                [232, 248, 252],
                [244, 229, 253],
                [253, 228, 240],
                [253, 244, 212],
                [235, 241, 248]
            ];
            const lightFilmChroma = [
                [120, 208, 230],
                [194, 132, 232],
                [244, 132, 196],
                [246, 204, 104],
                [116, 154, 246],
                [128, 218, 194]
            ];
            const lightFilmMid = [
                [174, 214, 220],
                [204, 177, 224],
                [224, 178, 202],
                [224, 206, 150],
                [184, 196, 210]
            ];
            const lightFilmDark = [
                [122, 150, 156],
                [150, 124, 168],
                [168, 126, 148],
                [150, 140, 116],
                [132, 138, 146]
            ];
            const darkFilmColors = [
                [76, 116, 164],
                [122, 82, 140],
                [148, 78, 112],
                [118, 112, 92],
                [132, 138, 148]
            ];
            const darkFilmShadows = [
                [10, 12, 16],
                [14, 15, 18],
                [18, 16, 23],
                [16, 18, 24]
            ];

            const writeFilmGrain = (data, alphaMultiplier, random) => {
                for (let i = 0; i < data.length; i += 4) {
                    let color;
                    let alpha;
                    let sharedJitter;
                    let channelJitter;

                    if (isDark) {
                        const toneRoll = random();
                        const useShadowFleck = toneRoll < 0.16;
                        color = useShadowFleck
                            ? darkFilmShadows[Math.floor(random() * darkFilmShadows.length)]
                            : darkFilmColors[Math.floor(random() * darkFilmColors.length)];
                        alpha = useShadowFleck
                            ? 7 + Math.floor(random() * 9)
                            : 14 + Math.floor(random() * 14);
                        sharedJitter = Math.floor((random() - 0.5) * (useShadowFleck ? 10 : 38));
                        channelJitter = useShadowFleck ? 5 : 12;
                    } else {
                        const toneRoll = random();
                        const palette = toneRoll < 0.68
                            ? lightFilmBright
                            : toneRoll < 0.9
                                ? lightFilmMid
                                : toneRoll < 0.97
                                    ? lightFilmChroma
                                    : lightFilmDark;
                        color = palette[Math.floor(random() * palette.length)];
                        alpha = toneRoll < 0.68
                            ? 44 + Math.floor(random() * 28)
                            : toneRoll < 0.9
                                ? 28 + Math.floor(random() * 22)
                                : toneRoll < 0.97
                                    ? 22 + Math.floor(random() * 20)
                                    : 10 + Math.floor(random() * 14);
                        sharedJitter = Math.floor((random() - 0.5) * (toneRoll < 0.9 ? 28 : 16));
                        channelJitter = toneRoll < 0.97 ? 12 : 8;
                    }

                    data[i] = Math.max(0, Math.min(255, color[0] + sharedJitter + Math.floor((random() - 0.5) * channelJitter)));
                    data[i + 1] = Math.max(0, Math.min(255, color[1] + sharedJitter + Math.floor((random() - 0.5) * channelJitter)));
                    data[i + 2] = Math.max(0, Math.min(255, color[2] + sharedJitter + Math.floor((random() - 0.5) * channelJitter)));
                    data[i + 3] = Math.max(0, Math.min(255, Math.round(alpha * alphaMultiplier)));
                }
            };

            writeFilmGrain(
                image.data,
                isDark ? 1.18 : 1.16,
                createSeededRandom(`radiance-grain:${mode}:macro:${texture.width}x${texture.height}`)
            );
            rawCtx.putImageData(image, 0, 0);

            grainCtx.save();
            grainCtx.imageSmoothingEnabled = false;
            grainCtx.drawImage(rawTexture, 0, 0, texture.width, texture.height);
            grainCtx.restore();

            const microTexture = document.createElement("canvas");
            microTexture.width = texture.width;
            microTexture.height = texture.height;
            const microCtx = microTexture.getContext("2d");
            const microImage = microCtx.createImageData(texture.width, texture.height);
            writeFilmGrain(
                microImage.data,
                isDark ? 0.36 : 0.3,
                createSeededRandom(`radiance-grain:${mode}:micro:${texture.width}x${texture.height}`)
            );
            microCtx.putImageData(microImage, 0, 0);
            grainCtx.drawImage(microTexture, 0, 0);

            return texture;
        }

        createDarkDither() {
            const texture = document.createElement("canvas");
            texture.width = Math.max(1, Math.floor(this.width * this.dpr));
            texture.height = Math.max(1, Math.floor(this.height * this.dpr));
            const ditherCtx = texture.getContext("2d");
            const image = ditherCtx.createImageData(texture.width, texture.height);
            const data = image.data;
            const random = createSeededRandom(`radiance-dither:${texture.width}x${texture.height}`);

            for (let i = 0; i < data.length; i += 4) {
                const isLightSpeck = random() > 0.44;
                const alpha = isLightSpeck
                    ? 6 + Math.floor(random() * 8)
                    : 4 + Math.floor(random() * 5);

                data[i] = isLightSpeck ? 255 : 10;
                data[i + 1] = isLightSpeck ? 255 : 12;
                data[i + 2] = isLightSpeck ? 255 : 16;
                data[i + 3] = alpha;
            }

            ditherCtx.putImageData(image, 0, 0);
            return texture;
        }

        drawLightRightEdgeSupport(t) {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            ctx.save();
            ctx.globalCompositeOperation = "source-over";

            const intensity = (this.isSubtle ? 0.58 : 1) * this.prominenceScale;
            const pulse = (0.92 + 0.08 * Math.sin(t * 0.0005)) * intensity;
            const rightWash = ctx.createLinearGradient(w * 0.36, 0, w, 0);
            rightWash.addColorStop(0, "rgba(255,255,255,0)");
            rightWash.addColorStop(0.42, `rgba(200,220,255,${0.045 * pulse})`);
            rightWash.addColorStop(0.66, `rgba(140,100,255,${0.075 * pulse})`);
            rightWash.addColorStop(0.84, `rgba(255,120,160,${0.085 * pulse})`);
            rightWash.addColorStop(1, `rgba(40,140,255,${0.11 * pulse})`);
            ctx.fillStyle = rightWash;
            ctx.fillRect(0, 0, w, h);

            const supportRadius = Math.max(w, h) * 0.42;
            const supportGlows = [
                { x: w * 1.02, y: h * 0.12, radius: supportRadius, color: [255, 120, 160], alpha: 0.18 },
                { x: w * 0.96, y: h * 0.42, radius: supportRadius * 1.05, color: [140, 100, 255], alpha: 0.16 },
                { x: w * 1.02, y: h * 0.86, radius: supportRadius * 1.08, color: [40, 140, 255], alpha: 0.18 },
                { x: w * 0.84, y: h * 0.98, radius: supportRadius * 0.9, color: [80, 220, 180], alpha: 0.035 }
            ];

            for (const glow of supportGlows) {
                const [r, g, b] = glow.color;
                const grd = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
                grd.addColorStop(0, `rgba(${r},${g},${b},${glow.alpha * pulse})`);
                grd.addColorStop(0.58, `rgba(${r},${g},${b},${glow.alpha * 0.3 * pulse})`);
                grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
            }

            ctx.restore();
        }

        drawDarkRightEdgeSupport(t) {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            ctx.save();
            ctx.globalCompositeOperation = "screen";

            const intensity = (this.isSubtle ? 0.58 : 1) * this.prominenceScale;
            const pulse = (0.86 + 0.14 * Math.sin(t * 0.00062)) * intensity;
            const rightWash = ctx.createLinearGradient(w * 0.5, 0, w, 0);
            rightWash.addColorStop(0, "rgba(0,0,0,0)");
            rightWash.addColorStop(0.56, `rgba(138,93,255,${0.035 * pulse})`);
            rightWash.addColorStop(0.82, `rgba(39,140,255,${0.05 * pulse})`);
            rightWash.addColorStop(1, `rgba(255,93,142,${0.055 * pulse})`);
            ctx.fillStyle = rightWash;
            ctx.fillRect(0, 0, w, h);

            const cornerGlowRadius = Math.max(w, h) * 0.44;
            const cornerGlows = [
                { x: w * 1.03, y: h * 0.06, radius: cornerGlowRadius, color: [255, 93, 142], alpha: 0.14 },
                { x: w * 1.04, y: h * 0.92, radius: cornerGlowRadius * 1.05, color: [39, 140, 255], alpha: 0.15 },
                { x: w * 0.9, y: h * 1.02, radius: cornerGlowRadius * 0.82, color: [45, 220, 177], alpha: 0.03 }
            ];

            for (const glow of cornerGlows) {
                const [r, g, b] = glow.color;
                const grd = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
                grd.addColorStop(0, `rgba(${r},${g},${b},${glow.alpha * pulse})`);
                grd.addColorStop(0.58, `rgba(${r},${g},${b},${glow.alpha * 0.28 * pulse})`);
                grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
            }

            ctx.restore();
        }

        drawLightTopSupport(t) {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            ctx.save();
            ctx.globalCompositeOperation = "source-over";

            const intensity = (this.isSubtle ? 0.64 : 1) * this.prominenceScale;
            const pulse = (0.9 + 0.1 * Math.sin(t * 0.0007)) * intensity;
            const topWash = ctx.createLinearGradient(0, 0, 0, h);
            topWash.addColorStop(0, `rgba(200,220,255,${0.105 * pulse})`);
            topWash.addColorStop(0.18, `rgba(140,100,255,${0.062 * pulse})`);
            topWash.addColorStop(0.34, `rgba(255,120,160,${0.052 * pulse})`);
            topWash.addColorStop(0.58, `rgba(255,200,220,${0.024 * pulse})`);
            topWash.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = topWash;
            ctx.fillRect(0, 0, w, h);

            const supportRadius = Math.max(w, h) * 0.42;
            const supportGlows = [
                { x: w * 0.16, y: h * -0.04, radius: supportRadius, color: [255, 120, 160], alpha: 0.13 },
                { x: w * 0.36, y: h * -0.05, radius: supportRadius * 1.04, color: [140, 100, 255], alpha: 0.13 },
                { x: w * 0.64, y: h * -0.02, radius: supportRadius * 1.08, color: [40, 140, 255], alpha: 0.15 },
                { x: w * 0.86, y: h * 0.02, radius: supportRadius * 1.12, color: [80, 220, 180], alpha: 0.06 }
            ];

            for (const glow of supportGlows) {
                const [r, g, b] = glow.color;
                const grd = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
                grd.addColorStop(0, `rgba(${r},${g},${b},${glow.alpha * pulse})`);
                grd.addColorStop(0.52, `rgba(${r},${g},${b},${glow.alpha * 0.28 * pulse})`);
                grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
            }

            ctx.restore();
        }

        drawDarkTopSupport(t) {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            ctx.save();
            ctx.globalCompositeOperation = "screen";

            const intensity = (this.isSubtle ? 0.68 : 1) * this.prominenceScale;
            const pulse = (0.86 + 0.14 * Math.sin(t * 0.00072)) * intensity;
            const topWash = ctx.createLinearGradient(0, 0, 0, h);
            topWash.addColorStop(0, `rgba(138,93,255,${0.082 * pulse})`);
            topWash.addColorStop(0.18, `rgba(39,140,255,${0.058 * pulse})`);
            topWash.addColorStop(0.34, `rgba(255,93,142,${0.043 * pulse})`);
            topWash.addColorStop(0.58, `rgba(255,170,210,${0.018 * pulse})`);
            topWash.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = topWash;
            ctx.fillRect(0, 0, w, h);

            const supportRadius = Math.max(w, h) * 0.42;
            const supportGlows = [
                { x: w * 0.18, y: h * -0.04, radius: supportRadius, color: [255, 93, 142], alpha: 0.105 },
                { x: w * 0.34, y: h * -0.05, radius: supportRadius * 1.04, color: [138, 93, 255], alpha: 0.12 },
                { x: w * 0.62, y: h * -0.02, radius: supportRadius * 1.08, color: [39, 140, 255], alpha: 0.13 },
                { x: w * 0.86, y: h * 0.02, radius: supportRadius * 1.12, color: [45, 220, 177], alpha: 0.035 }
            ];

            for (const glow of supportGlows) {
                const [r, g, b] = glow.color;
                const grd = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
                grd.addColorStop(0, `rgba(${r},${g},${b},${glow.alpha * pulse})`);
                grd.addColorStop(0.54, `rgba(${r},${g},${b},${glow.alpha * 0.3 * pulse})`);
                grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, w, h);
            }

            ctx.restore();
        }

        drawNeutralSupport(t) {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;
            const cycle = t * 0.00044;
            const focusX = w * (0.5 + Math.sin(cycle) * 0.04);
            const focusY = h * (0.48 + Math.cos(cycle * 0.86) * 0.035);
            const radius = Math.max(w, h) * 0.74;
            const washAlpha = (this.isSubtle ? 1.18 : 0.88) / this.prominenceScale;

            ctx.save();
            ctx.globalCompositeOperation = "source-over";

            const tone = this.baseTone;
            const centerWash = ctx.createRadialGradient(focusX, focusY, radius * 0.06, focusX, focusY, radius);
            if (this.isDark) {
                centerWash.addColorStop(0, `rgba(${tone},${0.18 * washAlpha})`);
                centerWash.addColorStop(0.48, `rgba(${tone},${0.08 * washAlpha})`);
                centerWash.addColorStop(1, `rgba(${tone},0)`);
            } else {
                centerWash.addColorStop(0, `rgba(${tone},${0.34 * washAlpha})`);
                centerWash.addColorStop(0.46, `rgba(${tone},${0.18 * washAlpha})`);
                centerWash.addColorStop(1, `rgba(${tone},0)`);
            }
            ctx.fillStyle = centerWash;
            ctx.fillRect(0, 0, w, h);

            const crossWash = ctx.createLinearGradient(0, h * 0.1, w, h * 0.92);
            if (this.isDark) {
                crossWash.addColorStop(0, `rgba(${tone},${0.08 * washAlpha})`);
                crossWash.addColorStop(0.52, `rgba(${tone},0)`);
                crossWash.addColorStop(1, `rgba(${tone},${0.065 * washAlpha})`);
            } else {
                crossWash.addColorStop(0, `rgba(${tone},${0.08 * washAlpha})`);
                crossWash.addColorStop(0.5, `rgba(${tone},0)`);
                crossWash.addColorStop(1, `rgba(${tone},${0.07 * washAlpha})`);
            }
            ctx.fillStyle = crossWash;
            ctx.fillRect(0, 0, w, h);

            const minSide = Math.min(w, h);
            const veilAlpha = (this.isSubtle ? 1.34 : 0.32) / this.prominenceScale;
            const veilTone = tone;

            for (const veil of NEUTRAL_VEIL_BLOBS) {
                const x = w * veil.anchorX + Math.sin(t * veil.freqX + veil.phase) * veil.orbitX;
                const y = h * veil.anchorY + Math.cos(t * veil.freqY + veil.phase) * veil.orbitY;
                const veilRadius = minSide * veil.radius;
                const alpha = veil.opacity * veilAlpha;
                const neutralBlob = ctx.createRadialGradient(x, y, veilRadius * 0.06, x, y, veilRadius);
                neutralBlob.addColorStop(0, `rgba(${veilTone},${alpha})`);
                neutralBlob.addColorStop(0.54, `rgba(${veilTone},${alpha * 0.42})`);
                neutralBlob.addColorStop(1, `rgba(${veilTone},0)`);
                ctx.fillStyle = neutralBlob;
                ctx.fillRect(0, 0, w, h);
            }
            ctx.restore();
        }

        // GRAIN-4 (experiment): keep grain inside the colour field.
        // The draw methods all write to this.ctx, so swap it for the offscreen
        // field context rather than threading a target through every method.
        renderColourField(t) {
            const realCtx = this.ctx;
            this.fieldCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.fieldCtx.clearRect(0, 0, this.width, this.height);

            this.fieldCtx.save();
            this.fieldCtx.filter = `blur(${this.layout === "neutral" ? 22 : 40}px)`;
            for (const blob of this.blobs) {
                blob.update(t, this.width, this.height, this.mouse, this.breathT);
                blob.draw(this.fieldCtx);
            }
            this.fieldCtx.restore();

            this.ctx = this.fieldCtx;
            try {
                this.drawSupport(t);
            } finally {
                this.ctx = realCtx;
            }
        }

        // Dark keeps its own colour compositing (each layer screened onto the
        // base separately). This pass exists only to collect the field's ALPHA,
        // so the colours it produces here are never shown.
        renderDarkColourField(t) {
            const realCtx = this.ctx;
            this.fieldCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.fieldCtx.globalCompositeOperation = "source-over";
            this.fieldCtx.clearRect(0, 0, this.width, this.height);

            this.fieldCtx.save();
            this.fieldCtx.filter = `blur(${this.layout === "neutral" ? 40 : 64}px)`;
            this.fieldCtx.drawImage(this.blobCanvas, 0, 0, this.width, this.height);
            this.fieldCtx.restore();

            this.ctx = this.fieldCtx;
            try {
                this.drawSupport(t);
            } finally {
                this.ctx = realCtx;
            }
        }

        // Stack the colour field onto itself so the mask reads closer to
        // present/absent than to the field's own opacity. Without this the
        // texture would be thinned everywhere in proportion to colour strength.
        buildColourMask(saturation) {
            const maskCtx = this.maskCtx;
            const mw = this.maskCanvas.width;
            const mh = this.maskCanvas.height;
            maskCtx.setTransform(1, 0, 0, 1, 0, 0);
            maskCtx.globalCompositeOperation = "source-over";
            maskCtx.imageSmoothingEnabled = true;
            maskCtx.clearRect(0, 0, mw, mh);
            // Stacking n copies gives 1 - (1 - a)^n; drawing the mask onto itself
            // squares that, so 3 copies doubled twice is exactly the 12th power.
            let power = saturation;
            let doublings = 0;
            while (power % 2 === 0 && power > 3) {
                power /= 2;
                doublings += 1;
            }
            for (let pass = 0; pass < power; pass += 1) {
                maskCtx.drawImage(this.fieldCanvas, 0, 0, mw, mh);
            }
            for (let pass = 0; pass < doublings; pass += 1) {
                maskCtx.drawImage(this.maskCanvas, 0, 0);
            }
        }

        // GRAIN-4: draw a texture through the colour mask, so it never lands on
        // the bare surface. Call buildColourMask() first.
        drawMaskedTexture(texture, alpha = 1) {
            const grainCtx = this.grainMaskCtx;
            grainCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            grainCtx.globalCompositeOperation = "source-over";
            grainCtx.clearRect(0, 0, this.width, this.height);
            grainCtx.imageSmoothingEnabled = false;
            grainCtx.drawImage(texture, 0, 0, this.width, this.height);
            grainCtx.globalCompositeOperation = "destination-in";
            grainCtx.imageSmoothingEnabled = true;
            grainCtx.drawImage(this.maskCanvas, 0, 0, this.width, this.height);
            grainCtx.globalCompositeOperation = "source-over";

            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(this.grainCanvas, 0, 0, this.width, this.height);
            this.ctx.restore();
        }

        // F1: the fine noise layer, through the colour mask (GRAIN-4).
        drawMaskedOverlay(theme) {
            const pattern = getOverlayPattern(theme, this.dpr, this.grainMaskCtx);
            if (!pattern) return;
            const film = FILM[theme];
            const grainCtx = this.grainMaskCtx;
            grainCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            grainCtx.globalCompositeOperation = "source-over";
            grainCtx.clearRect(0, 0, this.width, this.height);
            grainCtx.fillStyle = pattern;
            grainCtx.fillRect(0, 0, this.width, this.height);
            grainCtx.globalCompositeOperation = "destination-in";
            grainCtx.imageSmoothingEnabled = true;
            grainCtx.drawImage(this.maskCanvas, 0, 0, this.width, this.height);
            grainCtx.globalCompositeOperation = "source-over";

            this.ctx.save();
            this.ctx.globalAlpha = film.overlay;
            this.ctx.globalCompositeOperation = film.overlayBlend;
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(this.grainCanvas, 0, 0, this.width, this.height);
            this.ctx.restore();
        }

        // F1: the tone lift (Home's saturate/contrast), applied to the colour
        // field only - the bare surface keeps the host's exact base colour.
        applyToneLift(theme) {
            const film = FILM[theme];
            const liftCtx = this.liftCtx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            liftCtx.setTransform(1, 0, 0, 1, 0, 0);
            liftCtx.globalCompositeOperation = "copy";
            liftCtx.filter = `saturate(${film.saturate}) contrast(${film.contrast})`;
            liftCtx.drawImage(this.canvas, 0, 0);
            liftCtx.filter = "none";
            liftCtx.globalCompositeOperation = "destination-in";
            liftCtx.imageSmoothingEnabled = true;
            liftCtx.drawImage(this.maskCanvas, 0, 0, w, h);
            liftCtx.globalCompositeOperation = "source-over";

            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.globalAlpha = 1;
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.drawImage(this.liftCanvas, 0, 0);
            this.ctx.restore();
        }

        drawSupport(t) {
            if (this.layout === "neutral") {
                this.drawNeutralSupport(t);
                return;
            }

            if (this.layout === "top-wash") {
                if (this.isDark) this.drawDarkTopSupport(t);
                else this.drawLightTopSupport(t);
                return;
            }

            if (this.layout === "bottom-wash") {
                this.ctx.save();
                this.ctx.translate(0, this.height);
                this.ctx.scale(1, -1);
                if (this.isDark) this.drawDarkTopSupport(t);
                else this.drawLightTopSupport(t);
                this.ctx.restore();
                return;
            }

            const draw = () => {
                if (this.isDark) {
                    this.drawDarkRightEdgeSupport(t);
                } else {
                    this.drawLightRightEdgeSupport(t);
                }
            };

            if (this.layout === "left-wash") {
                this.ctx.save();
                this.ctx.translate(this.width, 0);
                this.ctx.scale(-1, 1);
                draw();
                this.ctx.restore();
            } else {
                draw();
            }
        }

        drawDarkFalloff() {
            const ctx = this.ctx;
            if (this.layout === "top-wash" || this.layout === "bottom-wash") {
                const startY = this.layout === "bottom-wash" ? this.height : 0;
                const endY = this.layout === "bottom-wash" ? 0 : this.height;
                const verticalFalloff = ctx.createLinearGradient(0, startY, 0, endY);
                const tone = this.baseTone;
                verticalFalloff.addColorStop(0, `rgba(${tone},0.26)`);
                verticalFalloff.addColorStop(0.28, `rgba(${tone},0.16)`);
                verticalFalloff.addColorStop(0.58, `rgba(${tone},0.06)`);
                verticalFalloff.addColorStop(1, `rgba(${tone},0)`);
                ctx.fillStyle = verticalFalloff;
                ctx.fillRect(0, 0, this.width, this.height);
                return;
            }
            const startX = this.layout === "left-wash" ? this.width : 0;
            const endX = this.layout === "left-wash" ? 0 : this.width;
            const falloff = ctx.createLinearGradient(startX, 0, endX, this.height);
            const falloffTone = this.baseTone;
            falloff.addColorStop(0, `rgba(${falloffTone},0.38)`);
            falloff.addColorStop(0.42, `rgba(${falloffTone},0.2)`);
            falloff.addColorStop(0.78, `rgba(${falloffTone},0.04)`);
            falloff.addColorStop(1, `rgba(${falloffTone},0)`);
            ctx.fillStyle = falloff;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        ensureTextures() {
            const nextKey = `${this.width}x${this.height}@${this.dpr}:${this.appearance}`;
            if (nextKey === this.textureKey) return;
            this.textureKey = nextKey;

            if (this.isDark) {
                this.lightGrain = undefined;
                this.darkGrain = this.getCachedTexture("dark-grain", () => this.createGrain("dark"));
                this.darkDither = this.getCachedTexture("dark-dither", () => this.createDarkDither());
            } else {
                this.lightGrain = this.getCachedTexture("light-grain", () => this.createGrain("light"));
                this.darkGrain = undefined;
                this.darkDither = undefined;
            }

            this.blobCanvas.width = Math.max(1, Math.floor(this.width * this.dpr));
            this.blobCanvas.height = Math.max(1, Math.floor(this.height * this.dpr));
            this.blobCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            for (const target of [this.fieldCanvas, this.grainCanvas, this.liftCanvas]) {
                target.width = this.blobCanvas.width;
                target.height = this.blobCanvas.height;
            }
            this.maskCanvas.width = Math.max(1, Math.ceil(this.blobCanvas.width * MASK_SCALE));
            this.maskCanvas.height = Math.max(1, Math.ceil(this.blobCanvas.height * MASK_SCALE));
            this.fieldCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.grainMaskCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.staticFrameKey = "";
        }

        getCachedTexture(kind, factory) {
            const key = `${kind}:${this.width}x${this.height}@${this.dpr}`;
            const cachedTexture = textureCache.get(key);
            if (cachedTexture) return cachedTexture;
            return rememberTexture(key, factory());
        }

        // "page" film (the Home product): the full-surface grain Home was built
        // on; its page recipe fades and tones it.
        /* A product whose colour sits below full strength (Home's hero) mixes it
           toward the base here, before the grain, so the grain keeps its one
           value (GRAIN-6). */
        drawFieldOpacity() {
            const opacity = this.product && this.product.fieldOpacity ? this.product.fieldOpacity[this.isDark ? "dark" : "light"] : 1;
            if (!(opacity < 1)) return;
            this.ctx.save();
            this.ctx.globalCompositeOperation = "source-over";
            this.ctx.globalAlpha = 1 - opacity;
            this.ctx.fillStyle = this.baseFill;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
        }

        drawPlainTexture(texture, alpha) {
            if (!texture) return;
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(texture, 0, 0, this.width, this.height);
            this.ctx.restore();
        }

        /* ---- the Spotter radiance engine (product patterns spotterx, liveboard) ---- */

        /* Locked: the values SpotterX and Liveboard ship (SBG_TUNING). Only the
           state comes from the page; the admin lab may preview other values on
           one surface (RadianceLanguageRenderer.admin). */
        get sbgTuning() {
            const raw = (this.element.dataset.radianceState || "idle").trim().toLowerCase();
            let state = PRODUCT_STATES[raw];
            if (!state) {
                warnOnce(this.element, "PRODUCT-4", `data-radiance-state="${raw}" is not a state. Use idle, reasoning or answered.`);
                state = PRODUCT_STATES.idle;
            }
            const tuning = { ...SBG_TUNING };
            const admin = ADMIN_SPOTTER.get(this.element);
            if (admin) {
                Object.keys(SBG_TUNING).forEach((key) => {
                    if (Number.isFinite(admin[key])) tuning[key] = admin[key];
                });
            }
            return { energy: state[0], settled: state[1], ...tuning };
        }

        /* The state levels for a theme: SBG_STATES, or the admin lab's preview. */
        sbgLevels(theme) {
            const admin = ADMIN_SPOTTER.get(this.element);
            const levels = admin && admin.levels && admin.levels[theme];
            return levels ? { ...SBG_STATES[theme], ...levels } : SBG_STATES[theme];
        }

        /* The grain strength for a theme: the language's one grain (FILM,
           GRAIN-6), or the admin lab's preview of a new one. */
        sbgGrainStrength(theme) {
            const admin = ADMIN_SPOTTER.get(this.element);
            const grain = admin && admin.grain && admin.grain[theme];
            return Number.isFinite(grain) ? clamp(grain, 0, 1) : FILM[theme].grain;
        }

        ensureSbg(tune) {
            const key = `${this.width}x${this.height}`;
            if (this.sbg && this.sbg.key === key) return this.sbg;
            const prev = this.sbg;
            const W = this.width;
            const H = this.height;
            const spacing = clamp(W / 6.4, 170, 300);
            const radius = spacing * 1.6;
            /* A blob wraps from one edge to the other only when fully out of
               view: widest horizontal extent of the tilted, stretched, breathing
               ellipse (~2.4 radii) + wander + blur. */
            const reachX = radius * 2.4 + spacing * 0.5 + 80;
            const count = Math.max(6, Math.ceil((W + reachX * 2) / spacing));
            const band = count * spacing;
            const rand = (lo, hi) => lo + Math.random() * (hi - lo);
            const blobs = [];
            let walk = { i: 1, d: 1, hold: false, cool: false, warm: 0, run: 1 };
            for (let i = 0; i < count; i += 1) {
                const blob = { slot: i, lap: null };
                RadianceSurface.reseedBlob(blob, walk, spacing, band, W);
                blobs.push(blob);
                walk = RadianceSurface.walkHue(walk);
            }
            /* The reasoning stream: fewer, smaller lights flowing the other way. */
            const streamSpacing = spacing * 1.7;
            const streamCount = Math.max(4, Math.ceil((W + reachX * 2) / streamSpacing));
            const streamBand = streamCount * streamSpacing;
            const stream = [];
            for (let i = 0; i < streamCount; i += 1) {
                stream.push({
                    x0: -(streamBand - W) / 2 + (i + 0.5 + rand(-0.25, 0.25)) * streamSpacing,
                    sig: rand(0.8, 1.2),
                    f: [rand(0.0006, 0.001), rand(0.0011, 0.0017), rand(0.0005, 0.0011), rand(0.0007, 0.0013)],
                    p: [rand(0, TAU), rand(0, TAU), rand(0, TAU), rand(0, TAU)],
                    bp: rand(0, TAU),
                    bMs: rand(1500, 2800)
                });
            }
            const lw = Math.ceil((W + SBG_PAD * 2) * SBG_SCALE);
            const lh = Math.ceil((H + SBG_PAD) * SBG_SCALE);
            const layer = () => {
                const canvas = document.createElement("canvas");
                canvas.width = lw;
                canvas.height = lh;
                return { canvas, ctx: canvas.getContext("2d") };
            };
            this.sbg = {
                key, W, H, spacing, radius, band, blobs, lw, lh,
                margin: (band - W) / 2,
                stream, streamSpacing, streamBand,
                streamMargin: (streamBand - W) / 2,
                ax: new Float32Array(count),
                ah: new Array(count),
                blob: layer(),
                field: layer(),
                grainKey: "", grain: null,
                clock: prev ? prev.clock : rand(0, 600000),
                chorus: prev ? prev.chorus : 0,
                energy: prev ? prev.energy : tune.energy,
                vel: prev ? prev.vel : 0,
                target: prev ? prev.target : tune.energy,
                settled: prev ? prev.settled : tune.settled,
                settledVel: prev ? prev.settledVel : 0,
                last: 0,
                cost: prev ? prev.cost : 0,
                drawnH: H,
                drawnTheme: ""
            };
            return this.sbg;
        }

        /* Home's hero grain: the canonical passes at the hero's opacity. */
        sbgGrain(S) {
            const strength = this.sbgGrainStrength(this.isDark ? "dark" : "light");
            const key = `${S.W}x${S.H}:${this.appearance}:${strength}`;
            if (S.grainKey === key && S.grain) return S.grain;
            const texture = document.createElement("canvas");
            texture.width = S.W;
            texture.height = S.H;
            const tctx = texture.getContext("2d");
            tctx.imageSmoothingEnabled = false;
            if (this.isDark) {
                tctx.globalAlpha = 0.42 * strength;
                tctx.drawImage(this.darkDither, 0, 0, S.W, S.H);
                tctx.globalAlpha = strength;
                tctx.drawImage(this.darkGrain, 0, 0, S.W, S.H);
            } else {
                tctx.globalAlpha = strength;
                tctx.drawImage(this.lightGrain, 0, 0, S.W, S.H);
            }
            S.grain = texture;
            S.grainKey = key;
            return texture;
        }

        /* One step of the colour walk (see SBG_PATH). State: i (index on the
           path), d (direction), hold (repeat once), cool (peach seen - no second
           peach before violet), warm / run (length of the current warm / cool
           stretch). */
        static walkHue(state) {
            const isWarm = (index) => index >= 3;
            let next;
            if (SBG_PATH[state.i] === "pink" && state.warm >= 3) {
                next = { i: 2, d: -1, hold: false, cool: true };
            } else if (!isWarm(state.i) && state.run >= 5) {
                next = { i: state.i + 1, d: 1, hold: false, cool: false };
            } else {
                next = RadianceSurface.walkStep(state);
                if (!isWarm(state.i) && isWarm(next.i) && state.run < 2) {
                    next = { i: 1, d: -1, hold: false, cool: next.cool };
                }
            }
            next.warm = isWarm(next.i) ? (isWarm(state.i) ? state.warm + 1 : 1) : 0;
            next.run = isWarm(next.i) ? 0 : (isWarm(state.i) ? 1 : state.run + 1);
            return next;
        }

        static walkStep(state) {
            const { i, hold } = state;
            let { d, cool } = state;
            if (hold) return { i: i + d, d, hold: false, cool };
            const roll = Math.random();
            const hue = SBG_PATH[i];
            if (hue === "peach") return { i: i - 1, d: -1, hold: false, cool: true };
            if (hue === "mint") return { i: i + 1, d: 1, hold: false, cool };
            if (hue === "blue") {
                if (d === -1) {
                    if (roll < 0.3) return { i: i - 1, d: -1, hold: false, cool };
                    if (roll < 0.72) return { i, d: 1, hold: true, cool };
                    return { i: i + 1, d: 1, hold: false, cool };
                }
                if (roll < 0.1) return { i: i - 1, d: -1, hold: false, cool };
                if (roll < 0.18) return { i, d, hold: false, cool };
                return { i: i + 1, d, hold: false, cool };
            }
            if (hue === "violet") {
                cool = false;
                if (roll < 0.14) d = -d;
                else if (roll < 0.22) return { i, d, hold: false, cool };
                return { i: i + d, d, hold: false, cool };
            }
            if (d === 1 && !cool) {
                if (roll < 0.4) return { i: i + 1, d: 1, hold: false, cool };
                if (roll < 0.5) return { i, d, hold: false, cool };
                return { i: i - 1, d: -1, hold: false, cool };
            }
            if (roll < 0.1) return { i, d: -1, hold: false, cool };
            return { i: i - 1, d: -1, hold: false, cool };
        }

        /* A blob's identity: hue, slot jitter, size, and per-blob frequencies
           (rad per clock-ms) - every motion is 2-3 sines at incommensurate
           ratios, so no blob ever retraces a path. */
        static reseedBlob(blob, walk, spacing, band, W) {
            const rand = (lo, hi) => lo + Math.random() * (hi - lo);
            const wx = rand(0.00045, 0.0008);
            const wy = rand(0.0004, 0.0009);
            const wr = rand(0.0006, 0.0011);
            const ws = rand(0.0005, 0.0012);
            const wt = rand(0.0005, 0.0012);
            const wq = rand(0.00025, 0.0005);
            blob.walk = walk;
            blob.hue = SBG_PATH[walk.i];
            blob.x0 = -(band - W) / 2 + (blob.slot + 0.5 + rand(-0.18, 0.18)) * spacing;
            blob.sig = rand(0.92, 1.08);
            blob.amp = rand(0.9, 1.1);
            blob.f = [
                wx, wx * rand(1.52, 1.72), wx * rand(2.3, 2.6),
                wy, wy * rand(1.6, 1.9),
                wr, wr * rand(1.4, 1.7),
                ws, ws * rand(1.5, 1.8),
                wt, wt * rand(1.5, 1.8),
                wq, wq * rand(1.6, 1.9)
            ];
            blob.p = Array.from({ length: 13 }, () => rand(0, TAU));
            const B = SBG_MOTION.breathMs;
            blob.bRest = rand(B.rest[0], B.rest[1]);
            blob.bReason = rand(B.reason[0], B.reason[1]);
            blob.bCalm = rand(B.calm[0], B.calm[1]);
            blob.bp = rand(0, TAU);
        }

        /* Exact solution of a critically damped spring step: stable at any dt. */
        static spring(value, velocity, target, omega, dt) {
            const e0 = value - target;
            const k = velocity + omega * e0;
            const decay = Math.exp(-omega * dt);
            return [target + (e0 + k * dt) * decay, (velocity - omega * k * dt) * decay];
        }

        renderSbg(timestamp) {
            const started = performance.now();
            const tune = this.sbgTuning;
            const S = this.ensureSbg(tune);
            const theme = this.isDark ? "dark" : "light";
            const still = this.isStill;
            const M = SBG_MOTION;

            const dtMs = S.last ? clamp(timestamp - S.last, 0, 250) : 0;
            S.last = timestamp;
            const dt = dtMs / 1000;
            if (tune.energy > 0.5 && S.target <= 0.5) S.chorus = 0;
            S.target = tune.energy;
            [S.energy, S.vel] = RadianceSurface.spring(S.energy, S.vel, tune.energy,
                (tune.energy > S.energy ? M.rise : M.fall) / tune.pace, dt);
            [S.settled, S.settledVel] = RadianceSurface.spring(S.settled, S.settledVel, tune.settled, M.settle / tune.pace, dt);
            const E = clamp(S.energy, 0, 1);
            const calm = clamp(S.settled, 0, 1);

            const m = tune.flow;
            const rateRest = mix(M.speedDefault, M.speedSettled, calm) * m;
            const rate = Math.min(M.speedCap, mix(rateRest, M.speedReason * m, E));
            const tempo = Math.sqrt(Math.max(m, 0.05) / 2.5);
            if (!still) {
                S.clock += dtMs * rate;
                S.chorus += (TAU * dtMs / M.chorusMs) * tempo * (1 + 0.06 * Math.sin(S.clock * 0.00013));
            }
            const t = S.clock;
            const breath = still ? 0 : tune.breath;
            const sizeSwing = mix(mix(M.breathSize.rest, M.breathSize.calm, calm), M.breathSize.reason, E) * breath;
            const glowSwing = mix(mix(M.breathGlow.rest, M.breathGlow.calm, calm), M.breathGlow.reason, E) * breath;
            const chorus = wave(S.chorus);
            const chorusSize = 1 + M.chorusSize * E * breath * (chorus - 0.3);
            const chorusGlow = 1 + M.chorusGlow * E * breath * (chorus - 0.5);
            const state = this.sbgLevels(theme);
            const restLevel = mix(state.rest, Math.min(1, state.calm * tune.calmGain) * state.rest, calm);
            const level = mix(restLevel, state.reason, E);
            const alphaNow = level * tune.gain;
            const boost = level / mix(restLevel, state.floor, E);
            const palette = SBG_PALETTE[theme];
            const W = S.W;
            const H = S.H;
            const baseLift = SBG_BASE_LIFT + tune.lift;
            const lift = baseLift - S.radius * SBG_CALM_RISE * calm;
            const wander = S.spacing * (1 + M.wanderReason * E);

            /* Blobs, at quarter resolution, in CSS-pixel coordinates. The drift's
               own speed swells and eases on two slow sines (never reversing). */
            const bctx = S.blob.ctx;
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.globalCompositeOperation = "source-over";
            bctx.clearRect(0, 0, S.lw, S.lh);
            bctx.setTransform(SBG_SCALE, 0, 0, SBG_SCALE, SBG_PAD * SBG_SCALE, SBG_PAD * SBG_SCALE);
            const flowX = t * M.flow + S.spacing * (0.5 * Math.sin(t * 0.000061) + 0.3 * Math.sin(t * 0.000097 + 1.3));
            /* A blob that has just wrapped (it is off-screen, entering on the
               left) is reborn: the next step of the colour walk from its
               right-hand neighbour, fresh size, timing and shape. */
            for (const blob of S.blobs) {
                const lap = Math.floor((blob.x0 + flowX + S.margin) / S.band);
                if (blob.lap !== null && lap !== blob.lap) {
                    const right = S.blobs[(blob.slot + 1) % S.blobs.length];
                    RadianceSurface.reseedBlob(blob, RadianceSurface.walkHue(right.walk), S.spacing, S.band, W);
                    blob.lap = Math.floor((blob.x0 + flowX + S.margin) / S.band);
                } else {
                    blob.lap = lap;
                }
            }
            const draw = (x, y, r, sx, sy, tilt, rgb, opacity) => {
                bctx.save();
                bctx.translate(x, y);
                bctx.rotate(tilt);
                bctx.scale(sx, sy);
                const gradient = bctx.createRadialGradient(0, 0, 0, 0, 0, r);
                gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`);
                gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
                bctx.fillStyle = gradient;
                bctx.beginPath();
                bctx.arc(0, 0, r, 0, TAU);
                bctx.fill();
                bctx.restore();
            };
            let placed = 0;
            for (const blob of S.blobs) {
                const f = blob.f;
                const q = blob.p;
                let x = (blob.x0 + flowX + S.margin) % S.band;
                if (x < 0) x += S.band;
                x -= S.margin;
                x += wander * (0.24 * Math.sin(t * f[0] + q[0]) + 0.13 * Math.sin(t * f[1] + q[1]) + 0.07 * Math.sin(t * f[2] + q[2]));
                S.ax[placed] = x;
                S.ah[placed] = blob.hue;
                placed += 1;
                if (!still) blob.bp += (TAU * dtMs / mix(mix(blob.bRest, blob.bCalm, calm), blob.bReason, E)) * tempo;
                const own = wave(blob.bp);
                const r = S.radius * SBG_SIZE[blob.hue] * blob.sig
                    * (1 + 0.1 * Math.sin(t * f[5] + q[5]) + 0.05 * Math.sin(t * f[6] + q[6]))
                    * (1 + sizeSwing * (own - 0.4)) * chorusSize;
                const sx = 1 + 0.16 * Math.sin(t * f[7] + q[7]) + 0.06 * Math.sin(t * f[8] + q[8]);
                const sy = SBG_TALL * (1 + 0.18 * Math.cos(t * f[9] + q[9]) + 0.07 * Math.sin(t * f[10] + q[10]));
                const tilt = 0.3 * Math.sin(t * f[11] + q[11]) + 0.16 * Math.sin(t * f[12] + q[12]);
                const cos = Math.cos(tilt);
                const sin = Math.sin(tilt);
                const extent = r * Math.sqrt(sx * sx * cos * cos + sy * sy * sin * sin);
                if (x + extent < -SBG_PAD || x - extent > W + SBG_PAD) continue;
                const y = lift + S.radius * (-0.1 + 0.05 * Math.cos(t * f[3] + q[3]) + 0.03 * Math.sin(t * f[4] + q[4]));
                const opacity = Math.min(1, alphaNow * SBG_ROLE[blob.hue] * blob.amp * (1 + glowSwing * (own - 0.5)) * chorusGlow);
                draw(x, y, r, sx, sy, tilt, palette[blob.hue], opacity);
            }

            /* The reasoning stream: lights flowing the other way along the edge,
               each taking the colour of the light beneath it (never a new hue,
               so crossings brighten instead of muddying). */
            if (E > 0.01) {
                const flowS = t * M.flow * M.streamFlow + S.streamSpacing * 0.4 * Math.sin(t * 0.00011 + 0.7);
                const reach = S.spacing * 0.9;
                for (const light of S.stream) {
                    const f = light.f;
                    const q = light.p;
                    let x = (light.x0 + flowS + S.streamMargin) % S.streamBand;
                    if (x < 0) x += S.streamBand;
                    x -= S.streamMargin;
                    x += S.streamSpacing * (0.2 * Math.sin(t * f[0] + q[0]) + 0.1 * Math.sin(t * f[1] + q[1]));
                    if (!still) light.bp += (TAU * dtMs / light.bMs) * tempo;
                    const lb = wave(light.bp);
                    const r = S.spacing * 0.8 * light.sig * (1 + 0.2 * lb);
                    const sx = 1.1 + 0.15 * Math.sin(t * f[2] + q[2]);
                    const sy = 1.4 + 0.2 * Math.cos(t * f[3] + q[3]);
                    if (x + r * sx < -SBG_PAD || x - r * sx > W + SBG_PAD) continue;
                    let cr = 0, cg = 0, cb = 0, cw = 0;
                    for (let k = 0; k < placed; k += 1) {
                        const u = (x - S.ax[k]) / reach;
                        if (u > 3 || u < -3) continue;
                        const w = Math.exp(-u * u);
                        const rgb = palette[S.ah[k]];
                        cr += w * rgb[0];
                        cg += w * rgb[1];
                        cb += w * rgb[2];
                        cw += w;
                    }
                    if (cw < 1e-4) continue;
                    const y = lift + r * (-0.2 + 0.1 * Math.cos(t * f[2] + q[3]));
                    const opacity = Math.min(1, alphaNow * M.streamGlow * E * (0.55 + 0.45 * lb));
                    draw(x, y, r, sx, sy, 0, [Math.round(cr / cw), Math.round(cg / cw), Math.round(cb / cw)], opacity);
                }
            }

            /* Blur (BLEND-2); while reasoning, fold the extra brightness back to
               the resting level below the top band. */
            const fctx = S.field.ctx;
            fctx.setTransform(1, 0, 0, 1, 0, 0);
            fctx.globalCompositeOperation = "source-over";
            fctx.clearRect(0, 0, S.lw, S.lh);
            fctx.filter = `blur(${SBG_BLUR[theme] * SBG_SCALE}px)`;
            fctx.drawImage(S.blob.canvas, 0, 0);
            fctx.filter = "none";
            if (boost > 1.001) {
                fctx.setTransform(SBG_SCALE, 0, 0, SBG_SCALE, SBG_PAD * SBG_SCALE, SBG_PAD * SBG_SCALE);
                fctx.globalCompositeOperation = "destination-in";
                const band = fctx.createLinearGradient(0, 0, 0, SBG_ENVELOPE.band * 5);
                for (let i = 0; i <= 10; i += 1) {
                    const y = (i / 10) * SBG_ENVELOPE.band * 5;
                    band.addColorStop(i / 10, `rgba(0,0,0,${(1 + (boost - 1) * Math.exp(-y / SBG_ENVELOPE.band)) / boost})`);
                }
                fctx.fillStyle = band;
                fctx.fillRect(-SBG_PAD, -SBG_PAD, W + SBG_PAD * 2, H + SBG_PAD);
                fctx.globalCompositeOperation = "source-over";
            }

            /* Compose: base -> field (BLEND-1) -> grain. Only the rows the page's
               fade reaches change; below them the canvas is bare base, left as
               drawn (a theme change repaints it once). */
            const y0 = Math.max(0, baseLift);
            const litH = Math.min(H, Math.ceil(y0 + SBG_ENVELOPE.wash * tune.wash * 4.5 + 8));
            const paintKey = `${this.appearance}|${this.baseKey}`;
            const drawH = S.drawnTheme === paintKey ? Math.max(litH, S.drawnH) : H;
            S.drawnTheme = paintKey;
            const inv = 1 / SBG_SCALE;
            const ctx = this.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W, drawH);
            ctx.clip();
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = this.baseFill;
            ctx.fillRect(0, 0, W, drawH);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "low";
            ctx.globalCompositeOperation = this.isDark ? "screen" : "source-over";
            ctx.drawImage(S.field.canvas, 0, 0, S.lw, S.lh, -SBG_PAD, -SBG_PAD, S.lw * inv, S.lh * inv);
            ctx.globalCompositeOperation = "source-over";
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.sbgGrain(S), 0, 0, W, drawH, 0, 0, W, drawH);
            ctx.restore();
            S.drawnH = litH;

            S.cost = S.cost ? S.cost * 0.92 + (performance.now() - started) * 0.08 : performance.now() - started;
        }

        markReady() {
            if (this.ready) return;
            this.ready = true;
            this.element.dataset.radianceReady = "true";
            this.element.dispatchEvent(new CustomEvent("radiance-local-ready", { bubbles: true }));
        }

        getFrameKey() {
            return [
                this.textureKey,
                this.lastConfigKey,
                this.baseKey,
                overlayGeneration,
                this.width,
                this.height,
                this.dpr,
                prefersReducedMotion ? "reduced" : "full"
            ].join(":");
        }

        render(timestamp) {
            if (!this.isRenderable()) return;
            this.applyPatternShorthand();
            this.ensureSize();
            if (this.isSpotter) {
                this.ensureTextures();
                this.resolveBase();
                this.renderSbg(timestamp || performance.now());
                this.markReady();
                return;
            }
            this.ensureBlobs();
            this.ensureTextures();
            this.resolveBase();

            const frameKey = this.getFrameKey();
            if (this.isStill && this.staticFrameKey === frameKey) return;

            const time = this.isStill ? 0 : getTimelineTime();
            const t = time * this.speed;
            // F2: breathing runs on the shared timeline at sqrt(speed).
            this.breathT = time * Math.sqrt(Math.max(this.speed, 0.05));
            const ctx = this.ctx;
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = this.baseFill;
            ctx.fillRect(0, 0, this.width, this.height);
            const theme = this.isDark ? "dark" : "light";
            const film = FILM[theme];
            const pageFilm = this.filmMode === "page";

            if (this.isDark) {
                this.blobCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
                this.blobCtx.clearRect(0, 0, this.width, this.height);
                for (const blob of this.blobs) {
                    blob.update(t, this.width, this.height, this.mouse, this.breathT);
                    blob.draw(this.blobCtx);
                }

                ctx.save();
                ctx.filter = `blur(${this.layout === "neutral" ? 40 : 64}px)`;
                ctx.globalCompositeOperation = "screen";
                ctx.drawImage(this.blobCanvas, 0, 0, this.width, this.height);
                ctx.restore();

                this.drawSupport(t);

                if (this.darkGlow === "subtle") {
                    this.drawDarkFalloff();
                }

                if (pageFilm) {
                    this.drawFieldOpacity();
                    this.drawPlainTexture(this.darkDither, film.dither);
                    this.drawPlainTexture(this.darkGrain, film.grain);
                } else {
                    this.renderDarkColourField(t);
                    this.buildColourMask(GRAIN_MASK_SATURATION);
                    this.drawMaskedTexture(this.darkDither, film.dither);
                    this.drawMaskedTexture(this.darkGrain, film.grain);
                    this.drawMaskedOverlay(theme);
                    this.applyToneLift(theme);
                }
            } else {
                this.renderColourField(t);
                ctx.drawImage(this.fieldCanvas, 0, 0, this.width, this.height);
                if (pageFilm) {
                    this.drawFieldOpacity();
                    this.drawPlainTexture(this.lightGrain, film.grain);
                } else {
                    this.buildColourMask(GRAIN_MASK_SATURATION);
                    this.drawMaskedTexture(this.lightGrain, film.grain);
                    this.drawMaskedOverlay(theme);
                    this.applyToneLift(theme);
                }
            }

            this.markReady();
            if (this.isStill) this.staticFrameKey = frameKey;
        }
    }

    // F1: the fine noise layer, rasterised once per theme and pixel density.
    // The SVG loads asynchronously; surfaces repaint once it is ready.
    const overlaySources = {};
    const overlayPatterns = new Map();
    let overlayGeneration = 0;

    function getOverlaySource(theme) {
        if (overlaySources[theme]) return overlaySources[theme];
        const image = new Image();
        const entry = { image, ready: false };
        image.onload = () => {
            entry.ready = true;
            overlayGeneration += 1;
            surfaces.forEach((surface) => {
                surface.staticFrameKey = "";
            });
        };
        image.src = `data:image/svg+xml,${encodeURIComponent(FILM_OVERLAY_SVG[theme])}`;
        overlaySources[theme] = entry;
        return entry;
    }

    function getOverlayPattern(theme, dpr, ctx) {
        const key = `${theme}@${dpr}`;
        if (overlayPatterns.has(key)) return overlayPatterns.get(key);
        const source = getOverlaySource(theme);
        if (!source.ready) return null;
        const tile = document.createElement("canvas");
        const size = Math.max(1, Math.round(FILM_OVERLAY_TILE * dpr));
        tile.width = size;
        tile.height = size;
        tile.getContext("2d").drawImage(source.image, 0, 0, size, size);
        const pattern = ctx.createPattern(tile, "repeat");
        if (pattern && pattern.setTransform && typeof DOMMatrix === "function") {
            pattern.setTransform(new DOMMatrix().scaleSelf(1 / dpr, 1 / dpr));
        }
        overlayPatterns.set(key, pattern);
        return pattern;
    }

    function scan(root = document) {
        root.querySelectorAll?.(".radiance-local").forEach((element) => {
            if (surfaceByElement.has(element)) return;
            const surface = new RadianceSurface(element);
            surfaceByElement.set(element, surface);
            surfaces.add(surface);
        });

        surfaces.forEach((surface) => {
            if (surface.element.isConnected) return;
            surface.destroy();
            surfaces.delete(surface);
        });

        startLoop();
    }

    function frame(timestamp) {
        if (!isDocumentVisible) {
            raf = 0;
            return;
        }

        surfaces.forEach((surface) => surface.render(timestamp));
        raf = window.requestAnimationFrame(frame);
    }

    function startLoop() {
        if (raf || !isDocumentVisible) return;
        raf = window.requestAnimationFrame(frame);
    }

    function stopLoop() {
        if (!raf) return;
        window.cancelAnimationFrame(raf);
        raf = 0;
    }

    function handleVisibilityChange() {
        isDocumentVisible = document.visibilityState !== "hidden";
        if (isDocumentVisible) {
            startLoop();
        } else {
            stopLoop();
        }
    }

    function observeDomChanges() {
        if (mutationObserver || !document.body || !("MutationObserver" in window)) return;
        mutationObserver = new MutationObserver((mutations) => {
            const needsScan = mutations.some((mutation) => (
                [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE)
                || [...mutation.removedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE)
            ));
            if (needsScan) scan();
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    function renderGrainPreview(canvas, mode = "light") {
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const safeMode = mode === "dark" ? "dark" : "light";
        const rect = canvas.getBoundingClientRect();
        const maxWidth = Number(canvas.dataset.grainPreviewMaxWidth || "0");
        const maxHeight = Number(canvas.dataset.grainPreviewMaxHeight || "0");
        const measuredWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || canvas.width || 280));
        const measuredHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || canvas.height || 120));
        const width = maxWidth > 0 ? Math.min(measuredWidth, maxWidth) : measuredWidth;
        const height = maxHeight > 0 ? Math.min(measuredHeight, maxHeight) : measuredHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = safeMode === "dark" ? DARK_SURFACE : "#ffffff";
        ctx.fillRect(0, 0, width, height);

        if (safeMode === "dark") {
            const dither = RadianceSurface.prototype.createDarkDither.call({ width, height, dpr: 1 });
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(dither, 0, 0, width, height);
            ctx.restore();
        }

        const grain = RadianceSurface.prototype.createGrain.call({ width, height }, safeMode);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(grain, 0, 0, width, height);
        ctx.restore();
    }

    function handleReducedMotionChange(event) {
        prefersReducedMotion = event.matches;
        surfaces.forEach((surface) => {
            surface.staticFrameKey = "";
        });
        startLoop();
    }

    /* Read-only snapshot of every surface (tests and tooling). */
    function inspect() {
        return [...surfaces].map((surface) => ({
            pattern: surface.productName || surface.element.dataset.radiancePattern || surface.layout,
            product: surface.productName || null,
            engine: surface.product ? surface.product.engine : "template",
            appearance: surface.appearance,
            base: surface.baseFill,
            width: surface.width,
            height: surface.height,
            energy: surface.sbg ? surface.sbg.energy : null,
            settled: surface.sbg ? surface.sbg.settled : null,
            clock: surface.sbg ? surface.sbg.clock : null,
            costMs: surface.sbg ? surface.sbg.cost : null
        }));
    }

    window.RadianceLanguageRenderer = {
        version: RADIANCE_VERSION,
        refresh() {
            scan();
            startLoop();
        },
        renderGrainPreview,
        grainSize: RADIANCE_FILM_GRAIN_SIZE,
        patterns: RADIANCE_PATTERNS,
        products: PRODUCT_PATTERNS,
        resolvePattern: resolveRadiancePattern,
        inspect,
        /* For the Radiance admin's Spotter lab (spotter-lab/) and nothing else:
           preview a change to the Spotter engine on one surface before it is
           made in this file. Product patterns stay fixed (PRODUCT-2), nothing
           persists, and the linter fails any use outside spotter-lab/ (PRODUCT-5). */
        admin: Object.freeze({
            spotterDefaults() {
                return JSON.parse(JSON.stringify({ ...SBG_TUNING, levels: SBG_STATES, grain: { light: FILM.light.grain, dark: FILM.dark.grain } }));
            },
            tuneSpotter(element, values) {
                if (element) ADMIN_SPOTTER.set(element, JSON.parse(JSON.stringify(values || {})));
            },
            resetSpotter(element) {
                if (element) ADMIN_SPOTTER.delete(element);
            }
        }),
        get prefersReducedMotion() {
            return prefersReducedMotion;
        }
    };

    scan();
    observeDomChanges();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery?.addEventListener?.("change", handleReducedMotionChange);
    window.addEventListener("beforeunload", () => {
        stopLoop();
        mutationObserver?.disconnect();
        surfaces.forEach((surface) => surface.destroy());
        surfaces.clear();
        textureCache.clear();
    });
})();
