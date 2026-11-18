import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gameAudio } from './audio';
import { MISSIONS, STARTING_CASH, WEAPONS } from './missions';
import {
  AirplaneRig,
  buildCarModel,
  buildCitizenModel,
  buildDroneModel,
  buildEnemyJetModel,
  buildEnforcerModel,
  buildPlaneModel,
  buildPlayerModel,
  CarRig,
  CitizenRig,
  DroneRig,
  PlayerRig,
} from './models';
import { createProceduralTextures, ProceduralTextures } from './textures';
import {
  BuildingCollider,
  CameraPerspective,
  HudSnapshot,
  MinimapEntity,
  VehicleKind,
  WeaponId,
} from './types';
import { buildOpenWorld, WorldBuildResult } from './world';

interface VehicleEntity {
  id: string;
  kind: VehicleKind;
  label: string;
  group: THREE.Group;
  carRig?: CarRig;
  planeRig?: AirplaneRig;
  velocity: THREE.Vector3;
  speed: number;
  heading: number;
  pitch: number;
  roll: number;
  throttle: number;
  isTraffic: boolean;
  trafficDir: THREE.Vector3;
  occupiedByPlayer: boolean;
}

interface CitizenEntity {
  rig: CitizenRig;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  walkPhase: number;
  panicTimer: number;
  baseSpeed: number;
}

interface EnemyEntity {
  id: string;
  kind: 'drone' | 'command_drone' | 'enemy_jet' | 'enforcer' | 'gunship';
  group: THREE.Group;
  droneRig?: DroneRig;
  enforcerRig?: CitizenRig;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fireCooldown: number;
  orbitAngle: number;
  orbitRadius: number;
  baseAlt: number;
}

interface ProjectileEntity {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fromPlayer: boolean;
  damage: number;
  explosive: boolean;
  life: number;
}

interface ExplosionParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface CheckpointRing {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  collected: boolean;
}

// Pre-allocated math helpers (Zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _quat = new THREE.Quaternion();

export class GtaGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onContextLostChange?: (lost: boolean) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextures;
  private world!: WorldBuildResult;

  private isSoftwareGl = false;
  private frameId = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private paused = false;

  // Player state
  private playerRig!: PlayerRig;
  private playerPos = new THREE.Vector3(0, 0, 28);
  private playerVel = new THREE.Vector3();
  private playerHeading = Math.PI;
  private playerWalkPhase = 0;
  private onGround = true;

  private health = 100;
  private maxHealth = 100;
  private armor = 50;
  private cash = STARTING_CASH;
  private score = 0;
  private wantedLevel = 0;
  private gameOver = false;

  // Weapons
  private weaponId: WeaponId = 'pistol';
  private unlockedWeapons: WeaponId[] = ['pistol', 'rifle'];
  private ammoInClip: Record<WeaponId, number> = {
    pistol: WEAPONS.pistol.clipSize,
    rifle: WEAPONS.rifle.clipSize,
    launcher: WEAPONS.launcher.clipSize,
  };
  private reserveAmmo: Record<WeaponId, number> = {
    pistol: 120,
    rifle: 210,
    launcher: 12,
  };
  private lastFireTime = 0;

  // Camera
  private cameraMode: CameraPerspective = 'third';
  private camYaw = Math.PI;
  private camPitch = 0.24;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // World actors
  private vehicles: VehicleEntity[] = [];
  private currentVehicle: VehicleEntity | null = null;
  private citizens: CitizenEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private explosions: ExplosionParticle[] = [];
  private checkpoints: CheckpointRing[] = [];
  private objectiveBeacon!: THREE.Mesh;

  // Mission progression
  private purchasedMissionIds: string[] = [];
  private completedMissionIds: string[] = [];
  private activeMissionId: string | null = null;
  private activeSubMissionIndex = 0;
  private subMissionProgress = 0;
  private bannerMessage: string | null = 'GTA 5 by Double Tech.';
  private bannerTimer = 4.5;

  // Input state
  private keys = new Set<string>();
  private virtualKeys = new Set<string>();
  private firing = false;
  private hudEmitTimer = 0;

  // Shared geometries for projectiles/particles
  private bulletGeo = new THREE.SphereGeometry(0.18, 6, 6);
  private rocketGeo = new THREE.SphereGeometry(0.32, 8, 8);
  private particleGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);

  constructor(
    container: HTMLElement,
    onHudUpdate: (hud: HudSnapshot) => void,
    onContextLostChange?: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLostChange = onContextLostChange;
    this.initThree();
    this.populateActors();
    this.bindEvents();
    this.emitHud();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private initThree(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyHex = 0x0b1326;
    this.scene.background = new THREE.Color(skyHex);
    this.scene.fog = new THREE.FogExp2(skyHex, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.2,
      1100,
    );

    // Mandatory studio environment map for metallic car paint & airplane canopies
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Lighting Rig (<= 3 shadow casters)
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.72);
    this.scene.add(hemi);

    const sunKey = new THREE.DirectionalLight(0xffe4b5, 1.55);
    sunKey.position.set(110, 160, 85);
    sunKey.castShadow = !this.isSoftwareGl;
    sunKey.shadow.mapSize.set(1024, 1024);
    sunKey.shadow.camera.near = 10;
    sunKey.shadow.camera.far = 420;
    const d = 160;
    sunKey.shadow.camera.left = -d;
    sunKey.shadow.camera.right = d;
    sunKey.shadow.camera.top = d;
    sunKey.shadow.camera.bottom = -d;
    sunKey.shadow.bias = -0.0005;
    sunKey.shadow.normalBias = 0.02;
    this.scene.add(sunKey);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-120, 80, -110);
    this.scene.add(rimLight);

    // Subtle skyline sun/moon disc in sky
    const moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(22, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfde68a, fog: false }),
    );
    moonDisc.position.set(360, 290, -450);
    this.scene.add(moonDisc);

    this.textures = createProceduralTextures(this.renderer);
    this.world = buildOpenWorld(this.scene, this.textures);

    // Objective waypoint beacon
    this.objectiveBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 70, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.objectiveBeacon.visible = false;
    this.scene.add(this.objectiveBeacon);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private populateActors(): void {
    // Player
    this.playerRig = buildPlayerModel(this.textures.contactShadow);
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerHeading;
    this.scene.add(this.playerRig.group);

    // Parked Hero Sports Cars
    const parkedCars: { x: number; z: number; h: number; color: number; label: string }[] = [
      { x: 10, z: 32, h: Math.PI / 2, color: 0x06b6d4, label: 'Apex GT-R' },
      { x: -16, z: -32, h: 0, color: 0xf59e0b, label: 'Viper Muscle' },
      { x: 185, z: 12, h: Math.PI / 2, color: 0xef4444, label: 'Coastline Coupe' },
      { x: -108, z: 42, h: Math.PI, color: 0x10b981, label: 'Emerald Interceptor' },
    ];
    parkedCars.forEach((c, idx) => {
      const rig = buildCarModel(this.textures.contactShadow, c.color, true);
      rig.group.position.set(c.x, 0, c.z);
      rig.group.rotation.y = c.h;
      this.scene.add(rig.group);
      this.vehicles.push({
        id: `hero_car_${idx}`,
        kind: 'car',
        label: c.label,
        group: rig.group,
        carRig: rig,
        velocity: new THREE.Vector3(),
        speed: 0,
        heading: c.h,
        pitch: 0,
        roll: 0,
        throttle: 0,
        isTraffic: false,
        trafficDir: new THREE.Vector3(),
        occupiedByPlayer: false,
      });
    });

    // Moving Ambient Traffic Cars on avenues
    const trafficColors = [0x3b82f6, 0x94a3b8, 0xeab308, 0xec4899, 0x14b8a6, 0xdc2626];
    this.world.roadCoords.forEach((rc, i) => {
      const alongX = i % 2 === 0;
      const pos = alongX ? new THREE.Vector3(-120 + i * 35, 0, rc + 4) : new THREE.Vector3(rc + 4, 0, -110 + i * 30);
      const heading = alongX ? Math.PI / 2 : 0;
      const rig = buildCarModel(
        this.textures.contactShadow,
        trafficColors[i % trafficColors.length],
        false,
      );
      rig.group.position.copy(pos);
      rig.group.rotation.y = heading;
      this.scene.add(rig.group);
      this.vehicles.push({
        id: `traffic_car_${i}`,
        kind: 'car',
        label: 'Metro Sedan',
        group: rig.group,
        carRig: rig,
        velocity: new THREE.Vector3(),
        speed: 14,
        heading,
        pitch: 0,
        roll: 0,
        throttle: 0,
        isTraffic: true,
        trafficDir: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
        occupiedByPlayer: false,
      });
    });

    // Flyable Airplanes on the Coastal Airstrip + Southern Runway Apron
    const planes: { x: number; z: number; h: number; primary: number; accent: number; label: string }[] = [
      { x: 265, z: -140, h: 0, primary: 0xe2e8f0, accent: 0x06b6d4, label: 'F-22 Skyblade Jet' },
      { x: 265, z: 130, h: Math.PI, primary: 0xf8fafc, accent: 0xf59e0b, label: 'Falcon Stunt Plane' },
      { x: 244, z: -20, h: 0, primary: 0xcbd5e1, accent: 0xef4444, label: 'Vanguard Interceptor' },
    ];
    planes.forEach((p, idx) => {
      const rig = buildPlaneModel(this.textures.contactShadow, p.primary, p.accent);
      rig.group.position.set(p.x, 0, p.z);
      rig.group.rotation.y = p.h;
      this.scene.add(rig.group);
      this.vehicles.push({
        id: `plane_${idx}`,
        kind: 'airplane',
        label: p.label,
        group: rig.group,
        planeRig: rig,
        velocity: new THREE.Vector3(),
        speed: 0,
        heading: p.h,
        pitch: 0,
        roll: 0,
        throttle: 0,
        isTraffic: false,
        trafficDir: new THREE.Vector3(),
        occupiedByPlayer: false,
      });
    });

    // Citizens (Pedestrians) strolling city sidewalks
    const shirtPalette = [0x38bdf8, 0xfbbf24, 0xf472b6, 0x34d399, 0xa78bfa, 0xf87171, 0xe2e8f0];
    const pantsPalette = [0x1e293b, 0x334155, 0x0f172a, 0x3f3f46];
    for (let i = 0; i < 28; i++) {
      const rc = this.world.roadCoords[i % this.world.roadCoords.length];
      const side = i % 2 === 0 ? 10.5 : -10.5;
      const alongZ = i < 14;
      const pos = alongZ
        ? new THREE.Vector3(rc + side, 0, -160 + (i * 25) % 320)
        : new THREE.Vector3(-160 + (i * 27) % 320, 0, rc + side);
      const dir = alongZ
        ? new THREE.Vector3(0, 0, i % 3 === 0 ? 1 : -1)
        : new THREE.Vector3(i % 3 === 0 ? 1 : -1, 0, 0);

      const rig = buildCitizenModel(
        this.textures.contactShadow,
        shirtPalette[i % shirtPalette.length],
        pantsPalette[i % pantsPalette.length],
      );
      rig.group.position.copy(pos);
      this.scene.add(rig.group);
      this.citizens.push({
        rig,
        pos,
        dir,
        walkPhase: Math.random() * Math.PI * 2,
        panicTimer: 0,
        baseSpeed: 2.3 + Math.random() * 1.1,
      });
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('contextmenu', this.preventContext);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private preventContext = (e: Event): void => {
    e.preventDefault();
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.onContextLostChange?.(false);
  };

  private handleResize = (): void => {
    if (!this.container || this.disposed) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    gameAudio.init();
    this.keys.add(e.code);

    if (this.paused || this.gameOver) return;

    if (e.code === 'KeyF' || e.code === 'KeyE') {
      this.toggleVehicle();
    } else if (e.code === 'KeyV') {
      this.toggleCameraMode();
    } else if (e.code === 'Digit1') {
      this.selectWeapon('pistol');
    } else if (e.code === 'Digit2') {
      this.selectWeapon('rifle');
    } else if (e.code === 'Digit3') {
      this.selectWeapon('launcher');
    } else if (e.code === 'KeyR') {
      this.reloadWeapon();
    } else if (e.code === 'KeyJ') {
      this.firing = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'KeyJ') {
      this.firing = false;
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    gameAudio.init();
    if (this.paused || this.gameOver) return;

    if (e.button === 0) {
      this.firing = true;
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2) {
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDraggingLook || this.paused) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.camYaw -= dx * 0.0055;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.0045, -0.35, 1.05);
  };

  private handlePointerUp = (): void => {
    this.firing = false;
    this.isDraggingLook = false;
  };

  // Public API for React UI
  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.firing = false;
      this.keys.clear();
      this.virtualKeys.clear();
      gameAudio.updateVehicleEngine(false, null, 0);
    }
  }

  public setVirtualKey(code: string, active: boolean): void {
    gameAudio.init();
    if (active) this.virtualKeys.add(code);
    else this.virtualKeys.delete(code);
  }

  public setFiring(active: boolean): void {
    gameAudio.init();
    this.firing = active;
  }

  public toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === 'third' ? 'first' : 'third';
    this.emitHud();
  }

  public selectWeapon(id: WeaponId): void {
    if (!this.unlockedWeapons.includes(id)) return;
    this.weaponId = id;
    this.emitHud();
  }

  public reloadWeapon(): void {
    const spec = WEAPONS[this.weaponId];
    const needed = spec.clipSize - this.ammoInClip[this.weaponId];
    if (needed <= 0 || this.reserveAmmo[this.weaponId] <= 0) return;
    const take = Math.min(needed, this.reserveAmmo[this.weaponId]);
    this.ammoInClip[this.weaponId] += take;
    this.reserveAmmo[this.weaponId] -= take;
    gameAudio.playChime('vehicle');
    this.emitHud();
  }

  public purchaseWeapon(id: WeaponId): boolean {
    const spec = WEAPONS[id];
    if (!this.unlockedWeapons.includes(id)) {
      if (this.cash < spec.unlockCost) return false;
      this.cash -= spec.unlockCost;
      this.unlockedWeapons.push(id);
      this.weaponId = id;
      gameAudio.playChime('buy');
      this.emitHud();
      return true;
    }
    // Buy ammo pack ($120)
    const ammoCost = 120;
    if (this.cash < ammoCost) return false;
    this.cash -= ammoCost;
    this.reserveAmmo[id] = Math.min(spec.maxAmmo, this.reserveAmmo[id] + spec.clipSize * 2);
    gameAudio.playChime('buy');
    this.emitHud();
    return true;
  }

  public buyArmorMedkit(): boolean {
    if (this.cash < 200) return false;
    this.cash -= 200;
    this.health = this.maxHealth;
    this.armor = 100;
    gameAudio.playChime('buy');
    this.emitHud();
    return true;
  }

  public purchaseAndStartMission(missionId: string): boolean {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return false;

    const alreadyOwned = this.purchasedMissionIds.includes(missionId);
    if (!alreadyOwned) {
      if (this.cash < def.cost) return false;
      this.cash -= def.cost;
      this.purchasedMissionIds.push(missionId);
      gameAudio.playChime('buy');
    }

    this.startMission(missionId);
    return true;
  }

  public startMission(missionId: string): void {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return;

    this.clearMissionActors();
    this.activeMissionId = missionId;
    this.activeSubMissionIndex = 0;
    this.subMissionProgress = 0;
    this.wantedLevel = def.number;
    this.world.setBarricadesVisible(missionId === 'mission_3_chaos');

    this.showBanner(`Mission ${def.number}: ${def.title} — ${def.subMissions[0].title}`);
    this.spawnSubMissionActors();
    this.emitHud();
  }

  public respawnPlayer(): void {
    this.health = 100;
    this.armor = 50;
    this.gameOver = false;
    if (this.currentVehicle) {
      this.exitVehicle();
    }
    this.playerPos.set(0, 0, 28);
    this.playerVel.set(0, 0, 0);
    this.playerRig.group.visible = true;
    this.showBanner('Respawned at Downtown Plaza');
    this.emitHud();
  }

  private showBanner(msg: string, duration = 3.8): void {
    this.bannerMessage = msg;
    this.bannerTimer = duration;
  }

  private clearMissionActors(): void {
    for (const en of this.enemies) {
      this.scene.remove(en.group);
    }
    this.enemies = [];

    for (const cp of this.checkpoints) {
      this.scene.remove(cp.mesh);
    }
    this.checkpoints = [];
    this.objectiveBeacon.visible = false;
    this.world.setBarricadesVisible(false);
  }

  private spawnSubMissionActors(): void {
    if (!this.activeMissionId) return;
    const mission = MISSIONS.find((m) => m.id === this.activeMissionId);
    if (!mission) return;
    const sub = mission.subMissions[this.activeSubMissionIndex];
    if (!sub) return;

    if (sub.type === 'kill_drones') {
      const count = sub.targetCount;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 26 + (i % 2) * 14;
        const pos = new THREE.Vector3(
          this.playerPos.x + Math.cos(angle) * radius,
          7 + (i % 3) * 2.5,
          this.playerPos.z + Math.sin(angle) * radius,
        );
        const rig = buildDroneModel(false);
        rig.group.position.copy(pos);
        this.scene.add(rig.group);
        this.enemies.push({
          id: `drone_${i}`,
          kind: 'drone',
          group: rig.group,
          droneRig: rig,
          hp: this.activeSubMissionIndex === 0 ? 55 : 95,
          maxHp: this.activeSubMissionIndex === 0 ? 55 : 95,
          pos,
          vel: new THREE.Vector3(),
          fireCooldown: 1.5 + Math.random() * 1.5,
          orbitAngle: angle,
          orbitRadius: radius,
          baseAlt: pos.y,
        });
      }
    } else if (sub.type === 'kill_command_drone') {
      const pos = new THREE.Vector3(0, 14, -22);
      const rig = buildDroneModel(true);
      rig.group.position.copy(pos);
      this.scene.add(rig.group);
      this.enemies.push({
        id: 'command_drone',
        kind: 'command_drone',
        group: rig.group,
        droneRig: rig,
        hp: 340,
        maxHp: 340,
        pos,
        vel: new THREE.Vector3(),
        fireCooldown: 1.2,
        orbitAngle: 0,
        orbitRadius: 30,
        baseAlt: 14,
      });
    } else if (sub.type === 'enter_airplane') {
      this.objectiveBeacon.position.set(265, 35, -140);
      this.objectiveBeacon.visible = true;
    } else if (sub.type === 'reach_altitude') {
      this.objectiveBeacon.visible = false;
    } else if (sub.type === 'kill_enemy_jets') {
      for (let i = 0; i < sub.targetCount; i++) {
        const angle = (i / sub.targetCount) * Math.PI * 2;
        const pos = new THREE.Vector3(
          Math.cos(angle) * 145,
          72 + (i % 3) * 18,
          Math.sin(angle) * 145,
        );
        const jetGroup = buildEnemyJetModel(false);
        jetGroup.position.copy(pos);
        this.scene.add(jetGroup);
        this.enemies.push({
          id: `enemy_jet_${i}`,
          kind: 'enemy_jet',
          group: jetGroup,
          hp: 110,
          maxHp: 110,
          pos,
          vel: new THREE.Vector3(),
          fireCooldown: 2 + Math.random() * 2,
          orbitAngle: angle,
          orbitRadius: 135 + i * 12,
          baseAlt: pos.y,
        });
      }
    } else if (sub.type === 'kill_enforcers') {
      for (let i = 0; i < sub.targetCount; i++) {
        const angle = (i / sub.targetCount) * Math.PI * 2;
        const pos = new THREE.Vector3(
          this.playerPos.x + Math.cos(angle) * 32,
          0,
          this.playerPos.z + Math.sin(angle) * 32,
        );
        const rig = buildEnforcerModel(this.textures.contactShadow);
        rig.group.position.copy(pos);
        this.scene.add(rig.group);
        this.enemies.push({
          id: `enforcer_${i}`,
          kind: 'enforcer',
          group: rig.group,
          enforcerRig: rig,
          hp: 85,
          maxHp: 85,
          pos,
          vel: new THREE.Vector3(),
          fireCooldown: 1.4 + Math.random() * 1.4,
          orbitAngle: angle,
          orbitRadius: 20,
          baseAlt: 0,
        });
      }
      // Scatter citizens during City Chaos
      this.citizens.forEach((c) => {
        c.panicTimer = 15;
      });
    } else if (sub.type === 'hit_checkpoints') {
      const cpCoords: [number, number][] = [
        [35, -70],
        [-35, -105],
        [-105, 35],
      ];
      cpCoords.forEach(([cx, cz]) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(4.2, 0.4, 10, 28),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
        );
        ring.position.set(cx, 3.2, cz);
        this.scene.add(ring);
        this.checkpoints.push({
          mesh: ring,
          pos: new THREE.Vector3(cx, 0, cz),
          collected: false,
        });
      });
    } else if (sub.type === 'kill_gunship') {
      const pos = new THREE.Vector3(0, 32, -80);
      const gunship = buildEnemyJetModel(true);
      gunship.position.copy(pos);
      this.scene.add(gunship);
      this.enemies.push({
        id: 'rogue_gunship',
        kind: 'gunship',
        group: gunship,
        hp: 460,
        maxHp: 460,
        pos,
        vel: new THREE.Vector3(),
        fireCooldown: 1.0,
        orbitAngle: 0,
        orbitRadius: 65,
        baseAlt: 32,
      });
    }
  }

  private advanceSubMission(amount = 1): void {
    if (!this.activeMissionId) return;
    const mission = MISSIONS.find((m) => m.id === this.activeMissionId);
    if (!mission) return;
    const sub = mission.subMissions[this.activeSubMissionIndex];
    if (!sub) return;

    this.subMissionProgress += amount;
    if (this.subMissionProgress < sub.targetCount) return;

    // Sub-mission complete!
    this.activeSubMissionIndex++;
    this.subMissionProgress = 0;

    if (this.activeSubMissionIndex >= mission.subMissions.length) {
      // Whole mission complete!
      this.cash += mission.reward;
      this.score += mission.reward;
      if (!this.completedMissionIds.includes(mission.id)) {
        this.completedMissionIds.push(mission.id);
      }
      this.clearMissionActors();
      this.activeMissionId = null;
      this.wantedLevel = 0;
      gameAudio.playChime('complete');
      this.showBanner(`Mission Complete! +$${mission.reward.toLocaleString()} Earned`, 5.0);
    } else {
      const nextSub = mission.subMissions[this.activeSubMissionIndex];
      gameAudio.playChime('complete');
      this.showBanner(`Stage Cleared! Next: ${nextSub.title}`, 4.0);
      this.spawnSubMissionActors();
    }
  }

  private isKeyDown(code: string): boolean {
    return this.keys.has(code) || this.virtualKeys.has(code);
  }

  public toggleVehicle(): void {
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }

    let nearest: VehicleEntity | null = null;
    let bestDist = 7.5;
    for (const v of this.vehicles) {
      const dist = v.group.position.distanceTo(this.playerPos);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = v;
      }
    }

    if (!nearest) return;

    nearest.isTraffic = false;
    nearest.occupiedByPlayer = true;
    this.currentVehicle = nearest;
    this.playerRig.group.visible = false;
    this.camYaw = nearest.heading;
    gameAudio.playChime('vehicle');

    if (nearest.kind === 'airplane') {
      this.showBanner('Piloting Airplane — W: Throttle · A/D: Bank · Up/I: Pitch Up · Click: Fire', 4.5);
      // Check Mission 2 sub-mission 1
      if (this.activeMissionId === 'mission_2_dogfight' && this.activeSubMissionIndex === 0) {
        this.advanceSubMission(1);
      }
    } else {
      this.showBanner(`Driving ${nearest.label} — W/S: Drive · A/D: Steer · F: Exit`, 3.2);
    }

    this.emitHud();
  }

  private exitVehicle(): void {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    v.occupiedByPlayer = false;
    if (v.kind === 'car') {
      v.speed *= 0.2;
    }

    // Place player beside the vehicle on the ground (safe eject if plane is airborne)
    const sideOffset = new THREE.Vector3(Math.cos(v.heading) * 3.2, 0, -Math.sin(v.heading) * 3.2);
    this.playerPos.copy(v.group.position).add(sideOffset);
    if (this.playerPos.y > 4) {
      this.playerVel.y = -2;
      this.onGround = false;
    } else {
      this.playerPos.y = 0;
      this.onGround = true;
    }
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.visible = true;

    this.currentVehicle = null;
    gameAudio.updateVehicleEngine(false, null, 0);
    gameAudio.playChime('vehicle');
    this.emitHud();
  }

  private resolveBuildingCollision(pos: THREE.Vector3, radius: number, heightCheck = 10): void {
    const colliders: BuildingCollider[] = this.world.colliders;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (pos.y > b.height + 1 || heightCheck === 0) continue;

      const closestX = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          pos.x += (dx / dist) * push;
          pos.z += (dz / dist) * push;
        } else {
          pos.x = b.maxX + radius;
        }
      }
    }

    // Clamp to playable coastal + city bounds (unless flying high)
    if (pos.y < 10) {
      pos.x = THREE.MathUtils.clamp(pos.x, -230, 310);
      pos.z = THREE.MathUtils.clamp(pos.z, -230, 230);
    } else {
      pos.x = THREE.MathUtils.clamp(pos.x, -450, 550);
      pos.z = THREE.MathUtils.clamp(pos.z, -450, 450);
    }
  }

  private firePlayerWeapon(): void {
    const now = performance.now();

    if (this.currentVehicle?.kind === 'airplane') {
      if (now - this.lastFireTime < 130) return;
      this.lastFireTime = now;

      const plane = this.currentVehicle;
      _euler.set(plane.pitch, plane.heading, plane.roll, 'YXZ');
      _quat.setFromEuler(_euler);

      const forward = _v1.set(0, 0, 1).applyQuaternion(_quat).normalize();
      // Twin wingtip autocannons
      for (const wingSide of [-3.2, 3.2]) {
        const wingOffset = _v2.set(wingSide, 1.3, 1.5).applyQuaternion(_quat);
        const spawnPos = plane.group.position.clone().add(wingOffset);
        const mesh = new THREE.Mesh(
          this.bulletGeo,
          new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
        );
        mesh.scale.set(1.3, 1.3, 3.2);
        mesh.position.copy(spawnPos);
        this.scene.add(mesh);

        this.projectiles.push({
          mesh,
          pos: spawnPos,
          vel: forward.clone().multiplyScalar(230 + Math.max(0, plane.speed)),
          fromPlayer: true,
          damage: 45,
          explosive: false,
          life: 2.2,
        });
      }
      gameAudio.playShot('autocannon');
      return;
    }

    // On foot firing
    if (this.currentVehicle) return;
    const spec = WEAPONS[this.weaponId];
    if (now - this.lastFireTime < spec.fireRateMs) return;

    if (this.ammoInClip[this.weaponId] <= 0) {
      this.reloadWeapon();
      return;
    }

    this.lastFireTime = now;
    this.ammoInClip[this.weaponId]--;

    // Aim forward along camera yaw + subtle pitch toward crosshair
    const aimDir = new THREE.Vector3(
      -Math.sin(this.camYaw),
      Math.sin(-this.camPitch + 0.15) * 0.55,
      -Math.cos(this.camYaw),
    ).normalize();

    // Auto-assist slight vertical lock toward nearest airborne drone in front cone
    let bestTarget: EnemyEntity | null = null;
    let bestDot = 0.88;
    for (const en of this.enemies) {
      _v2.copy(en.pos).sub(this.playerPos);
      const dist = _v2.length();
      if (dist > 140) continue;
      _v2.normalize();
      const horizontalDot = _v2.x * aimDir.x + _v2.z * aimDir.z;
      if (horizontalDot > bestDot) {
        bestDot = horizontalDot;
        bestTarget = en;
      }
    }
    if (bestTarget) {
      aimDir.copy(bestTarget.pos).sub(_v3.set(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z)).normalize();
    }

    // Apply small weapon spread
    aimDir.x += (Math.random() - 0.5) * spec.spread;
    aimDir.y += (Math.random() - 0.5) * spec.spread;
    aimDir.z += (Math.random() - 0.5) * spec.spread;
    aimDir.normalize();

    // Turn player to face aim direction
    this.playerHeading = Math.atan2(aimDir.x, aimDir.z);

    const spawnPos = new THREE.Vector3(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z).addScaledVector(
      aimDir,
      0.9,
    );

    const isExplosive = this.weaponId === 'launcher';
    const mesh = new THREE.Mesh(
      isExplosive ? this.rocketGeo : this.bulletGeo,
      new THREE.MeshBasicMaterial({ color: spec.color }),
    );
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      pos: spawnPos,
      vel: aimDir.multiplyScalar(spec.projectileSpeed),
      fromPlayer: true,
      damage: spec.damage,
      explosive: isExplosive,
      life: 1.8,
    });

    gameAudio.playShot(this.weaponId);

    // Trigger nearby citizens to panic when firing
    for (const c of this.citizens) {
      if (c.pos.distanceToSquared(this.playerPos) < 1600) {
        c.panicTimer = 6.0;
      }
    }
  }

  private spawnExplosion(pos: THREE.Vector3, scale = 1): void {
    gameAudio.playExplosion(scale);
    const colors = [0xf97316, 0xfef08a, 0xef4444, 0x334155];
    const count = Math.floor(14 * scale);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.copy(pos);
      const s = (0.5 + Math.random() * 1.1) * scale;
      mesh.scale.setScalar(s);
      this.scene.add(mesh);

      this.explosions.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 24 * scale,
          (Math.random() * 16 + 4) * scale,
          (Math.random() - 0.5) * 24 * scale,
        ),
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1.0,
      });
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (!this.paused && !this.gameOver) {
        this.update(dt);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    // Banner countdown
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerMessage = null;
      }
    }

    // Camera keyboard yaw rotation (Q / E or ArrowLeft / ArrowRight when on foot)
    if (!this.currentVehicle) {
      if (this.isKeyDown('KeyQ') || this.isKeyDown('ArrowLeft')) this.camYaw += 2.1 * dt;
      if (this.isKeyDown('KeyE') || this.isKeyDown('ArrowRight')) this.camYaw -= 2.1 * dt;
    }

    if (this.firing) {
      this.firePlayerWeapon();
    }

    if (this.currentVehicle?.kind === 'car') {
      this.updateDrivenCar(dt, this.currentVehicle);
    } else if (this.currentVehicle?.kind === 'airplane') {
      this.updateFlownAirplane(dt, this.currentVehicle);
    } else {
      this.updatePlayerOnFoot(dt);
    }

    this.updateTraffic(dt);
    this.updateCitizens(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateExplosions(dt);
    this.updateCheckpoints(dt);
    this.updateCamera(dt);

    if (this.objectiveBeacon.visible) {
      this.objectiveBeacon.rotation.y += dt * 1.5;
    }

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private updatePlayerOnFoot(dt: number): void {
    let moveZ = 0;
    let moveX = 0;
    if (this.isKeyDown('KeyW')) moveZ -= 1;
    if (this.isKeyDown('KeyS')) moveZ += 1;
    if (this.isKeyDown('KeyA')) moveX -= 1;
    if (this.isKeyDown('KeyD')) moveX += 1;

    const sprinting = this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
    const maxSpeed = sprinting ? 13.5 : 7.8;

    if (moveX !== 0 || moveZ !== 0) {
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      // Camera looks along (-sin, -cos)
      const worldX = moveZ * sin + moveX * cos;
      const worldZ = moveZ * cos - moveX * sin;
      _v1.set(worldX, 0, worldZ).normalize();

      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _v1.x * maxSpeed, 14, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _v1.z * maxSpeed, 14, dt);

      if (!this.firing) {
        const targetHeading = Math.atan2(_v1.x, _v1.z);
        let diff = targetHeading - this.playerHeading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerHeading += diff * Math.min(1, 12 * dt);
      }

      this.playerWalkPhase += dt * (sprinting ? 14 : 9);
      const swing = Math.sin(this.playerWalkPhase) * 0.65;
      this.playerRig.leftLeg.rotation.x = swing;
      this.playerRig.rightLeg.rotation.x = -swing;
      this.playerRig.leftArm.rotation.x = -swing * 0.7;
      this.playerRig.rightArm.rotation.x = this.firing ? -1.45 : swing * 0.6;
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 12, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 12, dt);
      this.playerRig.leftLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.leftLeg.rotation.x, 0, 10, dt);
      this.playerRig.rightLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.rightLeg.rotation.x, 0, 10, dt);
      this.playerRig.leftArm.rotation.x = THREE.MathUtils.damp(this.playerRig.leftArm.rotation.x, 0, 10, dt);
      this.playerRig.rightArm.rotation.x = THREE.MathUtils.damp(
        this.playerRig.rightArm.rotation.x,
        this.firing ? -1.45 : 0,
        12,
        dt,
      );
    }

    if (this.isKeyDown('Space') && this.onGround) {
      this.playerVel.y = 8.4;
      this.onGround = false;
    }

    this.playerVel.y -= 22 * dt;
    this.playerPos.addScaledVector(this.playerVel, dt);
    if (this.playerPos.y <= 0) {
      this.playerPos.y = 0;
      this.playerVel.y = 0;
      this.onGround = true;
    }

    this.resolveBuildingCollision(this.playerPos, 0.75);
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerHeading;
    gameAudio.updateVehicleEngine(false, null, 0);
  }

  private updateDrivenCar(dt: number, car: VehicleEntity): void {
    const accelInput = (this.isKeyDown('KeyW') ? 1 : 0) - (this.isKeyDown('KeyS') ? 1 : 0);
    const steerInput = (this.isKeyDown('KeyA') ? 1 : 0) - (this.isKeyDown('KeyD') ? 1 : 0);
    const handbrake = this.isKeyDown('Space');

    if (accelInput > 0) {
      car.speed = THREE.MathUtils.damp(car.speed, 46, 1.9, dt);
    } else if (accelInput < 0) {
      car.speed = THREE.MathUtils.damp(car.speed, -18, 2.8, dt);
    } else {
      car.speed = THREE.MathUtils.damp(car.speed, 0, handbrake ? 6.5 : 1.5, dt);
    }

    if (handbrake) {
      car.speed = THREE.MathUtils.damp(car.speed, 0, 5.5, dt);
    }

    const steerFactor = Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= -0.5 ? 1 : -1);
    car.heading += steerInput * 2.25 * steerFactor * dt;

    const fwdX = Math.sin(car.heading);
    const fwdZ = Math.cos(car.heading);
    car.group.position.x += fwdX * car.speed * dt;
    car.group.position.z += fwdZ * car.speed * dt;

    const prevX = car.group.position.x;
    const prevZ = car.group.position.z;
    this.resolveBuildingCollision(car.group.position, 2.1);
    if (
      Math.abs(car.group.position.x - prevX) > 0.05 ||
      Math.abs(car.group.position.z - prevZ) > 0.05
    ) {
      car.speed *= 0.45;
    }

    car.group.rotation.y = car.heading;
    this.playerPos.copy(car.group.position);
    this.playerHeading = car.heading;

    // Spin wheels & steer front wheels
    if (car.carRig) {
      car.carRig.wheels.forEach((w, idx) => {
        w.rotation.x += car.speed * dt * 1.4;
        if (idx < 2) {
          w.rotation.y = THREE.MathUtils.damp(w.rotation.y, steerInput * 0.42, 12, dt);
        }
      });
    }

    // Ram enemies
    if (Math.abs(car.speed) > 12) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const en = this.enemies[i];
        if (en.pos.y < 3 && en.pos.distanceTo(car.group.position) < 3.4) {
          this.damageEnemy(i, 120);
        }
      }
    }

    gameAudio.updateVehicleEngine(true, 'car', Math.abs(car.speed) / 45);
  }

  private updateFlownAirplane(dt: number, plane: VehicleEntity): void {
    // Throttle: W increases, S decreases
    if (this.isKeyDown('KeyW')) {
      plane.throttle = THREE.MathUtils.clamp(plane.throttle + 0.55 * dt, 0, 1);
    } else if (this.isKeyDown('KeyS')) {
      plane.throttle = THREE.MathUtils.clamp(plane.throttle - 0.6 * dt, 0, 1);
    }

    // Target speed from throttle (0 to 92 m/s ~ 330 km/h)
    const targetSpeed = plane.throttle * 92;
    plane.speed = THREE.MathUtils.damp(plane.speed, targetSpeed, 1.4, dt);

    // Banking & Turning (A/D)
    const bankInput = (this.isKeyDown('KeyA') ? 1 : 0) - (this.isKeyDown('KeyD') ? 1 : 0);
    // Pitch Up/Down: ArrowUp / I = nose up, ArrowDown / K = nose down
    let pitchInput =
      (this.isKeyDown('ArrowUp') || this.isKeyDown('KeyI') ? 1 : 0) -
      (this.isKeyDown('ArrowDown') || this.isKeyDown('KeyK') ? 1 : 0);

    // Gentle liftoff assist if player holds W at high throttle on the runway!
    const airborne = plane.group.position.y > 0.35;
    if (!airborne && plane.speed > 44 && this.isKeyDown('KeyW') && pitchInput === 0) {
      pitchInput = 0.45;
    }

    if (airborne || plane.speed > 28) {
      const targetPitchRate = pitchInput * 1.15;
      plane.pitch = THREE.MathUtils.clamp(plane.pitch - targetPitchRate * dt, -0.78, 0.78);
    } else {
      plane.pitch = THREE.MathUtils.damp(plane.pitch, 0, 6, dt);
    }

    // Smooth coordinated roll + yaw
    const targetRoll = airborne ? -bankInput * 0.75 : 0;
    plane.roll = THREE.MathUtils.damp(plane.roll, targetRoll, 4.5, dt);
    const turnRate = airborne ? bankInput * 1.45 : bankInput * 1.1 * Math.min(1, plane.speed / 12);
    plane.heading += turnRate * dt;

    // Gentle auto-level pitch when no pitch key pressed
    if (pitchInput === 0 && airborne) {
      plane.pitch = THREE.MathUtils.damp(plane.pitch, 0, 0.7, dt);
    }

    // Apply 3D flight velocity
    _euler.set(plane.pitch, plane.heading, plane.roll, 'YXZ');
    _quat.setFromEuler(_euler);
    _v1.set(0, 0, 1).applyQuaternion(_quat).normalize();

    // Lift & Gravity balance
    const liftFactor = THREE.MathUtils.clamp(plane.speed / 34, 0, 1.15);
    const verticalLift = (liftFactor - 0.85) * 14;

    plane.group.position.addScaledVector(_v1, plane.speed * dt);
    if (airborne || verticalLift > 0) {
      plane.group.position.y += verticalLift * dt;
    }

    // Ground & altitude limits
    if (plane.group.position.y <= 0) {
      plane.group.position.y = 0;
      if (plane.pitch > 0.05) plane.pitch = 0;
      plane.roll = THREE.MathUtils.damp(plane.roll, 0, 10, dt);
    }
    plane.group.position.y = Math.min(plane.group.position.y, 260);
    plane.group.position.x = THREE.MathUtils.clamp(plane.group.position.x, -440, 520);
    plane.group.position.z = THREE.MathUtils.clamp(plane.group.position.z, -440, 440);

    // Avoid skyscrapers if flying low
    if (plane.group.position.y < 45) {
      this.resolveBuildingCollision(plane.group.position, 4.2, 10);
    }

    plane.group.quaternion.copy(_quat);
    this.playerPos.copy(plane.group.position);
    this.playerHeading = plane.heading;

    // Animate propeller & afterburner glow
    if (plane.planeRig) {
      plane.planeRig.propeller.rotation.z += (8 + plane.speed * 0.9) * dt;
      const burnerScale = 0.6 + plane.throttle * 1.2;
      plane.planeRig.afterburner.scale.set(1, burnerScale, 1);
    }

    // Check Mission 2 Sub-Mission 2 (climb above 45m)
    if (
      this.activeMissionId === 'mission_2_dogfight' &&
      this.activeSubMissionIndex === 1 &&
      plane.group.position.y >= 45
    ) {
      this.advanceSubMission(1);
    }

    gameAudio.updateVehicleEngine(true, 'airplane', plane.throttle + plane.speed / 120);
  }

  private updateTraffic(dt: number): void {
    for (const v of this.vehicles) {
      if (!v.isTraffic) continue;

      v.group.position.addScaledVector(v.trafficDir, v.speed * dt);
      if (v.carRig) {
        v.carRig.wheels.forEach((w) => {
          w.rotation.x += v.speed * dt * 1.2;
        });
      }

      // Wrap around city perimeter cleanly
      if (v.group.position.x > 205) v.group.position.x = -205;
      if (v.group.position.x < -205) v.group.position.x = 205;
      if (v.group.position.z > 205) v.group.position.z = -205;
      if (v.group.position.z < -205) v.group.position.z = 205;
    }
  }

  private updateCitizens(dt: number): void {
    for (const c of this.citizens) {
      let speed = c.baseSpeed;
      if (c.panicTimer > 0) {
        c.panicTimer -= dt;
        speed = 6.2;
        // Run away from player/gunfire
        _v1.copy(c.pos).sub(this.playerPos);
        _v1.y = 0;
        if (_v1.lengthSq() > 0.1) {
          c.dir.copy(_v1.normalize());
        }
      }

      c.pos.addScaledVector(c.dir, speed * dt);

      // Reverse direction at city edge or Mission 3 barricades
      const limit = this.activeMissionId === 'mission_3_chaos' ? 185 : 200;
      if (Math.abs(c.pos.x) > limit) {
        c.pos.x = THREE.MathUtils.clamp(c.pos.x, -limit, limit);
        c.dir.x *= -1;
      }
      if (Math.abs(c.pos.z) > limit) {
        c.pos.z = THREE.MathUtils.clamp(c.pos.z, -limit, limit);
        c.dir.z *= -1;
      }

      this.resolveBuildingCollision(c.pos, 0.6);
      c.rig.group.position.copy(c.pos);
      c.rig.group.rotation.y = Math.atan2(c.dir.x, c.dir.z);

      c.walkPhase += dt * speed * 3.4;
      const swing = Math.sin(c.walkPhase) * 0.55;
      c.rig.leftLeg.rotation.x = swing;
      c.rig.rightLeg.rotation.x = -swing;
      c.rig.leftArm.rotation.x = -swing;
      c.rig.rightArm.rotation.x = swing;
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      en.orbitAngle += dt * (en.kind === 'enemy_jet' ? 0.52 : 0.75);

      if (en.kind === 'drone' || en.kind === 'command_drone') {
        const tx = Math.cos(en.orbitAngle) * en.orbitRadius;
        const tz = Math.sin(en.orbitAngle) * en.orbitRadius;
        const ty = en.baseAlt + Math.sin(en.orbitAngle * 3) * 1.8;
        en.pos.x = THREE.MathUtils.damp(en.pos.x, this.playerPos.x * 0.35 + tx, 2.5, dt);
        en.pos.z = THREE.MathUtils.damp(en.pos.z, this.playerPos.z * 0.35 + tz, 2.5, dt);
        en.pos.y = THREE.MathUtils.damp(en.pos.y, ty, 3, dt);
        en.group.position.copy(en.pos);
        en.group.lookAt(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z);

        if (en.droneRig) {
          en.droneRig.rotors.forEach((r) => {
            r.rotation.y += dt * 28;
          });
        }
      } else if (en.kind === 'enemy_jet' || en.kind === 'gunship') {
        const centerX = en.kind === 'gunship' ? 0 : this.playerPos.x * 0.4;
        const centerZ = en.kind === 'gunship' ? 0 : this.playerPos.z * 0.4;
        const nextX = centerX + Math.cos(en.orbitAngle) * en.orbitRadius;
        const nextZ = centerZ + Math.sin(en.orbitAngle) * en.orbitRadius;
        const nextY = en.baseAlt + Math.sin(en.orbitAngle * 2) * 8;

        _v1.set(nextX, nextY, nextZ);
        en.group.lookAt(_v1);
        en.pos.copy(_v1);
        en.group.position.copy(en.pos);
      } else if (en.kind === 'enforcer') {
        _v1.copy(this.playerPos).sub(en.pos);
        _v1.y = 0;
        const dist = _v1.length();
        if (dist > 14) {
          _v1.normalize();
          en.pos.addScaledVector(_v1, 5.2 * dt);
          this.resolveBuildingCollision(en.pos, 0.7);
        }
        en.group.position.copy(en.pos);
        en.group.lookAt(this.playerPos.x, 0, this.playerPos.z);
        if (en.enforcerRig) {
          const swing = Math.sin(performance.now() * 0.008) * 0.45;
          en.enforcerRig.leftLeg.rotation.x = swing;
          en.enforcerRig.rightLeg.rotation.x = -swing;
        }
      }

      // Enemy firing
      en.fireCooldown -= dt;
      const fireRange = en.kind === 'enemy_jet' || en.kind === 'gunship' ? 220 : 85;
      if (en.fireCooldown <= 0 && en.pos.distanceTo(this.playerPos) < fireRange) {
        en.fireCooldown = en.kind === 'command_drone' || en.kind === 'gunship' ? 1.1 : 2.1;
        const dir = _v1
          .copy(this.playerPos)
          .add(_v2.set(0, 1.2, 0))
          .sub(en.pos)
          .normalize();
        const bolt = new THREE.Mesh(
          this.bulletGeo,
          new THREE.MeshBasicMaterial({ color: 0xef4444 }),
        );
        bolt.position.copy(en.pos);
        this.scene.add(bolt);
        this.projectiles.push({
          mesh: bolt,
          pos: en.pos.clone(),
          vel: dir.multiplyScalar(en.kind === 'enemy_jet' ? 95 : 58),
          fromPlayer: false,
          damage: en.kind === 'gunship' ? 12 : 7,
          explosive: false,
          life: 2.5,
        });
      }
    }
  }

  private damageEnemy(index: number, dmg: number): void {
    const en = this.enemies[index];
    if (!en) return;
    en.hp -= dmg;
    gameAudio.playHit();

    if (en.hp <= 0) {
      const scale = en.kind === 'command_drone' || en.kind === 'gunship' ? 2.2 : 1.1;
      this.spawnExplosion(en.pos, scale);
      this.scene.remove(en.group);
      this.enemies.splice(index, 1);

      this.score += 250;
      this.cash += 120;
      this.advanceSubMission(1);
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      let hit = p.life <= 0 || p.pos.y < 0;

      if (!hit && p.fromPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const en = this.enemies[j];
          const hitRadius =
            en.kind === 'enemy_jet' || en.kind === 'gunship'
              ? 6.2
              : en.kind === 'command_drone'
                ? 3.8
                : 2.4;
          if (p.pos.distanceTo(en.pos) < hitRadius) {
            if (p.explosive) {
              this.spawnExplosion(p.pos, 1.6);
            }
            this.damageEnemy(j, p.damage);
            hit = true;
            break;
          }
        }
      } else if (!hit && !p.fromPlayer) {
        const playerCenter = _v1.set(this.playerPos.x, this.playerPos.y + 1.2, this.playerPos.z);
        const hitRadius = this.currentVehicle ? 3.5 : 1.35;
        if (p.pos.distanceTo(playerCenter) < hitRadius) {
          this.applyPlayerDamage(p.damage);
          hit = true;
        }
      }

      if (hit) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private applyPlayerDamage(dmg: number): void {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.65);
      this.armor -= absorbed;
      this.health -= dmg - absorbed;
    } else {
      this.health -= dmg;
    }

    if (this.health <= 0) {
      this.health = 0;
      this.gameOver = true;
      this.spawnExplosion(this.playerPos, 1.5);
      this.emitHud();
    }
  }

  private updateExplosions(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      ex.vel.y -= 18 * dt;
      ex.mesh.position.addScaledVector(ex.vel, dt);
      ex.mesh.rotation.x += dt * 4;
      ex.mesh.rotation.y += dt * 5;
      ex.mesh.scale.multiplyScalar(Math.max(0.1, 1 - dt * 1.4));

      if (ex.life <= 0) {
        this.scene.remove(ex.mesh);
        (ex.mesh.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      }
    }
  }

  private updateCheckpoints(dt: number): void {
    for (const cp of this.checkpoints) {
      if (cp.collected) continue;
      cp.mesh.rotation.y += dt * 2.2;
      if (cp.pos.distanceTo(new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z)) < 6.5) {
        cp.collected = true;
        cp.mesh.visible = false;
        gameAudio.playChime('complete');
        this.advanceSubMission(1);
      }
    }
  }

  private updateCamera(dt: number): void {
    if (this.currentVehicle?.kind === 'airplane') {
      const plane = this.currentVehicle;
      const targetFov = 65 + Math.min(20, plane.speed * 0.22);
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4, dt);
        this.camera.updateProjectionMatrix();
      }

      if (this.cameraMode === 'first') {
        _euler.set(plane.pitch, plane.heading, plane.roll, 'YXZ');
        _quat.setFromEuler(_euler);
        _v1.set(0, 2.25, 1.2).applyQuaternion(_quat).add(plane.group.position);
        _v2.set(0, 2.1, 32).applyQuaternion(_quat).add(plane.group.position);
        this.camera.position.copy(_v1);
        this.camera.lookAt(_v2);
      } else {
        _euler.set(plane.pitch * 0.5, plane.heading, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _v1.set(0, 5.2, -16.5).applyQuaternion(_quat).add(plane.group.position);
        _v1.y = Math.max(1.5, _v1.y);
        _v2.set(0, 2.0, 14).applyQuaternion(_quat).add(plane.group.position);

        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _v1.x, 8, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _v1.y, 8, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _v1.z, 8, dt);
        this.camera.lookAt(_v2);
      }
      return;
    }

    if (this.currentVehicle?.kind === 'car') {
      const car = this.currentVehicle;
      const targetFov = 64 + Math.min(16, Math.abs(car.speed) * 0.35);
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
        this.camera.updateProjectionMatrix();
      }

      // Gently align camera behind car while driving
      let yawDiff = car.heading + Math.PI - this.camYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      if (!this.isDraggingLook) {
        this.camYaw += yawDiff * Math.min(1, 2.8 * dt);
      }

      if (this.cameraMode === 'first') {
        _v1.set(
          car.group.position.x + Math.sin(car.heading) * 0.25,
          car.group.position.y + 1.35,
          car.group.position.z + Math.cos(car.heading) * 0.25,
        );
        _v2.set(
          car.group.position.x + Math.sin(car.heading) * 20,
          car.group.position.y + 1.2,
          car.group.position.z + Math.cos(car.heading) * 20,
        );
        this.camera.position.copy(_v1);
        this.camera.lookAt(_v2);
      } else {
        const dist = 9.5;
        _camTargetPos.set(
          car.group.position.x + Math.sin(this.camYaw) * dist,
          car.group.position.y + 3.8 + Math.sin(this.camPitch) * 3.0,
          car.group.position.z + Math.cos(this.camYaw) * dist,
        );
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 9, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 9, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 9, dt);
        _camLookTarget.set(car.group.position.x, car.group.position.y + 1.4, car.group.position.z);
        this.camera.lookAt(_camLookTarget);
      }
      return;
    }

    // On foot camera
    if (Math.abs(this.camera.fov - 64) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 64, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.cameraMode === 'first') {
      this.playerRig.group.visible = false;
      this.camera.position.set(this.playerPos.x, this.playerPos.y + 1.72, this.playerPos.z);
      _camLookTarget.set(
        this.playerPos.x - Math.sin(this.camYaw) * 20,
        this.playerPos.y + 1.72 - Math.sin(this.camPitch) * 14,
        this.playerPos.z - Math.cos(this.camYaw) * 20,
      );
      this.camera.lookAt(_camLookTarget);
    } else {
      this.playerRig.group.visible = true;
      const dist = 6.2;
      _camTargetPos.set(
        this.playerPos.x + Math.sin(this.camYaw) * dist * Math.cos(this.camPitch),
        Math.max(0.8, this.playerPos.y + 2.2 + Math.sin(this.camPitch) * dist),
        this.playerPos.z + Math.cos(this.camYaw) * dist * Math.cos(this.camPitch),
      );
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 12, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 12, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 12, dt);

      _camLookTarget.set(this.playerPos.x, this.playerPos.y + 1.5, this.playerPos.z);
      this.camera.lookAt(_camLookTarget);
    }
  }

  private emitHud(): void {
    // Nearby vehicle check
    let nearbyVehicleKind: VehicleKind | null = null;
    let nearbyVehicleLabel = '';
    if (!this.currentVehicle) {
      let bestDist = 7.5;
      for (const v of this.vehicles) {
        const d = v.group.position.distanceTo(this.playerPos);
        if (d < bestDist) {
          bestDist = d;
          nearbyVehicleKind = v.kind;
          nearbyVehicleLabel = v.label;
        }
      }
    }

    // Active mission objective text
    let objectiveLabel = 'Free Roam · Open Mission Terminal (M) to purchase contracts';
    let subMissionTarget = 1;
    if (this.activeMissionId) {
      const m = MISSIONS.find((x) => x.id === this.activeMissionId);
      const sub = m?.subMissions[this.activeSubMissionIndex];
      if (sub) {
        objectiveLabel = `${sub.title}: ${sub.objectiveText}`;
        subMissionTarget = sub.targetCount;
      }
    }

    // Minimap entities
    const minimapEntities: MinimapEntity[] = [];
    for (const v of this.vehicles) {
      if (v.occupiedByPlayer) continue;
      minimapEntities.push({ x: v.group.position.x, z: v.group.position.z, kind: v.kind });
    }
    for (const c of this.citizens) {
      minimapEntities.push({ x: c.pos.x, z: c.pos.z, kind: 'citizen' });
    }
    for (const en of this.enemies) {
      minimapEntities.push({ x: en.pos.x, z: en.pos.z, kind: 'enemy' });
    }
    for (const cp of this.checkpoints) {
      if (!cp.collected) {
        minimapEntities.push({ x: cp.pos.x, z: cp.pos.z, kind: 'checkpoint' });
      }
    }
    if (this.objectiveBeacon.visible) {
      minimapEntities.push({
        x: this.objectiveBeacon.position.x,
        z: this.objectiveBeacon.position.z,
        kind: 'objective',
      });
    }

    const speedKmh = this.currentVehicle
      ? Math.round(Math.abs(this.currentVehicle.speed) * 3.6)
      : Math.round(Math.hypot(this.playerVel.x, this.playerVel.z) * 3.6);

    this.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      cash: this.cash,
      score: this.score,
      weaponId: this.weaponId,
      ammoInClip: { ...this.ammoInClip },
      reserveAmmo: { ...this.reserveAmmo },
      unlockedWeapons: [...this.unlockedWeapons],
      inVehicle: this.currentVehicle?.kind ?? null,
      vehicleLabel: this.currentVehicle?.label ?? '',
      speedKmh,
      altitudeM: Math.max(0, Math.round(this.playerPos.y)),
      throttlePct: this.currentVehicle?.kind === 'airplane' ? Math.round(this.currentVehicle.throttle * 100) : 0,
      cameraMode: this.cameraMode,
      nearbyVehicleKind,
      nearbyVehicleLabel,
      activeMissionId: this.activeMissionId,
      activeSubMissionIndex: this.activeSubMissionIndex,
      subMissionProgress: this.subMissionProgress,
      subMissionTarget,
      objectiveLabel,
      completedMissionIds: [...this.completedMissionIds],
      purchasedMissionIds: [...this.purchasedMissionIds],
      playerX: this.playerPos.x,
      playerY: this.playerPos.y,
      playerZ: this.playerPos.z,
      playerHeading: this.currentVehicle ? this.currentVehicle.heading : this.camYaw + Math.PI,
      minimapEntities,
      bannerMessage: this.bannerMessage,
      wantedLevel: this.wantedLevel,
      gameOver: this.gameOver,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('contextmenu', this.preventContext);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    gameAudio.dispose();
    this.textures.dispose();
    this.bulletGeo.dispose();
    this.rocketGeo.dispose();
    this.particleGeo.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
