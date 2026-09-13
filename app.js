import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/objects/Water.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/objects/Sky.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js';
import { ScrollTrigger } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js';
gsap.registerPlugin(ScrollTrigger);

const canvas=document.querySelector('#scene');
const isMobile=matchMedia('(max-width:700px)').matches||navigator.maxTouchPoints>1;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x06202b,isMobile?.018:.011);
const camera=new THREE.PerspectiveCamera(isMobile?67:57,1,.1,900);
camera.position.set(0,5.2,24);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile,alpha:false,powerPreference:isMobile?'low-power':'high-performance'});}catch(e){document.body.classList.add('no-webgl');document.querySelector('#loader')?.remove();throw e;}
renderer.setPixelRatio(isMobile?Math.min(devicePixelRatio||1,1.05):Math.min(devicePixelRatio||1,1.5));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=isMobile?1.05:1.18;

// Fast startup: create the scene immediately and load the normal map without blocking the UI.
const waterNormals=new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg',texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;});
const waterSize=isMobile?240:420;
const waterSegments=isMobile?64:160;
const water=new Water(new THREE.PlaneGeometry(waterSize,waterSize,waterSegments,waterSegments),{
  textureWidth:isMobile?128:384,
  textureHeight:isMobile?128:384,
  waterNormals,
  sunDirection:new THREE.Vector3(-0.35,0.85,0.2).normalize(),
  sunColor:0xfff4d0,
  waterColor:0x075a73,
  distortionScale:isMobile?2.3:3.8,
  fog:true
});
water.rotation.x=-Math.PI/2;
water.position.y=0;
scene.add(water);

const sky=new Sky();
sky.scale.setScalar(450);
scene.add(sky);
const skyUniforms=sky.material.uniforms;
skyUniforms.turbidity.value=5.2;
skyUniforms.rayleigh.value=1.45;
skyUniforms.mieCoefficient.value=.006;
skyUniforms.mieDirectionalG.value=.82;
const sun=new THREE.Vector3();
const skyParams={elevation:14,azimuth:138};
function updateSky(){
  const phi=THREE.MathUtils.degToRad(90-skyParams.elevation);
  const theta=THREE.MathUtils.degToRad(skyParams.azimuth);
  sun.setFromSphericalCoords(1,phi,theta);
  sky.material.uniforms.sunPosition.value.copy(sun);
  water.material.uniforms.sunDirection.value.copy(sun).normalize();
}
updateSky();

const hemi=new THREE.HemisphereLight(0xa9dcf0,0x031018,isMobile?1.15:1.55);
scene.add(hemi);
const sunlight=new THREE.DirectionalLight(0xffe4aa,isMobile?1.8:3.0);
sunlight.position.copy(sun).multiplyScalar(40);
scene.add(sunlight);

const hazeGroup=new THREE.Group();scene.add(hazeGroup);
for(let i=0;i<(isMobile?2:5);i++){
  const haze=new THREE.Mesh(new THREE.PlaneGeometry(180,22),new THREE.MeshBasicMaterial({color:0xc8eff5,transparent:true,opacity:.035-i*.004,depthWrite:false}));
  haze.position.set((i-2)*35,5+i*3,-120-i*35);haze.rotation.x=-.08;hazeGroup.add(haze);
}

const sprayCount=isMobile?90:500;
const sprayGeo=new THREE.BufferGeometry();
const sprayPos=new Float32Array(sprayCount*3);
for(let i=0;i<sprayCount;i++){
  sprayPos[i*3]=(Math.random()-.5)*120;
  sprayPos[i*3+1]=Math.random()*7+.1;
  sprayPos[i*3+2]=-Math.random()*210-4;
}
sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayPos,3));
const spray=new THREE.Points(sprayGeo,new THREE.PointsMaterial({color:0xdffcff,size:isMobile?.035:.045,transparent:true,opacity:.35,depthWrite:false}));
scene.add(spray);

const boat=new THREE.Group();
const hull=new THREE.Mesh(new THREE.BoxGeometry(3.2,.42,.85),new THREE.MeshStandardMaterial({color:0x10242a,roughness:.7}));
hull.position.y=.45;boat.add(hull);
const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,3.2,8),new THREE.MeshStandardMaterial({color:0xf2eee0,roughness:.6}));
mast.position.y=2;boat.add(mast);
const sail=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.2),new THREE.MeshStandardMaterial({color:0xf3f0df,side:THREE.DoubleSide,roughness:.9}));
sail.position.set(.55,2.05,0);sail.rotation.y=-.18;boat.add(sail);
boat.position.set(-9,.0,-82);boat.scale.setScalar(isMobile?.55:.9);scene.add(boat);

const plane=new THREE.Group();
const planeMat=new THREE.MeshStandardMaterial({color:0xeef4f4,roughness:.4,metalness:.2});
const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,2.2,10),planeMat);fuselage.rotation.z=Math.PI/2;plane.add(fuselage);
const wing=new THREE.Mesh(new THREE.BoxGeometry(1.2,.04,.45),planeMat);plane.add(wing);
plane.scale.setScalar(isMobile?.72:1);scene.add(plane);
const trailGeo=new THREE.BufferGeometry();
const trailPos=new Float32Array(48*3);trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.13}));scene.add(trail);

const state={progress:0,mx:0,my:0};
const target={x:0,y:5.2,z:24};
const bar=document.querySelector('#progressBar');
ScrollTrigger.create({trigger:'main',start:'top top',end:'bottom bottom',scrub:isMobile?.42:.65,onUpdate:self=>{
  state.progress=self.progress;if(bar)bar.style.width=`${self.progress*100}%`;
  target.z=24-self.progress*94;
  target.y=5.2-Math.sin(self.progress*Math.PI)*3.4-(self.progress>.72?(self.progress-.72)*11:0);
  target.x=Math.sin(self.progress*Math.PI*2)*7;
}});

gsap.to('.hero h1',{y:isMobile?-34:-75,opacity:.08,scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
gsap.to('.hero p,.scroll-cue',{y:-28,opacity:0,scrollTrigger:{trigger:'.hero',start:'top top',end:'55% top',scrub:true}});
gsap.utils.toArray('.story-card').forEach(card=>gsap.fromTo(card,{y:70,opacity:0},{y:0,opacity:1,scrollTrigger:{trigger:card,start:'top 84%',end:'top 54%',scrub:true}}));

// Never make the splash screen wait for the heavy water texture or first GPU frame.
const loader=document.querySelector('#loader');
if(loader){requestAnimationFrame(()=>requestAnimationFrame(()=>loader.classList.add('is-ready')));setTimeout(()=>loader.remove(),900);}
if(!isMobile&&!reduced)addEventListener('pointermove',e=>{state.mx=(e.clientX/innerWidth-.5)*2;state.my=(e.clientY/innerHeight-.5)*2;},{passive:true});
document.querySelector('#replay')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(isMobile?Math.min(devicePixelRatio||1,1.05):Math.min(devicePixelRatio||1,1.5));renderer.setSize(w,h,false);ScrollTrigger.refresh();}
addEventListener('resize',resize,{passive:true});addEventListener('orientationchange',()=>setTimeout(resize,150),{passive:true});

const clock=new THREE.Clock();
let frame=0;
function animate(){
  const t=clock.getElapsedTime();
  camera.position.x+=(target.x+state.mx*(isMobile?0:1.7)-camera.position.x)*.035;
  camera.position.y+=(target.y-state.my*(isMobile?0:.65)-camera.position.y)*.035;
  camera.position.z+=(target.z-camera.position.z)*.045;
  camera.lookAt(camera.position.x*.08,Math.max(-1,camera.position.y*.25),camera.position.z-22);

  water.material.uniforms.time.value=t*.48;
  // Sky/light updates are throttled on mobile; the sky does not need to be recalculated every frame.
  if(!isMobile || (frame%6===0)){
    skyParams.azimuth=138+Math.sin(t*.018)*5;
    skyParams.elevation=14+Math.sin(t*.025)*1.8;
    updateSky();
    sunlight.position.copy(sun).multiplyScalar(40);
  }
  spray.rotation.y=t*.006;

  const phase=(t*(isMobile?.32:.48))%15/15;
  plane.position.set(-30+phase*60,14+Math.sin(phase*Math.PI)*1.5,-35-phase*18);
  plane.rotation.z=-.02+Math.sin(phase*Math.PI*2)*.02;
  const a=trailGeo.attributes.position.array;
  for(let i=0;i<16;i++){const p=i/15;a[i*3]=plane.position.x-1-p*4.2;a[i*3+1]=plane.position.y+.04+Math.sin(p*5+t)*.012;a[i*3+2]=plane.position.z+p*3.2;}
  trailGeo.attributes.position.needsUpdate=true;

  boat.rotation.z=Math.sin(t*.55)*.025;
  boat.rotation.x=Math.cos(t*.42)*.018;
  boat.position.y=Math.sin(t*.55)*.12;
  renderer.render(scene,camera);
  frame++;
}
renderer.setAnimationLoop(animate);
