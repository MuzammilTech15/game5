import { Play, ShoppingBag } from 'lucide-react';

interface TitleScreenProps {
  onEnterGame: () => void;
  onOpenMissions: () => void;
}

export function TitleScreen({ onEnterGame, onOpenMissions }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#050811]/85 px-6">
      <div className="max-w-2xl w-full hud-panel rounded-2xl p-8 md:p-10 text-center shadow-2xl">
        <p className="text-xs font-medium tracking-[0.28em] text-cyan-300 uppercase mb-3">
          GTA 5 by Double Tech.
        </p>

        <h1 className="gta-neon-title text-6xl md:text-8xl font-black tracking-wider mb-3">
          GTA <span className="gta-neon-accent">5</span>
        </h1>

        <p className="text-base md:text-lg text-slate-300 font-medium mb-8">
          Ultimate Edition · Open World Experience
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8">
          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-3.5">
            <p className="text-xs font-semibold text-cyan-300 mb-1">Movement & Combat</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              W A S D to move · Shift sprint · Click or J to fire · Keys 1–3 switch weapons
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-3.5">
            <p className="text-xs font-semibold text-amber-300 mb-1">Cars & Airplanes</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Press F near any car or airstrip jet · W/S throttle · A/D steer & bank · Up/I pitch
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/80 border border-white/10 p-3.5">
            <p className="text-xs font-semibold text-emerald-300 mb-1">$2,000 Starting Cash</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Purchase multi-stage missions, clear sub-missions, and unlock heavy firepower
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onEnterGame}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            Enter Open World
          </button>

          <button
            onClick={onOpenMissions}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/15 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            Purchase Mission ($2,000)
          </button>
        </div>
      </div>
    </div>
  );
}
