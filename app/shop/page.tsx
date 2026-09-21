"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { categories, products, stoneTypes } from "@/lib/catalog";

export default function ShopPage() {
  const [category, setCategory] = useState("all");
  const [stone, setStone] = useState("all");
  const [sort, setSort] = useState("featured");
  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => (category === "all" || product.categorySlug === category) && (stone === "all" || product.stoneType === stone));
    return [...filtered].sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [category, stone, sort]);

  return (
    <>
      <section className="page-hero"><div className="page-container"><div className="eyebrow eyebrow--light">The collection</div><h1>Natural stones with a sense of place.</h1><p>Explore one-of-a-kind pieces, polished cabochons, rough material, and strands sourced from Indonesia.</p></div></section>
      <section className="page-container section">
        <div className="catalog-toolbar"><span className="muted">{visibleProducts.length} pieces in the collection</span><div className="catalog-toolbar__controls"><select className="select-control" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><select className="select-control" value={stone} onChange={(event) => setStone(event.target.value)} aria-label="Filter by stone type"><option value="all">All stone types</option>{stoneTypes.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><select className="select-control" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div></div>
        <div className="catalog-layout"><aside className="filter-panel"><h3>Browse by category</h3><div className="filter-group"><label><input type="radio" checked={category === "all"} onChange={() => setCategory("all")} /> All pieces</label>{categories.map((item) => <label key={item.slug}><input type="radio" checked={category === item.slug} onChange={() => setCategory(item.slug)} /> {item.name}</label>)}</div></aside><div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state">No pieces match these filters.</div>}</div></div>
      </section>
    </>
  );
}
