import { CheckCircle2, Crosshair, DollarSign, Shield, X } from 'lucide-react';
import { MISSIONS, WEAPONS } from '../game/missions';
import { HudSnapshot, WeaponId } from '../game/types';

interface MissionTerminalModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSelectMission: (missionId: string) => void;
  onBuyWeapon: (weaponId: WeaponId) => void;
  onBuyArmor: () => void;
}

export function MissionTerminalModal({
  hud,
  onClose,
  onSelectMission,
  onBuyWeapon,
  onBuyArmor,
}: MissionTerminalModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl hud-panel rounded-xl p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Mission Contracts & Armory
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Purchase contracts with your bankroll to unlock progressive sub-missions
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono-tabular font-bold text-lg">
              <DollarSign className="w-4 h-4" />
              {hud.cash.toLocaleString()}
            </div>
            <button
              onClick={onClose}
              aria-label="Close Mission Terminal"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Missions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {MISSIONS.map((m) => {
            const isOwned = hud.purchasedMissionIds.includes(m.id);
            const isCompleted = hud.completedMissionIds.includes(m.id);
            const isActive = hud.activeMissionId === m.id;
            const canAfford = hud.cash >= m.cost;

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-lg bg-slate-900/85 border border-white/10 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
                    <span>Mission 0{m.number}</span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cleared
                      </span>
                    ) : (
                      <span className="font-mono-tabular text-amber-300 font-semibold">
                        Reward +${m.reward.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white">{m.title}</h3>
                  <p className="text-xs text-cyan-300/90 mb-2">{m.subtitle}</p>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{m.description}</p>

                  <div className="space-y-1.5 border-t border-white/10 pt-2.5 mb-4">
                    {m.subMissions.map((sub) => (
                      <div key={sub.id} className="text-[11px] text-slate-300 leading-snug">
                        <span className="text-cyan-400 font-semibold">{sub.title}:</span>{' '}
                        {sub.objectiveText}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectMission(m.id);
                    onClose();
                  }}
                  disabled={!isOwned && !canAfford}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950'
                      : isOwned
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isActive
                    ? 'Active Contract · Restart'
                    : isOwned
                      ? 'Launch Mission'
                      : `Purchase Contract ($${m.cost.toLocaleString()})`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Armory & Medkit Row */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {(Object.keys(WEAPONS) as WeaponId[]).map((wId) => {
                const spec = WEAPONS[wId];
                const unlocked = hud.unlockedWeapons.includes(wId);
                const cost = unlocked ? 120 : spec.unlockCost;
                const canAfford = hud.cash >= cost;

                return (
                  <button
                    key={wId}
                    onClick={() => onBuyWeapon(wId)}
                    disabled={!canAfford}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      canAfford
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-white/15'
                        : 'bg-slate-900 text-slate-500 border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{spec.name}</span>
                    <span className="font-mono-tabular text-amber-300">
                      {unlocked ? `Ammo $${cost}` : `Unlock $${cost}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onBuyArmor}
              disabled={hud.cash < 200}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                hud.cash >= 200
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-500 border-white/5 cursor-not-allowed'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Refill Health & Armor ($200)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
