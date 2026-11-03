import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";

const HEAD_GAIN_X = 4.5, HEAD_GAIN_Y = 5;    // head movement  pointer
const IRIS_GAIN_X = 3, IRIS_GAIN_Y = 1.5;    // eye movement  pointer
const SMOOTH = 0.25;                          // higher = snappier pointer
const WINK_CLOSED = 0.55, WINK_OPEN = 0.35;   // blink scores: one eye closed, other open
const WINK_HOLD_MS = 220, CLICK_COOLDOWN_MS = 900;
const PINCH_CLICK = 0.15;   // thumb–index distance / hand size touching = click
const PINCH_FREEZE = 0.35;  // freeze pointer while fingers close, so the click lands where aimed
const PINCH_RELEASE = 0.25;
const SCROLL_SPEED = 18;

// To load faster / offline, copy these files into /public and point the paths there (see README).
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const CLICKABLE = "button,a,input,select,textarea,label,summary,[role=button]";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Each model is created once and reused (fast mode switching).
const cache = {};
function getLandmarker(mode) {
  if (!cache[mode]) {
    cache[mode] = (async () => {
      const fs = await FilesetResolver.forVisionTasks(WASM);
      const Cls = mode === "eye" ? FaceLandmarker : HandLandmarker;
      const path = mode === "eye" ? FACE_MODEL : HAND_MODEL;
      const extra = mode === "eye" ? { numFaces: 1, outputFaceBlendshapes: true } : { numHands: 1 };
      for (const delegate of ["GPU", "CPU"]) {
        try { return await Cls.createFromOptions(fs, { baseOptions: { modelAssetPath: path, delegate }, runningMode: "VIDEO", ...extra }); }
        catch (e) { if (delegate === "CPU") throw e; }
      }
    })().catch(e => { delete cache[mode]; throw e; });
  }
  return cache[mode];
}

export default function HandsFree({ mode, setMode }) {
  const [status, setStatus] = useState("Choose a mode");
  const videoRef = useRef(null);
  const cursorRef = useRef(null);
  const recenter = useRef(true);

  useEffect(() => { getLandmarker("eye").catch(() => {}); getLandmarker("finger").catch(() => {}); }, []); // preload

  useEffect(() => {
    document.body.classList.toggle("hf-active", mode !== "off");
    if (mode === "off") { setStatus("Choose a mode"); return; }

    let stopped = false, raf = 0, stream, landmarker, hovered = null;
    const video = videoRef.current, cursor = cursorRef.current;
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    let cal = { x: 0, y: 0 }, winkSince = 0, lastClick = 0, pinched = false;
    recenter.current = true;

    const hover = el => {
      if (hovered === el) return;
      hovered?.classList.remove("hf-hover");
      el?.classList.add("hf-hover");
      hovered = el;
    };
    const doClick = el => {
      cursor.classList.add("click");
      setTimeout(() => cursor.classList.remove("click"), 250);
      if (!el) return;
      el.click();
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName)) el.focus();
    };

    const frame = () => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (video.readyState < 2) return;
      const now = performance.now();
      const res = landmarker.detectForVideo(video, now);
      let target = null, freeze = false, wantClick = false;

      if (mode === "eye") {
        const lm = res.faceLandmarks?.[0];
        if (!lm) { setStatus("No face found – face the camera"); return; }
        const bs = {};
        res.faceBlendshapes[0].categories.forEach(c => (bs[c.categoryName] = c.score));
        const L = bs.eyeBlinkLeft, R = bs.eyeBlinkRight;
        const ratioX = (i, a, b) => {
          const lo = Math.min(lm[a].x, lm[b].x), hi = Math.max(lm[a].x, lm[b].x);
          return -((lm[i].x - lo) / (hi - lo) - 0.5); // mirrored
        };
        const ratioY = (i, t, b) => (lm[i].y - lm[t].y) / (lm[b].y - lm[t].y) - 0.5;
        const irisX = (ratioX(468, 33, 133) + ratioX(473, 362, 263)) / 2;
        const irisY = (ratioY(468, 159, 145) + ratioY(473, 386, 374)) / 2;
        const rx = (1 - lm[1].x) * HEAD_GAIN_X + irisX * IRIS_GAIN_X;
        const ry = lm[1].y * HEAD_GAIN_Y + irisY * IRIS_GAIN_Y;
        if (recenter.current) { cal = { x: rx, y: ry }; recenter.current = false; }
        target = { x: clamp(0.5 + rx - cal.x) * innerWidth, y: clamp(0.5 + ry - cal.y) * innerHeight };

        const winking = (L > WINK_CLOSED && R < WINK_OPEN) || (R > WINK_CLOSED && L < WINK_OPEN);
        freeze = L > WINK_OPEN || R > WINK_OPEN; // hold the pointer while an eye closes
        if (winking) {
          if (!winkSince) winkSince = now;
          if (now - winkSince > WINK_HOLD_MS && now - lastClick > CLICK_COOLDOWN_MS) { wantClick = true; lastClick = now; winkSince = 0; }
        } else winkSince = 0;
        setStatus("Eye mode: aim with head/eyes, wink ONE eye to click");
      } else {
        const lm = res.landmarks?.[0];
        if (!lm) { setStatus("Show one hand to the camera"); pinched = false; return; }
        const d = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
        const ratio = d(4, 8) / d(0, 9); // thumb tip ↔ index tip, scaled by hand size
        const m = 0.12;
        target = { x: clamp(((1 - lm[8].x) - m) / (1 - 2 * m)) * innerWidth, y: clamp((lm[8].y - m) / (1 - 2 * m)) * innerHeight };
        freeze = ratio < PINCH_FREEZE;
        if (ratio < PINCH_CLICK && !pinched) { pinched = true; wantClick = true; }
        if (ratio > PINCH_RELEASE) pinched = false;
        setStatus("Finger mode: aim with index finger, touch thumb + index to click");
      }

      if (!freeze && target) {
        pos.x += (target.x - pos.x) * SMOOTH;
        pos.y += (target.y - pos.y) * SMOOTH;
      }
      cursor.style.display = "block";
      cursor.style.left = pos.x + "px";
      cursor.style.top = pos.y + "px";

      const el = document.elementFromPoint(pos.x, pos.y); // cursor has pointer-events:none
      const zone = el?.closest("[data-scroll]");
      if (zone) {
        const dy = (zone.dataset.scroll === "up" ? -1 : 1) * SCROLL_SPEED;
        const inner = document.querySelector(".drawer-body,.modal-body"); // scroll open panel first
        inner ? inner.scrollBy(0, dy) : window.scrollBy(0, dy);
      }
      const clickable = el?.closest(CLICKABLE) || null;
      hover(clickable);
      if (wantClick) doClick(clickable || el);
    };

    (async () => {
      try {
        setStatus("Loading…");
        const [lm, s] = await Promise.all([
          getLandmarker(mode),
          navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }),
        ]);
        landmarker = lm; stream = s;
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = s;
        await video.play();
        frame();
      } catch (e) {
        setStatus("Error: " + e.message);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      hovered?.classList.remove("hf-hover");
      stream?.getTracks().forEach(t => t.stop());
      if (cursor) cursor.style.display = "none";
      if (video) video.srcObject = null;
    };
  }, [mode]);

  return (
    <>
      <div data-scroll="up" className="hf-zone up">▲</div>
      <div data-scroll="down" className="hf-zone down">▼</div>
      <div ref={cursorRef} className="hf-cursor" />
      <div className="hf-panel">
        <button className={mode === "eye" ? "on" : ""} onClick={() => setMode(mode === "eye" ? "off" : "eye")}>👁 Eye mode</button>
        <button className={mode === "finger" ? "on" : ""} onClick={() => setMode(mode === "finger" ? "off" : "finger")}>✋ Finger mode</button>
        {mode === "eye" && <button onClick={() => (recenter.current = true)}>Recenter</button>}
        <video ref={videoRef} muted playsInline style={{ display: mode === "off" ? "none" : "block" }} />
        <small>{status}</small>
      </div>
    </>
  );
}
