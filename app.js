import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';

const canvas = document.querySelector('#scene');
const video = document.querySelector('#oceanVideo');
const progressBar = document.querySelector('#progressBar');
const mobile = matchMedia('(max-width:700px)').matches || navigator.maxTouchPoints > 1;
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

// Garante que o vídeo tente tocar mesmo quando o navegador exigir uma chamada posterior.
video?.play().catch(() => {});

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: !mobile,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.15 : 1.65));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(mobile ? 65 : 58, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 4.8, 18);

const clock = new THREE.Clock();
const target = { x: 0, y: 4.8, z: 18 };
const state = { progress: 0, mx: 0, my: 0 };

// Camada de água 3D transparente: as ondas são computadas na GPU e o vídeo real fica atrás.
const vertexShader = `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vWorld;
  varying float vWave;
  varying vec3 vNormal;

  float wave(vec2 p, float t){
    float h = 0.0;
    h += sin(p.x * 0.12 + t * 0.72 + sin(p.y * 0.025) * 1.4) * 0.72;
    h += sin(p.y * 0.22 - t * 1.05 + p.x * 0.035) * 0.28;
    h += sin((p.x + p.y) * 0.34 + t * 1.4) * 0.14;
    h += sin((p.x * 1.8 - p.y) * 0.55 - t * 1.8) * 0.055;
    return h;
  }

  void main(){
    vec2 p = position.xy;
    float h = wave(p, uTime) * uAmp;
    float e = 0.08;
    float hx = wave(p + vec2(e,0.0),uTime) * uAmp;
    float hz = wave(p + vec2(0.0,e),uTime) * uAmp;
    vec3 tx = normalize(vec3(e,hx-h,0.0));
    vec3 tz = normalize(vec3(0.0,hz-h,e));
    vNormal = normalize(cross(tz,tx));
    vWave = h;
    vec3 local = vec3(p.x,h,p.y);
    vec4 world = modelMatrix * vec4(local,1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec3 uLight;
  uniform bool uMobile;
  varying vec3 vWorld;
  varying float vWave;
  varying vec3 vNormal;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamera-vWorld);
    vec3 L = normalize(uLight);
    float fresnel = pow(1.0-max(dot(N,V),0.0),3.5);
    float sun = pow(max(dot(reflect(-L,N),V),0.0),uMobile?55.0:100.0);
    float foam = smoothstep(0.48,0.78,abs(vWave));
    float ripple = sin(vWorld.x*2.6+uTime*3.0)*sin(vWorld.z*2.1-uTime*2.7);
    ripple = smoothstep(0.78,0.98,ripple);
    vec3 tint = mix(vec3(0.01,0.12,0.17),vec3(0.04,0.48,0.58),fresnel);
    tint += vec3(1.0,0.68,0.38)*sun*0.85;
    tint += vec3(0.5,0.88,1.0)*ripple*(uMobile?0.08:0.15);
    tint += vec3(0.75,0.92,0.92)*foam*0.07;
    float alpha = 0.10 + fresnel*0.25 + sun*0.22;
    gl_FragColor = vec4(tint,alpha);
  }
`;

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(mobile ? 360 : 520, mobile ? 360 : 520, mobile ? 120 : 210, mobile ? 120 : 210),
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    uniforms:{
      uTime:{value:0},
      uAmp:{value:mobile?0.8:1.05},
      uCamera:{value:camera.position},
      uLight:{value:new THREE.Vector3(-0.42,0.76,0.3).normalize()},
      uMobile:{value:mobile}
    }
  })
);
ocean.rotation.x = -Math.PI/2;
ocean.position.y = -0.7;
scene.add(ocean);

// Partículas de spray dão profundidade sem esconder o vídeo.
const count = mobile ? 140 : 520;
const positions = new Float32Array(count*3);
for(let i=0;i<count;i++){
  positions[i*3]=(Math.random()-.5)*120;
  positions[i*3+1]=Math.random()*2.4-0.2;
  positions[i*3+2]=-Math.random()*180+8;
}
const sprayGeometry = new THREE.BufferGeometry();
sprayGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
const spray = new THREE.Points(
  sprayGeometry,
  new THREE.PointsMaterial({color:0xdffaff,size:mobile?.025:.04,transparent:true,opacity:.28,depthWrite:false})
);
scene.add(spray);

// Silhueta 3D pequena para criar escala cinematográfica.
const boat = new THREE.Group();
const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8,.34,.72),new THREE.MeshStandardMaterial({color:0x101c20,roughness:.8}));
hull.position.y=.3;boat.add(hull);
const mast = new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,2.6,8),new THREE.MeshStandardMaterial({color:0xf0eadc}));
mast.position.y=1.65;boat.add(mast);
const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.65),new THREE.MeshStandardMaterial({color:0xf1ebdb,side:THREE.DoubleSide}));
sail.position.set(.42,1.65,0);boat.add(sail);
boat.position.set(-11,0,-75);boat.scale.setScalar(mobile?.42:.72);scene.add(boat);

const light = new THREE.HemisphereLight(0xa9dce8,0x021018,mobile?0.8:1.1);scene.add(light);

// Scroll nativo: elimina outra dependência externa e deixa a experiência mais robusta.
function updateScroll(){
  const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  state.progress=Math.min(1,Math.max(0,scrollY/max));
  if(progressBar) progressBar.style.width=`${state.progress*100}%`;
  target.z=18-state.progress*86;
  target.y=4.8-Math.sin(state.progress*Math.PI)*3.2-(state.progress>.72?(state.progress-.72)*8:0);
  target.x=Math.sin(state.progress*Math.PI*2)*5.5;
}
addEventListener('scroll',updateScroll,{passive:true});

if(!mobile && !reduced){
  addEventListener('pointermove',e=>{
    state.mx=(e.clientX/innerWidth-.5)*2;
    state.my=(e.clientY/innerHeight-.5)*2;
  },{passive:true});
}

document.querySelector('#replay')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

function resize(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.15:1.65));
  renderer.setSize(innerWidth,innerHeight,false);
}
addEventListener('resize',resize,{passive:true});
addEventListener('orientationchange',()=>setTimeout(resize,150),{passive:true});

function animate(){
  const t=clock.getElapsedTime();
  camera.position.x += (target.x + state.mx*(mobile?0:1.8)-camera.position.x)*0.035;
  camera.position.y += (target.y - state.my*(mobile?0:.65)-camera.position.y)*0.035;
  camera.position.z += (target.z-camera.position.z)*0.045;
  camera.lookAt(camera.position.x*.06,Math.max(-1,camera.position.y*.22),camera.position.z-22);
  ocean.material.uniforms.uTime.value=t*0.72;
  ocean.material.uniforms.uCamera.value.copy(camera.position);
  spray.rotation.y=t*.006;
  boat.rotation.z=Math.sin(t*.55)*.025;
  boat.rotation.x=Math.cos(t*.42)*.018;
  boat.position.y=Math.sin(t*.55)*.1;
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);
updateScroll();
