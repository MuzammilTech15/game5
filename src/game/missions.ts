import { MissionDef, WeaponId, WeaponSpec } from './types';

export const STARTING_CASH = 2000;

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    id: 'pistol',
    name: 'Tactical 9mm',
    key: '1',
    damage: 34,
    fireRateMs: 260,
    maxAmmo: 180,
    clipSize: 15,
    projectileSpeed: 135,
    spread: 0.012,
    color: 0xfbbf24,
    unlockCost: 0,
    description: 'Precision semi-auto sidearm for close-range encounters.',
  },
  rifle: {
    id: 'rifle',
    name: 'M4 Carbine',
    key: '2',
    damage: 28,
    fireRateMs: 110,
    maxAmmo: 360,
    clipSize: 30,
    projectileSpeed: 165,
    spread: 0.024,
    color: 0x38bdf8,
    unlockCost: 0,
    description: 'High-velocity automatic rifle suited for anti-drone combat.',
  },
  launcher: {
    id: 'launcher',
    name: 'Apex Rail-Launcher',
    key: '3',
    damage: 135,
    fireRateMs: 680,
    maxAmmo: 40,
    clipSize: 4,
    projectileSpeed: 98,
    spread: 0.004,
    color: 0xf97316,
    unlockCost: 450,
    description: 'Explosive ordinance launcher capable of destroying armored aircraft.',
  },
};

export const MISSIONS: MissionDef[] = [
  {
    id: 'mission_1_drones',
    number: 1,
    title: 'Anti-Drone Combat',
    subtitle: 'Downtown Airspace Security',
    cost: 500,
    reward: 1500,
    description:
      'Rogue autonomous drones have seized the downtown skyline. Deploy on foot with firearms to clear all three escalation waves.',
    subMissions: [
      {
        id: 'm1_s1',
        title: '1.1 Recon Sweep',
        objectiveText: 'Shoot down 4 Scout Drones hovering over Downtown Plaza',
        targetCount: 4,
        type: 'kill_drones',
      },
      {
        id: 'm1_s2',
        title: '1.2 Hunter Interception',
        objectiveText: 'Eliminate 5 Armored Hunter Drones using Rifle or Launcher (Keys 1-3)',
        targetCount: 5,
        type: 'kill_drones',
      },
      {
        id: 'm1_s3',
        title: '1.3 Command Core',
        objectiveText: 'Destroy the Command Mother-Drone before it escapes',
        targetCount: 1,
        type: 'kill_command_drone',
      },
    ],
  },
  {
    id: 'mission_2_dogfight',
    number: 2,
    title: 'Aerial Dogfight',
    subtitle: 'Coastal Airstrip Scramble',
    cost: 1000,
    reward: 2500,
    description:
      'Hostile fighter squadrons are entering city airspace. Sprint or drive to the Coastal Airstrip, pilot an airplane, and dominate the sky.',
    subMissions: [
      {
        id: 'm2_s1',
        title: '2.1 Scramble to Runway',
        objectiveText: 'Reach the Coastal Airstrip and board an Airplane (Press F)',
        targetCount: 1,
        type: 'enter_airplane',
      },
      {
        id: 'm2_s2',
        title: '2.2 Liftoff & Climb',
        objectiveText: 'Throttle up (W) and pitch up (Up Arrow / I) to climb above 45m altitude',
        targetCount: 1,
        type: 'reach_altitude',
      },
      {
        id: 'm2_s3',
        title: '2.3 Sky Superiority',
        objectiveText: 'Shoot down 5 Enemy Interceptor Aircraft with Wing Autocannons (Click / J)',
        targetCount: 5,
        type: 'kill_enemy_jets',
      },
    ],
  },
  {
    id: 'mission_3_chaos',
    number: 3,
    title: 'City Chaos',
    subtitle: 'High-Stakes Escapades',
    cost: 1500,
    reward: 5000,
    description:
      'Citywide lockdown initiated. Escape routes are barricaded while citizens panic. Break through roadblocks and neutralize the Rogue Gunship.',
    subMissions: [
      {
        id: 'm3_s1',
        title: '3.1 Lockdown Ambush',
        objectiveText: 'Survive the barricade perimeter and eliminate 6 Syndicate Enforcers',
        targetCount: 6,
        type: 'kill_enforcers',
      },
      {
        id: 'm3_s2',
        title: '3.2 Street Breakout',
        objectiveText: 'Drive a car through 3 Lockdown Checkpoints across the avenues',
        targetCount: 3,
        type: 'hit_checkpoints',
      },
      {
        id: 'm3_s3',
        title: '3.3 Endgame Gunship',
        objectiveText: 'Destroy the Rogue Gunship patrolling Downtown',
        targetCount: 1,
        type: 'kill_gunship',
      },
    ],
  },
];
