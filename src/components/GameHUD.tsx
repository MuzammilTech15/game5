import { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Gamepad2,
  Plane,
  Car,
  ShoppingBag,
  Volume2,
  VolumeX,
  RotateCcw,
} from 'lucide-react';
import { WEAPONS } from '../game/missions';
import { HudSnapshot, WeaponId } from '../game/types';
import { Minimap } from './Minimap';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onOpenMissions: () => void;
  onToggleCamera: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onToggleVehicle: () => void;
  onRespawn: () => void;
  onVirtualKey: (code: string, active: boolean) => void;
  onFire: (active: boolean) => void;
}

export function GameHUD({
  hud,
  muted,
  onToggleMute,
  onOpenMissions,
  onToggleCamera,
  onSelectWeapon,
  onToggleVehicle,
  onRespawn,
  onVirtualKey,
  onFire,
}: GameHUDProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(false);

  const currentWeapon = WEAPONS[hud.weaponId];
  const clip = hud.ammoInClip[hud.weaponId];
  const reserve = hud.reserveAmmo[hud.weaponId];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Subtle center crosshair when on foot or flying */}
      {(!hud.inVehicle || hud.inVehicle === 'airplane') && !hud.gameOver && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-65">
          <div className="w-4 h-4 border border-cyan-300/80 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-cyan-300 rounded-full" />
          </div>
        </div>
      )}

      {/* Top Row: Left Minimap | Center Objective | Right Health & Weapon */}
      <div className="flex items-start justify-between gap-4 p-4">
        {/* Top-Left: Minimap + Cash */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <Minimap
            playerX={hud.playerX}
            playerZ={hud.playerZ}
            playerHeading={hud.playerHeading}
            entities={hud.minimapEntities}
          />
          <div className="hud-panel rounded-lg px-3 py-1.5 flex items-center justify-between gap-3">
            <span className="font-mono-tabular text-sm font-bold text-emerald-400">
              ${hud.cash.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400 font-mono-tabular">
              PTS {hud.score.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Top-Center: Mission Objective Tracker + Entry Banner */}
        <div className="hidden md:flex flex-col items-center gap-2 max-w-xl">
          <div className="hud-panel rounded-lg px-4 py-2 text-center shadow-lg">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-cyan-300">
              <span>{hud.activeMissionId ? 'Active Objective' : 'Open World'}</span>
              {hud.activeMissionId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-amber-300">
                    {hud.subMissionProgress} / {hud.subMissionTarget}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-100 font-medium mt-0.5">{hud.objectiveLabel}</p>
          </div>

          {hud.bannerMessage && (
            <div className="rounded-lg bg-cyan-500/95 text-slate-950 px-5 py-2 font-display font-bold text-sm tracking-wide shadow-xl">
              {hud.bannerMessage}
            </div>
          )}
        </div>

        {/* Top-Right: Health, Armor, Weapon & Quick Actions */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="hud-panel rounded-lg p-3 w-56 shadow-lg">
            {/* Health */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Health</span>
              <span className="font-mono-tabular text-slate-100 font-bold">{hud.health}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.health))}%` }}
              />
            </div>

            {/* Armor */}
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Armor</span>
              <span className="font-mono-tabular text-sky-300 font-bold">{hud.armor}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mb-2.5">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.armor))}%` }}
              />
            </div>

            {/* Weapon / Ammo Counter */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-slate-100">
                  {hud.inVehicle === 'airplane' ? 'Wing Autocannon' : currentWeapon.name}
                </span>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-amber-300">
                {hud.inVehicle === 'airplane' ? 'INF' : `${clip} / ${reserve}`}
              </span>
            </div>

            {/* Weapon quick-switch buttons */}
            {!hud.inVehicle && (
              <div className="grid grid-cols-3 gap-1 mt-2">
                {(['pistol', 'rifle', 'launcher'] as WeaponId[]).map((wId) => {
                  const unlocked = hud.unlockedWeapons.includes(wId);
                  const active = hud.weaponId === wId;
                  return (
                    <button
                      key={wId}
                      onClick={() => (unlocked ? onSelectWeapon(wId) : onOpenMissions())}
                      className={`py-1 px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-cyan-500 text-slate-950'
                          : unlocked
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-900 text-slate-500 border border-white/5'
                      }`}
                    >
                      {WEAPONS[wId].key}·{wId === 'pistol' ? '9mm' : wId === 'rifle' ? 'M4' : 'Rail'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenMissions}
              className="hud-panel hover:bg-slate-800 px-3 py-2 rounded-lg text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Missions (M)
            </button>
            <button
              onClick={onToggleCamera}
              title="Toggle 1st/3rd Person Camera (V)"
              className="hud-panel hover:bg-slate-800 p-2 rounded-lg text-slate-200 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTouchPad((s) => !s)}
              title="Toggle On-Screen Touch Controls"
              className={`hud-panel hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer ${
                showTouchPad ? 'text-cyan-300' : 'text-slate-200'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMute}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="hud-panel hover:bg-slate-800 p-2 rounded-lg text-slate-200 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Nearby Vehicle Enter Prompt */}
      {hud.nearbyVehicleKind && !hud.inVehicle && !hud.gameOver && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onToggleVehicle}
            className="hud-panel hover:bg-slate-800 px-4 py-2 rounded-lg text-xs font-semibold text-cyan-300 inline-flex items-center gap-2 shadow-lg cursor-pointer whitespace-nowrap"
          >
            {hud.nearbyVehicleKind === 'airplane' ? (
              <Plane className="w-4 h-4 text-amber-300" />
            ) : (
              <Car className="w-4 h-4 text-cyan-300" />
            )}
            Press F to Enter {hud.nearbyVehicleLabel}
          </button>
        </div>
      )}

      {/* Optional On-Screen Touch Controls */}
      {showTouchPad && !hud.gameOver && (
        <div className="fixed bottom-20 inset-x-4 flex items-end justify-between pointer-events-none">
          {/* Left Directional Pad */}
          <div className="grid grid-cols-3 gap-1.5 pointer-events-auto hud-panel p-2 rounded-xl">
            <div />
            <button
              onPointerDown={() => onVirtualKey('KeyW', true)}
              onPointerUp={() => onVirtualKey('KeyW', false)}
              onPointerLeave={() => onVirtualKey('KeyW', false)}
              className="w-11 h-11 rounded bg-slate-800 active:bg-cyan-500 active:text-slate-950 font-bold text-xs"
            >
              W
            </button>
            <div />
            <button
              onPointerDown={() => onVirtualKey('KeyA', true)}
              onPointerUp={() => onVirtualKey('KeyA', false)}
              onPointerLeave={() => onVirtualKey('KeyA', false)}
              className="w-11 h-11 rounded bg-slate-800 active:bg-cyan-500 active:text-slate-950 font-bold text-xs"
            >
              A
            </button>
            <button
              onPointerDown={() => onVirtualKey('KeyS', true)}
              onPointerUp={() => onVirtualKey('KeyS', false)}
              onPointerLeave={() => onVirtualKey('KeyS', false)}
              className="w-11 h-11 rounded bg-slate-800 active:bg-cyan-500 active:text-slate-950 font-bold text-xs"
            >
              S
            </button>
            <button
              onPointerDown={() => onVirtualKey('KeyD', true)}
              onPointerUp={() => onVirtualKey('KeyD', false)}
              onPointerLeave={() => onVirtualKey('KeyD', false)}
              className="w-11 h-11 rounded bg-slate-800 active:bg-cyan-500 active:text-slate-950 font-bold text-xs"
            >
              D
            </button>
          </div>

          {/* Right Action Pad */}
          <div className="flex flex-col gap-1.5 pointer-events-auto hud-panel p-2 rounded-xl">
            {hud.inVehicle === 'airplane' && (
              <div className="flex gap-1.5">
                <button
                  onPointerDown={() => onVirtualKey('ArrowUp', true)}
                  onPointerUp={() => onVirtualKey('ArrowUp', false)}
                  onPointerLeave={() => onVirtualKey('ArrowUp', false)}
                  className="px-3 h-11 rounded bg-slate-800 active:bg-amber-400 active:text-slate-950 font-bold text-xs"
                >
                  Pitch Up
                </button>
                <button
                  onPointerDown={() => onVirtualKey('ArrowDown', true)}
                  onPointerUp={() => onVirtualKey('ArrowDown', false)}
                  onPointerLeave={() => onVirtualKey('ArrowDown', false)}
                  className="px-3 h-11 rounded bg-slate-800 active:bg-amber-400 active:text-slate-950 font-bold text-xs"
                >
                  Pitch Dn
                </button>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={onToggleVehicle}
                className="px-3.5 h-11 rounded bg-slate-800 active:bg-cyan-500 font-bold text-xs"
              >
                {hud.inVehicle ? 'Exit (F)' : 'Enter (F)'}
              </button>
              <button
                onPointerDown={() => onFire(true)}
                onPointerUp={() => onFire(false)}
                onPointerLeave={() => onFire(false)}
                className="px-5 h-11 rounded bg-rose-600 active:bg-rose-400 font-bold text-xs text-white"
              >
                FIRE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control / Telemetry Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto max-w-[94vw]">
        <button
          onClick={() => setDockCollapsed((c) => !c)}
          className="hud-panel px-3 py-1 rounded-t-lg text-[11px] font-medium text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer border-b-0"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {dockCollapsed ? 'Show Controls' : 'Hide Controls'}
        </button>

        {!dockCollapsed && (
          <div className="hud-panel rounded-lg px-4 py-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs shadow-xl">
            {hud.inVehicle ? (
              <>
                <span className="font-semibold text-cyan-300 whitespace-nowrap">
                  {hud.vehicleLabel}
                </span>
                <span className="font-mono-tabular text-slate-100 whitespace-nowrap">
                  {hud.speedKmh} KM/H
                </span>
                {hud.inVehicle === 'airplane' && (
                  <>
                    <span className="font-mono-tabular text-amber-300 whitespace-nowrap">
                      ALT {hud.altitudeM}m
                    </span>
                    <span className="font-mono-tabular text-emerald-300 whitespace-nowrap">
                      THR {hud.throttlePct}%
                    </span>
                    <span className="text-slate-400 whitespace-nowrap">
                      W/S Throttle · A/D Bank · Up/Down Pitch · Click Fire · F Exit
                    </span>
                  </>
                )}
                {hud.inVehicle === 'car' && (
                  <span className="text-slate-400 whitespace-nowrap">
                    W/S Drive · A/D Steer · Space Brake · V Cam · F Exit
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-300 whitespace-nowrap">
                WASD Move · Shift Sprint · Drag/Q/E Look · Click/J Fire · F Enter Car/Plane · V Camera ({hud.cameraMode === 'third' ? '3rd' : '1st'})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Wasted / Respawn Overlay */}
      {hud.gameOver && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 pointer-events-auto">
          <div className="hud-panel rounded-xl p-8 text-center max-w-sm w-full">
            <h2 className="font-display text-4xl font-black text-rose-500 tracking-wider mb-2">
              WASTED
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              You were neutralized in action. Respawn at Downtown Plaza to continue.
            </p>
            <button
              onClick={onRespawn}
              className="w-full py-3 px-5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Respawn Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
