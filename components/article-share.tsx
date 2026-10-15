"use client";

import { useState } from "react";

export function ArticleShare({ title }: { title: string }) {
  const [message, setMessage] = useState("");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied");
    } catch {
      setMessage("Copy this page link to share it.");
    }
    window.setTimeout(() => setMessage(""), 2500);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <div className="article-share">
      <button type="button" className="button button--outline button--compact" onClick={share}>
        Share this guide
      </button>
      <button type="button" className="text-button" onClick={copy}>
        Copy link
      </button>
      {message ? (
        <span className="article-share__note" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
