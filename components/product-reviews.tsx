"use client";

import { useCallback, useEffect, useState } from "react";
import { useCopy } from "@/components/providers";

type Review = {
  id: string;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
};

type ReviewPayload = {
  items: Review[];
  total: number;
  page: number;
  pageCount: number;
  summary: { rating: number; count: number };
};

const Stars = ({ rating, label }: { rating: number; label?: string }) => (
  <span className="review-stars" aria-label={label} role={label ? "img" : undefined}>
    {[1, 2, 3, 4, 5].map((value) => (
      <span key={value} aria-hidden="true" className={value <= Math.round(rating) ? "is-filled" : ""}>
        ★
      </span>
    ))}
  </span>
);

export function ProductReviews({ slug }: { slug: string }) {
  const t = useCopy();
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page: number, append: boolean) => {
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews?page=${page}&pageSize=5`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          setLoading(false);
          return;
        }
        const data = (await response.json()) as ReviewPayload;
        setPayload((current) =>
          append && current ? { ...data, items: [...current.items, ...data.items] } : data,
        );
      } catch {
        // Leave the current state; the empty state covers the first load.
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    setPayload(null);
    setLoading(true);
    void load(1, false);
  }, [load]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string | string[] };
      if (!response.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
        setError(message ?? t.reviews.error);
        return;
      }
      setSubmitted(true);
      setName("");
      setEmail("");
      setTitle("");
      setBody("");
      setRating(5);
    } catch {
      setError(t.reviews.error);
    } finally {
      setSubmitting(false);
    }
  };

  const summary = payload?.summary;

  return (
    <section className="page-container product-reviews" aria-label={t.reviews.title}>
      <div className="section-heading">
        <h2>{t.reviews.title}</h2>
      </div>

      {summary && summary.count > 0 ? (
        <div className="review-summary">
          <Stars rating={summary.rating} label={t.reviews.ratingLabel(summary.rating, summary.count)} />
          <strong>{summary.rating.toFixed(1)}</strong>
          <span className="muted">{t.reviews.basedOn(summary.count)}</span>
        </div>
      ) : null}

      {payload?.items.length ? (
        <ul className="review-list">
          {payload.items.map((review) => (
            <li key={review.id} className="review-item">
              <div className="review-item__head">
                <Stars rating={review.rating} label={t.reviews.stars(review.rating)} />
                <strong>{review.title || review.name}</strong>
                <span className="muted">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              <p>{review.body}</p>
              <div className="review-item__meta">
                <span className="muted">{review.name}</span>
                {review.verifiedPurchase ? <span className="review-verified">{t.reviews.verified}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="muted">{t.reviews.empty}</p>
      ) : null}

      {payload && payload.page < payload.pageCount ? (
        <button
          type="button"
          className="text-button"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            void load(payload.page + 1, true);
          }}
        >
          {loadingMore ? t.reviews.loadingMore : t.reviews.showMore}
        </button>
      ) : null}

      <div className="review-form-wrap">
        <h3>{t.reviews.formTitle}</h3>
        {submitted ? (
          <p className="form-status form-status--success" role="status">
            {t.reviews.pending}
          </p>
        ) : (
          <form className="review-form" onSubmit={submit}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="review-name">{t.reviews.name}</label>
                <input id="review-name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="review-email">{t.reviews.email}</label>
                <input id="review-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="review-rating">{t.reviews.rating}</label>
                <select id="review-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} ★
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="review-title">{t.reviews.titleLabel}</label>
                <input id="review-title" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="review-body">{t.reviews.body}</label>
              <textarea id="review-body" required minLength={4} maxLength={4000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
            </div>
            {error ? (
              <p className="form-status form-status--error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? t.reviews.submitting : t.reviews.submit}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
