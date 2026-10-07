import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { corePalette, rgbUnit } from '../features/system-health/coreColors';
import { coreFragment, coreVertex, haloFragment, haloVertex } from './shaders';

export interface CoreState {
  instability: number;
}

export interface CoreHandle {
  readonly failed: boolean;
  attach(container: HTMLElement): void;
  detach(): void;
  setState(state: CoreState): void;
  setReduced(reduced: boolean): void;
  /** Angular impulse from a drag, in radians. */
  spin(dx: number, dy: number): void;
  ping(): void;
  onFail: (() => void) | null;
}

/**
 * Budget for an iPhone 11: ≤ 2× DPR, one ~5k-triangle mesh, ~300 points,
 * one draw loop that only runs while the canvas is visible, the page is
 * visible and motion is allowed.
 */
const MAX_DPR = 2;
const HALO_POINTS = 300;

function buildBody(): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, 4);
  const position = geometry.getAttribute('position');
  const count = position.count;
  const centers = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  const bary = new Float32Array(count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let face = 0; face < count / 3; face++) {
    a.fromBufferAttribute(position, face * 3);
    b.fromBufferAttribute(position, face * 3 + 1);
    c.fromBufferAttribute(position, face * 3 + 2);
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const r = rand();
    for (let k = 0; k < 3; k++) {
      const v = face * 3 + k;
      centers[v * 3] = cx;
      centers[v * 3 + 1] = cy;
      centers[v * 3 + 2] = cz;
      rands[v] = r;
      bary[v * 3 + k] = 1;
    }
  }
  geometry.setAttribute('aCenter', new BufferAttribute(centers, 3));
  geometry.setAttribute('aRand', new BufferAttribute(rands, 1));
  geometry.setAttribute('aBary', new BufferAttribute(bary, 3));
  return geometry;
}

function buildHalo(): BufferGeometry {
  const positions = new Float32Array(HALO_POINTS * 3);
  const rands = new Float32Array(HALO_POINTS);
  for (let i = 0; i < HALO_POINTS; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 1.32 + Math.random() * 0.42;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = Math.cos(theta) * s * r;
    positions[i * 3 + 1] = u * r * 0.82;
    positions[i * 3 + 2] = Math.sin(theta) * s * r;
    rands[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aRand', new BufferAttribute(rands, 1));
  return geometry;
}

function createCore(): CoreHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
  canvas.setAttribute('aria-hidden', 'true');

  let failed = false;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    failed = true;
    return {
      failed: true,
      attach() {},
      detach() {},
      setState() {},
      setReduced() {},
      spin() {},
      ping() {},
      onFail: null,
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 5.6);

  const bodyUniforms = {
    uTime: { value: 0 },
    uInstability: { value: 0 },
    uFragment: { value: 0 },
    uPing: { value: 0 },
    uInner: { value: [0.74, 0.58, 0.98] as [number, number, number] },
    uRim: { value: [0.55, 0.91, 0.99] as [number, number, number] },
  };
  const body = new Mesh(
    buildBody(),
    new ShaderMaterial({ uniforms: bodyUniforms, vertexShader: coreVertex, fragmentShader: coreFragment, transparent: true }),
  );

  const haloUniforms = {
    uTime: bodyUniforms.uTime,
    uInstability: bodyUniforms.uInstability,
    uSize: { value: 2.2 * Math.min(window.devicePixelRatio || 1, MAX_DPR) },
    uColor: { value: [0.55, 0.91, 0.99] as [number, number, number] },
  };
  const halo = new Points(
    buildHalo(),
    new ShaderMaterial({
      uniforms: haloUniforms,
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );

  const group = new Group();
  group.add(body, halo);
  group.rotation.x = 0.28;
  scene.add(group);

  let container: HTMLElement | null = null;
  let visible = true;
  let reduced = false;
  let raf = 0;
  let last = 0;
  let time = Math.random() * 100;
  let target = 0;
  let current = 0;
  let spinVelocity = 0;
  let tiltVelocity = 0;
  let ping = 0;

  const resizeObserver = new ResizeObserver(() => resize());
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });

  function resize() {
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (reduced) render(0);
  }

  function applyPalette() {
    const { inner, rim } = corePalette(current);
    bodyUniforms.uInner.value = rgbUnit(inner);
    bodyUniforms.uRim.value = rgbUnit(rim);
    haloUniforms.uColor.value = rgbUnit(rim);
  }

  function render(dt: number) {
    const k = 1 - Math.exp(-dt * 2.4);
    current += (target - current) * (dt === 0 ? 1 : k);
    time += dt * (0.6 + current * 0.9);
    ping = Math.max(0, ping - dt * 1.4);

    bodyUniforms.uTime.value = time;
    bodyUniforms.uInstability.value = current;
    bodyUniforms.uFragment.value = Math.max(0, (current - 0.32) / 0.68);
    bodyUniforms.uPing.value = ping;
    applyPalette();

    group.rotation.y += dt * (0.12 + current * 0.35) + spinVelocity;
    group.rotation.x += tiltVelocity;
    group.rotation.x += (0.28 - group.rotation.x) * Math.min(1, dt * 1.5);
    spinVelocity *= Math.exp(-dt * 2.2);
    tiltVelocity *= Math.exp(-dt * 3);

    renderer.render(scene, camera);
  }

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    render(dt);
    schedule();
  }

  function shouldRun() {
    return Boolean(container) && visible && !reduced && !failed && document.visibilityState === 'visible';
  }

  function schedule() {
    if (!shouldRun()) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const onVisibility = () => schedule();
  document.addEventListener('visibilitychange', onVisibility);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    failed = true;
    schedule();
    handle.onFail?.();
  });

  const handle: CoreHandle = {
    get failed() {
      return failed;
    },
    onFail: null,
    attach(next) {
      container = next;
      next.appendChild(canvas);
      resizeObserver.observe(next);
      intersection.observe(next);
      resize();
      render(0);
      schedule();
    },
    detach() {
      if (container) {
        resizeObserver.unobserve(container);
        intersection.unobserve(container);
      }
      canvas.remove();
      container = null;
      schedule();
    },
    setState(state) {
      target = Math.min(1, Math.max(0, state.instability));
      if (reduced) {
        current = target;
        render(0);
      }
    },
    setReduced(next) {
      reduced = next;
      if (reduced) render(0);
      schedule();
    },
    spin(dx, dy) {
      spinVelocity += dx;
      tiltVelocity += dy;
      if (reduced) {
        group.rotation.y += dx * 6;
        render(0);
      }
    },
    ping() {
      ping = 1;
    },
  };
  return handle;
}

let singleton: CoreHandle | null = null;

/** One WebGL context for the life of the app: shaders compile once. */
export function getCore(): CoreHandle {
  if (!singleton) singleton = createCore();
  return singleton;
}
