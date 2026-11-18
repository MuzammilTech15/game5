import * as THREE from 'three';

export interface PlayerRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Group;
  head: THREE.Mesh;
  weaponMesh: THREE.Group;
}

export interface CarRig {
  group: THREE.Group;
  wheels: THREE.Group[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
}

export interface AirplaneRig {
  group: THREE.Group;
  propeller: THREE.Group;
  afterburner: THREE.Mesh;
}

export interface CitizenRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
}

export interface DroneRig {
  group: THREE.Group;
  rotors: THREE.Mesh[];
  eye: THREE.Mesh;
}

export function createContactShadow(
  shadowTex: THREE.Texture,
  width: number,
  depth: number,
  opacity = 0.48,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  return mesh;
}

export function buildPlayerModel(shadowTex: THREE.Texture): PlayerRig {
  const group = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.12,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.58,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd9a077,
    roughness: 0.65,
    metalness: 0.02,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.9,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.85,
  });

  // Legs (bottom-center pivot at y=0)
  const legGeo = new THREE.BoxGeometry(0.24, 0.78, 0.26);
  legGeo.translate(0, -0.39, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.16, 0.78, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.16, 0.78, 0);
  rightLeg.castShadow = true;

  // Torso & tactical vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.32), jacketMat);
  torso.position.set(0, 1.16, 0);
  torso.castShadow = true;

  const chestAccent = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.34), shirtMat);
  chestAccent.position.set(0, 1.2, 0.01);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.16), pantsMat);
  pack.position.set(0, 1.18, -0.22);

  // Head & sunglasses visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skinMat);
  head.position.set(0, 1.74, 0);
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), pantsMat);
  hair.position.set(0, 1.92, -0.01);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), visorMat);
  visor.position.set(0, 1.76, 0.18);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.64, 0.22);
  armGeo.translate(0, -0.26, 0);
  const leftArm = new THREE.Mesh(armGeo, jacketMat);
  leftArm.position.set(-0.4, 1.44, 0);
  leftArm.castShadow = true;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 1.44, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, jacketMat);
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  // Weapon assembly attached to right hand
  const weaponMesh = new THREE.Group();
  weaponMesh.position.set(0, -0.52, 0.24);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.52), gunMat);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), pantsMat);
  grip.position.set(0, -0.08, -0.14);
  weaponMesh.add(barrel, grip);
  rightArm.add(weaponMesh);

  const shadow = createContactShadow(shadowTex, 1.1, 1.1, 0.45);
  group.add(shadow, leftLeg, rightLeg, torso, chestAccent, pack, head, hair, visor, leftArm, rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm, head, weaponMesh };
}

export function buildCarModel(
  shadowTex: THREE.Texture,
  bodyColor: number,
  isSports = true,
): CarRig {
  const group = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const cabinGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.2,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.78,
    metalness: 0.2,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.92,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.4,
  });

  // Lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.45), paintMat);
  chassis.position.set(0, 0.56, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;

  // Front hood slope accent
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.5), paintMat);
  hood.position.set(0, 0.86, 1.25);
  hood.rotation.x = 0.08;

  // Cabin greenhouse
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.74, isSports ? 0.54 : 0.66, 2.05),
    cabinGlassMat,
  );
  cabin.position.set(0, isSports ? 1.1 : 1.15, -0.25);
  cabin.castShadow = true;

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.65), paintMat);
  roof.position.set(0, isSports ? 1.38 : 1.49, -0.3);

  // Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.26, 0.22), trimMat);
  frontBumper.position.set(0, 0.34, 2.22);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 0.22), trimMat);
  rearBumper.position.set(0, 0.35, -2.22);

  // Spoiler on sports cars
  if (isSports) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.07, 0.36), trimMat);
    wing.position.set(0, 1.08, -2.02);
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.16), trimMat);
    strutL.position.set(-0.62, 0.96, -2.02);
    const strutR = strutL.clone();
    strutR.position.x = 0.62;
    group.add(wing, strutL, strutR);
  }

  // Headlights & Taillights
  const hlGeo = new THREE.BoxGeometry(0.42, 0.14, 0.08);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.66, 0.64, 2.24);
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.66, 0.64, 2.24);

  const tlL = new THREE.Mesh(hlGeo, taillightMat);
  tlL.position.set(-0.68, 0.68, -2.24);
  const tlR = new THREE.Mesh(hlGeo, taillightMat);
  tlR.position.set(0.68, 0.68, -2.24);

  // 4 Composite Wheels (Tire + Alloy Rim)
  const wheels: THREE.Group[] = [];
  const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelCoords: [number, number, number][] = [
    [-1.02, 0.38, 1.38],
    [1.02, 0.38, 1.38],
    [-1.02, 0.38, -1.38],
    [1.02, 0.38, -1.38],
  ];

  for (const [wx, wy, wz] of wheelCoords) {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, wy, wz);
    const tire = new THREE.Mesh(tireGeo, trimMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wGroup.add(tire, rim);
    wheels.push(wGroup);
    group.add(wGroup);
  }

  const shadow = createContactShadow(shadowTex, 2.7, 5.2, 0.52);
  group.add(
    shadow,
    chassis,
    hood,
    cabin,
    roof,
    frontBumper,
    rearBumper,
    hlL,
    hlR,
    tlL,
    tlR,
  );

  return { group, wheels, headlights: [hlL, hlR], taillights: [tlL, tlR] };
}

export function buildPlaneModel(
  shadowTex: THREE.Texture,
  primaryColor = 0xe2e8f0,
  accentColor = 0x06b6d4,
): AirplaneRig {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.72,
    roughness: 0.25,
    clearcoat: 0.85,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.55,
    roughness: 0.32,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.35,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.8,
  });
  const burnerMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xf97316,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  // Sleek tapered fuselage
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 6.2, 16), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 1.35, 0);
  fuselage.castShadow = true;

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 16), accentMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.35, 4.0);
  nose.castShadow = true;

  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 2.2), canopyMat);
  canopy.position.set(0, 1.92, 1.15);

  // Swept main wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(4.6, -1.3);
  wingShape.lineTo(4.6, -2.1);
  wingShape.lineTo(0, -1.8);
  wingShape.closePath();

  const extrudeSettings = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 };
  const wingGeoR = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
  wingGeoR.rotateX(Math.PI / 2);

  const wingR = new THREE.Mesh(wingGeoR, hullMat);
  wingR.position.set(0.45, 1.32, 0.9);
  wingR.castShadow = true;

  const wingL = wingR.clone();
  wingL.scale.x = -1;
  wingL.position.x = -0.45;

  // Wingtip pods / accents
  const podGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, accentMat);
  podL.position.set(-4.9, 1.26, -0.7);
  const podR = podL.clone();
  podR.position.x = 4.9;

  // Tail stabilizer fin + horizontal elevators
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.65, 1.4), accentMat);
  tailFin.position.set(0, 2.25, -2.55);
  tailFin.rotation.x = -0.25;
  tailFin.castShadow = true;

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.9), hullMat);
  hStab.position.set(0, 1.42, -2.65);

  // Nose propeller + Afterburner exhaust
  const propeller = new THREE.Group();
  propeller.position.set(0, 1.35, 4.92);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 0.05), darkMetal);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.05), darkMetal);
  propeller.add(blade1, blade2);

  const afterburner = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 0.6, 12), burnerMat);
  afterburner.rotation.x = Math.PI / 2;
  afterburner.position.set(0, 1.35, -3.25);

  // Tricycle landing gear grounded at y = 0
  const gearWheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12);
  gearWheelGeo.rotateZ(Math.PI / 2);
  const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8);

  const gearPositions: [number, number][] = [
    [0, 2.4],
    [-1.4, -0.6],
    [1.4, -0.6],
  ];
  for (const [gx, gz] of gearPositions) {
    const strut = new THREE.Mesh(strutGeo, darkMetal);
    strut.position.set(gx, 0.72, gz);
    const wheel = new THREE.Mesh(gearWheelGeo, darkMetal);
    wheel.position.set(gx, 0.24, gz);
    group.add(strut, wheel);
  }

  const shadow = createContactShadow(shadowTex, 9.2, 8.6, 0.44);
  group.add(
    shadow,
    fuselage,
    nose,
    canopy,
    wingR,
    wingL,
    podL,
    podR,
    tailFin,
    hStab,
    propeller,
    afterburner,
  );

  return { group, propeller, afterburner };
}

export function buildCitizenModel(
  shadowTex: THREE.Texture,
  shirtColor: number,
  pantsColor: number,
): CitizenRig {
  const group = new THREE.Group();

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.7 });

  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  legGeo.translate(0, -0.36, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.14, 0.72, 0);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.14, 0.72, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.28), shirtMat);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.set(0, 1.62, 0);

  const armGeo = new THREE.BoxGeometry(0.16, 0.56, 0.18);
  armGeo.translate(0, -0.24, 0);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.34, 1.34, 0);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.34, 1.34, 0);

  const shadow = createContactShadow(shadowTex, 0.95, 0.95, 0.36);
  group.add(shadow, leftLeg, rightLeg, torso, head, leftArm, rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm };
}

export function buildDroneModel(isBoss = false): DroneRig {
  const group = new THREE.Group();
  const scale = isBoss ? 2.4 : 1.0;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0x1f2937 : 0x334155,
    metalness: 0.85,
    roughness: 0.25,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xf97316 : 0xef4444,
    emissive: isBoss ? 0xf97316 : 0xef4444,
    emissiveIntensity: 2.0,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.7,
    roughness: 0.3,
  });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65 * scale, 1), bodyMat);
  core.castShadow = true;

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 12, 12), eyeMat);
  eye.position.set(0, 0, 0.52 * scale);

  const rotors: THREE.Mesh[] = [];
  const armOffsets: [number, number][] = [
    [-0.9 * scale, -0.9 * scale],
    [0.9 * scale, -0.9 * scale],
    [-0.9 * scale, 0.9 * scale],
    [0.9 * scale, 0.9 * scale],
  ];

  for (const [ax, az] of armOffsets) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 * scale, 0.1 * scale, 1.3 * scale),
      bodyMat,
    );
    arm.position.set(ax * 0.5, 0.1 * scale, az * 0.5);
    arm.lookAt(ax, 0.1 * scale, az);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.95 * scale, 0.04 * scale, 0.14 * scale),
      rotorMat,
    );
    blade.position.set(ax, 0.22 * scale, az);
    rotors.push(blade);
    group.add(arm, blade);
  }

  group.add(core, eye);
  return { group, rotors, eye };
}

export function buildEnemyJetModel(isGunship = false): THREE.Group {
  const group = new THREE.Group();
  const s = isGunship ? 1.85 : 1.0;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isGunship ? 0x18181b : 0x27272a,
    metalness: 0.85,
    roughness: 0.28,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.9,
    metalness: 0.5,
    roughness: 0.35,
  });

  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.8 * s, 5.2 * s, 8), bodyMat);
  hull.rotation.x = Math.PI / 2;

  const wing = new THREE.Mesh(new THREE.BoxGeometry(6.4 * s, 0.14 * s, 1.9 * s), bodyMat);
  wing.position.set(0, 0, -0.6 * s);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 1.5 * s, 1.2 * s), accentMat);
  tail.position.set(0, 0.8 * s, -2.0 * s);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 0.45 * s, 1.5 * s), accentMat);
  cockpit.position.set(0, 0.45 * s, 0.8 * s);

  group.add(hull, wing, tail, cockpit);
  return group;
}

export function buildEnforcerModel(shadowTex: THREE.Texture): CitizenRig {
  const rig = buildCitizenModel(shadowTex, 0x991b1b, 0x18181b);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
    }),
  );
  visor.position.set(0, 1.64, 0.16);
  rig.group.add(visor);
  return rig;
}
