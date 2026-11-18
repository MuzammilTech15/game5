import { useEffect, useRef } from 'react';
import { MinimapEntity } from '../game/types';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  entities: MinimapEntity[];
}

export function Minimap({ playerX, playerZ, playerHeading, entities }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 148;
    const half = size / 2;
    const scale = 0.42; // world meters -> pixels

    ctx.clearRect(0, 0, size, size);

    // Background ocean / land
    ctx.fillStyle = '#0a1222';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);

    // Draw city road grid relative to player
    const roadCoords = [-175, -105, -35, 35, 105, 175];
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 4;

    for (const rc of roadCoords) {
      const rx = (rc - playerX) * scale;
      const rz = (rc - playerZ) * scale;

      // NS road
      ctx.beginPath();
      ctx.moveTo(rx, (-210 - playerZ) * scale);
      ctx.lineTo(rx, (210 - playerZ) * scale);
      ctx.stroke();

      // EW road
      ctx.beginPath();
      ctx.moveTo((-210 - playerX) * scale, rz);
      ctx.lineTo((210 - playerX) * scale, rz);
      ctx.stroke();
    }

    // Coastal airstrip runway rectangle
    const runwayX = (265 - playerX) * scale;
    const runwayZ = (0 - playerZ) * scale;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fillRect(runwayX - 7, runwayZ - 80, 14, 160);

    // Draw entities
    for (const ent of entities) {
      const ex = (ent.x - playerX) * scale;
      const ez = (ent.z - playerZ) * scale;
      if (Math.abs(ex) > half - 4 || Math.abs(ez) > half - 4) continue;

      if (ent.kind === 'citizen') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.fillRect(ex - 1, ez - 1, 2, 2);
      } else if (ent.kind === 'car') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(ex - 2, ez - 2, 4, 4);
      } else if (ent.kind === 'airplane') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'enemy') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'checkpoint' || ent.kind === 'objective') {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ez, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Player heading arrow at center
    ctx.rotate(-playerHeading + Math.PI);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [playerX, playerZ, playerHeading, entities]);

  return (
    <div className="hud-panel rounded-lg p-1.5 shadow-lg">
      <div className="relative w-[148px] h-[148px] rounded overflow-hidden border border-white/10">
        <canvas ref={canvasRef} width={148} height={148} className="block w-full h-full" />
        <div className="absolute bottom-1 left-1.5 text-[10px] font-mono-tabular text-cyan-300/90 pointer-events-none">
          {Math.round(playerX)}, {Math.round(playerZ)}
        </div>
      </div>
    </div>
  );
}
