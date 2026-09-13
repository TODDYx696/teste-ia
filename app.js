import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector('#scene');
const isMobile = matchMedia('(max-width: 700px)').matches || navigator.maxTouchPoints > 1;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = isMobile ? 'mobile' : 'desktop';
const pixelRatio = isMobile ? Math.min(devicePixelRatio || 1, 1.15) : Math.min(devicePixelRatio || 1, 1.6);
const treeStep = isMobile ? 5.2 : 2.7;
const particleCount = isMobile ? 110 : 520;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06110b, isMobile ? 0.075 : 0.052);

const camera = new THREE.PerspectiveCamera(isMobile ? 68 : 58, 1, 0.1, 120);
camera.position.set(0, 1.7, 10);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: isMobile ? 'low-power' : 'high-performance',
    failIfMajorPerformanceCaveat: false
  });
} catch (error) {
  document.body.classList.add('no-webgl');
  document.querySelector('#loader')?.remove();
  console.warn('WebGL indisponível:', error);
}

if (!renderer) throw errorFallback();

renderer.setPixelRatio(pixelRatio);
renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = isMobile ? 1.05 : 1.2;

const hemi = new THREE.HemisphereLight(0xb7e6c4, 0x020503, isMobile ? 1.25 : 1.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe9b2, isMobile ? 2.1 : 3.4);
sun.position.set(-8, 12, 5);
scene.add(sun);

// -------------------- FOREST --------------------
const forest = new THREE.Group();
scene.add(forest);
const trunkGeometry = new THREE.CylinderGeometry(.12, .23, 3.2, isMobile ? 6 : 8);
const crownGeometries = [0,1,2].map(i => new THREE.ConeGeometry(1.25 - i*.16, 2.25, isMobile ? 7 : 10));
const trunkMaterial = new THREE.MeshStandardMaterial({ color:0x21170f, roughness:1 });
const crownMaterial = new THREE.MeshStandardMaterial({ color:0x123b25, roughness:.95 });

function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1.55;
  group.add(trunk);
  for (let i=0; i<3; i++) {
    const crown = new THREE.Mesh(crownGeometries[i], crownMaterial);
    crown.position.y = 2.35 + i*.8;
    crown.position.x = i % 2 ? .12 : -.08;
    group.add(crown);
  }
  group.position.set(x, 0, z);
  group.rotation.y = Math.random()*Math.PI;
  group.scale.setScalar(scale);
  forest.add(group);
}

for (let z=-5; z>-62; z-=treeStep) {
  const spread = 4.2 + Math.abs(z)*.075;
  for (const side of [-1,1]) {
    createTree(side*(spread + Math.random()*2.7), z + Math.random()*1.7, .65 + Math.random()*.95);
    if (!isMobile && Math.random()>.3) createTree(side*(spread+3+Math.random()*2), z+Math.random()*1.5, .45+Math.random()*.65);
  }
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(90,130),
  new THREE.MeshStandardMaterial({ color:0x06130b, roughness:1 })
);
ground.rotation.x = -Math.PI/2;
ground.position.set(0,-.05,-31);
scene.add(ground);

// -------------------- ATMOSPHERE --------------------
const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount*3);
for (let i=0;i<particleCount;i++) {
  positions[i*3]=(Math.random()-.5)*25;
  positions[i*3+1]=Math.random()*10;
  positions[i*3+2]=-Math.random()*70;
}
particles.setAttribute('position',new THREE.BufferAttribute(positions,3));
const fireflies = new THREE.Points(
  particles,
  new THREE.PointsMaterial({color:0xd2ff8c,size:isMobile?.045:.055,transparent:true,opacity:.7,depthWrite:false})
);
scene.add(fireflies);

// A subtle sun disk gives the opening a cinematic focal point without another heavy texture.
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(isMobile ? 1.2 : 1.7, 32),
  new THREE.MeshBasicMaterial({color:0xffdf9a,transparent:true,opacity:.11,depthWrite:false})
);
sunDisc.position.set(-5,8,-24);
sunDisc.lookAt(camera.position);
scene.add(sunDisc);

// -------------------- AIRPLANE + CONTRAIL --------------------
const airplane = new THREE.Group();
const planeScale = isMobile ? .9 : 1.25;
const bodyMat = new THREE.MeshStandardMaterial({color:0xf0f2ee,roughness:.35,metalness:.2});
const darkMat = new THREE.MeshStandardMaterial({color:0x26332c,roughness:.55,metalness:.15});
const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(.16,.21,2.9,12),bodyMat);
fuselage.rotation.z=Math.PI/2;
airplane.add(fuselage);
const nose = new THREE.Mesh(new THREE.ConeGeometry(.21,.55,12),bodyMat);
nose.rotation.z=-Math.PI/2;
nose.position.x=1.7;
airplane.add(nose);
const wings = new THREE.Mesh(new THREE.BoxGeometry(1.75,.06,.62),bodyMat);
airplane.add(wings);
const tailWing = new THREE.Mesh(new THREE.BoxGeometry(.7,.05,.28),bodyMat);
tailWing.position.set(-1.05,.18,0);
airplane.add(tailWing);
const tailFin = new THREE.Mesh(new THREE.BoxGeometry(.32,.45,.05),darkMat);
tailFin.position.set(-1.05,.28,0);
airplane.add(tailFin);
airplane.scale.setScalar(planeScale);
scene.add(airplane);

const contrailGeometry = new THREE.BufferGeometry();
const contrailPositions = new Float32Array(60*3);
contrailGeometry.setAttribute('position',new THREE.BufferAttribute(contrailPositions,3));
const contrail = new THREE.Line(
  contrailGeometry,
  new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.16})
);
scene.add(contrail);

// -------------------- SCROLL / INTERACTION --------------------
const state={progress:0,mouseX:0,mouseY:0};
const cameraTarget={x:0,y:1.7,z:10};
const bar=document.querySelector('#progressBar');

ScrollTrigger.create({
  trigger:'main',start:'top top',end:'bottom bottom',scrub:isMobile?.45:.65,
  onUpdate:self=>{
    state.progress=self.progress;
    if(bar) bar.style.width=`${self.progress*100}%`;
    cameraTarget.z=10-self.progress*50;
    cameraTarget.y=1.7+Math.sin(self.progress*Math.PI)*1.5;
    cameraTarget.x=Math.sin(self.progress*Math.PI*2)*1.9;
  }
});

gsap.to('.hero h1',{y:isMobile?-30:-75,opacity:.08,scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
gsap.to('.hero p, .scroll-cue',{y:-28,opacity:0,scrollTrigger:{trigger:'.hero',start:'top top',end:'58% top',scrub:true}});
gsap.to('.hero-real-image',{scale:1.14,yPercent:7,scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
gsap.to('.hero-light',{opacity:.9,scale:1.15,scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
gsap.utils.toArray('.story-card').forEach(card=>gsap.fromTo(card,{y:70,opacity:0},{y:0,opacity:1,scrollTrigger:{trigger:card,start:'top 86%',end:'top 55%',scrub:true}}));

gsap.fromTo('#loader',{opacity:1},{opacity:0,duration:.7,delay:.35,onComplete:()=>document.querySelector('#loader')?.remove()});

if(!isMobile&&!reduceMotion){
  addEventListener('pointermove',e=>{
    state.mouseX=(e.clientX/innerWidth-.5)*2;
    state.mouseY=(e.clientY/innerHeight-.5)*2;
  },{passive:true});
}

document.querySelector('#replay')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

function resize(){
  const width=canvas.clientWidth||innerWidth;
  const height=canvas.clientHeight||innerHeight;
  camera.aspect=width/Math.max(height,1);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(isMobile?Math.min(devicePixelRatio||1,1.15):Math.min(devicePixelRatio||1,1.6));
  renderer.setSize(width,height,false);
  ScrollTrigger.refresh();
}
new ResizeObserver(resize).observe(canvas);
addEventListener('orientationchange',()=>setTimeout(resize,120),{passive:true});

const clock=new THREE.Clock();
function animate(){
  const t=clock.getElapsedTime();
  camera.position.x+=(cameraTarget.x+state.mouseX*(isMobile?0:.5)-camera.position.x)*.045;
  camera.position.y+=(cameraTarget.y-state.mouseY*(isMobile?0:.22)-camera.position.y)*.045;
  camera.position.z+=(cameraTarget.z-camera.position.z)*.06;
  camera.rotation.y+=(-state.mouseX*(isMobile?0:.016)-camera.rotation.y)*.04;
  sun.position.x=-8+Math.sin(t*.1)*2.5;
  fireflies.rotation.y=t*.012;
  forest.rotation.y=Math.sin(t*.07)*.006;

  // Airplane is intentionally larger and leaves a short moving contrail.
  const phase=(t*(isMobile?.5:.78))%13/13;
  airplane.position.x=-20+phase*40;
  airplane.position.y=7.5+Math.sin(phase*Math.PI)*.8;
  airplane.position.z=-7-phase*12;
  airplane.rotation.z=-.045+Math.sin(phase*Math.PI*2)*.035;
  airplane.rotation.y=Math.PI/2+Math.sin(phase*Math.PI)*.05;

  const line=contrailGeometry.attributes.position.array;
  for(let i=0;i<20;i++){
    const p=i/19;
    line[i*3]=airplane.position.x-1.9-p*3.5;
    line[i*3+1]=airplane.position.y+.05+Math.sin(p*8+t)*.015;
    line[i*3+2]=airplane.position.z+p*1.8;
  }
  contrailGeometry.attributes.position.needsUpdate=true;

  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);

function errorFallback(){
  return new Error('WebGL renderer could not be initialized');
}
