import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { MissionTerminalModal } from './components/MissionTerminalModal';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GtaGameEngine } from './game/engine';
import { STARTING_CASH } from './game/missions';
import { HudSnapshot, WeaponId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  armor: 50,
  cash: STARTING_CASH,
  score: 0,
  weaponId: 'pistol',
  ammoInClip: { pistol: 15, rifle: 30, launcher: 4 },
  reserveAmmo: { pistol: 120, rifle: 210, launcher: 12 },
  unlockedWeapons: ['pistol', 'rifle'],
  inVehicle: null,
  vehicleLabel: '',
  speedKmh: 0,
  altitudeM: 0,
  throttlePct: 0,
  cameraMode: 'third',
  nearbyVehicleKind: null,
  nearbyVehicleLabel: '',
  activeMissionId: null,
  activeSubMissionIndex: 0,
  subMissionProgress: 0,
  subMissionTarget: 1,
  objectiveLabel: 'Free Roam · Open Mission Terminal (M) to purchase contracts',
  completedMissionIds: [],
  purchasedMissionIds: [],
  playerX: 0,
  playerY: 0,
  playerZ: 28,
  playerHeading: Math.PI,
  minimapEntities: [],
  bannerMessage: 'GTA 5 by Double Tech.',
  wantedLevel: 0,
  gameOver: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GtaGameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [showTitle, setShowTitle] = useState(true);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GtaGameEngine(
      container,
      (snapshot) => setHud(snapshot),
      (lost) => setContextLost(lost),
    );
    engine.setPaused(true);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Pause simulation while Title Screen or Mission Modal is open
  useEffect(() => {
    engineRef.current?.setPaused(showTitle || showMissionModal);
  }, [showTitle, showMissionModal]);

  // Global keyboard shortcut M for Mission Terminal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !showTitle) {
        setShowMissionModal((prev) => !prev);
      } else if (e.code === 'Escape' && showMissionModal) {
        setShowMissionModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showTitle]);

  const handleEnterGame = useCallback(() => {
    gameAudio.init();
    setShowTitle(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      gameAudio.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectMission = useCallback((missionId: string) => {
    setShowTitle(false);
    engineRef.current?.purchaseAndStartMission(missionId);
  }, []);

  const handleBuyWeapon = useCallback((weaponId: WeaponId) => {
    engineRef.current?.purchaseWeapon(weaponId);
  }, []);

  const handleBuyArmor = useCallback(() => {
    engineRef.current?.buyArmorMedkit();
  }, []);

  return (
    <div className="relative w-full h-full bg-[#07090f] overflow-hidden">
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 text-center p-6">
          <div className="hud-panel rounded-xl p-6 max-w-sm">
            <h2 className="font-display text-lg font-bold text-amber-300 mb-2">
              Graphics Context Paused
            </h2>
            <p className="text-xs text-slate-300">
              WebGL context was interrupted. Waiting for GPU restoration or reload the page.
            </p>
          </div>
        </div>
      )}

      {!showTitle && (
        <GameHUD
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenMissions={() => setShowMissionModal(true)}
          onToggleCamera={() => engineRef.current?.toggleCameraMode()}
          onSelectWeapon={(id) => engineRef.current?.selectWeapon(id)}
          onToggleVehicle={() => engineRef.current?.toggleVehicle()}
          onRespawn={() => engineRef.current?.respawnPlayer()}
          onVirtualKey={(code, active) => engineRef.current?.setVirtualKey(code, active)}
          onFire={(active) => engineRef.current?.setFiring(active)}
        />
      )}

      {showTitle && (
        <TitleScreen
          onEnterGame={handleEnterGame}
          onOpenMissions={() => {
            gameAudio.init();
            setShowTitle(false);
            setShowMissionModal(true);
          }}
        />
      )}

      {showMissionModal && (
        <MissionTerminalModal
          hud={hud}
          onClose={() => setShowMissionModal(false)}
          onSelectMission={handleSelectMission}
          onBuyWeapon={handleBuyWeapon}
          onBuyArmor={handleBuyArmor}
        />
      )}
    </div>
  );
}
