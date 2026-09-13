import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#scene');
const isMobile = matchMedia('(max-width:700px)').matches || navigator.maxTouchPoints > 1;
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const progressBar = document.querySelector('#progressBar');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.15 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = isMobile ? 1.08 : 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03131c);
scene.fog = new THREE.FogExp2(0x08232d, isMobile ? 0.009 : 0.006);

const camera = new THREE.PerspectiveCamera(isMobile ? 67 : 58, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 6.4, 23);

const clock = new THREE.Clock();
const state = { progress: 0, mx: 0, my: 0 };
const target = { x: 0, y: 6.4, z: 23 };

// ============================================================
// OCEANO PROCEDURAL
// A superfície é criada inteiramente em shader: não usa vídeo,
// imagem de fundo nem textura de água externa.
// ============================================================
const oceanVertex = `
  uniform float uTime;
  uniform float uScale;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vNormal;

  float wave(vec2 p, float t) {
    float h = 0.0;
    h += 0.78 * sin(p.x * 0.105 + t * 0.75 + sin(p.y * 0.03) * 1.3);
    h += 0.34 * sin(p.y * 0.19 - t * 1.05 + p.x * 0.035);
    h += 0.18 * sin((p.x + p.y) * 0.31 + t * 1.35);
    h += 0.09 * sin((p.x * 1.7 - p.y * 0.8) * 0.42 - t * 1.8);
    h += 0.045 * sin((p.x - p.y) * 0.9 + t * 2.2);
    return h;
  }

  float heightAt(vec2 p) {
    return wave(p, uTime) * uScale;
  }

  void main() {
    // PlaneGeometry começa no plano XY. Depois o mesh é rotacionado
    // para virar o oceano, portanto a superfície deve usar position.xy.
    vec2 surface = position.xy;
    float h = heightAt(surface);
    vec3 p = vec3(surface.x, h, surface.y);

    float e = 0.11;
    float hx = heightAt(surface + vec2(e, 0.0));
    float hz = heightAt(surface + vec2(0.0, e));
    vec3 tx = normalize(vec3(e, hx - h, 0.0));
    vec3 tz = normalize(vec3(0.0, hz - h, e));
    vNormal = normalize(cross(tz, tx));

    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPosition = world.xyz;
    vHeight = h;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const oceanFragment = `
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec3 uSunDirection;
  uniform bool uMobile;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vNormal;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamera - vWorldPosition);
    vec3 L = normalize(uSunDirection);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.2);

    vec3 deep = vec3(0.003, 0.043, 0.064);
    vec3 mid = vec3(0.008, 0.18, 0.245);
    vec3 shallow = vec3(0.035, 0.39, 0.46);
    vec3 color = mix(deep, mid, clamp(0.5 + N.y * 0.55, 0.0, 1.0));
    color = mix(color, shallow, fresnel * 0.56);

    // Reflexo solar intenso e faixa larga de luz.
    float sunGlint = pow(max(dot(reflect(-L, N), V), 0.0), uMobile ? 60.0 : 115.0);
    float sunlight = pow(max(dot(N, L), 0.0), 7.0) * 0.14;
    color += vec3(1.0, 0.76, 0.48) * (sunGlint * 0.95 + sunlight);

    // Micro brilho quebrado pela água.
    float sparkle = sin(vWorldPosition.x * 2.8 + uTime * 4.0) *
                    sin(vWorldPosition.z * 2.1 - uTime * 3.0);
    sparkle = smoothstep(0.80, 0.985, sparkle);
    sparkle *= pow(max(dot(N, L), 0.0), 5.0);
    color += vec3(0.62, 0.90, 1.0) * sparkle * (uMobile ? 0.08 : 0.16);

    // Espuma sutil nas cristas.
    float foam = smoothstep(0.52, 0.82, abs(vHeight));
    color = mix(color, vec3(0.55, 0.80, 0.82), foam * 0.075);

    // Haze atmosférico para criar profundidade no horizonte.
    float horizonFade = smoothstep(35.0, 280.0, -vWorldPosition.z);
    color = mix(color, vec3(0.075, 0.18, 0.21), horizonFade * 0.56);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(isMobile ? 420 : 620, isMobile ? 420 : 620, isMobile ? 150 : 250, isMobile ? 150 : 250),
  new THREE.ShaderMaterial({
    vertexShader: oceanVertex,
    fragmentShader: oceanFragment,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: isMobile ? 0.92 : 1.1 },
      uCamera: { value: camera.position },
      uSunDirection: { value: new THREE.Vector3(-0.42, 0.75, 0.34).normalize() },
      uMobile: { value: isMobile }
    },
    side: THREE.DoubleSide
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -0.55;
scene.add(ocean);

// ============================================================
// CÉU PROCEDURAL
// ============================================================
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(520, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 0.5 + 0.45, 0.0, 1.0);
        vec3 horizon = vec3(0.42, 0.70, 0.80);
        vec3 zenith = vec3(0.006, 0.028, 0.052);
        vec3 c = mix(horizon, zenith, pow(h, 1.25));
        float sunGlow = pow(max(dot(vDir, normalize(vec3(-0.42,0.75,0.34))),0.0), 15.0);
        c += vec3(1.0, 0.53, 0.25) * sunGlow * 0.18;
        gl_FragColor = vec4(c, 1.0);
      }
    `
  })
);
scene.add(sky);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(3.5, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd39b, transparent: true, opacity: 0.72 })
);
sun.position.set(-95, 78, -170);
scene.add(sun);

for (let i = 0; i < (isMobile ? 4 : 7); i++) {
  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 18),
    new THREE.MeshBasicMaterial({
      color: 0xa8d9df,
      transparent: true,
      opacity: 0.025 - i * 0.002,
      depthWrite: false
    })
  );
  mist.position.set((i - 3) * 31, 4 + i * 2.7, -95 - i * 28);
  mist.rotation.x = -0.06;
  scene.add(mist);
}

scene.add(new THREE.HemisphereLight(0xb8e8f2, 0x021018, isMobile ? 1.2 : 1.55));
const keyLight = new THREE.DirectionalLight(0xffdfb1, isMobile ? 1.8 : 2.7);
keyLight.position.set(-40, 45, -70);
scene.add(keyLight);

// ============================================================
// BARCO — escala visual no horizonte
// ============================================================
const boat = new THREE.Group();
const hull = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.45, 0.9),
  new THREE.MeshStandardMaterial({ color: 0x122328, roughness: 0.65 })
);
hull.position.y = 0.38;
boat.add(hull);

const deck = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.11, 1.0),
  new THREE.MeshStandardMaterial({ color: 0xc0ab83, roughness: 0.85 })
);
deck.position.y = 0.63;
boat.add(deck);

const mast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.035, 3.1, 10),
  new THREE.MeshStandardMaterial({ color: 0xf0e9d7 })
);
mast.position.y = 2.05;
boat.add(mast);

const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(1.95, 2.15),
  new THREE.MeshStandardMaterial({ color: 0xf0eadc, side: THREE.DoubleSide, roughness: 0.9 })
);
sail.position.set(0.52, 2.05, 0);
sail.rotation.y = -0.15;
boat.add(sail);

boat.position.set(-14, -0.1, -96);
boat.scale.setScalar(isMobile ? 0.48 : 0.85);
scene.add(boat);

// ============================================================
// AVIÃO DISTANTE
// ============================================================
const plane = new THREE.Group();
const planeMat = new THREE.MeshStandardMaterial({ color: 0xd9e4e6, roughness: 0.42, metalness: 0.18 });
const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 1.7, 5, 10), planeMat);
fuselage.rotation.z = Math.PI / 2;
plane.add(fuselage);
const wing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 1.45), planeMat);
wing.rotation.x = Math.PI / 2;
plane.add(wing);
plane.scale.setScalar(isMobile ? 0.55 : 0.78);
scene.add(plane);

const sprayCount = isMobile ? 180 : 700;
const sprayPositions = new Float32Array(sprayCount * 3);
for (let i = 0; i < sprayCount; i++) {
  sprayPositions[i * 3] = (Math.random() - 0.5) * 150;
  sprayPositions[i * 3 + 1] = Math.random() * 2.2 - 0.15;
  sprayPositions[i * 3 + 2] = -Math.random() * 220 + 5;
}
const sprayGeometry = new THREE.BufferGeometry();
sprayGeometry.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
const spray = new THREE.Points(
  sprayGeometry,
  new THREE.PointsMaterial({ color: 0xe8fbff, size: isMobile ? 0.025 : 0.035, transparent: true, opacity: 0.42, depthWrite: false })
);
scene.add(spray);

// ============================================================
// SCROLL + CÂMERA CINEMATOGRÁFICA
// ============================================================
ScrollTrigger.create({
  trigger: 'main',
  start: 'top top',
  end: 'bottom bottom',
  scrub: isMobile ? 0.4 : 0.65,
  onUpdate: self => {
    state.progress = self.progress;
    if (progressBar) progressBar.style.width = `${self.progress * 100}%`;
    target.z = 23 - self.progress * 105;
    target.y = 6.4 - Math.sin(self.progress * Math.PI) * 3.5 - (self.progress > 0.72 ? (self.progress - 0.72) * 11 : 0);
    target.x = Math.sin(self.progress * Math.PI * 2) * 6.5;
  }
});

gsap.to('.hero h1', {
  y: isMobile ? -32 : -70,
  opacity: 0.08,
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
});

gsap.to('.hero p,.scroll-cue', {
  y: -25,
  opacity: 0,
  scrollTrigger: { trigger: '.hero', start: 'top top', end: '55% top', scrub: true }
});

gsap.utils.toArray('.story-card').forEach(card => {
  gsap.fromTo(card, { y: 70, opacity: 0 }, {
    y: 0,
    opacity: 1,
    scrollTrigger: { trigger: card, start: 'top 84%', end: 'top 54%', scrub: true }
  });
});

if (!isMobile && !reduced) {
  addEventListener('pointermove', e => {
    state.mx = (e.clientX / innerWidth - 0.5) * 2;
    state.my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
}

document.querySelector('#replay')?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isMobile ? 1.15 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  ScrollTrigger.refresh();
}
addEventListener('resize', resize, { passive: true });
addEventListener('orientationchange', () => setTimeout(resize, 160), { passive: true });

function animate() {
  const t = clock.getElapsedTime();

  camera.position.x += (target.x + state.mx * (isMobile ? 0 : 1.6) - camera.position.x) * 0.035;
  camera.position.y += (target.y - state.my * (isMobile ? 0 : 0.65) - camera.position.y) * 0.035;
  camera.position.z += (target.z - camera.position.z) * 0.045;
  camera.lookAt(camera.position.x * 0.07, Math.max(-1.2, camera.position.y * 0.22), camera.position.z - 23);

  ocean.material.uniforms.uTime.value = t * (reduced ? 0.16 : 0.55);
  ocean.material.uniforms.uCamera.value.copy(camera.position);

  spray.rotation.y = t * 0.004;
  boat.rotation.z = Math.sin(t * 0.62) * 0.035;
  boat.rotation.x = Math.cos(t * 0.44) * 0.018;
  boat.position.y = -0.12 + Math.sin(t * 0.62) * 0.14;

  const phase = (t * (isMobile ? 0.23 : 0.34)) % 1;
  plane.position.set(-45 + phase * 90, 17 + Math.sin(phase * Math.PI) * 2.6, -60 - phase * 26);
  plane.rotation.z = -0.035 + Math.sin(phase * Math.PI * 2) * 0.03;

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
