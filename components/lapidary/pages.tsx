import { LocalizedLink } from "@/components/localized-link";
import type { LapidaryArtistProfile, LapidaryArtistsPresentation, LapidaryStudioImage, LapidaryStudioPresentation } from "@/lib/storefront";
import type { LapidaryProcessPresentation } from "@/lib/lapidary-process";
import type { Language } from "@/lib/i18n";
import { CustomOrderForm } from "./custom-order-form";

const copy = {
  en: {
    home: {
      eyebrow: "LAPIDARY · RENDI VIRGO",
      title: "A stone, shaped with intention.",
      body: "From considered cuts to careful finishing, explore the people, place, and standards behind our lapidary work.",
      cta: "Start a custom request",
      note: "Made to order · Studio review before any work begins",
      cards: [
        ["01 / BEGIN A PROJECT", "Custom Order", "Tell us about your stone, the cut you have in mind, and the finish you need.", "/lapidary/custom-order", "Request a quote"],
        ["02 / THE WORKROOM", "Our Studio", "Learn how our studio approaches each stone and see the workroom as its gallery grows.", "/lapidary/studio", "Explore the studio"],
        ["03 / THE HANDS BEHIND THE CUT", "Meet the Artists", "Meet the cutters who bring practical skill and a careful eye to each piece.", "/lapidary/artists", "Meet our artists"],
        ["04 / HOW WE WORK", "Our Craft Standards", "A clear look at assessment, cutting, finishing, and quality review.", "/lapidary/process", "Read our standards"],
      ],
      processTitle: "A considered process",
      process: ["Share your brief", "We review the stone and scope", "You approve a written quote", "The studio begins the work"],
    },
    sub: { back: "Lapidary", estimate: "Every project is reviewed individually. Pricing and timing are confirmed in a written quote before work begins.", contact: "Questions before you start?" },
    studio: {
      eyebrow: "THE WORKROOM", title: "Our Lapidary Studio", body: "A focused workspace for turning natural material into considered forms. Each project begins with understanding the stone, its structure, and what you want it to become.", gallery: "Inside the studio", empty: "Studio photographs are being prepared. Contact us if you would like to see examples relevant to your project.", photoCount: "STUDIO VIEWS", cta: "Start a custom request", approach: "A material-first practice", points: ["Read the material before choosing a cut", "Discuss risks and natural inclusions openly", "Agree on scope and finish before work begins"],
    },
    artists: {
      craft: "FULL-PROCESS PRACTICE", style: "Signature approach", stones: "Stones they know", experience: "Experience", location: "Based in", viewProfile: "Meet the artist",
      sampleNotice: "Preview only: these five profiles and portraits are sample content. Replace them with approved artist information in the admin dashboard.", sampleBadge: "SAMPLE PROFILE",
      directoryEyebrow: "THE PEOPLE BEHIND THE CUT", directoryTitle: "Meet the artists.", directoryIntro: "Each brings the same full-process skill and a distinct eye for stone.", directoryCount: "ARTISTS",
    },
  },
  id: {
    home: {
      eyebrow: "LAPIDARY · RENDI VIRGO",
      title: "Batu dibentuk dengan penuh pertimbangan.",
      body: "Dari pemotongan yang terukur hingga pemolesan yang cermat, kenali para pengrajin, studio, dan standar di balik layanan lapidary kami.",
      cta: "Mulai permintaan custom",
      note: "Dibuat sesuai pesanan · Ditinjau studio sebelum pengerjaan",
      cards: [
        ["01 / MULAI PROYEK", "Pesanan Custom", "Ceritakan batu Anda, bentuk yang diinginkan, dan hasil akhir yang dibutuhkan.", "/lapidary/custom-order", "Minta penawaran"],
        ["02 / RUANG KERJA", "Studio Kami", "Kenali pendekatan studio kami terhadap setiap batu dan lihat galeri yang terus berkembang.", "/lapidary/studio", "Jelajahi studio"],
        ["03 / PENGRAJIN DI BALIK POTONGAN", "Kenali Pengrajin", "Kenali para pemotong batu dengan keterampilan dan ketelitian dalam setiap karya.", "/lapidary/artists", "Kenali pengrajin"],
        ["04 / CARA KAMI BEKERJA", "Standar Pengerjaan", "Lihat proses penilaian, pemotongan, pemolesan, dan pemeriksaan kualitas.", "/lapidary/process", "Baca standar kami"],
      ],
      processTitle: "Proses yang terukur",
      process: ["Kirimkan brief", "Kami meninjau batu dan lingkup kerja", "Anda menyetujui penawaran tertulis", "Studio memulai pengerjaan"],
    },
    sub: { back: "Lapidary", estimate: "Setiap proyek ditinjau secara individual. Harga dan waktu pengerjaan akan dikonfirmasi melalui penawaran tertulis sebelum proses dimulai.", contact: "Ada pertanyaan sebelum memulai?" },
    studio: {
      eyebrow: "RUANG KERJA", title: "Studio Lapidary Kami", body: "Ruang kerja khusus untuk membentuk material alami menjadi bentuk yang terukur. Setiap proyek dimulai dengan memahami karakter batu dan tujuan bentuk akhirnya.", gallery: "Suasana studio", empty: "Foto studio sedang disiapkan. Hubungi kami jika Anda ingin melihat contoh yang sesuai dengan proyek Anda.", photoCount: "SUASANA STUDIO", cta: "Mulai permintaan custom", approach: "Pengerjaan yang berawal dari material", points: ["Memahami material sebelum memilih potongan", "Membahas risiko dan inklusi alami secara terbuka", "Menyepakati ruang lingkup dan hasil akhir sebelum mulai"],
    },
    artists: {
      craft: "PENGERJAAN MENYELURUH", style: "Pendekatan khas", stones: "Jenis batu yang dikenal", experience: "Pengalaman", location: "Berbasis di", viewProfile: "Kenali pengrajin",
      sampleNotice: "Hanya pratinjau: lima profil dan foto ini adalah data contoh. Ganti dengan informasi pengrajin yang sudah disetujui melalui dashboard admin.", sampleBadge: "PROFIL CONTOH",
      directoryEyebrow: "PARA PENGRAJIN DI BALIK SETIAP POTONGAN", directoryTitle: "Kenali para artis.", directoryIntro: "Keahlian menyeluruh yang sama, dengan gaya dan pemahaman batu yang khas.", directoryCount: "ARTIS",
    },
  },
} as const;

type PageLanguage = keyof typeof copy;

const lapidaryPathIcons = [
  "/images/lapidary/icons/custom-order.png",
  "/images/lapidary/icons/studio.png",
  "/images/lapidary/icons/artists.png",
  "/images/lapidary/icons/craft-standards.png",
] as const;

function LapidaryPathIcon({ index }: { index: number }) {
  const src = lapidaryPathIcons[index] ?? lapidaryPathIcons[0];
  return <img src={src} alt="" width={48} height={48} loading="lazy" decoding="async" />;
}

function SubpageHeader({ language, eyebrow, title, body }: { language: Language; eyebrow: string; title: string; body: string }) {
  const text = copy[language as PageLanguage].sub;
  return (
    <header className="lapidary-subhead">
      <LocalizedLink href="/lapidary" className="lapidary-back">← {text.back}</LocalizedLink>
      <p className="lapidary-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lapidary-lede">{body}</p>
      <p className="lapidary-subhead__contact">{text.contact} <LocalizedLink href="/contact">{language === "id" ? "Hubungi kami ↗" : "Get in touch ↗"}</LocalizedLink></p>
    </header>
  );
}

export function LapidaryLanding({ language }: { language: Language }) {
  const text = copy[language as PageLanguage].home;
  return (
    <div className="lapidary-page">
      <section className="lapidary-hero page-container">
        <div className="lapidary-hero__copy">
          <p className="lapidary-eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="lapidary-lede">{text.body}</p>
          <LocalizedLink className="lapidary-button" href="/lapidary/custom-order">{text.cta}<span aria-hidden="true">↗</span></LocalizedLink>
          <p className="lapidary-hero__note">{text.note}</p>
        </div>
        <figure className="lapidary-hero__visual">
          <img
            className="lapidary-hero__image"
            src="/images/lapidary/lapidary-bench-polishing.webp"
            alt={language === "id" ? "Tangan pengrajin memoles cabochon moss agate menggunakan roda poles" : "An artisan's hands polish a moss-agate cabochon at the wheel"}
            width={1254}
            height={1254}
            fetchPriority="high"
          />
          <figcaption><span>{language === "id" ? "PROSES" : "PROCESS"}</span>{language === "id" ? "PEMOLESAN MANUAL" : "FINISHED BY HAND"}</figcaption>
        </figure>
      </section>

      <section className="lapidary-intro page-container">
        <div><p className="lapidary-eyebrow">{language === "id" ? "PILIH JALUR" : "CHOOSE YOUR PATH"}</p><h2>{language === "id" ? "Dari brief hingga hasil akhir." : "From first brief to final form."}</h2></div>
        <p>{language === "id" ? "Pilih jalur yang sesuai. Untuk pesanan custom, sampaikan detail proyek. Untuk memahami layanan kami, jelajahi studio, pengrajin, dan standar pengerjaan." : "Choose the path that fits. Share the details of a custom project, or explore the studio, the artists, and the standards that guide our work."}</p>
      </section>

      <section className="lapidary-card-grid page-container" aria-label={language === "id" ? "Pilihan layanan lapidary" : "Lapidary services"}>
        {text.cards.map(([eyebrow, title, body, href, action], index) => (
          <LocalizedLink className="lapidary-path-card" href={href} key={href}>
            <div className="lapidary-path-card__mark" aria-hidden="true"><LapidaryPathIcon index={index} /></div>
            <div className="lapidary-path-card__body"><div><p className="lapidary-path-card__eyebrow">{eyebrow}</p><h2>{title}</h2><p>{body}</p></div><span className="lapidary-card-link">{action}<span aria-hidden="true">↗</span></span></div>
          </LocalizedLink>
        ))}
      </section>

      <section className="lapidary-process page-container">
        <p className="lapidary-eyebrow">{language === "id" ? "LANGKAH BERIKUTNYA" : "WHAT HAPPENS NEXT"}</p>
        <h2>{text.processTitle}</h2>
        <ol>{text.process.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}</li>)}</ol>
      </section>
    </div>
  );
}

export function LapidaryCustomOrder({ language }: { language: Language }) {
  const en = language === "en";
  return (
    <div className="lapidary-page page-container">
      <SubpageHeader language={language} eyebrow={en ? "CUSTOM LAPIDARY" : "LAPIDARY CUSTOM"} title={en ? "Tell us what you have in mind." : "Ceritakan rencana pengerjaan Anda."} body={en ? "Share the stone, the shape, and the finish you are looking for. Our studio will review the brief and send a quote before any work begins." : "Ceritakan tentang batu, bentuk, dan hasil akhir yang Anda inginkan. Studio kami akan meninjau brief dan mengirimkan penawaran sebelum pengerjaan dimulai."} />
      <div className="lapidary-order-layout">
        <CustomOrderForm language={language} />
        <aside className="lapidary-order-aside">
          <p className="lapidary-eyebrow">{en ? "A CLEAR START" : "AWAL YANG JELAS"}</p>
          <h2>{en ? "No account required." : "Tidak perlu membuat akun."}</h2>
          <p>{en ? "We will assess availability, material condition, and scope with you. No payment is taken through this request form." : "Kami akan mendiskusikan ketersediaan, kondisi material, dan lingkup pekerjaan. Formulir ini tidak menerima pembayaran."}</p>
          <ul><li>{en ? "Submit a project brief" : "Kirim brief proyek"}</li><li>{en ? "Receive a written quote" : "Terima penawaran tertulis"}</li><li>{en ? "Approve before work begins" : "Setujui sebelum pengerjaan dimulai"}</li></ul>
          <p className="lapidary-estimate-note">{copy[language as PageLanguage].sub.estimate}</p>
        </aside>
      </div>
    </div>
  );
}

export function LapidaryStudio({ language, heroImage, images, presentation }: { language: Language; heroImage: string; images: LapidaryStudioImage[]; presentation: LapidaryStudioPresentation }) {
  const text = copy[language as PageLanguage].studio;
  const title = language === "id" ? presentation.titleId : presentation.titleEn;
  const intro = language === "id" ? presentation.introId : presentation.introEn;
  const galleryTitle = language === "id" ? presentation.galleryTitleId : presentation.galleryTitleEn;
  const eyebrow = language === "id" ? presentation.eyebrowId : presentation.eyebrowEn;
  const galleryEyebrow = language === "id" ? presentation.galleryEyebrowId : presentation.galleryEyebrowEn;
  const ctaLabel = language === "id" ? presentation.ctaLabelId : presentation.ctaLabelEn;
  const approachTitle = language === "id" ? presentation.approachTitleId : presentation.approachTitleEn;
  const approachEyebrow = language === "id" ? presentation.approachEyebrowId : presentation.approachEyebrowEn;
  const approachPoints = language === "id" ? presentation.approachPointsId : presentation.approachPointsEn;
  const photoCountLabel = language === "id" ? presentation.photoCountLabelId : presentation.photoCountLabelEn;
  const backLabel = language === "id" ? presentation.backLabelId : presentation.backLabelEn;
  const ctaHref = presentation.ctaTarget === "contact" ? "/contact" : "/lapidary/custom-order";
  return (
    <div className={`lapidary-page page-container lapidary-studio lapidary-studio--${presentation.visualStyle} lapidary-studio--hero-${presentation.heroImagePosition}${presentation.motionEnabled ? " lapidary-studio--motion" : ""}`}>
      <section className="lapidary-studio-hero">
        {heroImage ? <img className="lapidary-studio-hero__image" src={heroImage} alt="" fetchPriority="high" /> : null}
        <div className="lapidary-studio-hero__content">
          <LocalizedLink href="/lapidary" className="lapidary-back">← {backLabel || copy[language as PageLanguage].sub.back}</LocalizedLink>
          <p className="lapidary-studio-hero__eyebrow"><span />{eyebrow || text.eyebrow}</p>
          <h1>{title || text.title}</h1>
          <p className="lapidary-studio-hero__intro">{intro || text.body}</p>
          <div className="lapidary-studio-hero__footer">
            <LocalizedLink className="lapidary-button" href={ctaHref}>{ctaLabel || text.cta}<span aria-hidden="true">↗</span></LocalizedLink>
            <div className="lapidary-studio-hero__count"><strong>{String(images.length).padStart(2, "0")}</strong><span>{photoCountLabel || text.photoCount}</span></div>
          </div>
        </div>
        <span className="lapidary-studio-hero__orbit" aria-hidden="true" />
      </section>

      <section className="lapidary-info-panel lapidary-studio-approach"><div><p className="lapidary-eyebrow">{approachEyebrow || (language === "id" ? "PENDEKATAN KAMI" : "OUR APPROACH")}</p><h2>{approachTitle || text.approach}</h2></div><ul>{approachPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul></section>
      <section className="lapidary-gallery lapidary-studio-gallery">
        <div className="lapidary-section-heading"><p className="lapidary-eyebrow">{galleryEyebrow || (language === "id" ? "DARI RUANG KERJA" : "A LOOK INSIDE")}</p><h2>{galleryTitle || text.gallery}</h2></div>
        {images.length ? <div className="lapidary-gallery-grid">{images.map((image, index) => <figure key={`${image.url}-${index}`}>
          <img src={image.url} alt={language === "id" ? image.altId || image.altEn : image.altEn} loading="lazy" />
          <figcaption><span>{String(index + 1).padStart(2, "0")}</span><span>{(language === "id" ? image.captionId : image.captionEn) || photoCountLabel || text.photoCount}</span></figcaption>
        </figure>)}</div> : <p className="lapidary-empty-state">{text.empty}</p>}
      </section>
    </div>
  );
}

export function LapidaryArtists({ language, artists, presentation, samplePreview = false }: { language: Language; artists: LapidaryArtistProfile[]; presentation: LapidaryArtistsPresentation; samplePreview?: boolean }) {
  const text = copy[language as PageLanguage].artists;
  const en = language !== "id";
  const value = (english: string, indonesian: string) => en ? english : indonesian;
  const emptyCtaHref = presentation.ctaTarget === "customOrder" ? "/lapidary/custom-order" : "/contact";
  return (
    <div className={`lapidary-page page-container lapidary-artists lapidary-artists--${presentation.visualStyle}${presentation.motionEnabled ? " lapidary-artists--motion" : ""}`}>
      <section className="lapidary-artists-hero">
        <img className="lapidary-artists-hero__image" src={presentation.heroImage} alt={value(presentation.heroAltEn, presentation.heroAltId)} fetchPriority="high" style={{ objectPosition: `${presentation.heroImagePosition} center` }} />
        <div className="lapidary-artists-hero__content">
          <LocalizedLink href="/lapidary" className="lapidary-back">← {language === "id" ? "Lapidary" : "Lapidary"}</LocalizedLink>
          <p className="lapidary-eyebrow lapidary-artists-hero__eyebrow"><span aria-hidden="true" />{value(presentation.eyebrowEn, presentation.eyebrowId)}</p>
          <h1>{value(presentation.titleEn, presentation.titleId)}</h1>
          <p className="lapidary-artists-hero__intro">{value(presentation.introEn, presentation.introId)}</p>
          <span className="lapidary-artists-hero__index">{String(artists.length).padStart(2, "0")} <i aria-hidden="true" /> {text.craft}</span>
        </div>
        <span className="lapidary-artists-hero__facet" aria-hidden="true" />
      </section>

      <section className="lapidary-artists-capability">
        <p className="lapidary-eyebrow">{text.craft}</p>
        <h2>{value(presentation.capabilityTitleEn, presentation.capabilityTitleId)}</h2>
        <p>{value(presentation.capabilityBodyEn, presentation.capabilityBodyId)}</p>
      </section>

      {samplePreview ? <aside className="lapidary-sample-notice" role="note">{text.sampleNotice}</aside> : null}

      {artists.length ? <>
        <header className="lapidary-artists-directory">
          <div><p className="lapidary-eyebrow">{text.directoryEyebrow}</p><h2>{text.directoryTitle}</h2><p>{text.directoryIntro}</p></div>
          <span className="lapidary-artists-directory__count"><strong>{String(artists.length).padStart(2, "0")}</strong>{text.directoryCount}</span>
        </header>
        <section className="lapidary-artists-grid" aria-label={en ? "Lapidary artists" : "Pengrajin lapidary"}>{artists.map((artist, index) => <LocalizedLink className="lapidary-artist-card" href={`/lapidary/artists/${artist.slug}`} key={artist.id} style={{ animationDelay: `${Math.min(index, 8) * 65}ms` }}>
        <div className="lapidary-artist-card__photo">{artist.imageUrl ? <img src={artist.imageUrl} alt={artist.imageAlt || artist.name} loading="lazy" style={{ objectPosition: `${artist.imagePosition} center` }} /> : <span aria-hidden="true">{artist.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>}{samplePreview ? <span className="lapidary-artist-card__sample">{text.sampleBadge}</span> : null}<span className="lapidary-artist-card__number">{String(index + 1).padStart(2, "0")}</span><span className="lapidary-artist-card__arrow" aria-hidden="true">↗</span></div>
        <div className="lapidary-artist-card__body"><p className="lapidary-eyebrow">{artist.signatureStyle || text.craft}</p><h2>{artist.name}</h2>{artist.location ? <p className="lapidary-artist-location">{text.location} · {artist.location}</p> : null}<p className="lapidary-artist-card__bio">{artist.bio}</p>{artist.stoneExperience.length ? <><strong>{text.stones}</strong><div className="lapidary-specialties">{artist.stoneExperience.map((stone) => <span key={stone}>{stone}</span>)}</div></> : null}<span className="lapidary-artist-card__link">{text.viewProfile}<span aria-hidden="true">↗</span></span></div>
      </LocalizedLink>)}</section>
      </> : <section className="lapidary-artists-empty"><p className="lapidary-eyebrow">{text.craft}</p><h2>{value(presentation.emptyTitleEn, presentation.emptyTitleId)}</h2><p>{value(presentation.emptyBodyEn, presentation.emptyBodyId)}</p><LocalizedLink className="lapidary-button" href={emptyCtaHref}>{value(presentation.ctaLabelEn, presentation.ctaLabelId)}<span aria-hidden="true">↗</span></LocalizedLink></section>}
    </div>
  );
}

export function LapidaryArtistDetail({ language, artist, presentation, samplePreview = false }: { language: Language; artist: LapidaryArtistProfile; presentation: LapidaryArtistsPresentation; samplePreview?: boolean }) {
  const en = language !== "id";
  const value = (english: string, indonesian: string) => en ? english : indonesian;
  const detailCtaHref = presentation.detailCtaTarget === "customOrder" ? "/lapidary/custom-order" : "/contact";
  return <div className={`lapidary-page page-container lapidary-artist-detail lapidary-artist-detail--${presentation.visualStyle}${presentation.motionEnabled ? " lapidary-artist-detail--motion" : ""}`}>
    <LocalizedLink href="/lapidary/artists" className="lapidary-artist-detail__back">← {en ? "All artists" : "Semua pengrajin"}</LocalizedLink>
    {samplePreview ? <aside className="lapidary-sample-notice" role="note">{en ? "Preview only: this profile and portrait are sample content. Replace them with approved artist information in the admin dashboard." : "Hanya pratinjau: profil dan foto ini adalah data contoh. Ganti dengan informasi pengrajin yang sudah disetujui melalui dashboard admin."}</aside> : null}
    <section className="lapidary-artist-detail__hero">
      <div className="lapidary-artist-detail__portrait">{artist.imageUrl ? <img src={artist.imageUrl} alt={artist.imageAlt || artist.name} fetchPriority="high" style={{ objectPosition: `${artist.imagePosition} center` }} /> : <span aria-hidden="true">{artist.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>}</div>
      <div className="lapidary-artist-detail__copy"><p className="lapidary-eyebrow">{artist.signatureStyle || (en ? "LAPIDARY ARTIST" : "PENGRAJIN LAPIDARY")}</p><h1>{artist.name}</h1>{artist.location ? <p className="lapidary-artist-location">{en ? "Based in" : "Berbasis di"} · {artist.location}</p> : null}<p className="lapidary-artist-detail__bio">{artist.bio}</p>{artist.experience ? <div className="lapidary-artist-detail__experience"><span>{en ? "EXPERIENCE" : "PENGALAMAN"}</span><p>{artist.experience}</p></div> : null}</div>
    </section>
    <section className="lapidary-artist-detail__practice"><div><p className="lapidary-eyebrow">{en ? "A SHARED PRACTICE" : "PRAKTIK BERSAMA"}</p><h2>{value(presentation.capabilityTitleEn, presentation.capabilityTitleId)}</h2></div><p>{value(presentation.capabilityBodyEn, presentation.capabilityBodyId)}</p></section>
    {artist.stoneExperience.length ? <section className="lapidary-artist-detail__stones"><p className="lapidary-eyebrow">{en ? "MATERIAL FAMILIARITY" : "PENGALAMAN MATERIAL"}</p><div>{artist.stoneExperience.map((stone) => <span key={stone}>{stone}</span>)}</div></section> : null}
    {artist.portfolioImages.length ? <section className="lapidary-artist-detail__portfolio"><div className="lapidary-section-heading"><p className="lapidary-eyebrow">{en ? "SELECTED WORK" : "KARYA PILIHAN"}</p><h2>{en ? "A closer look." : "Melihat karya lebih dekat."}</h2></div><div className="lapidary-artist-detail__gallery">{artist.portfolioImages.map((image, index) => <figure key={`${image.url}-${index}`}><img src={image.url} alt={image.altText} loading="lazy" /><figcaption><span>{String(index + 1).padStart(2, "0")}</span>{image.caption}</figcaption></figure>)}</div></section> : null}
    <section className="lapidary-artist-detail__cta"><p>{en ? "Planning a piece of your own?" : "Ingin merencanakan karya Anda?"}</p><LocalizedLink className="lapidary-button" href={detailCtaHref}>{en ? "Start a custom request" : "Mulai permintaan custom"}<span aria-hidden="true">↗</span></LocalizedLink></section>
  </div>;
}

export function LapidaryStandards({ language, presentation }: { language: Language; presentation: LapidaryProcessPresentation }) {
  const en = language !== "id";
  const value = (english: string, indonesian: string) => en ? english : indonesian;
  const ctaHref = presentation.ctaTarget === "contact" ? "/contact" : "/lapidary/custom-order";
  let stepNumber = 0;
  return (
    <div className={`lapidary-page page-container lapidary-process-page lapidary-process-page--${presentation.visualStyle} lapidary-process-page--${presentation.layout}${presentation.motionEnabled ? " lapidary-process-page--motion" : ""}`}>
      <header className="lapidary-process-hero">
        <img className="lapidary-process-hero__image" src={presentation.heroImage} alt={value(presentation.heroAltEn, presentation.heroAltId)} fetchPriority="high" style={{ objectPosition: `${presentation.heroImagePosition} center` }} />
        <div className="lapidary-process-hero__content">
          <LocalizedLink href="/lapidary" className="lapidary-process-back">← {value(presentation.backLabelEn, presentation.backLabelId)}</LocalizedLink>
          <p className="lapidary-process-eyebrow"><span aria-hidden="true" />{value(presentation.eyebrowEn, presentation.eyebrowId)}</p>
          <h1>{value(presentation.titleEn, presentation.titleId)}</h1>
          <p className="lapidary-process-hero__intro">{value(presentation.introEn, presentation.introId)}</p>
          <div className="lapidary-process-hero__meta"><strong>15</strong><span>{value(presentation.stepCountLabelEn, presentation.stepCountLabelId)}</span><i aria-hidden="true" /></div>
        </div>
        <span className="lapidary-process-hero__facet" aria-hidden="true" />
      </header>

      <nav className="lapidary-process-index" aria-label={value("Process phases", "Fase proses")}>
        {presentation.phases.map((phase, index) => <a href={`#lapidary-process-phase-${index + 1}`} key={`phase-index-${index}`}><span>0{index + 1}</span>{value(phase.titleEn, phase.titleId)}<i aria-hidden="true">↘</i></a>)}
      </nav>

      <div className="lapidary-process-phases">
        {presentation.phases.map((phase, phaseIndex) => (
          <section className="lapidary-process-phase" id={`lapidary-process-phase-${phaseIndex + 1}`} key={`phase-${phaseIndex}`}>
            <header className="lapidary-process-phase__heading">
              <span className="lapidary-process-phase__index">0{phaseIndex + 1}<i aria-hidden="true" /></span>
              <div><p className="lapidary-eyebrow">{value(presentation.phaseLabelEn, presentation.phaseLabelId)} 0{phaseIndex + 1}</p><h2>{value(phase.titleEn, phase.titleId)}</h2><p>{value(phase.introEn, phase.introId)}</p></div>
              <span className="lapidary-process-phase__range">{String(phaseIndex * 5 + 1).padStart(2, "0")} — {String((phaseIndex + 1) * 5).padStart(2, "0")}</span>
            </header>
            <ol className="lapidary-process-steps">
              {phase.steps.map((step) => {
                stepNumber += 1;
                return <li className="lapidary-process-step" key={`step-${stepNumber}`}>
                  <span className="lapidary-process-step__number">{String(stepNumber).padStart(2, "0")}</span>
                  <span className="lapidary-process-step__mark" aria-hidden="true"><i /></span>
                  <details className="lapidary-process-step__details" name={`process-phase-${phaseIndex}`}>
                    <summary className="lapidary-process-step__summary">
                      <span className="lapidary-process-step__title">{value(step.titleEn, step.titleId)}</span>
                      <span className="lapidary-process-step__toggle">
                        <span>{value(presentation.expandDetailsLabelEn, presentation.expandDetailsLabelId)}</span>
                        <span>{value(presentation.collapseDetailsLabelEn, presentation.collapseDetailsLabelId)}</span>
                      </span>
                      <span className="lapidary-process-step__chevron" aria-hidden="true" />
                    </summary>
                    <p>{value(step.bodyEn, step.bodyId)}</p>
                  </details>
                  <span className="lapidary-process-step__ordinal" aria-hidden="true">{String(stepNumber).padStart(2, "0")}</span>
                </li>;
              })}
            </ol>
          </section>
        ))}
      </div>

      <aside className="lapidary-process-note">
        <div><p className="lapidary-process-eyebrow"><span aria-hidden="true" />{value(presentation.noteEyebrowEn, presentation.noteEyebrowId)}</p><h2>{value(presentation.noteTitleEn, presentation.noteTitleId)}</h2></div>
        <p>{value(presentation.noteBodyEn, presentation.noteBodyId)}</p>
      </aside>

      <footer className="lapidary-process-footer">
        <div><p>{value(presentation.contactPromptEn, presentation.contactPromptId)}</p><LocalizedLink href="/contact">{value(presentation.contactLabelEn, presentation.contactLabelId)} ↗</LocalizedLink></div>
        <LocalizedLink className="lapidary-button" href={ctaHref}>{value(presentation.ctaLabelEn, presentation.ctaLabelId)}<span aria-hidden="true">↗</span></LocalizedLink>
      </footer>
    </div>
  );
}
