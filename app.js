import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07120b, 0.055);

const isMobile = matchMedia('(max-width: 700px)').matches || navigator.maxTouchPoints > 1;
const pixelRatio = isMobile ? Math.min(devicePixelRatio || 1, 1.25) : Math.min(devicePixelRatio || 1, 1.6);
const treeStep = isMobile ? 4.2 : 2.8;
const particleCount = isMobile ? 280 : 650;

const camera = new THREE.PerspectiveCamera(isMobile ? 64 : 58, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.8, 10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  alpha: true,
  powerPreference: 'high-performance',
  failIfMajorPerformanceCaveat: false
});
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.HemisphereLight(0x9bd6ae, 0x020604, isMobile ? 1.45 : 1.8));
const moon = new THREE.DirectionalLight(0xc8ffe0, isMobile ? 2.2 : 3.5);
moon.position.set(-5, 9, 5);
scene.add(moon);

const forest = new THREE.Group();
scene.add(forest);

const trunkGeometry = new THREE.CylinderGeometry(.12, .22, 3.1, 7);
const crownGeometries = [0, 1, 2, 3].map(i => new THREE.ConeGeometry(1.25 - i * .15, 2.15, isMobile ? 7 : 9));
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x211812, roughness: 1 });
const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x163b24, roughness: .9 });

function tree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1.55;
  group.add(trunk);
  for (let i = 0; i < 4; i++) {
    const crown = new THREE.Mesh(crownGeometries[i], crownMaterial);
    crown.position.y = 2.55 + i * .75;
    crown.position.x = (i % 2 ? .12 : -.08);
    group.add(crown);
  }
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  forest.add(group);
}

for (let z = -5; z > -55; z -= treeStep) {
  const spread = 4.5 + Math.abs(z) * .08;
  for (const side of [-1, 1]) {
    tree(side * (spread + Math.random() * 2.5), z + Math.random() * 1.5, .7 + Math.random() * .9);
    if (!isMobile && Math.random() > .35) tree(side * (spread + 3 + Math.random() * 2), z + Math.random() * 1.5, .45 + Math.random() * .6);
  }
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 120),
  new THREE.MeshStandardMaterial({ color: 0x07140c, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.05;
ground.position.z = -30;
scene.add(ground);

const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = (Math.random() - .5) * 24;
  positions[i * 3 + 1] = Math.random() * 9;
  positions[i * 3 + 2] = -Math.random() * 65;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({ color: 0xb7ff67, size: isMobile ? .028 : .035, transparent: true, opacity: .65, depthWrite: false });
scene.add(new THREE.Points(particles, particleMat));

const state = { progress: 0, mouseX: 0, mouseY: 0 };
const cameraTarget = { x: 0, y: 1.8, z: 10 };

ScrollTrigger.create({
  trigger: 'main',
  start: 'top top',
  end: 'bottom bottom',
  scrub: isMobile ? 0.35 : 0.7,
  onUpdate: self => {
    state.progress = self.progress;
    const bar = document.querySelector('#progressBar');
    if (bar) bar.style.width = `${self.progress * 100}%`;
    cameraTarget.z = 10 - self.progress * 48;
    cameraTarget.y = 1.8 + Math.sin(self.progress * Math.PI) * (isMobile ? .8 : 1.4);
    cameraTarget.x = Math.sin(self.progress * Math.PI * 2) * (isMobile ? .8 : 1.7);
  }
});

gsap.to('.hero h1', { y: isMobile ? -45 : -80, opacity: .15, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
gsap.to('.hero p, .scroll-cue', { y: -25, opacity: 0, scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true } });
gsap.utils.toArray('.story-card').forEach(card => {
  gsap.fromTo(card, { y: 55, opacity: 0 }, { y: 0, opacity: 1, scrollTrigger: { trigger: card, start: 'top 82%', end: 'top 52%', scrub: true } });
});

gsap.fromTo('#loader', { opacity: 1 }, { opacity: 0, duration: .7, delay: .45, onComplete: () => document.querySelector('#loader')?.remove() });

if (!isMobile) {
  addEventListener('pointermove', e => {
    state.mouseX = (e.clientX / innerWidth - .5) * 2;
    state.mouseY = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });
}

document.querySelector('#replay')?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(isMobile ? Math.min(devicePixelRatio || 1, 1.25) : Math.min(devicePixelRatio || 1, 1.6));
  renderer.setSize(innerWidth, innerHeight, false);
  ScrollTrigger.refresh();
}
addEventListener('resize', resize, { passive: true });

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  camera.position.x += (cameraTarget.x + state.mouseX * (isMobile ? 0 : .45) - camera.position.x) * .045;
  camera.position.y += (cameraTarget.y - state.mouseY * (isMobile ? 0 : .25) - camera.position.y) * .045;
  camera.position.z += (cameraTarget.z - camera.position.z) * .065;
  camera.rotation.y += (-state.mouseX * (isMobile ? 0 : .018) - camera.rotation.y) * .04;
  moon.position.x = -5 + Math.sin(t * .12) * 2;
  forest.rotation.y = Math.sin(t * .08) * .008;
  renderer.render(scene, camera);
}
animate();
