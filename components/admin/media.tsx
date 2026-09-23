"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "./api";
import { toast } from "./toast";
import { Button, Modal } from "./ui";

export type MediaAsset = {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  folder: string;
  createdAt: string;
};

export function MediaPicker({
  value,
  onChange,
  folder = "products",
  multiple = true,
  label = "Images",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  multiple?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    if (!libraryOpen) return;
    setLibraryLoading(true);
    apiFetch<MediaAsset[]>(`/api/admin/uploads?folder=${folder}`)
      .then(setLibrary)
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => setLibraryLoading(false));
  }, [libraryOpen, folder]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const asset = await apiFetch<MediaAsset>(`/api/admin/uploads?folder=${folder}`, { method: "POST", body: form });
        uploaded.push(asset.url);
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded.slice(0, 1));
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const addFromLibrary = (asset: MediaAsset) => {
    if (multiple) {
      if (!value.includes(asset.url)) onChange([...value, asset.url]);
    } else {
      onChange([asset.url]);
      setLibraryOpen(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...value];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="rv-stack">
      <div className="rv-inline" style={{ justifyContent: "space-between" }}>
        <span className="rv-label">{label}</span>
        <div className="rv-inline">
          <Button size="sm" onClick={() => setLibraryOpen(true)}>
            Library
          </Button>
          <Button size="sm" variant="primary" loading={uploading} onClick={() => inputRef.current?.click()}>
            Upload
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(event) => upload(event.target.files)}
      />

      {value.length ? (
        <div className="rv-media-grid">
          {value.map((url, index) => (
            <div className="rv-media-item" key={`${url}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              <button className="rv-media-item__remove" type="button" aria-label="Remove image" onClick={() => onChange(value.filter((_, position) => position !== index))}>
                ×
              </button>
              {multiple && value.length > 1 ? (
                <>
                  {index > 0 ? (
                    <button
                      className="rv-media-item__tag"
                      style={{ left: 6, bottom: 30 }}
                      type="button"
                      onClick={() => move(index, -1)}
                    >
                      ←
                    </button>
                  ) : null}
                  {index < value.length - 1 ? (
                    <button className="rv-media-item__tag" type="button" onClick={() => move(index, 1)}>
                      →
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rv-upload-zone" onClick={() => inputRef.current?.click()} role="button" tabIndex={0}>
          <strong>Drop images or click to upload</strong>
          <span className="rv-hint">JPEG, PNG, WebP, GIF, AVIF up to 8 MB</span>
        </div>
      )}

      <Modal open={libraryOpen} title="Media library" onClose={() => setLibraryOpen(false)} wide>
        {libraryLoading ? (
          <p className="rv-hint">Loading…</p>
        ) : library.length ? (
          <div className="rv-media-grid">
            {library.map((asset) => (
              <button key={asset.id} type="button" className="rv-media-item" onClick={() => addFromLibrary(asset)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.originalName} />
                <span className="rv-media-item__tag">{asset.folder}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rv-hint">No media uploaded yet. Upload from the product form.</p>
        )}
      </Modal>
    </div>
  );
}
