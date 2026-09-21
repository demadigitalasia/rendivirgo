import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__grid">
        <div className="site-footer__brand">
          <div className="footer-logo-plate"><img src="/brand/rendi-virgo-logo-black-silver.png" alt="RENDI VIRGO" /></div>
          <p>Rare natural stones from Indonesia, carefully selected for collectors and makers around the world.</p>
        </div>
        <div><span className="footer-label">Explore</span><Link href="/">Home</Link><Link href="/shop">Shop</Link><Link href="/about-us">About Us</Link><Link href="/blog">Journal</Link></div>
        <div><span className="footer-label">Help</span><Link href="/faq">FAQ</Link><Link href="/shipping-returns">Shipping & Returns</Link><Link href="/contact">Contact</Link></div>
        <div><span className="footer-label">Follow</span><a href="#instagram">Instagram</a><a href="#pinterest">Pinterest</a><a href="mailto:hello@rendivirgo.com">hello@rendivirgo.com</a></div>
      </div>
      <div className="page-container site-footer__bottom"><span>© 2026 RENDI VIRGO</span><span>From Indonesia to the world</span><span><Link href="/privacy-policy">Privacy</Link> · <Link href="/terms-conditions">Terms</Link></span></div>
    </footer>
  );
}
