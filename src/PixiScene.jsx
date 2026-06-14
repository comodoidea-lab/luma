import { useEffect, useRef } from "react";
import { Application, BlurFilter, Graphics } from "pixi.js";

const dust = Array.from({ length: 220 }, (_, index) => ({
  x: ((index * 73) % 997) / 997,
  y: ((index * 193) % 991) / 991,
  size: index % 17 ? 0.7 : 1.4,
  phase: index * 0.71,
}));

function drawGlow(graphics, x, y, radius, color, alpha) {
  graphics.circle(x, y, radius).fill({ color, alpha: alpha * 0.08 });
  graphics.circle(x, y, radius * 0.52).fill({ color, alpha: alpha * 0.16 });
  graphics.circle(x, y, Math.max(1, radius * 0.09)).fill({ color: 0xffffff, alpha });
}

function drawCosmos(back, glow, front, data, pointer, width, height, time) {
  const centerX = width * 0.5;
  const centerY = height * 0.55;
  const pullX = pointer?.dragX ?? 0;
  const pullY = pointer?.dragY ?? 0;

  for (const particle of dust) {
    const twinkle = 0.2 + Math.abs(Math.sin(time * 0.00035 + particle.phase)) * 0.65;
    front.rect(particle.x * width, particle.y * height, particle.size, particle.size)
      .fill({ color: particle.phase % 5 > 1 ? 0x4598ff : 0x9b68ff, alpha: twinkle });
  }

  for (let orbit = 0; orbit < 12; orbit += 1) {
    const orbitWidth = width * (0.28 + orbit * 0.07);
    back.ellipse(
      centerX + pullX * (orbit % 3) * 0.025,
      centerY + pullY * 0.03,
      orbitWidth * 0.5,
      orbitWidth * (0.18 + (orbit % 3) * 0.025),
    ).stroke({
      color: orbit % 4 === 0 ? 0xffad57 : 0x4689ff,
      alpha: orbit % 4 === 0 ? 0.16 : 0.12,
      width: 1,
    });
  }

  for (const nebula of data.nebulae) {
    const x = nebula.x * width + pullX * 0.44;
    const y = nebula.y * height + pullY * 0.32;
    const radius = 48 + nebula.strength * 42;
    for (let cloud = 0; cloud < 24; cloud += 1) {
      const angle = nebula.phase + cloud * 2.399 + time * 0.00002 * (cloud % 2 ? 1 : -1);
      const distance = radius * (0.08 + (cloud % 7) * 0.11);
      const cx = x + Math.cos(angle) * distance;
      const cy = y + Math.sin(angle) * distance * 0.48;
      const cloudRadius = radius * (0.17 + (cloud % 5) * 0.052);
      const color = cloud % 3 === 0 ? 0xff7ad9 : cloud % 4 === 0 ? 0x49e1ff : 0x755dff;
      glow.ellipse(cx, cy, cloudRadius, cloudRadius * 0.55).fill({
        color,
        alpha: 0.06 + nebula.strength * 0.025,
      });
    }
    drawGlow(glow, x, y, radius * 0.48, 0xffcfff, 0.86);
  }

  data.stars.forEach((star, index) => {
    let x = star.x * width + pullX * (0.18 + (index % 5) * 0.035);
    let y = star.y * height + pullY * (0.16 + (index % 4) * 0.035);
    if (pointer) {
      const dx = pointer.x - x;
      const dy = pointer.y - y;
      const influence = Math.min(28 / Math.max(30, Math.hypot(dx, dy)), 0.23);
      x += dx * influence;
      y += dy * influence;
    }
    if (index > 0 && index % 3) {
      const previous = data.stars[index - 1];
      back.moveTo(previous.x * width + pullX * 0.18, previous.y * height + pullY * 0.16)
        .lineTo(x, y)
        .stroke({ color: 0x628fff, alpha: 0.17, width: 1 });
    }
    drawGlow(glow, x, y, star.size * 6, star.color, 0.92);
  });

  drawGlow(glow, centerX + pullX * 0.08, centerY + pullY * 0.08, 92, 0xffaf48, 1);
  front.circle(centerX + pullX * 0.08, centerY + pullY * 0.08, 7).fill({ color: 0xffffff });
}

function drawLiquid(glow, front, marks, pointer, width, height, time) {
  const pullX = pointer?.dragX ?? 0;
  const pullY = pointer?.dragY ?? 0;

  for (let index = 0; index < 15; index += 1) {
    const phase = time * 0.00025 + index * 1.37;
    const x = ((index * 0.173 + 0.08) % 1) * width + Math.sin(phase) * 18 + pullX * 0.08;
    const y = ((index * 0.227 + 0.12) % 1) * height + Math.cos(phase * 0.7) * 12 + pullY * 0.06;
    front.circle(x, y, 2 + (index % 4)).stroke({ color: 0xa8f7ff, alpha: 0.16, width: 1 });
  }

  for (const mark of marks) {
    if (mark.type !== "liquid") continue;
    const strength = mark.strength ?? 0.55;
    const x = mark.x * width + pullX * (0.5 + strength * 0.09);
    const y = mark.y * height + pullY * (0.4 + strength * 0.06);
    const age = Math.min(1, (Date.now() - mark.createdAt) / (mark.hold ? 1900 : 1100));
    const wave = 18 + age * (54 + strength * 36);
    const alpha = Math.max(0, 0.54 - age * 0.5);
    for (let ring = 0; ring < (mark.hold ? 5 : 3); ring += 1) {
      front.ellipse(x, y, wave + ring * 13, (wave + ring * 13) * 0.56).stroke({
        color: ring % 2 ? 0xaa7dff : 0x72edff,
        alpha: Math.max(0, alpha - ring * 0.045),
        width: 1,
      });
    }
    const radius = 7 + strength * 7;
    glow.circle(x, y, radius * 2.5).fill({ color: 0x62eaff, alpha: 0.15 });
    front.circle(x, y, radius).fill({ color: 0xb8f7ff, alpha: 0.18 });
    front.circle(x, y, radius).stroke({ color: 0xc9faff, alpha: 0.78, width: 1 });
    front.circle(x - radius * 0.28, y - radius * 0.3, Math.max(1.2, radius * 0.16))
      .fill({ color: 0xffffff, alpha: 0.92 });
  }
}

function drawGarden(glow, front, marks, pointer, width, height, time) {
  const pullX = pointer?.dragX ?? 0;
  const pullY = pointer?.dragY ?? 0;

  for (let index = 0; index < 28; index += 1) {
    const phase = time * 0.00032 + index * 1.83;
    const x = ((index * 0.279 + 0.05) % 1) * width + Math.sin(phase) * 22 + pullX * 0.1;
    const y = ((index * 0.193 + 0.08) % 1) * height + Math.cos(phase * 0.8) * 15 + pullY * 0.06;
    glow.circle(x, y, index % 5 ? 1.2 : 2).fill({
      color: index % 4 ? 0xffd29c : 0x78eadb,
      alpha: 0.22 + Math.abs(Math.sin(phase)) * 0.36,
    });
  }

  for (const mark of marks) {
    if (mark.type !== "garden") continue;
    const strength = mark.strength ?? 0.55;
    const x = mark.x * width + pullX * (0.44 + strength * 0.08);
    const y = mark.y * height + pullY * (0.31 + strength * 0.06);
    const age = Math.min(1, (Date.now() - mark.createdAt) / (mark.hold ? 1800 : 1000));
    const growth = 0.3 + age * 0.7;
    const clusterSize = mark.hold ? 5 : 1;
    const colorMap = {
      peach: [0xffa38b, 0xffd4ad],
      gold: [0xffc65c, 0xffedac],
      violet: [0xc79aff, 0xead7ff],
      teal: [0x70eadc, 0xb6fff2],
      rose: [0xff70a7, 0xffbdd6],
      sky: [0x79c7ff, 0xc7e9ff],
      ivory: [0xfff3ce, 0xffffff],
      coral: [0xff765f, 0xffb79f],
      warm: [0xffa38b, 0xffdda6],
    };
    const [color, highlight] = colorMap[mark.color] ?? colorMap.teal;

    for (let bloom = 0; bloom < clusterSize; bloom += 1) {
      const clusterAngle = mark.phase + bloom * 2.399;
      const spread = bloom === 0 ? 0 : 22 + (bloom % 3) * 14;
      const rootX = x + Math.cos(clusterAngle) * spread;
      const rootY = y + Math.sin(clusterAngle) * spread * 0.35 + bloom * 3;
      const bloomStrength = strength * (bloom === 0 ? 1 : 0.62 + (bloom % 2) * 0.12);
      const sway = Math.sin(time * 0.0012 + mark.phase + bloom) * (7 + bloomStrength * 5) + pullX * 0.18;
      const stem = (48 + bloomStrength * 50 + bloom * 5) * growth;
      const flowerX = rootX + sway;
      const flowerY = rootY - stem;
      const species = mark.species ?? ["cosmos", "daisy", "bell", "star", "cup"][Math.floor(mark.phase * 10) % 5];

      front.moveTo(rootX, rootY + 12)
        .bezierCurveTo(rootX - 12, rootY - stem * 0.2, rootX + sway * 0.4, rootY - stem * 0.75, flowerX, flowerY)
        .stroke({ color: highlight, alpha: 0.72, width: bloom === 0 && mark.hold ? 1.5 : 1 });

      const leafY = rootY - stem * 0.48;
      const leafSide = bloom % 2 ? -1 : 1;
      front.ellipse(rootX + leafSide * 9, leafY, 11, 3.5)
        .fill({ color: 0x4aa997, alpha: 0.34 });

      const petals = species === "daisy" ? 12 : species === "star" ? 6 : species === "bell" ? 5 : 8;
      for (let petal = 0; petal < petals; petal += 1) {
        const angle = (petal / petals) * Math.PI * 2 + time * 0.00005;
        const radial = species === "star" ? 14 + bloomStrength * 5 : 11 + bloomStrength * 5;
        const px = flowerX + Math.cos(angle) * radial;
        const py = flowerY + Math.sin(angle) * (species === "bell" ? 5 : 7 + bloomStrength * 2);
        const petalWidth = species === "daisy" ? 10 : species === "star" ? 15 : species === "cup" ? 14 : 12;
        const petalHeight = species === "bell" ? 8 : species === "daisy" ? 3.5 : 5 + bloomStrength;
        front.ellipse(px, py + (species === "bell" ? 5 : 0), petalWidth + bloomStrength * 3, petalHeight)
          .fill({ color, alpha: 0.28 + age * 0.42 });
      }

      if (species === "cup") {
        front.ellipse(flowerX, flowerY + 2, 12 + bloomStrength * 4, 8)
          .stroke({ color: highlight, alpha: 0.62, width: 1 });
      }
      glow.circle(flowerX, flowerY, 22 + bloomStrength * 9).fill({ color, alpha: 0.13 });
      front.circle(flowerX, flowerY, species === "daisy" ? 4.5 : 3 + bloomStrength)
        .fill({ color: species === "daisy" ? 0xffd85e : 0xfff2c8, alpha: 0.96 });
    }
  }
}

export function PixiScene({ mode, dataRef, pointerRef }) {
  const hostRef = useRef(null);

  useEffect(() => {
    let app;
    let destroyed = false;
    let ready = false;

    const setup = async () => {
      app = new Application();
      await app.init({
        resizeTo: hostRef.current,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(devicePixelRatio || 1, 2),
      });
      ready = true;
      if (destroyed || !hostRef.current) {
        app.destroy(true);
        return;
      }

      hostRef.current.appendChild(app.canvas);
      const back = new Graphics();
      const glow = new Graphics();
      glow.filters = [new BlurFilter({ strength: 5, quality: 2 })];
      const front = new Graphics();
      app.stage.addChild(back, glow, front);

      app.ticker.add(() => {
        const width = app.screen.width;
        const height = app.screen.height;
        const time = performance.now();
        back.clear();
        glow.clear();
        front.clear();
        if (mode === "cosmos") {
          drawCosmos(back, glow, front, dataRef.current, pointerRef.current, width, height, time);
        } else if (mode === "liquid") {
          drawLiquid(glow, front, dataRef.current.marks, pointerRef.current, width, height, time);
        } else {
          drawGarden(glow, front, dataRef.current.marks, pointerRef.current, width, height, time);
        }
      });
    };

    setup();
    return () => {
      destroyed = true;
      if (app && ready) app.destroy(true, { children: true });
    };
  }, [dataRef, mode, pointerRef]);

  return <div ref={hostRef} className="absolute inset-0 z-[2] mix-blend-screen" aria-hidden="true" />;
}
