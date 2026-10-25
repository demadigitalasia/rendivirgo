"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import Image from "next/image";
import type { ModelViewerElement } from "@google/model-viewer";
import type { Language } from "@/lib/i18n";
import { cabochonShapes as SHAPE_INFO, cabochonAssetVersion, type CabochonShape } from "@/lib/lapidary-shapes";
export type { CabochonShape } from "@/lib/lapidary-shapes";

import { domeModel } from "@/lib/cabochon-dome";

const DEFAULT_ORBIT = "30deg 75deg 105%";

export function Cabochon3DPreview({ shape, language, onClose, matchedPair = false, domeHeight, domeProfile = "Medium" }: { shape: CabochonShape; language: Language; onClose: () => void; matchedPair?: boolean; domeHeight?: number; domeProfile?: string }) {
  const t = (en: string, id: string) => language === "id" ? id : en;
  const info = SHAPE_INFO[shape];
  const assetVersion = cabochonAssetVersion(shape);
  const model = matchedPair ? `/models/lapidary/${shape}-v1/matched-pair-v1.glb` : `/models/lapidary/${shape}-v1/${shape}.glb?v=${assetVersion}`;
  const savedCamera = useRef<{ orbit: string; target: string; fov: string } | null>(null);
  const fixedTarget = useRef<string | null>(null);
  function captureCamera() {
    const element = viewer.current;
    if (!element?.loaded) return;
    const orbit = element.getCameraOrbit(), target = element.getCameraTarget();
    savedCamera.current = { orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`, target: fixedTarget.current ?? `${target.x}m ${target.y}m ${target.z}m`, fov: `${element.getFieldOfView()}deg` };
  }
  // model-viewer loads asynchronously and may retain sources in its loader cache.
  // Keep generated URLs valid for the entire mounted preview, including retries.
  const modelUrls = useRef(new Set<string>());
  useEffect(() => () => {
    for (const url of modelUrls.current) URL.revokeObjectURL(url);
    modelUrls.current.clear();
  }, []);
  const [deformed, setDeformed] = useState<string | null>(null);
  useEffect(() => {
    if (!domeHeight) { captureCamera(); setDeformed(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => { domeModel(model, domeHeight, domeProfile, controller.signal).then(blob => { if (!controller.signal.aborted) { const url = URL.createObjectURL(blob); modelUrls.current.add(url); captureCamera(); setDeformed(url); } }).catch(() => { if (!controller.signal.aborted) setFailed(true); }); }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [model, domeHeight, domeProfile]);
  const poster = matchedPair ? `/models/lapidary/${shape}-v1/matched-pair-poster-v1.png` : `/models/lapidary/${shape}-v1/poster-v${assetVersion}.png`;
  const viewer = useRef<ModelViewerElement | null>(null);
  const [registered, setRegistered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const bindViewer = useCallback((node: HTMLElement | null) => { viewer.current = node as ModelViewerElement | null; }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setLoaded(false);
    const ready = customElements.get("model-viewer") ? Promise.resolve() : import("@google/model-viewer");
    ready.then(() => { if (active) setRegistered(true); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!registered || failed) return;
    const element = viewer.current;
    if (!element) return;
    const onLoad = () => {
      const camera = savedCamera.current;
      if (camera) {
        element.cameraOrbit = camera.orbit;
        element.cameraTarget = camera.target;
        element.fieldOfView = camera.fov;
        element.requestUpdate("cameraOrbit");
        element.requestUpdate("cameraTarget");
        element.requestUpdate("fieldOfView");
        element.jumpCameraToGoal();
      }
      if (!fixedTarget.current) { const target = element.getCameraTarget(); fixedTarget.current = `${target.x}m ${target.y}m ${target.z}m`; }
      setLoaded(true);
    };
    const onError = () => { setLoaded(false); setFailed(true); };
    element.addEventListener("load", onLoad);
    element.addEventListener("error", onError);
    if (element.loaded) setLoaded(true);
    return () => {
      element.removeEventListener("load", onLoad);
      element.removeEventListener("error", onError);
    };
  }, [registered, failed, attempt, deformed, model]);

  function angle(orbit: string) {
    if (!viewer.current || !loaded) return;
    viewer.current.cameraOrbit = orbit;
    viewer.current.cameraTarget = fixedTarget.current ?? "auto auto auto";
    // Drag and zoom do not change the declarative cameraOrbit property.
    // Reapply it even when a preset is clicked a second time.
    viewer.current.requestUpdate("cameraOrbit");
  }

  function reset() {
    angle(DEFAULT_ORBIT);
    if (viewer.current) {
      viewer.current.fieldOfView = "30deg";
      viewer.current.requestUpdate("fieldOfView");
    }
  }

  function retry() {
    setRegistered(false);
    setFailed(false);
    setLoaded(false);
    setAttempt((value) => value + 1);
  }

  return <section className="lapidary-oval-preview" aria-label={t(`Interactive ${info.en}${matchedPair ? " matched pair" : " cabochon"} preview`, `Preview ${info.id}${matchedPair ? " sepasang" : " cabochon"} interaktif`)}>
    <header className="lapidary-oval-preview__heading">
      <div><p>{t("EXPLORE THE SHAPE", "JELAJAHI BENTUKNYA")}</p><h4>{t(`${info.en}${matchedPair ? " matched pair" : ""}, from every angle`, `${info.id}${matchedPair ? " sepasang" : ""}, dari setiap sisi`)}</h4></div>
      <button type="button" className="lapidary-oval-preview__close" onClick={onClose} aria-label={t("Close 3D preview", "Tutup preview 3D")}>×</button>
    </header>
    <div className="lapidary-oval-preview__stage" aria-busy={!loaded && !failed}>
      {!registered || failed ? <Image className="lapidary-oval-preview__poster" src={poster} alt={t(`Green ${info.en.toLowerCase()} cabochon with a domed face and a flat back`, `Cabochon ${info.id.toLowerCase()} hijau dengan permukaan berkubah dan bagian belakang datar`)} fill sizes="(max-width: 620px) 85vw, 600px" /> : createElement("model-viewer", {
        key: attempt,
        ref: bindViewer,
        src: deformed ?? model,
        poster,
        alt: t(`${info.en}${matchedPair ? " matched pair" : " cabochon"}. Drag to rotate, pinch or use the zoom buttons to zoom. Arrow keys rotate the model.`, `${matchedPair ? "Sepasang cabochon" : "Cabochon"} ${info.id}. Geser untuk memutar, cubit atau gunakan tombol zoom untuk memperbesar. Tombol panah memutar model.`),
        "camera-controls": "",
        "disable-pan": "",
        "disable-tap": "",
        "touch-action": "pan-y",
        "interaction-prompt": "none",
        "camera-orbit": DEFAULT_ORBIT,
        "min-camera-orbit": "auto 0deg auto",
        "max-camera-orbit": "auto 180deg auto",
        "field-of-view": "30deg",
        "min-field-of-view": "15deg",
        "max-field-of-view": "45deg",
        "environment-image": "neutral",
        exposure: "1",
        "shadow-intensity": "0",
        loading: "eager",
        reveal: "auto",
        style: { width: "100%", height: "100%", backgroundColor: "transparent" },
      })}
      {!loaded && !failed ? <p className="lapidary-oval-preview__status" role="status">{t("Loading interactive model…", "Memuat model interaktif…")}</p> : null}
      {loaded ? <span className="lapidary-oval-preview__badge">360°</span> : null}
    </div>
    {failed ? <div className="lapidary-oval-preview__fallback" role="status"><p>{t("The 3D preview could not load. You can still use the image to review the shape.", "Preview 3D belum dapat dimuat. Gambar tetap dapat digunakan untuk melihat bentuk.")}</p><button type="button" onClick={retry}>{t("Try again", "Coba lagi")}</button></div> : null}
    <div className="lapidary-oval-preview__controls" aria-label={t("3D view controls", "Kontrol tampilan 3D")}>
      <div>{([
        ["0deg 90deg 105%", t("Front", "Depan")],
        ["90deg 90deg 105%", t("Side", "Samping")],
        ["180deg 90deg 105%", t("Back", "Belakang")],
      ] as const).map(([orbit, label]) => <button type="button" key={label} onClick={() => angle(orbit)} disabled={!loaded}>{label}</button>)}</div>
      <div><button type="button" onClick={() => viewer.current?.zoom(0.5)} disabled={!loaded} aria-label={t("Zoom in", "Perbesar")}>＋</button><button type="button" onClick={() => viewer.current?.zoom(-0.5)} disabled={!loaded} aria-label={t("Zoom out", "Perkecil")}>−</button><button type="button" onClick={reset} disabled={!loaded}>{t("Reset", "Reset")}</button></div>
    </div>
    <p className="lapidary-oval-preview__hint">{t("Drag to rotate · Pinch or use + / − to zoom", "Geser untuk memutar · Cubit atau gunakan + / − untuk zoom")}</p>
    {domeHeight ? <p className="lapidary-oval-preview__hint">{t(`Requested dome: ${domeHeight} mm above girdle · ${domeProfile}`, `Target dome: ${domeHeight} mm di atas girdle · ${domeProfile}`)}</p> : null}
    <footer className="lapidary-oval-preview__facts"><span>{t("Domed face", "Permukaan berkubah")}</span><span>{t("Flat back", "Belakang datar")}</span><span>{t(`Example${matchedPair ? " per cabochon" : ""}: ${info.dimensions}`, `Contoh${matchedPair ? " per batu" : ""}: ${info.dimensions}`)}</span></footer>
  </section>;
}

export const OvalCabochonPreview = (props: Omit<ComponentProps<typeof Cabochon3DPreview>, "shape">) => <Cabochon3DPreview {...props} shape="oval" />;
