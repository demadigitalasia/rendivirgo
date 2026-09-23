import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-container content-page">
      <div className="eyebrow">404</div>
      <h1>This piece is not here.</h1>
      <p className="muted" style={{ margin: "18px 0 26px" }}>
        The page or stone you are looking for may have moved into a private collection.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/" className="button">
          Return home
        </Link>
        <Link href="/shop" className="button button--outline">
          Browse the collection
        </Link>
      </div>
    </div>
  );
}
