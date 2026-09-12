/**
 * J.A.R.V.I.S. Holographic Orb Interface
 * 
 * A Three.js implementation of the JARVIS AI core from Avengers: Age of Ultron.
 * Features:
 * - Multi-layer wireframe shells (outer, secondary, inner core)
 * - 1700+ floating code text sprites
 * - 250+ orbiting debris particles
 * - Concentric orbital rings at different angles
 * - Bright nucleus with icosahedron wireframe
 * - Bloom + chromatic aberration post-processing
 * - Live OpenJarvis REST polling for agent status
 * - Orb reacts to agent states (thinking, speaking, idle)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HandTracker } from './handTracker.js';
import { createOpenJarvisAdapter } from './adapter/openjarvis-adapter.js';

// ═══════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════

const CONFIG = {
  // OpenJarvis API base URL
  apiUrl: 'http://127.0.0.1:8000',
  
  // Colors (JARVIS Amber/Gold)
  C_BRIGHT: 0xffaa30,
  C_MID: 0xdd7700,
  C_DIM: 0x884400,
  C_FAINT: 0x553300,
  C_HOT: 0xffcc66,
  C_NUCLEUS: 0xffdd66,
  C_CYAN: 0x00f0ff,  // Status text accent
  
  // Orb dimensions
  R_OUTER: 2.0,
  R_SECONDARY: 2.12,
  R_INNER: 0.9,
  R_CORE: 0.25,
  
  // Particle counts
  TEXT_OUTER: 1200,
  TEXT_INNER: 100,
  TEXT_AMBIENT: 400,
  DEBRIS_COUNT: 250,
  
  // Animation
  IDLE_SPEED: 0.002,
  THINKING_SPEED: 0.015,
  SPEAKING_SPEED: 0.008,
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

const state = {
  agentState: 'idle',  // idle, thinking, speaking, error
  orbSpeed: CONFIG.IDLE_SPEED,
  orbGlow: 1.0,
  connected: false,
  startTime: Date.now(),
  requestCount: 0,
  handTracking: false,
  handMode: 'idle',
};

// ═══════════════════════════════════════════════
// THREE.JS SETUP
// ═══════════════════════════════════════════════

const container = document.getElementById('orb-container');
const width = window.innerWidth;
const height = window.innerHeight;

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// Camera
const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
camera.position.set(0, 0.5, 5.5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
container.appendChild(renderer.domElement);

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(width, height),
  1.8,   // strength
  0.4,   // radius
  0.2,   // threshold
);
composer.addPass(bloom);

// Chromatic aberration + amber color grade
const chromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - vec2(0.5);
      float d = length(dir);
      float offset = uIntensity * d;
      float flicker = 1.0 + 0.02 * sin(uTime * 30.0) * sin(uTime * 7.3);
      vec4 cr = texture2D(tDiffuse, vUv + dir * offset);
      vec4 cg = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - dir * offset * 0.5);
      gl_FragColor = vec4(cr.r, cg.g * 1.05, cb.b * 0.6, 1.0) * flicker;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.15, 0.85, 0.55), 0.3);
    }
  `,
};
const chromaticPass = new ShaderPass(chromaticShader);
composer.addPass(chromaticPass);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.minDistance = 0.6;
controls.maxDistance = 40;
controls.zoomSpeed = 1.4;
controls.enablePan = false;

// ═══════════════════════════════════════════════
// MATERIAL HELPERS
// ═══════════════════════════════════════════════

function lineMat(color, opacity = 1) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// ═══════════════════════════════════════════════
// GEOMETRY UTILITIES
// ═══════════════════════════════════════════════

function latRing(radius, lat, segs = 120) {
  const r = radius * Math.cos(lat);
  const y = radius * Math.sin(lat);
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function meridian(radius, lon, segs = 120) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const lat = (i / segs) * Math.PI - Math.PI / 2;
    pts.push(
      new THREE.Vector3(
        radius * Math.cos(lat) * Math.cos(lon),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon),
      ),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

// ═══════════════════════════════════════════════
// ORB ROOT
// ═══════════════════════════════════════════════

const orbGroup = new THREE.Group();
scene.add(orbGroup);

// ═══════════════════════════════════════════════
// LAYER 1: OUTER SHELL — dense wireframe grid
// ═══════════════════════════════════════════════

const outerShell = new THREE.Group();
const R1 = CONFIG.R_OUTER;

// Dense latitude rings (30+)
for (let i = -15; i <= 15; i++) {
  const lat = (i / 15) * (Math.PI / 2) * 0.95;
  const opacity = i % 3 === 0 ? 0.5 : 0.12;
  const color = i % 3 === 0 ? CONFIG.C_MID : CONFIG.C_FAINT;
  outerShell.add(new THREE.Line(latRing(R1, lat), lineMat(color, opacity)));
}

// Dense meridians (24)
for (let i = 0; i < 24; i++) {
  const lon = (i / 24) * Math.PI * 2;
  const isMajor = i % 6 === 0;
  outerShell.add(
    new THREE.Line(
      meridian(R1, lon),
      lineMat(isMajor ? CONFIG.C_MID : CONFIG.C_FAINT, isMajor ? 0.6 : 0.1),
    ),
  );
}

// 4 bright cross meridians (the "plus" shape)
const CROSS_LINES = 18;
const CROSS_SPREAD = 0.25;
for (let i = 0; i < 4; i++) {
  const lon = (i / 4) * Math.PI * 2;
  for (let j = 0; j < CROSS_LINES; j++) {
    const t = (j / (CROSS_LINES - 1)) * 2 - 1;
    const offset = (t * CROSS_SPREAD) / 2;
    const falloff = 1 - Math.abs(t) * 0.7;
    const opacity = 0.85 * falloff;
    const color = Math.abs(t) < 0.3 ? CONFIG.C_BRIGHT : CONFIG.C_MID;
    outerShell.add(
      new THREE.Line(meridian(R1, lon + offset, 200), lineMat(color, opacity)),
    );
  }
}

// Bright equator band
const EQ_LINES = 20;
const EQ_SPREAD = 0.35;
for (let j = 0; j < EQ_LINES; j++) {
  const t = (j / (EQ_LINES - 1)) * 2 - 1;
  const offset = (t * EQ_SPREAD) / 2;
  const falloff = 1 - Math.abs(t) * 0.65;
  const opacity = 0.8 * falloff;
  const color = Math.abs(t) < 0.3 ? CONFIG.C_BRIGHT : CONFIG.C_MID;
  outerShell.add(
    new THREE.Line(latRing(R1, offset, 200), lineMat(color, opacity)),
  );
}

orbGroup.add(outerShell);

// ═══════════════════════════════════════════════
// LAYER 2: GRID PANELS on the sphere surface
// ═══════════════════════════════════════════════

const panelGroup = new THREE.Group();

function createSpherePanel(latCenter, lonCenter, latSpan, lonSpan, radius, divisions = 4) {
  const group = new THREE.Group();
  const mat = lineMat(CONFIG.C_DIM, 0.25);
  
  for (let i = 0; i <= divisions; i++) {
    const lat = latCenter - latSpan / 2 + (i / divisions) * latSpan;
    const pts = [];
    for (let j = 0; j <= divisions * 4; j++) {
      const lon = lonCenter - lonSpan / 2 + (j / (divisions * 4)) * lonSpan;
      pts.push(
        new THREE.Vector3(
          radius * Math.cos(lat) * Math.cos(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  
  for (let j = 0; j <= divisions; j++) {
    const lon = lonCenter - lonSpan / 2 + (j / divisions) * lonSpan;
    const pts = [];
    for (let i = 0; i <= divisions * 4; i++) {
      const lat = latCenter - latSpan / 2 + (i / (divisions * 4)) * latSpan;
      pts.push(
        new THREE.Vector3(
          radius * Math.cos(lat) * Math.cos(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  
  return group;
}

// Scatter 30 panels across the sphere
for (let i = 0; i < 30; i++) {
  const lat = (Math.random() - 0.5) * Math.PI * 0.8;
  const lon = Math.random() * Math.PI * 2;
  const size = 0.15 + Math.random() * 0.25;
  const panel = createSpherePanel(lat, lon, size, size, R1 + 0.01, 3 + Math.floor(Math.random() * 3));
  panelGroup.add(panel);
}

orbGroup.add(panelGroup);

// ═══════════════════════════════════════════════
// LAYER 3: SECONDARY SHELL — partial arcs
// ═══════════════════════════════════════════════

const shell2 = new THREE.Group();
const R2 = CONFIG.R_SECONDARY;

// Partial arcs at random latitudes
for (let i = 0; i < 16; i++) {
  const lat = (Math.random() - 0.5) * Math.PI * 0.85;
  const startLon = Math.random() * Math.PI * 2;
  const arcLen = 0.3 + Math.random() * 1.2;
  const pts = [];
  const segs = 60;
  const r = R2 * Math.cos(lat);
  const y = R2 * Math.sin(lat);
  for (let j = 0; j <= segs; j++) {
    const a = startLon + (j / segs) * arcLen;
    pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
  }
  shell2.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(CONFIG.C_MID, 0.2 + Math.random() * 0.3),
    ),
  );
}

// Partial meridian arcs
for (let i = 0; i < 12; i++) {
  const lon = Math.random() * Math.PI * 2;
  const startLat = (Math.random() - 0.5) * Math.PI * 0.8;
  const arcLen = 0.3 + Math.random() * 0.8;
  const pts = [];
  const segs = 40;
  for (let j = 0; j <= segs; j++) {
    const lat = startLat + (j / segs) * arcLen;
    pts.push(
      new THREE.Vector3(
        R2 * Math.cos(lat) * Math.cos(lon),
        R2 * Math.sin(lat),
        R2 * Math.cos(lat) * Math.sin(lon),
      ),
    );
  }
  shell2.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(CONFIG.C_DIM, 0.15 + Math.random() * 0.2),
    ),
  );
}

orbGroup.add(shell2);

// ═══════════════════════════════════════════════
// LAYER 4: INNER CORE — spiral geodesic
// ═══════════════════════════════════════════════

const innerCore = new THREE.Group();
const R3 = CONFIG.R_INNER;

// Dense spirals
for (let s = 0; s < 8; s++) {
  const pts = [];
  const turns = 3 + Math.random() * 2;
  const segs = 300;
  const phase = (s / 8) * Math.PI * 2;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const lat = t * Math.PI - Math.PI / 2;
    const lon = t * turns * Math.PI * 2 + phase;
    pts.push(
      new THREE.Vector3(
        R3 * Math.cos(lat) * Math.cos(lon),
        R3 * Math.sin(lat),
        R3 * Math.cos(lat) * Math.sin(lon),
      ),
    );
  }
  innerCore.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(CONFIG.C_BRIGHT, 0.3 + Math.random() * 0.2),
    ),
  );
}

// Inner latitude rings
for (let i = -6; i <= 6; i++) {
  const lat = (i / 6) * (Math.PI / 2) * 0.9;
  innerCore.add(new THREE.Line(latRing(R3, lat, 80), lineMat(CONFIG.C_DIM, 0.2)));
}

// Inner meridians
for (let i = 0; i < 12; i++) {
  const lon = (i / 12) * Math.PI * 2;
  innerCore.add(new THREE.Line(meridian(R3, lon, 80), lineMat(CONFIG.C_DIM, 0.15)));
}

orbGroup.add(innerCore);

// ═══════════════════════════════════════════════
// LAYER 5: INNERMOST CORE — bright hot center
// ═══════════════════════════════════════════════

const coreR = CONFIG.R_CORE;

// Icosahedron wireframe core
const icoGeo = new THREE.IcosahedronGeometry(coreR, 1);
const icoEdges = new THREE.EdgesGeometry(icoGeo);
const icoWireMat = lineMat(CONFIG.C_HOT, 0.9);
const icoWire = new THREE.LineSegments(icoEdges, icoWireMat);
orbGroup.add(icoWire);

// Glowing center sphere
const coreSphereMat = new THREE.MeshBasicMaterial({
  color: CONFIG.C_HOT,
  transparent: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending,
});
const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), coreSphereMat);
orbGroup.add(coreSphere);

// Larger faint glow
const glowSphereMat = new THREE.MeshBasicMaterial({
  color: CONFIG.C_MID,
  transparent: true,
  opacity: 0.04,
  blending: THREE.AdditiveBlending,
});
const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), glowSphereMat);
orbGroup.add(glowSphere);

// ═══════════════════════════════════════════════
// LAYER 6: ORBITAL RINGS — concentric at angles
// ═══════════════════════════════════════════════

const orbitalRings = new THREE.Group();

const ringConfigs = [
  { radius: 2.5, axis: 'y', speed: 0.003, color: CONFIG.C_BRIGHT, opacity: 0.4 },
  { radius: 2.8, axis: 'x', speed: -0.002, color: CONFIG.C_MID, opacity: 0.3 },
  { radius: 3.0, axis: 'z', speed: 0.0015, color: CONFIG.C_DIM, opacity: 0.25 },
  { radius: 2.3, axis: 'y', speed: -0.004, color: CONFIG.C_HOT, opacity: 0.5 },
  { radius: 3.2, axis: 'x', speed: 0.001, color: CONFIG.C_FAINT, opacity: 0.2 },
];

const rings = [];
for (const rc of ringConfigs) {
  const pts = [];
  const segs = 200;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(rc.radius * Math.cos(a), 0, rc.radius * Math.sin(a)));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mesh = new THREE.Line(geom, lineMat(rc.color, rc.opacity));
  
  // Tilt the ring
  if (rc.axis === 'x') mesh.rotation.x = Math.PI / 2;
  if (rc.axis === 'z') mesh.rotation.z = Math.PI / 3;
  if (rc.axis === 'y') mesh.rotation.y = Math.random() * Math.PI;
  
  rings.push({ mesh, speed: rc.speed });
  orbitalRings.add(mesh);
}

orbGroup.add(orbitalRings);

// ═══════════════════════════════════════════════
// LAYER 7: CODE TEXT SPRITES — floating fragments
// ═══════════════════════════════════════════════

const codeSnippets = [
  'sys.init()', '0xFF3A', 'malloc()', '>> SCAN', 'void*', 'ACK',
  'SYNC OK', 'ptr_ref', 'exec()', 'hash256', '::bind', 'core.0',
  '01101001', '10110100', '>>> RDY', 'HEAP 4K', 'TCP/SYN',
  'mutex.lk', 'IRQ 0x7', 'DMA xfer', 'REG EAX', 'FAULT 0',
  'kernel.d', 'pipe |>', 'chmod +x', 'fork()', 'SIGTERM',
  'eth0: UP', 'AES-256', 'RSA 4096', 'TLS 1.3', 'HTTP/2',
  'latency', '200 OK', 'PATCH /', 'fn main', 'use std',
  'impl Orb', 'async {}', 'spawn()', 'arc::new', '.unwrap',
  'jarvis.core', 'neural.net', 'quantum.entangle', 'matrix.inv',
  'entropy', 'cipher', 'decode', 'encrypt', 'hash', 'verify',
];

function makeTextSprite(text, size = 0.08) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 14px Courier New';
  const alpha = 0.35 + Math.random() * 0.55;
  ctx.fillStyle = `rgba(255, ${(130 + Math.random() * 80) | 0}, ${(20 + Math.random() * 30) | 0}, ${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  s.scale.set(size * 5, size * 0.7, 1);
  return s;
}

function scatterText(count, sizeFn, rFn, speedScale) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const sp = makeTextSprite(
      codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
      sizeFn(),
    );
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = rFn();
    sp.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
    sp.userData = {
      phi, theta, r,
      speed: (speedScale[0] + Math.random() * speedScale[1]) * (Math.random() > 0.5 ? 1 : -1),
    };
    group.add(sp);
  }
  return group;
}

// On outer sphere — dense text coverage
const textOuter = scatterText(
  CONFIG.TEXT_OUTER,
  () => 0.04 + Math.random() * 0.04,
  () => R1 + 0.03 + Math.random() * 0.08,
  [0.0002, 0.0008],
);
orbGroup.add(textOuter);

// On inner core
const textInner = scatterText(
  CONFIG.TEXT_INNER,
  () => 0.03 + Math.random() * 0.03,
  () => R3 + 0.02,
  [0.0005, 0.001],
);
orbGroup.add(textInner);

// Floating ambient text between shells
const textAmbient = scatterText(
  CONFIG.TEXT_AMBIENT,
  () => 0.03,
  () => R3 + 0.2 + Math.random() * (R1 - R3 - 0.3),
  [0.0003, 0.0006],
);
orbGroup.add(textAmbient);

// ═══════════════════════════════════════════════
// LAYER 8: ORBITING DEBRIS — particles
// ═══════════════════════════════════════════════

const debrisGeos = [
  new THREE.IcosahedronGeometry(0.012, 0),
  new THREE.IcosahedronGeometry(0.02, 0),
  new THREE.IcosahedronGeometry(0.03, 1),
  new THREE.IcosahedronGeometry(0.008, 0),
  new THREE.TetrahedronGeometry(0.015, 0),
  new THREE.OctahedronGeometry(0.018, 0),
];

const debris = [];
for (let i = 0; i < CONFIG.DEBRIS_COUNT; i++) {
  const geo = debrisGeos[Math.floor(Math.random() * debrisGeos.length)];
  const mat = new THREE.MeshBasicMaterial({
    color: Math.random() > 0.7 ? CONFIG.C_BRIGHT : CONFIG.C_MID,
    transparent: true,
    opacity: 0.3 + Math.random() * 0.6,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const orbitR = 1.2 + Math.random() * 4.0;
  const speed = (0.08 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1);
  const tiltX = Math.random() * Math.PI;
  const tiltZ = Math.random() * Math.PI;
  const phase = Math.random() * Math.PI * 2;
  
  debris.push({ mesh, orbitR, speed, tiltX, tiltZ, phase });
  orbGroup.add(mesh);
}

// ═══════════════════════════════════════════════
// LAYER 9: SCAN RINGS — rotating concentric
// ═══════════════════════════════════════════════

const scanRings = new THREE.Group();

for (let i = 0; i < 3; i++) {
  const radius = 2.2 + i * 0.3;
  const pts = [];
  const segs = 300;
  for (let j = 0; j <= segs; j++) {
    const a = (j / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const ring = new THREE.Line(geom, lineMat(CONFIG.C_BRIGHT, 0.3 - i * 0.08));
  
  // Different tilt for each
  ring.rotation.x = Math.PI / 2 + (i * Math.PI) / 6;
  ring.rotation.z = (i * Math.PI) / 4;
  
  scanRings.add(ring);
}

orbGroup.add(scanRings);

// ═══════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = clock.getDelta();
  
  // Update chromatic aberration time
  chromaticPass.uniforms.uTime.value = t;
  
  // Rotate orb based on state
  orbGroup.rotation.y += state.orbSpeed;
  
  // Rotate inner core faster
  innerCore.rotation.y += state.orbSpeed * 2;
  innerCore.rotation.x += state.orbSpeed * 0.5;
  
  // Rotate icosahedron core
  icoWire.rotation.y += state.orbSpeed * 3;
  icoWire.rotation.x += state.orbSpeed * 1.5;
  
  // Core glow pulse
  const glowPulse = 0.12 + 0.03 * Math.sin(t * 2);
  coreSphere.material.opacity = glowPulse;
  
  // Rotate orbital rings
  for (const ring of rings) {
    ring.mesh.rotation.y += ring.speed * state.orbSpeed * 500;
  }
  
  // Rotate scan rings
  scanRings.children.forEach((ring, i) => {
    ring.rotation.y += (0.005 + i * 0.002) * (state.agentState === 'thinking' ? 5 : 1);
  });
  
  // Animate debris orbits
  for (const d of debris) {
    const angle = t * d.speed + d.phase;
    d.mesh.position.set(
      d.orbitR * Math.cos(angle) * Math.cos(d.tiltX),
      d.orbitR * Math.sin(angle) * Math.sin(d.tiltZ),
      d.orbitR * Math.sin(angle) * Math.cos(d.tiltX),
    );
  }
  
  // Animate text sprites (gentle drift)
  [textOuter, textInner, textAmbient].forEach(group => {
    group.children.forEach(sprite => {
      const ud = sprite.userData;
      if (ud.speed) {
        sprite.position.x += Math.sin(t * ud.speed * 10) * 0.001;
        sprite.position.y += Math.cos(t * ud.speed * 8) * 0.0005;
      }
    });
  });
  
  // Bloom intensity based on state
  bloom.strength = 1.5 + (state.agentState === 'thinking' ? 0.5 : 0);
  
  controls.update();
  composer.render();
}

// ═══════════════════════════════════════════════
// OPENJARVIS REST CONNECTION
// ═══════════════════════════════════════════════

// OpenJarvis Adapter — maintains typed HudState
const openjarvisAdapter = createOpenJarvisAdapter({ baseUrl: CONFIG.apiUrl });

function connectDSH() {
  openjarvisAdapter.connect();
  
  // Subscribe to state changes and update all panels
  openjarvisAdapter.subscribe((hudState) => {
    updateAllPanels(hudState);
    
    // Sync orb state from HudState
    const agentState = hudState.agent.workflow_state;
    if (agentState === 'IMPLEMENTING' || agentState === 'VERIFYING') {
      setAgentState('thinking');
    } else if (agentState === 'SHIPPED') {
      setAgentState('speaking');
      setTimeout(() => setAgentState('idle'), 2000);
    }
  });
}

// ═══════════════════════════════════════════════
// UI UPDATE FUNCTIONS
// ═══════════════════════════════════════════════

function setAgentState(newState) {
  state.agentState = newState;
  
  switch (newState) {
    case 'idle':
      state.orbSpeed = CONFIG.IDLE_SPEED;
      break;
    case 'thinking':
      state.orbSpeed = CONFIG.THINKING_SPEED;
      break;
    case 'speaking':
      state.orbSpeed = CONFIG.SPEAKING_SPEED;
      break;
    case 'error':
      state.orbSpeed = 0;
      // Flash red briefly
      orbGroup.children.forEach(child => {
        if (child.material) {
          child.material.color.setHex(0xff3333);
          setTimeout(() => child.material.color.setHex(CONFIG.C_BRIGHT), 500);
        }
      });
      break;
  }
}

function updateStatusUI(connected) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  
  if (connected) {
    dot.classList.remove('offline');
    text.textContent = 'ONLINE';
  } else {
    dot.classList.add('offline');
    text.textContent = 'OFFLINE';
  }
}

function showMessage(text) {
  const el = document.getElementById('hud-message');
  el.textContent = text;
  el.classList.add('visible');
  
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => {
    el.classList.remove('visible');
  }, 3000);
}

function updateUptime() {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  document.getElementById('uptime').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  document.getElementById('request-count').textContent = String(state.requestCount);
}

// ═══════════════════════════════════════════════
// HUD STATE → PANEL WIRING (10.6)
// ═══════════════════════════════════════════════

function updateAllPanels(hud) {
  // Session panel
  const sessionTask = document.getElementById('current-task');
  if (sessionTask) {
    sessionTask.textContent = (hud.traces && hud.traces[0] && hud.traces[0].query)
      ? hud.traces[0].query
      : (hud.session.session_id || '—');
  }
  
  const sprintStatus = document.getElementById('sprint-status');
  if (sprintStatus) sprintStatus.textContent = hud.session.status.toUpperCase();
  
  const memoryCount = document.getElementById('memory-count');
  if (memoryCount) memoryCount.textContent = `${hud.memory.memory_count} nodes`;
  
  // System panel
  const modelEl = document.getElementById('active-model');
  if (modelEl) modelEl.textContent = hud.model.model || '—';
  
  const providerEl = document.getElementById('provider-name');
  if (providerEl) providerEl.textContent = hud.model.provider || '—';
  
  // Status dot
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  if (statusDot && statusText) {
    if (hud.connection.status === 'connected') {
      statusDot.classList.remove('offline');
      statusText.textContent = 'ONLINE';
    } else {
      statusDot.classList.add('offline');
      statusText.textContent = hud.connection.status.toUpperCase();
    }
  }
  
  // Agent indicators — driven by real managed-agent state
  const agentMap = {
    'braindump-node': 'agent-braindump',
    'scheduler-node': 'agent-scheduler',
    'body-double-node': 'agent-bodydouble',
    'coding-node': 'agent-coding',
  };

  // Reset all agents
  document.querySelectorAll('.agent-status').forEach(el => {
    el.querySelector('.indicator').classList.remove('active', 'thinking');
    el.classList.remove('active');
  });

  function lightAgent(el, active) {
    if (!el) return;
    const dot = el.querySelector('.indicator');
    if (active) {
      dot.classList.add('active');
      el.classList.add('active');
    }
  }

  // Real agents from the backend light their matching indicator
  (hud.agents || []).forEach(ag => {
    const id = `${ag.name}-node`;
    if (!agentMap[id]) return;
    const el = document.getElementById(agentMap[id]);
    if (ag.status === 'running' || ag.status === 'processing') {
      lightAgent(el, true);
      el.querySelector('.indicator').classList.add('thinking');
    } else if (ag.status === 'active' || ag.status === 'idle') {
      lightAgent(el, true);
    }
  });

  // Fallback: highlight current agent from workflow node
  if (hud.agent.current_node && agentMap[hud.agent.current_node]) {
    const el = document.getElementById(agentMap[hud.agent.current_node]);
    if (!el.querySelector('.indicator').classList.contains('active')) {
      lightAgent(el, true);
    }
  }
  
  // Workflow state in mood hint
  const moodEl = document.getElementById('mood-hint');
  if (moodEl) moodEl.textContent = hud.model.status === 'error' ? 'ERROR' : hud.agent.workflow_state;
  
  // Tool activity
  const toolEl = document.getElementById('tool-activity');
  if (toolEl) toolEl.textContent = hud.tools.active_tools.length ? hud.tools.active_tools.join(', ') : (hud.tools.last_tool || '—');
  
  // Verification
  const verifyEl = document.getElementById('verify-state');
  if (verifyEl) verifyEl.textContent = hud.verification.status.toUpperCase();
  
  const verifyDot = document.getElementById('verify-dot');
  if (verifyDot) {
    verifyDot.className = 'indicator';
    const vColors = { pending: 'thinking', failed: '', ready: 'active' };
    if (vColors[hud.verification.status] !== undefined) {
      verifyDot.classList.add(vColors[hud.verification.status]);
    }
  }
  
  // Memory
  const memEl = document.getElementById('memory-state');
  if (memEl) memEl.textContent = hud.memory.connected ? `${hud.memory.memory_count} memories` : 'OFFLINE';
  
  // Voice
  const voiceEl = document.getElementById('voice-state');
  if (voiceEl) voiceEl.textContent = hud.voice.connected ? (hud.voice.speaking ? 'SPEAKING' : 'IDLE') : 'OFFLINE';
  
  // Steps
  const stepsEl = document.getElementById('steps-current');
  if (stepsEl) stepsEl.textContent = `${hud.steps.current} / ${hud.steps.max}`;
  
  const stepsBar = document.getElementById('steps-fill');
  if (stepsBar) {
    const pct = Math.min(100, (hud.steps.current / Math.max(1, hud.steps.max)) * 100);
    stepsBar.style.width = `${pct}%`;
    stepsBar.style.background = hud.steps.escalated ? '#ff3333' : '#ffaa30';
  }
}

// ═══════════════════════════════════════════════
// BOOT SEQUENCE
// ═══════════════════════════════════════════════

function bootSequence() {
  const loading = document.getElementById('loading');
  const bootText = loading.querySelector('.boot-text');
  
  const bootPhases = [
    'INITIALIZING J.A.R.V.I.S.',
    'CONNECTING TO OPENJARVIS',
    'SESSION DETECTED',
    'SYNCHRONIZING STATE',
    'J.A.R.V.I.S. READY',
  ];
  
  let phaseIndex = 0;
  
  function advanceBoot() {
    if (phaseIndex < bootPhases.length) {
      bootText.textContent = bootPhases[phaseIndex];
      phaseIndex++;
      setTimeout(advanceBoot, 1200);
    } else {
      // Boot complete — show dashboard
      loading.classList.add('hidden');
      
      // Start animation
      animate();
      
      // Connect to DSH
      connectDSH();
      
      // Initialize hand tracking
      initHandTracking();
      
      // Start uptime counter
      setInterval(updateUptime, 1000);
    
    // Show welcome message
    setTimeout(() => {
      showMessage('J.A.R.V.I.S. online');
    }, 1000);
    }
  }

  // Start after 800ms
  setTimeout(advanceBoot, 800);
}

// ═══════════════════════════════════════════════
// RESIZE HANDLER
// ═══════════════════════════════════════════════

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
});

// ═══════════════════════════════════════════════
// HAND TRACKING
// ═══════════════════════════════════════════════

let handTracker = null;

// Holographic modules navigable by two-finger swipe
const MODULES = ['SYSTEM', 'PROJECTS', 'ANALYTICS', 'NETWORK', 'FILES', 'AI'];
let activeModule = 0;

function cycleModule(dir, pages) {
  activeModule = (activeModule + dir * pages + MODULES.length) % MODULES.length;
  showMessage(MODULES[activeModule]);
  // Orb "module envelope" pulse — bloom pulses to signal a module change
  const pulse = () => {
    bloom.strength = 2.4;
    setTimeout(() => { bloom.strength = 1.5; }, 220);
  };
  pulse();
}

function initHandTracking() {
  const video = document.getElementById('hand-video');
  const overlay = document.getElementById('hand-overlay');
  const toggleBtn = document.getElementById('hand-toggle');
  const statusEl = document.getElementById('hand-status');
  const stateBadge = document.getElementById('hand-state-badge');

  if (!video || !overlay || !toggleBtn) return;

  handTracker = new HandTracker(video, overlay, {
    onRotate(deltaTheta, deltaPhi) {
      // Rotate the orb based on hand movement (precise in precision mode)
      orbGroup.rotation.y += deltaTheta * 0.5;
      orbGroup.rotation.x += deltaPhi * 0.3;
    },
    onZoom(factor) {
      // Zoom the camera
      const dir = camera.position.clone().normalize();
      const currentDist = camera.position.length();
      const newDist = Math.max(0.6, Math.min(40, currentDist * factor));
      camera.position.copy(dir.multiplyScalar(newDist));
    },
    onSwipe(dir, pages) {
      cycleModule(dir, pages);
    },
    onDepth(dz) {
      // Pull a diagnostics panel toward/away from the orb
      showMessage(dz > 0 ? 'EXTRACTING DIAGNOSTICS' : 'RETURNING PANEL');
      // Brief processing glow on the orb core
      bloom.strength = 2.8;
      setTimeout(() => { bloom.strength = 1.5; }, 300);
    },
    onPoint(x, y) {
      // Focus marker at pointer position
      showMessage('FOCUS');
    },
    onArm(armed) {
      updateGestureBadge(stateBadge, armed);
    },
    onFeedback(fb) {
      showMessage(fb.text);
    },
    onStatus(status) {
      state.handMode = status.mode;
      state.handArmed = status.armed;
      if (statusEl) {
        const parts = [];
        if (status.detected) parts.push(`${status.hands} hand${status.hands !== 1 ? 's' : ''}`);
        if (status.mode !== 'idle') parts.push(status.mode.toUpperCase());
        if (status.precision) parts.push('PRECISION');
        statusEl.textContent = parts.join(' · ') || 'no hand';
      }
      if (stateBadge) {
        stateBadge.textContent = status.armed ? 'ARMED' : 'STANDBY';
        stateBadge.classList.toggle('armed', !!status.armed);
      }
      // Orb reacts to interaction state
      bloom.strength = status.mode !== 'idle' || status.armed ? 2.2 : 1.5;
    },
  });

  toggleBtn.addEventListener('click', () => {
    if (state.handTracking) {
      handTracker.stop();
      state.handTracking = false;
      toggleBtn.textContent = 'Gestures off';
      toggleBtn.classList.remove('active');
      toggleBtn.setAttribute('aria-pressed', 'false');
      video.style.display = 'none';
      overlay.style.display = 'none';
      if (stateBadge) stateBadge.textContent = 'OFF';
    } else {
      handTracker.start();
      state.handTracking = true;
      toggleBtn.textContent = 'Gestures on';
      toggleBtn.classList.add('active');
      toggleBtn.setAttribute('aria-pressed', 'true');
      video.style.display = 'block';
      overlay.style.display = 'block';
      if (stateBadge) stateBadge.textContent = 'STANDBY';
    }
  });
}

function updateGestureBadge(el, armed) {
  if (!el) return;
  el.textContent = armed ? 'ARMED' : 'STANDBY';
  el.classList.toggle('armed', armed);
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'r':
    case 'R':
      controls.reset();
      camera.position.set(0, 0.5, 5.5);
      break;
    case 'f':
    case 'F':
      // Toggle fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      break;
    case 'g':
    case 'G':
      // Toggle hand gestures
      document.getElementById('hand-toggle')?.click();
      break;
  }
});

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════

bootSequence();
