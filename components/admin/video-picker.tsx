"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "./api";
import { toast } from "./toast";
import { Button, Modal } from "./ui";

type VideoAsset = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: string;
};

export function VideoPicker({
  value,
  onChange,
  folder = "products",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<VideoAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    if (!libraryOpen) return;
    setLibraryLoading(true);
    apiFetch<VideoAsset[]>(`/api/admin/uploads?folder=${folder}`)
      .then((assets) => setLibrary(assets.filter((asset) => asset.mimeType === "video/mp4")))
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLibraryLoading(false));
  }, [libraryOpen, folder]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.error("Video must be 30 MB or smaller");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const asset = await apiFetch<VideoAsset>(`/api/admin/uploads/video?folder=${folder}`, {
        method: "POST",
        body: form,
      });
      onChange(asset.url);
      toast.success("Video uploaded");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rv-stack">
      <div className="rv-inline" style={{ justifyContent: "space-between" }}>
        <span className="rv-label">Square product video (optional)</span>
        <div className="rv-inline">
          <Button size="sm" onClick={() => setLibraryOpen(true)}>Video library</Button>
          <Button size="sm" variant="primary" loading={uploading} onClick={() => inputRef.current?.click()}>
            Upload video
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,.mp4"
        hidden
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <p className="rv-hint">MP4, up to 30 MB. Square (1:1) video recommended.</p>
      {value ? (
        <div className="rv-video-picker__preview">
          <video controls playsInline preload="metadata" aria-label="Product video preview">
            <source src={value} type="video/mp4" />
            Your browser does not support the video player.
          </video>
          <Button size="sm" onClick={() => onChange(null)}>Remove video</Button>
        </div>
      ) : null}

      <Modal open={libraryOpen} title="Video library" onClose={() => setLibraryOpen(false)} wide>
        {libraryLoading ? (
          <p className="rv-hint">Loading…</p>
        ) : library.length ? (
          <div className="rv-media-grid">
            {library.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="rv-media-item rv-video-picker__library-item"
                onClick={() => {
                  onChange(asset.url);
                  setLibraryOpen(false);
                }}
              >
                <video muted playsInline preload="metadata" aria-label={asset.originalName}>
                  <source src={asset.url} type="video/mp4" />
                </video>
                <span className="rv-media-item__tag">{asset.originalName}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rv-hint">No videos uploaded yet.</p>
        )}
      </Modal>
    </div>
  );
}
