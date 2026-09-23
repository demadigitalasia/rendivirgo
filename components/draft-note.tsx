"use client";

import { useLanguage } from "@/components/providers";
import { dictionaries } from "@/lib/i18n";

export function DraftNote() {
  const { language } = useLanguage();
  if (language !== "id") return null;
  const note = dictionaries.id.draft;

  return (
    <div className="draft-note" role="note">
      <strong>{note.title}</strong>
      <p>{note.body}</p>
    </div>
  );
}
