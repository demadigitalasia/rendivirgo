import Link from "next/link";
import { blogPosts } from "@/lib/catalog";

export default function BlogPage() {
  return <div className="page-container content-page"><div className="content-page__intro"><div className="eyebrow">The journal</div><h1>Notes from the collection.</h1><p>Practical guidance, sourcing stories, and small observations for anyone who enjoys natural stones.</p></div><div className="blog-grid">{blogPosts.map((post) => <Link href={`/blog/${post.slug}`} className="blog-card" key={post.slug}><div className="eyebrow eyebrow--light">{post.category}</div><h2>{post.title}</h2><p>{post.excerpt}</p><div className="blog-card__date">{post.date}</div></Link>)}</div></div>;
}
