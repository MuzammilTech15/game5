import * as THREE from 'three';
import { ProceduralTextures } from './textures';
import { BuildingCollider } from './types';

export interface WorldBuildResult {
  colliders: BuildingCollider[];
  roadCoords: number[];
  cityBounds: number;
  airstripCenter: THREE.Vector3;
  barricadeGroup: THREE.Group;
  setBarricadesVisible: (visible: boolean) => void;
}

export function buildOpenWorld(
  scene: THREE.Scene,
  textures: ProceduralTextures,
): WorldBuildResult {
  const colliders: BuildingCollider[] = [];
  const cityHalf = 220;
  const blockSize = 52;
  const roadWidth = 18;
  const step = blockSize + roadWidth; // 70m grid
  const gridRange = [-140, -70, 0, 70, 140];
  const roadCoords = [-175, -105, -35, 35, 105, 175];

  // Extended terrain plane out to horizon (natural perimeter, no void box)
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshStandardMaterial({
      map: textures.grass,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.05;
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  // Coastal Ocean to the East (x > 250)
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 2400),
    new THREE.MeshStandardMaterial({
      map: textures.water,
      roughness: 0.25,
      metalness: 0.45,
    }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(950, -0.02, 0);
  scene.add(ocean);

  // Urban concrete base pad
  const cityPad = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({
      map: textures.sidewalk,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  cityPad.rotation.x = -Math.PI / 2;
  cityPad.position.y = 0;
  cityPad.receiveShadow = true;
  scene.add(cityPad);

  // Asphalt road network (offset +0.02 on Y + polygonOffset to avoid Z-fighting)
  const roadMatNS = new THREE.MeshStandardMaterial({
    map: textures.asphalt.clone(),
    roughness: 0.78,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  roadMatNS.map!.repeat.set(1, 16);
  roadMatNS.map!.needsUpdate = true;

  const roadMatEW = new THREE.MeshStandardMaterial({
    map: textures.asphalt.clone(),
    roughness: 0.78,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  roadMatEW.map!.repeat.set(1, 16);
  roadMatEW.map!.needsUpdate = true;

  for (const rc of roadCoords) {
    const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 430), roadMatNS);
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(rc, 0.02, 0);
    nsRoad.receiveShadow = true;
    scene.add(nsRoad);

    const ewRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 430), roadMatEW);
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.rotation.z = Math.PI / 2;
    ewRoad.position.set(0, 0.03, rc);
    ewRoad.receiveShadow = true;
    scene.add(ewRoad);
  }

  // Coastal Runway / Airstrip (East side, x = 265, z from -190 to 190)
  const runwayCenter = new THREE.Vector3(265, 0, 0);
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 420),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(265, 0.01, 0);
  apron.receiveShadow = true;
  scene.add(apron);

  const runwayMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 380),
    new THREE.MeshStandardMaterial({
      map: textures.runway,
      roughness: 0.75,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.position.set(265, 0.04, 0);
  runwayMesh.receiveShadow = true;
  scene.add(runwayMesh);

  // Airport Hangar & Control Tower (placed away from runway centerline)
  const hangarMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.6,
  });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 34), hangarMat);
  hangar.position.set(222, 6, -95);
  hangar.castShadow = true;
  hangar.receiveShadow = true;
  scene.add(hangar);
  colliders.push({ minX: 208, maxX: 236, minZ: -112, maxZ: -78, height: 12 });

  const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.6, 26, 8), hangarMat);
  towerShaft.position.set(224, 13, 70);
  towerShaft.castShadow = true;
  const towerCab = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 3.6, 4.5, 8),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  towerCab.position.set(224, 27, 70);
  scene.add(towerShaft, towerCab);
  colliders.push({ minX: 220, maxX: 228, minZ: 66, maxZ: 74, height: 29 });

  // Skyscrapers & City Blocks
  const buildingMaterials = textures.buildingFacades.map(
    (tex) =>
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.42,
        metalness: 0.35,
      }),
  );
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.78,
    metalness: 0.25,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.8,
  });

  // Leave center plaza (0, 0) as an open downtown park/plaza for combat & visibility!
  for (let bx = 0; bx < gridRange.length; bx++) {
    for (let bz = 0; bz < gridRange.length; bz++) {
      const cx = gridRange[bx];
      const cz = gridRange[bz];

      if (cx === 0 && cz === 0) {
        // Downtown Plaza Park with monument
        const grassPad = new THREE.Mesh(
          new THREE.PlaneGeometry(46, 46),
          new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.9 }),
        );
        grassPad.rotation.x = -Math.PI / 2;
        grassPad.position.set(0, 0.04, 0);
        scene.add(grassPad);

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 8), roofMat);
        plinth.position.set(0, 0.7, 0);
        const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 6), beaconMat);
        spire.position.set(0, 7.4, 0);
        scene.add(plinth, spire);
        colliders.push({ minX: -4, maxX: 4, minZ: -4, maxZ: 4, height: 14 });
        continue;
      }

      // Deterministic pseudo-random per block
      const seed = Math.abs(Math.sin((bx + 1) * 19.3 + (bz + 1) * 43.7));
      const bCount = seed > 0.45 ? 2 : 1;

      for (let i = 0; i < bCount; i++) {
        const subSeed = Math.abs(Math.cos((bx + 2) * 11.1 + (bz + 3) * 29.7 + i * 7.3));
        const w = bCount === 1 ? 26 + subSeed * 14 : 18 + subSeed * 4;
        const d = bCount === 1 ? 26 + (1 - subSeed) * 14 : 34 + subSeed * 8;
        const h = 24 + Math.floor(subSeed * 62);

        const offsetX = bCount === 1 ? 0 : i === 0 ? -12 : 12;
        const px = cx + offsetX;
        const pz = cz;

        const mat = buildingMaterials[(bx + bz + i) % buildingMaterials.length];
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(px, h / 2, pz);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);

        // Roof penthouse/cap + aviation beacon on tall skyscrapers
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 2.6, d * 0.65), roofMat);
        cap.position.set(px, h + 1.3, pz);
        scene.add(cap);

        if (h > 55) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 8, 6), roofMat);
          antenna.position.set(px, h + 6, pz);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), beaconMat);
          tip.position.set(px, h + 10.2, pz);
          scene.add(antenna, tip);
        }

        colliders.push({
          minX: px - w / 2,
          maxX: px + w / 2,
          minZ: pz - d / 2,
          maxZ: pz + d / 2,
          height: h,
        });
      }
    }
  }

  // Streetlights along main avenues using InstancedMesh
  const polePositions: [number, number, number][] = [];
  for (const rc of roadCoords) {
    for (let z = -165; z <= 165; z += 55) {
      if (roadCoords.some((r) => Math.abs(r - z) < 14)) continue;
      polePositions.push([rc - 10.5, z, 0]);
      polePositions.push([rc + 10.5, z, Math.PI]);
    }
  }

  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 6.8, 8);
  poleGeo.translate(0, 3.4, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, polePositions.length);

  const lampGeo = new THREE.BoxGeometry(1.1, 0.22, 0.45);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 1.9,
  });
  const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, polePositions.length);

  const dummy = new THREE.Object3D();
  polePositions.forEach(([px, pz, rotY], idx) => {
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(px + (rotY === 0 ? 0.55 : -0.55), 6.75, pz);
    dummy.updateMatrix();
    lampInst.setMatrixAt(idx, dummy.matrix);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  lampInst.instanceMatrix.needsUpdate = true;
  poleInst.computeBoundingSphere();
  lampInst.computeBoundingSphere();
  scene.add(poleInst, lampInst);

  // Urban Trees using InstancedMesh with subtle scale & tint variation
  const treeCoords: [number, number][] = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    treeCoords.push([Math.cos(angle) * 19, Math.sin(angle) * 19]);
  }
  for (const rc of [-105, -35, 35, 105]) {
    treeCoords.push([rc - 11.5, -185], [rc + 11.5, 185]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 7);
  trunkGeo.translate(0, 1.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);

  const crownGeo = new THREE.DodecahedronGeometry(1.85, 1);
  crownGeo.translate(0, 4.1, 0);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6f44, roughness: 0.85 });
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treeCoords.length);
  crownInst.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(treeCoords.length * 3),
    3,
  );

  const treeTint = new THREE.Color();
  treeCoords.forEach(([tx, tz], i) => {
    const s = 0.85 + ((i * 37) % 30) / 100;
    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    crownInst.setMatrixAt(i, dummy.matrix);

    treeTint.setHSL(0.36 + (i % 5) * 0.015, 0.45, 0.28 + (i % 4) * 0.04);
    crownInst.setColorAt(i, treeTint);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst, crownInst);

  // Mission 3 Lockdown Barricades (hidden until Mission 3 is active)
  const barricadeGroup = new THREE.Group();
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0x9a3412,
    emissiveIntensity: 0.4,
    roughness: 0.5,
  });
  const barrierOffsets: [number, number, number][] = [
    [0, -195, 0],
    [0, 195, 0],
    [-195, 0, Math.PI / 2],
    [195, 0, Math.PI / 2],
    [-105, -195, 0],
    [105, 195, 0],
  ];
  for (const [bx, bz, rot] of barrierOffsets) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 1.2), barrierMat);
    bar.position.set(bx, 0.8, bz);
    bar.rotation.y = rot;
    barricadeGroup.add(bar);
  }
  barricadeGroup.visible = false;
  scene.add(barricadeGroup);

  return {
    colliders,
    roadCoords,
    cityBounds: cityHalf,
    airstripCenter: runwayCenter,
    barricadeGroup,
    setBarricadesVisible: (visible: boolean) => {
      barricadeGroup.visible = visible;
    },
  };
}
