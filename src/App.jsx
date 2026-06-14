import { useEffect, useMemo, useRef, useState } from "react";
import { PixiScene } from "./PixiScene.jsx";
import { playRelease, settleDrag, shapeDrag, startAudio } from "./audio.js";
import liquidMemory from "./assets/liquid-memory-art.png";
import nightGarden from "./assets/night-garden-art.png";

const palette = [0x42a5ff, 0x7f5cff, 0xffc16b, 0x8eeaff, 0xe49bff];
const flowerColors = ["peach", "gold", "violet", "teal", "rose", "sky", "ivory", "coral"];
const flowerSpecies = ["cosmos", "daisy", "bell", "star", "cup"];
const LONG_PRESS_MS = 650;
const TAP_SLOP = 14;
const modes = {
  cosmos: {
    label: "星",
    title: "触れて、宇宙を育てる",
    hint: "短押しで星、長押しで星雲",
    detail: "なぞると宇宙全体が指についてくる",
    unit: "lights",
    accent: "text-sky-200",
  },
  liquid: {
    label: "水",
    title: "まだ名前のない記憶",
    hint: "押し続けると、奥へ",
    detail: "波紋は水滴になり、指の動きに引かれる",
    unit: "droplets",
    accent: "text-cyan-100",
  },
  garden: {
    label: "花",
    title: "今夜だけの庭",
    hint: "触れた場所から、生きていく",
    detail: "花を増やし、風をまとわせて揺らす",
    unit: "blooms",
    accent: "text-amber-100",
  },
};

const initialStars = [
  [0.13, 0.31, 3], [0.27, 0.26, 2], [0.42, 0.34, 4], [0.61, 0.28, 3],
  [0.81, 0.36, 4], [0.18, 0.52, 3], [0.37, 0.47, 2], [0.58, 0.51, 4],
  [0.77, 0.56, 3], [0.23, 0.68, 4], [0.48, 0.63, 3], [0.7, 0.72, 4],
];

function uid() {
  return crypto.randomUUID();
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function makeInitialStars() {
  return initialStars.map(([x, y, size], index) => ({
      id: uid(),
      x,
      y,
      size,
      color: palette[index % palette.length],
      phase: index * 0.71,
    }));
}

function defaultScene() {
  const saved = loadJson("luma-scene", null);
  if (saved?.stars && saved?.nebulae && saved?.marks) return saved;
  return {
    stars: makeInitialStars(),
    nebulae: [],
    marks: [],
  };
}

function Waveform() {
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden="true">
      {[8, 16, 23, 16, 8].map((height, index) => (
        <i key={index} className="w-[2px] rounded-full bg-current" style={{ height }} />
      ))}
    </span>
  );
}

export function App() {
  const sceneRef = useRef(defaultScene());
  const pointerRef = useRef(null);
  const pressStartRef = useRef(0);
  const audioRef = useRef(null);
  const soundRef = useRef(true);
  const dragAudioRef = useRef(0);
  const dragRippleRef = useRef(0);
  const [mode, setMode] = useState("cosmos");
  const [message, setMessage] = useState(modes.cosmos.title);
  const [sound, setSound] = useState(true);
  const [active, setActive] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => () => audioRef.current?.dispose(), []);

  const modeCount = useMemo(() => {
    if (mode === "cosmos") return sceneRef.current.stars.length + sceneRef.current.nebulae.length;
    return sceneRef.current.marks.filter((mark) => mark.type === mode).length;
  }, [mode, revision]);

  const persist = () => {
    localStorage.setItem("luma-scene", JSON.stringify(sceneRef.current));
    setRevision((value) => value + 1);
  };

  const pointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    pointerRef.current = {
      ...point,
      startX: point.x,
      startY: point.y,
      dragX: 0,
      dragY: 0,
      maxDistance: 0,
    };
    pressStartRef.current = performance.now();
    setActive(true);
    startAudio(audioRef, soundRef.current);
  };

  const onPointerMove = (event) => {
    if (!pointerRef.current) return;
    event.preventDefault();
    const point = pointerPosition(event);
    const rawX = point.x - pointerRef.current.startX;
    const rawY = point.y - pointerRef.current.startY;
    const dragPoint = {
      ...point,
      startX: pointerRef.current.startX,
      startY: pointerRef.current.startY,
      dragX: Math.max(-210, Math.min(210, rawX * 0.82)),
      dragY: Math.max(-160, Math.min(160, rawY * 0.68)),
      maxDistance: Math.max(pointerRef.current.maxDistance, Math.hypot(rawX, rawY)),
    };
    pointerRef.current = dragPoint;
    const now = performance.now();
    if (mode === "liquid" && now - dragRippleRef.current > 110) {
      const rippleForce = Math.min(1, Math.hypot(dragPoint.dragX, dragPoint.dragY) / 180);
      const rippleAt = Date.now();
      sceneRef.current.marks.forEach((mark) => {
        const settleDuration = mark.hold ? 1900 : 1100;
        if (mark.type === "liquid" && rippleAt - mark.createdAt >= settleDuration) {
          mark.rippleAt = rippleAt;
          mark.rippleForce = rippleForce;
        }
      });
      dragRippleRef.current = now;
    }
    if (now - dragAudioRef.current > 80) {
      shapeDrag(audioRef, soundRef.current, mode, dragPoint);
      dragAudioRef.current = now;
    }
  };

  const onPointerUp = (event) => {
    if (!pointerRef.current) return;
    event.preventDefault();
    const point = pointerPosition(event);
    const holdMs = performance.now() - pressStartRef.current;
    const wasDrag = pointerRef.current.maxDistance > TAP_SLOP;
    const isLongPress = holdMs >= LONG_PRESS_MS;
    const strength = isLongPress ? Math.min(2.2, Math.max(0.7, holdMs / 1400)) : 0.55;
    const normalized = { x: point.x / point.width, y: point.y / point.height };

    if (wasDrag) {
      setMessage(mode === "cosmos" ? "軌道が、指の余韻を覚えた" : mode === "liquid" ? "水面が、指に引かれた" : "花々を、風が渡った");
    } else if (mode === "cosmos") {
      if (isLongPress) {
        sceneRef.current.nebulae.push({
          id: uid(),
          ...normalized,
          strength,
          phase: Math.random() * Math.PI * 2,
        });
        setMessage("記憶が、星雲として残った");
      } else {
        sceneRef.current.stars.push({
          id: uid(),
          ...normalized,
          size: 3 + Math.random() * 3,
          color: palette[Math.floor(Math.random() * palette.length)],
          phase: Math.random() * Math.PI * 2,
        });
        setMessage("ひとつ、光が生まれた");
      }
    } else {
      sceneRef.current.marks.push({
        id: uid(),
        ...normalized,
        type: mode,
        hold: isLongPress,
        strength,
        createdAt: Date.now(),
        phase: Math.random() * Math.PI * 2,
        color: mode === "garden"
          ? flowerColors[Math.floor(Math.random() * flowerColors.length)]
          : "aqua",
        species: mode === "garden"
          ? flowerSpecies[Math.floor(Math.random() * flowerSpecies.length)]
          : undefined,
      });
      setMessage(mode === "liquid"
        ? isLongPress ? "深い波紋のあとに、水滴が残る" : "波紋が、水滴へと結ばれる"
        : isLongPress ? "風の中に、小さな花畑がひらいた" : "新しい花が咲いた");
    }

    if (!wasDrag) {
      persist();
      playRelease(audioRef, soundRef.current, mode, point, holdMs);
      navigator.vibrate?.(isLongPress ? [25, 30, 55] : 20);
    }
    pointerRef.current = null;
    settleDrag(audioRef);
    setActive(false);
  };

  const onPointerCancel = () => {
    pointerRef.current = null;
    settleDrag(audioRef);
    setActive(false);
  };

  const selectMode = (nextMode) => {
    settleDrag(audioRef);
    pointerRef.current = null;
    setMode(nextMode);
    setMessage(modes[nextMode].title);
  };

  const reset = () => {
    if (mode === "cosmos") {
      sceneRef.current.stars = makeInitialStars();
      sceneRef.current.nebulae = [];
      setMessage("宇宙は、何度でも始まる");
    } else {
      sceneRef.current.marks = sceneRef.current.marks.filter((mark) => mark.type !== mode);
      setMessage(mode === "liquid" ? "水面は、また静かになった" : "庭は、また夜を待つ");
    }
    persist();
  };

  const toggleSound = async () => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSound(next);
    if (!next) {
      audioRef.current?.master.gain.rampTo(0, 0.15);
      setMessage("音を閉じた");
    } else {
      const audio = await startAudio(audioRef, true);
      audio?.master.gain.rampTo(0.96, 0.2);
      setMessage("音が、また戻った");
    }
  };

  const background = mode === "liquid" ? liquidMemory : mode === "garden" ? nightGarden : null;
  void revision;

  return (
    <main className={`mode-${mode} relative h-[100dvh] min-h-[560px] w-screen overflow-hidden bg-[#010207] text-white`}>
      {background && (
        <img
          src={background}
          alt=""
          draggable="false"
          className="scene-art absolute inset-[-4%] z-0 h-[108%] w-[108%] select-none object-cover"
          style={{
            transform: `translate(${(pointerRef.current?.dragX ?? 0) * 0.08}px, ${(pointerRef.current?.dragY ?? 0) * 0.06}px) scale(1.04)`,
          }}
        />
      )}

      <div className="absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(0,0,0,.9),transparent_24%,transparent_70%,rgba(0,0,0,.86))]" />
      <div className="grain absolute inset-0 z-[3] pointer-events-none opacity-20 mix-blend-soft-light" />
      <PixiScene mode={mode} dataRef={sceneRef} pointerRef={pointerRef} />

      <div
        className="interaction-surface absolute inset-0 z-[4] touch-none cursor-crosshair"
        aria-label={modes[mode].title}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      <header className="pointer-events-none absolute left-1/2 top-[max(20px,env(safe-area-inset-top))] z-10 w-[min(70vw,540px)] -translate-x-1/2 rounded-[28px] bg-gradient-to-b from-black/55 to-black/5 px-6 py-3 text-center backdrop-blur-md">
        <p className="m-0 text-[clamp(14px,1.8vw,20px)] font-light tracking-[.5em] text-white/90 [text-indent:.5em]">
          L U M A
        </p>
        <h1 className="mt-2 min-h-[1.5em] text-[clamp(15px,1.8vw,20px)] font-light tracking-[.16em] text-white/90 [text-shadow:0_0_22px_rgba(103,151,255,.35)]">
          {message}
        </h1>
        <p className={`mt-2 text-[10px] uppercase tracking-[.25em] opacity-50 ${modes[mode].accent}`}>
          {String(modeCount).padStart(2, "0")} {modes[mode].unit}
        </p>
      </header>

      <nav className="absolute right-[max(14px,env(safe-area-inset-right))] top-[max(16px,env(safe-area-inset-top))] z-20 flex gap-1 rounded-full border border-white/15 bg-slate-950/55 p-1.5 shadow-2xl backdrop-blur-xl" aria-label="体験を切り替える">
        {Object.entries(modes).map(([key, item]) => (
          <button
            key={key}
            type="button"
            className={`grid h-9 w-9 place-items-center rounded-full border-0 text-[11px] transition ${
              mode === key ? "bg-white/15 text-white shadow-[inset_0_0_18px_rgba(128,174,255,.22)]" : "text-white/45 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => selectMode(key)}
            aria-label={`${item.title}に切り替える`}
            aria-pressed={mode === key}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div
        className={`touch-ring pointer-events-none absolute z-[6] rounded-full border border-sky-300/40 ${active ? "is-active" : ""}`}
        aria-hidden="true"
      />

      <section className="absolute bottom-[max(18px,env(safe-area-inset-bottom))] left-1/2 z-20 flex min-h-[76px] w-[min(calc(100vw-24px),700px)] -translate-x-1/2 items-center justify-between rounded-full border border-blue-200/20 bg-gradient-to-br from-slate-900/80 to-slate-950/60 py-3 pl-4 pr-3 shadow-[0_20px_60px_rgba(0,21,80,.35),inset_0_1px_rgba(255,255,255,.08)] backdrop-blur-2xl sm:pl-6" aria-label="体験の操作">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="tap-mark relative h-9 w-9 shrink-0 rounded-full border border-sky-400/80 shadow-[0_0_20px_rgba(45,155,255,.35),inset_0_0_12px_rgba(69,174,255,.18)]" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block truncate text-xs font-normal tracking-[.08em] text-white/90 sm:text-sm sm:tracking-[.11em]">
              {modes[mode].hint}
            </strong>
            <small className="mt-1 hidden truncate text-[10px] tracking-[.06em] text-blue-100/45 sm:block">
              {modes[mode].detail}
            </small>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1 border-l border-white/15 pl-2 sm:ml-4 sm:pl-4">
          <button type="button" onClick={reset} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-xl text-white/50 transition hover:bg-white/10 hover:text-white" aria-label={`${modes[mode].label}をリセット`}>
            ↻
          </button>
          <button
            type="button"
            onClick={toggleSound}
            className={`grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent transition hover:bg-white/10 hover:text-white ${sound ? "text-violet-300" : "text-white/35"}`}
            aria-label={sound ? "サウンドをオフ" : "サウンドをオン"}
            title={sound ? "サウンドをオフ" : "サウンドをオン"}
          >
            <Waveform />
          </button>
        </div>
      </section>
    </main>
  );
}
