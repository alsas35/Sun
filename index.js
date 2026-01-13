import * as THREE from 'three';
import { OrbitControls } from "jsm/controls/OrbitControls.js";

// ── Setup ─────────────────────────────────────────────────────────
const w = window.innerWidth;
const h = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;  // Start farther to avoid initial "inside" feel

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000814);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;

// ── Sun Group ────────────────────────────────────────────────────
const sunGroup = new THREE.Group();
scene.add(sunGroup);

// Geometry
const geo = new THREE.IcosahedronGeometry(1.0, 6);

// Sun surface shader (sunspots)
const vertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec2 vUv;

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 baseColor = vec3(1.0, 0.7, 0.2);
    vec3 spotColor = vec3(0.6, 0.3, 0.1);

    float n = noise(vUv * 5.0 + time * 0.05);
    n += noise(vUv * 12.0 + time * 0.08) * 0.5;
    n = smoothstep(0.4, 0.7, n);

    vec3 color = mix(spotColor, baseColor, n);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const sunMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader,
  fragmentShader,
  side: THREE.FrontSide
});

const sunMesh = new THREE.Mesh(geo, sunMat);
sunMesh.renderOrder = 0;
sunGroup.add(sunMesh);

// Wireframe overlay
const wireMat = new THREE.MeshBasicMaterial({
  color: 0xffdd99,
  wireframe: true,
  transparent: true,
  opacity: 0.3
});
const wireMesh = new THREE.Mesh(geo, wireMat);
wireMesh.scale.setScalar(1.012);
wireMesh.renderOrder = 0.5;
sunGroup.add(wireMesh);

// Occlusion blocker (only ONE!)
const occlusion = new THREE.Mesh(
  new THREE.SphereGeometry(1.025, 64, 48),  // Slightly larger to block backfaces properly
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    transparent: true,
    depthWrite: true,
    colorWrite: false
  })
);
occlusion.renderOrder = 1;
sunGroup.add(occlusion);

// Corona layers – clean single loop
for (let i = 1; i <= 4; i++) {
  const radius = 1.0 + i * 0.16;  // 1.16 → 1.32 → 1.48 → 1.64 – good fade without excessive size

  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffaa44).multiplyScalar(1.4 - i * 0.28),
      transparent: true,
      opacity: 0.2 - i * 0.11,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  corona.renderOrder = 2 + i;
  sunGroup.add(corona);
}

// Solar Flares
const flareCount = 8;
const flares = [];

for (let i = 0; i < flareCount; i++) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    ).normalize().multiplyScalar(1.1),
    new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3
    ).normalize().multiplyScalar(2.5 + Math.random() * 1.5)
  ]);

  const points = curve.getPoints(50);
  const flareGeo = new THREE.BufferGeometry().setFromPoints(points);

  const flareMat = new THREE.LineBasicMaterial({
    color: 0xffee99,
    transparent: true,
    opacity: 0.7 + Math.random() * 0.3,
    blending: THREE.AdditiveBlending
  });

  const flareLine = new THREE.Line(flareGeo, flareMat);
  flareLine.userData = { phase: i * 1.5, scale: 1 + Math.random() * 0.8 };
  flareLine.renderOrder = 10 + i;  // After coronas
  sunGroup.add(flareLine);
  flares.push(flareLine);
}

// Light
scene.add(new THREE.PointLight(0xffeecc, 3, 100));

// Animation
function animate(t = 0) {
  requestAnimationFrame(animate);
  const time = t * 0.0005;

  sunMat.uniforms.time.value = time;

  const pulse = 1 + Math.sin(time * 2) * 0.02;
  sunGroup.scale.setScalar(pulse);

  sunGroup.rotation.y = time * 0.3;

  flares.forEach(flare => {
    const phase = (time + flare.userData.phase) % (Math.PI * 2);
    const grow = Math.max(0, Math.sin(phase * 2) * 1.5);
    flare.scale.setScalar(grow * flare.userData.scale);
    flare.material.opacity = 0.4 + Math.sin(phase * 3) * 0.6;
  });

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});