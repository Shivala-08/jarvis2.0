/**
 * JARVIS Hand Tracker — MediaPipe Hand Gesture Interaction Language
 *
 * Controls the holographic orb with a full gesture vocabulary instead of
 * raw pinches. Finger poses are derived from 21 hand landmarks; a state
 * machine layers arming, velocity, momentum, precision and z-depth on top.
 *
 * Gesture priority (contextual):
 *   ARMED (open palm) → one-hand (spin/point/grab) / two-hand (zoom) →
 *   radial / UI manipulation → disarmed (fist)
 *
 * All motion is emitted as smoothed deltas to the caller (orb.js) while the
 * engine internally tracks velocity and momentum so releases feel physical.
 */

// MediaPipe CDN URLs
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indices
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

// Gesture thresholds
const PINCH_ON = 0.34;
const PINCH_OFF = 0.48;
const POINT_CURL = 0.42;

// Arm/disarm state
const ENGAGE_HOLDS_MS = 300;      // hold still to engage ("select / grab")
const DISARM_HOLD_MS = 250;       // fist hold duration to disarm
const MOMENTUM_FRICTION = 0.94;   // per-frame decay applied after release
const MIN_MOMENTUM = 0.0002;      // stop decaying below this speed
const VELOCITY_SMOOTH = 0.5;      // velocity smoothing for throw
const PRECISION_SCALE = 0.35;     // multiplier in precision mode
const Z_DEPTH_SMOOTH = 0.3;       // hand-scale → z smoothing

/**
 * @typedef {Object} HandPose
 * Base pose per hand.
 * @property {string} pose  'palm' | 'fist' | 'point' | 'index' | 'peace' |
 *                          'open' | 'pinch' | 'none'
 * @property {boolean} pinching
 * @property {{x:number,y:number}} palm  smoothed palm center
 * @property {number} z       estimated depth (0 = neutral, + = toward camera)
 */

/**
 * Hand tracker for controlling the JARVIS orb with an interaction language.
 */
export class HandTracker {
  constructor(video, overlay, callbacks = {}) {
    this.video = video;
    this.overlay = overlay;
    this.callbacks = callbacks;

    this.landmarker = null;
    this.stream = null;
    this.rafId = 0;
    this.running = false;
    this.lastVideoTime = -1;

    // Per-hand state (keyed by hand label: Left / Right)
    this.hands = new Map();

    // Global interaction state
    this.armed = false;                 // interaction armed (open palm)
    this.palmHoldStart = null;          // for arming
    this.fistHoldStart = null;          // for disarming
    this.interaction = 'idle';          // idle | spin | zoom | point | extract
    this.precision = false;             // peace-hold → precision mode
    this.precisionHoldStart = null;

    // Spin / momentum
    this.spinVelocity = { theta: 0, phi: 0 };
    this.prevSpinGrab = null;
    this.spinStart = null;              // millis when grab engaged
    this.released = false;

    // Zoom
    this.prevZoomDist = null;

    // Z-depth
    this.smoothZ = 0;

    // Swipe tracking
    this.swipe = null;
    this.swipeSpeed = 0;
    this.swipePos = null;
    this.swipeTime = null;
    this.swipeVelocity = 0;
    this.focus = null;
    this.lastZ = null;

    // Status/logging
    this.lastStatus = { hands: 0, mode: 'idle', armed: false, precision: false };
    this.lastDetected = null;
  }

  // ─────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      const { FilesetResolver, HandLandmarker } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35'
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);

      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };

      try {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, options);
      } catch {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: 'CPU' },
        });
      }

      this.running = true;
      this.loop();
      this.emitStatus();
      console.log('[JARVIS] Gesture tracking started — raise an open palm to arm');
    } catch (err) {
      console.error('[JARVIS] Hand tracking failed to start:', err);
      this.emitStatus();
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.hands.clear();
    this.armed = false;
    this.interaction = 'idle';
    this.precision = false;
    this.spinVelocity = { theta: 0, phi: 0 };
    this.prevSpinGrab = null;
    this.prevZoomDist = null;
    this.smoothZ = 0;
    this.swipe = null;
    this.palmHoldStart = null;
    this.fistHoldStart = null;
    this.precisionHoldStart = null;

    const ctx = this.overlay?.getContext('2d');
    ctx?.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.emitStatus();
    console.log('[JARVIS] Gesture tracking stopped');
  }

  // Main recognition loop
  loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.landmarker || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    const labels = result.handedness.map(h => h[0]?.categoryName ?? '?');

    this.updateHands(result.landmarks, labels);
    this.updateStateMachine();
    this.applyMomentum();
    this.drawOverlay(result.landmarks);
    this.emitStatus();
  };

  // ─────────────────────────────────────────────
  //  FINGER POSE DETECTION
  // ─────────────────────────────────────────────
  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // A non-thumb finger is extended if its tip reaches well past its MCP
  // (straight ≈ tip ~2× first segment; curled ≈ tip pulled back to ~1×).
  fingerExtended(lm, mcp, pip, tip) {
    const baseToMid = this.dist(lm[mcp], lm[pip]);
    const baseToTip = this.dist(lm[mcp], lm[tip]);
    if (baseToMid < 1e-6) return false;
    return baseToTip > baseToMid * 1.5;
  }

  handScale(lm) {
    return this.dist(lm[WRIST], lm[MIDDLE_MCP]);
  }

  classifyPose(lm) {
    const scale = this.handScale(lm);
    if (scale < 1e-6) return 'none';

    // Per-finger extension using each finger's own MCP→PIP segment.
    // Extended: tip reaches well past the first joint; curled: tip pulled back.
    const ext = (mcp, pip, tip) => {
      const seg = this.dist(lm[mcp], lm[pip]);
      const reach = this.dist(lm[mcp], lm[tip]);
      if (seg < 1e-6) return false;
      return reach > seg * 1.5;
    };

    const idxOn = ext(INDEX_MCP, INDEX_PIP, INDEX_TIP);
    const midOn = ext(MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP);
    const ringOn = ext(RING_MCP, RING_PIP, RING_TIP);
    const pinkyOn = ext(PINKY_MCP, PINKY_PIP, PINKY_TIP);

    const allOn = idxOn && midOn && ringOn && pinkyOn;
    const allOff = !idxOn && !midOn && !ringOn && !pinkyOn;

    // Fist beats pinch (a fist has the thumb folded near the fingers too)
    if (allOff) return 'fist';

    // Pinch: thumb tip close to the index tip (index extended, canonical),
    // or to the middle tip when the index is folded (thumb-to-middle pinch).
    if (idxOn) {
      const pinchRatio = this.dist(lm[THUMB_TIP], lm[INDEX_TIP]) / scale;
      if (pinchRatio < PINCH_ON) return 'pinch';
    } else {
      const thumbToMiddle = this.dist(lm[THUMB_TIP], lm[MIDDLE_TIP]) / scale;
      if (thumbToMiddle < PINCH_ON) return 'pinch';
    }

    if (allOn) return 'palm';

    // Two-finger (peace): index + middle extended, ring + pinky curled
    if (idxOn && midOn && !ringOn && !pinkyOn) return 'peace';

    // Point: index extended alone
    if (idxOn && !midOn) return 'point';

    return 'none';
  }

  // ─────────────────────────────────────────────
  //  PER-HAND UPDATE
  // ─────────────────────────────────────────────
  updateHands(landmarks, labels) {
    const seen = new Set();

    landmarks.forEach((lm, i) => {
      const label = labels[i];
      seen.add(label);

      const scale = this.handScale(lm);
      if (scale < 1e-6) return;

      // Smoothed palm center from thumb + index (mirrored for user perspective)
      const raw = {
        x: 1 - (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2,
        y: (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2,
        z: (scale - 0.25) / 0.35, // apparent size ⇒ depth, ~0 at neutral
      };

      let h = this.hands.get(label);
      if (!h) {
        h = {
          label,
          grab: raw,
          z: 0,
          pose: 'none',
          pinching: false,
          palm: { x: raw.x, y: raw.y },
        };
        this.hands.set(label, h);
      }

      const smoothing = this.precision ? 0.6 : 0.4;
      h.grab = {
        x: h.grab.x + (raw.x - h.grab.x) * smoothing,
        y: h.grab.y + (raw.y - h.grab.y) * smoothing,
        z: h.grab.z + (raw.z - h.grab.z) * Z_DEPTH_SMOOTH,
      };
      h.z = h.grab.z;
      h.palm = { x: raw.x, y: raw.y };
      h.pose = this.classifyPose(lm);
    });

    // Drop hands that left the frame
    for (const key of this.hands.keys()) {
      if (!seen.has(key)) this.hands.delete(key);
    }
  }

  // ─────────────────────────────────────────────
  //  ARMING + INTERACTION STATE MACHINE
  // ─────────────────────────────────────────────
  updateStateMachine() {
    const handList = [...this.hands.values()];
    const now = performance.now();

    // Track "detected" presence for orb state
    this.lastDetected = handList.length > 0 ? now : null;

    // ── Precision mode: two fingers held (peace) → precision
    const anyPeace = handList.every(h => h.pose === 'peace') && handList.length >= 1;
    if (anyPeace) {
      if (!this.precisionHoldStart) this.precisionHoldStart = now;
      if (now - this.precisionHoldStart > 180) this.precision = true;
    } else {
      this.precisionHoldStart = null;
      this.precision = false;
    }

    // ── Arming: open palm toward orb, held ~300ms → arm
    const anyPalm = handList.some(h => h.pose === 'palm');
    if (anyPalm) {
      if (!this.palmHoldStart) this.palmHoldStart = now;
      if (!this.armed && now - this.palmHoldStart > ENGAGE_HOLDS_MS) {
        this.armed = true;
        this.interaction = 'idle';
        this.callbacks.onArm?.(true);
        this.callbacks.onFeedback?.({ kind: 'arm', text: 'INTERACTION ARMED' });
        console.log('[JARVIS] Interaction armed');
      }
    } else {
      this.palmHoldStart = null;
    }

    // ── Disarm: fist held → disarm
    const anyFist = handList.some(h => h.pose === 'fist');
    if (anyFist) {
      if (!this.fistHoldStart) this.fistHoldStart = now;
      if (this.armed && now - this.fistHoldStart > DISARM_HOLD_MS) {
        this.armed = false;
        this.interaction = 'idle';
        this.callbacks.onArm?.(false);
        this.callbacks.onFeedback?.({ kind: 'disarm', text: 'INTERACTION DISARMED' });
        console.log('[JARVIS] Interaction disarmed');
      }
    } else {
      this.fistHoldStart = null;
    }

    // Interaction only runs while armed
    if (!this.armed) {
      this.interaction = 'idle';
      this.prevSpinGrab = null;
      this.prevZoomDist = null;
      this.swipe = null;
      return;
    }

    this.resolveInteraction(handList);
  }

  resolveInteraction(handList) {
    const pinched = handList.filter(h => h.pose === 'pinch');
    const prev = this.interaction;

    // ── Two-handed pinch → zoom (with z-aware depth too)
    if (pinched.length >= 2) {
      this.interaction = 'zoom';
      if (prev !== 'zoom') this.prevZoomDist = null;
      this.doZoom(pinched[0], pinched[1]);
      // Two-hand simultaneous push/pull → also apply z (extract/return combos)
      this.doDepth(pinched);
      return;
    }

    // ── One-handed pinch → spin / engage-to-select / extract
    if (pinched.length === 1) {
      this.interaction = 'spin';
      this.doSpin(pinched[0]);
      this.doDepth(pinched);
      return;
    }

    // ── Point (index extended) → focus / hover target
    const pointing = handList.filter(h => h.pose === 'point');
    if (pointing.length === 1 && prev !== 'spin' && prev !== 'zoom') {
      this.interaction = 'point';
      const p = pointing[0];
      if (Math.abs(p.grab.x - (this.focus ?? { x: 0.5 }).x) > 0.02) {
        this.callbacks.onPoint?.(p.grab.x, p.grab.y);
      }
      this.focus = { x: p.grab.x, y: p.grab.y };
      return;
    }

    // ── Peace swipe (two fingers) → switch modules, velocity = pages jumped
    const peace = handList.filter(h => h.pose === 'peace');
    if (peace.length === 1) {
      const p = peace[0];
      this.trackSwipe(p);
      this.interaction = 'idle';
      return;
    }

    // Nothing active → clear references, let momentum coast
    this.interaction = 'idle';
    this.spinStart = null;
    this.prevSpinGrab = null;
    this.prevZoomDist = null;
    this.focus = null;
    this.swipeVelocity = 0;
  }

  // Swipe detection from a moving hand (peace/point), velocity → pages
  trackSwipe(hand) {
    const now = performance.now();
    const g = hand.grab;
    const dt = this.swipeTime ? (now - this.swipeTime) : 0;
    const inst = (this.swipePos && dt > 0)
      ? (g.x - this.swipePos.x) / (dt / 1000)
      : 0;

    this.swipeVelocity = this.swipeVelocity !== undefined
      ? this.swipeVelocity * 0.6 + inst * 0.4
      : inst;
    this.swipePos = { x: g.x, y: g.y };
    this.swipeTime = now;

    // A fast horizontal swipe triggers a module change
    if (Math.abs(this.swipeVelocity) > 2.2) {
      const dir = this.swipeVelocity > 0 ? 1 : -1;
      const pages = Math.max(1, Math.min(3, Math.floor(Math.abs(this.swipeVelocity) / 4)));
      this.callbacks.onSwipe?.(dir, pages);
      this.swipeVelocity = 0; // debounce until next gesture
      this.callbacks.onFeedback?.({ kind: 'swipe', text: dir > 0 ? 'NEXT' : 'PREV' });
    }
  }

  // Z-depth extract / return: pinch then pull hand toward/away from camera
  doDepth(pinched) {
    if (pinched.length !== 1) return;
    const z = pinched[0].z;
    const prevZ = this.lastZ ?? z;
    this.lastZ = z;
    const dz = z - prevZ;
    if (Math.abs(dz) > 0.06) {
      // Pull toward camera (hand grows) → extract info; push away → return
      this.callbacks.onDepth?.(dz);
    }
  }

  doSpin(hand) {
    const grab = hand.grab;
    const now = performance.now();

    // "Select / hold still" → lock onto the orb (spinStart represents engagement)
    if (!this.prevSpinGrab) {
      this.prevSpinGrab = grab;
      this.spinStart = now;
      this.spinVelocity = { theta: 0, phi: 0 };
      this.released = false;
      return;
    }

    const dx = grab.x - this.prevSpinGrab.x;
    const dy = grab.y - this.prevSpinGrab.y;
    const scale = this.precision ? PRECISION_SCALE : 1;

    if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
      const dTheta = dx * 5.0 * scale;
      const dPhi = dy * 5.0 * scale;

      // Feed orb directly and accumulate velocity for momentum
      this.callbacks.onRotate?.(dTheta, dPhi);
      this.spinVelocity.theta = this.spinVelocity.theta * VELOCITY_SMOOTH + dTheta * (1 - VELOCITY_SMOOTH);
      this.spinVelocity.phi = this.spinVelocity.phi * VELOCITY_SMOOTH + dPhi * (1 - VELOCITY_SMOOTH);
      this.released = false;
    }

    this.prevSpinGrab = grab;
    this.spinStart = now;
  }

  doZoom(ha, hb) {
    const d = Math.hypot(ha.grab.x - hb.grab.x, ha.grab.y - hb.grab.y);
    if (this.prevZoomDist && d > 1e-4) {
      const factor = Math.min(1.18, Math.max(0.85, this.prevZoomDist / d));
      const scale = this.precision ? 1 + (factor - 1) * PRECISION_SCALE : factor;
      this.callbacks.onZoom?.(scale);
    }
    this.prevZoomDist = d;
  }

  // ─────────────────────────────────────────────
  //  MOMENTUM — keep the orb coasting after release
  // ─────────────────────────────────────────────
  applyMomentum() {
    if (!this.armed || this.interaction !== 'idle') return; // only coast when armed+released
    const v = this.spinVelocity;
    if (Math.abs(v.theta) > MIN_MOMENTUM || Math.abs(v.phi) > MIN_MOMENTUM) {
      this.callbacks.onRotate?.(v.theta, v.phi);
      v.theta *= MOMENTUM_FRICTION;
      v.phi *= MOMENTUM_FRICTION;
    } else {
      v.theta = 0;
      v.phi = 0;
    }
  }

  // ─────────────────────────────────────────────
  //  OVERLAY — visual confirmation on the hand view
  // ─────────────────────────────────────────────
  drawOverlay(landmarks) {
    const ctx = this.overlay?.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.overlay;
    ctx.clearRect(0, 0, width, height);

    for (const lm of landmarks) {
      const thumb = lm[THUMB_TIP];
      const index = lm[INDEX_TIP];
      const tx = (1 - thumb.x) * width;
      const ty = thumb.y * height;
      const ix = (1 - index.x) * width;
      const iy = index.y * height;

      const scale = this.handScale(lm);
      const pinched = scale > 1e-6 && this.dist(thumb, index) / scale < PINCH_ON;

      ctx.strokeStyle = pinched ? '#ffcc66' : 'rgba(255,170,48,0.5)';
      ctx.lineWidth = pinched ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.stroke();

      ctx.fillStyle = pinched ? '#ffcc66' : 'rgba(255,170,48,0.7)';
      for (const [x, y] of [[tx, ty], [ix, iy]]) {
        ctx.beginPath();
        ctx.arc(x, y, pinched ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arm ring around pinch when interaction is armed
      if (this.armed) {
        ctx.strokeStyle = 'rgba(124, 200, 130, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ─────────────────────────────────────────────
  //  STATUS — emitted to the HUD
  // ─────────────────────────────────────────────
  emitStatus() {
    const handCount = this.hands.size;
    const mode = this.interaction;
    const status = {
      hands: handCount,
      mode,
      armed: this.armed,
      precision: this.precision,
      detected: handCount > 0,
    };

    const changed =
      status.hands !== this.lastStatus.hands ||
      status.mode !== this.lastStatus.mode ||
      status.armed !== this.lastStatus.armed ||
      status.precision !== this.lastStatus.precision;

    if (changed) {
      this.lastStatus = status;
      this.callbacks.onStatus?.(status);

      // Confirmation feedback when a meaningful gesture engages
      const feedback = mode === 'spin' ? { kind: 'spin', text: 'SPINNING ORB' }
        : mode === 'zoom' ? { kind: 'zoom', text: 'ZOOMING ORB' }
        : null;
      if (feedback) this.callbacks.onFeedback?.({ ...feedback, status });
    }
  }
}
