import * as THREE from 'three';

export interface ProceduralTextures {
  asphalt: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  runway: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  water: THREE.CanvasTexture;
  buildingFacades: THREE.CanvasTexture[];
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b1f27';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 22 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Lane markings
  ctx.fillStyle = '#e5a93c';
  ctx.fillRect(250, 0, 4, 512);
  ctx.fillRect(258, 0, 4, 512);

  ctx.fillStyle = '#cbd5e1';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(126, y + 10, 4, 34);
    ctx.fillRect(382, y + 10, 4, 34);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, 1);
}

function createSidewalkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#47505e';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#333b47';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 12, 12);
}

function createRunwayTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#202630';
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle tire rubber skid marks near center
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = 'rgba(12, 14, 18, 0.28)';
    const x = 190 + Math.random() * 132;
    const y = Math.random() * 1024;
    ctx.fillRect(x, y, 4, 24);
  }

  // Edge stripes
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(22, 0, 10, 1024);
  ctx.fillRect(480, 0, 10, 1024);

  // Center dashed line
  for (let y = 40; y < 984; y += 72) {
    ctx.fillRect(250, y, 12, 42);
  }

  // Threshold piano keys
  for (let x = 56; x <= 424; x += 36) {
    if (Math.abs(x - 246) < 28) continue;
    ctx.fillRect(x, 18, 20, 58);
    ctx.fillRect(x, 948, 20, 58);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, 2);
}

function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1d3629';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? '#234232' : '#162b20';
    ctx.fillRect(x, y, 2, 2);
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 32, 32);
}

function createWaterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#0a2940');
  grad.addColorStop(0.5, '#0e3754');
  grad.addColorStop(1, '#082236');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 2;
  for (let y = 16; y < 256; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(64, y - 6, 192, y + 6, 256, y);
    ctx.stroke();
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 24, 24);
}

function createBuildingFacadeTexture(
  maxAnisotropy: number,
  wallHex: string,
  litColorA: string,
  litColorB: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle horizontal floor bands
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < 512; y += 32) {
    ctx.fillRect(0, y, 256, 4);
  }

  // Windows grid
  const cols = 8;
  const rows = 16;
  const w = 20;
  const h = 18;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = 10 + c * 30;
      const wy = 8 + r * 32;
      const roll = Math.random();
      if (roll > 0.42) {
        ctx.fillStyle = roll > 0.72 ? litColorA : litColorB;
      } else {
        ctx.fillStyle = '#0f172a';
      }
      ctx.fillRect(wx, wy, w, h);
    }
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 1, 1);
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextures {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const asphalt = createAsphaltTexture(maxAniso);
  const sidewalk = createSidewalkTexture(maxAniso);
  const runway = createRunwayTexture(maxAniso);
  const grass = createGrassTexture(maxAniso);
  const water = createWaterTexture(maxAniso);
  const buildingFacades = [
    createBuildingFacadeTexture(maxAniso, '#1e293b', '#bae6fd', '#fde68a'),
    createBuildingFacadeTexture(maxAniso, '#27272a', '#67e8f9', '#fed7aa'),
    createBuildingFacadeTexture(maxAniso, '#1f2430', '#93c5fd', '#fcd34d'),
    createBuildingFacadeTexture(maxAniso, '#292524', '#a5f3fc', '#fdba74'),
  ];
  const contactShadow = createContactShadowTexture();

  return {
    asphalt,
    sidewalk,
    runway,
    grass,
    water,
    buildingFacades,
    contactShadow,
    dispose: () => {
      asphalt.dispose();
      sidewalk.dispose();
      runway.dispose();
      grass.dispose();
      water.dispose();
      buildingFacades.forEach((t) => t.dispose());
      contactShadow.dispose();
    },
  };
}
