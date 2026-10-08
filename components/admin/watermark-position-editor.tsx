"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

type Props = {
  logo: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  onChange: (x: number, y: number) => void;
};

export function WatermarkPositionEditor({ logo, x, y, size, opacity, onChange }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const moveTo = (clientX: number, clientY: number, mark: HTMLDivElement) => {
    const stage = stageRef.current;
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const maxX = Math.max(0, stageRect.width - markRect.width);
    const maxY = Math.max(0, stageRect.height - markRect.height);
    const left = Math.min(maxX, Math.max(0, clientX - stageRect.left - dragOffset.current.x));
    const top = Math.min(maxY, Math.max(0, clientY - stageRect.top - dragOffset.current.y));

    onChange(
      Math.round((left / stageRect.width) * 100),
      Math.round((top / stageRect.height) * 100),
    );
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const markRect = event.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - markRect.left,
      y: event.clientY - markRect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moveTo(event.clientX, event.clientY, event.currentTarget);
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1;
    let nextX = x;
    let nextY = y;
    if (event.key === "ArrowLeft") nextX -= step;
    else if (event.key === "ArrowRight") nextX += step;
    else if (event.key === "ArrowUp") nextY -= step;
    else if (event.key === "ArrowDown") nextY += step;
    else return;
    event.preventDefault();
    onChange(
      Math.min(100 - size, Math.max(0, nextX)),
      Math.min(100 - size / 3, Math.max(0, nextY)),
    );
  };

  return (
    <div className="rv-watermark-position-editor">
      <div className="rv-watermark-position-editor__stage" ref={stageRef}>
        <Image
          src="/images/rendi-virgo-hero-stones.webp"
          alt=""
          fill
          sizes="(max-width: 700px) 90vw, 400px"
          priority
        />
        {logo ? (
          <div
            className="rv-watermark-position-editor__mark"
            style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, opacity }}
            role="button"
            tabIndex={0}
            aria-label={`Watermark position: X ${x} percent, Y ${y} percent. Drag to move; use arrow keys for fine adjustment.`}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onKeyDown={nudge}
          >
            <Image src={logo} alt="" width={600} height={200} unoptimized draggable={false} />
          </div>
        ) : null}
      </div>
      <p className="rv-hint">Drag the logo to position it. Use the arrow keys for precise movement.</p>
    </div>
  );
}
