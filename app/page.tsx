import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductArt } from "@/components/product-art";
import { products, stoneTypes } from "@/lib/catalog";

export default function HomePage() {
  const featured = products.filter((product) => product.featured).slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="page-container hero__inner">
          <div className="hero__copy">
            <div className="eyebrow eyebrow--light">Natural beauty · Timeless value</div>
            <h1>Explore the Collection</h1>
            <p>Rare semi-precious stones from Indonesia, selected for collectors, makers, and quiet moments of wonder.</p>
            <div className="hero__actions"><Link href="/shop" className="button button--light">Explore the Collection <ArrowIcon /></Link></div>
          </div>
          <div className="hero__side-note">Indonesian<br />stones<br />a brighter<br />tomorrow</div>
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="owner-banner">
          <div className="owner-banner__portrait"><img src="/images/rendi-virgo-owner.png" alt="Indonesian stone collector examining a polished moss agate" /></div>
          <div className="owner-banner__copy">
            <div className="eyebrow">The owner&apos;s note</div>
            <h2>Meet RENDI VIRGO</h2>
            <p>A lifelong passion for Indonesia&apos;s natural treasures. RENDI VIRGO is dedicated to sharing the beauty and authenticity of our local stones with the world.</p>
          </div>
          <div className="owner-banner__quote">From Indonesia<br />to the World</div>
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="section-heading"><h2>Featured Categories</h2></div>
        <div className="category-grid">
          {stoneTypes.map((stone) => <Link className="category-tile" key={stone.slug} href={`/shop?stone=${stone.name}`}><span>{stone.name}</span></Link>)}
        </div>
      </section>

      <section className="page-container section--tight">
        <div className="section-heading"><h2>Featured Stones</h2></div>
        <div className="product-grid">{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        <div style={{ marginTop: 28, textAlign: "center" }}><Link href="/shop" className="button button--outline">View all stones <ArrowIcon /></Link></div>
      </section>

      <section className="page-container trust-bar" aria-label="Store promises">
        <div className="trust-item"><span>◊</span><span>Authentic Indonesian Stones</span></div>
        <div className="trust-item"><span>◎</span><span>Worldwide Shipping</span></div>
        <div className="trust-item"><span>✦</span><span>Selected with care</span></div>
      </section>
    </>
  );
}
