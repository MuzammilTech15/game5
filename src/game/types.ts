export type WeaponId = 'pistol' | 'rifle' | 'launcher';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  key: string;
  damage: number;
  fireRateMs: number;
  maxAmmo: number;
  clipSize: number;
  projectileSpeed: number;
  spread: number;
  color: number;
  unlockCost: number;
  description: string;
}

export type VehicleKind = 'car' | 'airplane';

export type CameraPerspective = 'third' | 'first';

export interface SubMission {
  id: string;
  title: string;
  objectiveText: string;
  targetCount: number;
  type:
    | 'kill_drones'
    | 'kill_command_drone'
    | 'enter_airplane'
    | 'reach_altitude'
    | 'kill_enemy_jets'
    | 'kill_enforcers'
    | 'hit_checkpoints'
    | 'kill_gunship';
}

export interface MissionDef {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  cost: number;
  reward: number;
  description: string;
  subMissions: SubMission[];
}

export interface MinimapEntity {
  x: number;
  z: number;
  kind: 'car' | 'airplane' | 'citizen' | 'enemy' | 'objective' | 'checkpoint';
  heading?: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  armor: number;
  cash: number;
  score: number;
  weaponId: WeaponId;
  ammoInClip: Record<WeaponId, number>;
  reserveAmmo: Record<WeaponId, number>;
  unlockedWeapons: WeaponId[];
  inVehicle: VehicleKind | null;
  vehicleLabel: string;
  speedKmh: number;
  altitudeM: number;
  throttlePct: number;
  cameraMode: CameraPerspective;
  nearbyVehicleKind: VehicleKind | null;
  nearbyVehicleLabel: string;
  activeMissionId: string | null;
  activeSubMissionIndex: number;
  subMissionProgress: number;
  subMissionTarget: number;
  objectiveLabel: string;
  completedMissionIds: string[];
  purchasedMissionIds: string[];
  playerX: number;
  playerY: number;
  playerZ: number;
  playerHeading: number;
  minimapEntities: MinimapEntity[];
  bannerMessage: string | null;
  wantedLevel: number;
  gameOver: boolean;
}

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}
