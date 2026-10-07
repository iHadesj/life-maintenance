/** Ashima / Stefan Gustavson 3D simplex noise (MIT). */
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/**
 * The organism. Healthy: smooth, slow, cohesive. Unstable: the surface
 * churns faster, its triangular structure shows through, and faces lift off
 * the body as shards.
 */
export const coreVertex = /* glsl */ `
uniform float uTime;
uniform float uInstability;
uniform float uFragment;
uniform float uPing;
attribute vec3 aCenter;
attribute float aRand;
attribute vec3 aBary;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
varying vec3 vBary;
varying float vLift;
${SIMPLEX}
void main() {
  vec3 dir = normalize(position);
  float speed = 0.1 + uInstability * 0.5;
  float freq = 1.15 + uInstability * 1.7;
  float n = snoise(dir * freq + vec3(uTime * speed));
  float n2 = snoise(dir * freq * 2.4 - vec3(uTime * speed * 1.3));
  float amp = 0.065 + uInstability * 0.19;
  float disp = n * amp + n2 * amp * 0.4 * uInstability;
  disp += uPing * 0.06 * sin(12.0 * dir.y - uTime * 7.0);
  vec3 p = dir * (1.0 + disp);

  vec3 cdir = normalize(aCenter);
  float shard = smoothstep(0.42, 1.0, aRand);
  float lift = uFragment * shard * (0.16 + 0.22 * (0.5 + 0.5 * snoise(cdir * 2.7 + vec3(uTime * 0.25))));
  vec3 shrunk = mix(p, cdir * (1.0 + disp), uFragment * shard * 0.4);
  p = shrunk + cdir * lift;

  vNormal = normalize(normalMatrix * dir);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = normalize(-mv.xyz);
  vNoise = n;
  vBary = aBary;
  vLift = lift;
  gl_Position = projectionMatrix * mv;
}
`;

export const coreFragment = /* glsl */ `
uniform vec3 uInner;
uniform vec3 uRim;
uniform float uInstability;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
varying vec3 vBary;
varying float vLift;
void main() {
  float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
  float fresnel = pow(1.0 - facing, 2.3);
  float tone = smoothstep(-0.7, 0.9, vNoise);
  vec3 color = mix(uInner * 0.55, uInner, tone) * (0.42 + 0.58 * facing);
  color += uRim * fresnel * 1.15;

  float edge = min(min(vBary.x, vBary.y), vBary.z);
  float wire = 1.0 - smoothstep(0.0, 0.04 + 0.03 * uInstability, edge);
  color += uRim * wire * (0.05 + 0.6 * uInstability);
  color += uRim * vLift * 1.6;

  float band = smoothstep(0.94, 1.0, sin(gl_FragCoord.y * 0.32 - uTime * 2.2));
  color += band * 0.05;

  gl_FragColor = vec4(color, 0.96);
}
`;

export const haloVertex = /* glsl */ `
uniform float uTime;
uniform float uInstability;
uniform float uSize;
attribute float aRand;
varying float vAlpha;
void main() {
  vec3 p = position;
  float a = uTime * (0.04 + aRand * 0.09) * (1.0 + uInstability * 2.2);
  float c = cos(a);
  float s = sin(a);
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  p *= 1.0 + uInstability * 0.22 * sin(uTime * 0.8 + aRand * 6.2831);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.5 + aRand) * (4.5 / -mv.z);
  vAlpha = 0.18 + 0.5 * aRand;
  gl_Position = projectionMatrix * mv;
}
`;

export const haloFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  gl_FragColor = vec4(uColor, vAlpha * smoothstep(0.5, 0.0, r));
}
`;
