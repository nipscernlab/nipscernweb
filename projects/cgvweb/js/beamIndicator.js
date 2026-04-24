import * as THREE from 'three';
import { scene, markDirty } from './renderer.js';

let beamGroup = null;
let beamOn = false;

function _build() {
  if (beamGroup) return;
  beamGroup = new THREE.Group();
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -13000),
    new THREE.Vector3(0, 0, 13000),
  ]);
  beamGroup.add(
    new THREE.Line(
      axisGeo,
      new THREE.LineBasicMaterial({
        color: 0x4a7fcc,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    ),
  );
  const northMesh = new THREE.Mesh(
    new THREE.ConeGeometry(90, 520, 24, 1, false),
    new THREE.MeshBasicMaterial({ color: 0xee2222 }),
  );
  northMesh.rotation.x = Math.PI / 2;
  northMesh.position.z = 13260;
  beamGroup.add(northMesh);
  const ringN = new THREE.Mesh(
    new THREE.TorusGeometry(90, 8, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.55 }),
  );
  ringN.rotation.x = Math.PI / 2;
  ringN.position.z = 13000;
  beamGroup.add(ringN);
  const southMesh = new THREE.Mesh(
    new THREE.ConeGeometry(90, 520, 24, 1, false),
    new THREE.MeshBasicMaterial({ color: 0x2244ee }),
  );
  southMesh.rotation.x = -Math.PI / 2;
  southMesh.position.z = -13260;
  beamGroup.add(southMesh);
  const ringS = new THREE.Mesh(
    new THREE.TorusGeometry(90, 8, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.55 }),
  );
  ringS.rotation.x = Math.PI / 2;
  ringS.position.z = -13000;
  beamGroup.add(ringS);
  beamGroup.visible = false;
  scene.add(beamGroup);
}

export function toggleBeam() {
  _build();
  beamOn = !beamOn;
  beamGroup.visible = beamOn;
  document.getElementById('btn-beam').classList.toggle('on', beamOn);
  markDirty();
}
