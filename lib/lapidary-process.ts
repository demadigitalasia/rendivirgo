export type LapidaryProcessStep = { titleEn: string; titleId: string; bodyEn: string; bodyId: string };
export type LapidaryProcessPhase = { titleEn: string; titleId: string; introEn: string; introId: string; steps: LapidaryProcessStep[] };
export type LapidaryProcessPresentation = {
  eyebrowEn: string; eyebrowId: string; titleEn: string; titleId: string; introEn: string; introId: string;
  phaseLabelEn: string; phaseLabelId: string; stepCountLabelEn: string; stepCountLabelId: string;
  expandDetailsLabelEn: string; expandDetailsLabelId: string; collapseDetailsLabelEn: string; collapseDetailsLabelId: string;
  heroImage: string; heroAltEn: string; heroAltId: string; heroImagePosition: "left" | "center" | "right";
  phases: LapidaryProcessPhase[];
  noteEyebrowEn: string; noteEyebrowId: string; noteTitleEn: string; noteTitleId: string; noteBodyEn: string; noteBodyId: string;
  ctaLabelEn: string; ctaLabelId: string; ctaTarget: "customOrder" | "contact";
  backLabelEn: string; backLabelId: string; contactPromptEn: string; contactPromptId: string; contactLabelEn: string; contactLabelId: string;
  metaTitleEn: string; metaTitleId: string; metaDescriptionEn: string; metaDescriptionId: string;
  visualStyle: "mineral" | "forest" | "quartz"; layout: "timeline" | "cards"; motionEnabled: boolean;
};

export const DEFAULT_LAPIDARY_PROCESS_PRESENTATION: LapidaryProcessPresentation = {
  eyebrowEn: "FROM FIRST LOOK TO FINAL FORM", eyebrowId: "DARI PEMERIKSAAN HINGGA BENTUK AKHIR",
  phaseLabelEn: "PHASE", phaseLabelId: "FASE", stepCountLabelEn: "STEPS · 3 PHASES", stepCountLabelId: "TAHAP · 3 FASE",
  expandDetailsLabelEn: "Read details", expandDetailsLabelId: "Lihat detail", collapseDetailsLabelEn: "Close details", collapseDetailsLabelId: "Tutup detail",
  titleEn: "A careful path through every cut.", titleId: "Setiap potongan melalui proses yang cermat.",
  introEn: "Fifteen considered steps guide each commission, from the first material review to the final inspection and handover.",
  introId: "Lima belas tahap terukur memandu setiap pesanan, dari pemeriksaan material pertama hingga pengecekan dan serah terima akhir.",
  heroImage: "/images/lapidary/lapidary-process-hero.png",
  heroAltEn: "A lapidary craftsman polishing a green agate cabochon on a water-fed grinding wheel", heroAltId: "Pengrajin lapidary memoles batu akik hijau dengan mesin gerinda berpendingin air", heroImagePosition: "center",
  phases: [
    { titleEn: "Understand the material", titleId: "Memahami material", introEn: "We establish what the stone can safely become before work is approved.", introId: "Kami memahami kemungkinan batu sebelum pengerjaan disetujui.", steps: [
      { titleEn: "Receive the brief", titleId: "Menerima brief", bodyEn: "We record your goals, intended use, preferred shape, finish, and timing.", bodyId: "Kami mencatat tujuan, penggunaan, bentuk, hasil akhir, dan waktu yang Anda inginkan." },
      { titleEn: "Confirm material source", titleId: "Memastikan sumber material", bodyEn: "We confirm whether the stone comes from your collection or from RENDI VIRGO stock.", bodyId: "Kami memastikan apakah batu berasal dari koleksi Anda atau dari stok RENDI VIRGO." },
      { titleEn: "Document arrival", titleId: "Mendokumentasikan penerimaan", bodyEn: "Customer supplied material is photographed and its received condition is recorded.", bodyId: "Material milik pelanggan difoto dan kondisi saat diterima dicatat." },
      { titleEn: "Inspect the stone", titleId: "Memeriksa batu", bodyEn: "We examine visible inclusions, fractures, surface condition, and dimensions.", bodyId: "Kami memeriksa inklusi, rekahan, kondisi permukaan, dan dimensi yang terlihat." },
      { titleEn: "Assess feasibility", titleId: "Menilai kelayakan", bodyEn: "The studio considers the requested cut, material behavior, likely yield, and risks.", bodyId: "Studio menilai bentuk yang diminta, karakter material, perkiraan hasil, dan risikonya." },
    ] },
    { titleEn: "Plan and shape", titleId: "Merencanakan dan membentuk", introEn: "Once the scope is approved, the cutter prepares and works to the agreed plan.", introId: "Setelah lingkup disetujui, pengrajin menyiapkan dan mengerjakan batu sesuai rencana.", steps: [
      { titleEn: "Define the scope", titleId: "Menetapkan lingkup", bodyEn: "We agree on dimensions, quantity, tolerances, finish, and any practical limitations.", bodyId: "Kami menyepakati dimensi, jumlah, toleransi, hasil akhir, dan batas pengerjaan." },
      { titleEn: "Prepare the written quote", titleId: "Menyiapkan penawaran tertulis", bodyEn: "The quote sets out the price and estimated studio time before any cutting begins.", bodyId: "Penawaran mencantumkan harga dan perkiraan waktu studio sebelum pemotongan dimulai." },
      { titleEn: "Receive approval", titleId: "Menerima persetujuan", bodyEn: "Work begins only after you approve the scope, price, and material arrangements.", bodyId: "Pengerjaan dimulai setelah Anda menyetujui lingkup, harga, dan pengaturan material." },
      { titleEn: "Mark the orientation", titleId: "Menentukan orientasi", bodyEn: "The cutter maps the intended face and direction around the stone's natural features.", bodyId: "Pengrajin menentukan sisi dan arah potongan berdasarkan karakter alami batu." },
      { titleEn: "Prepare the material", titleId: "Menyiapkan material", bodyEn: "The stone is cleaned, secured, and prepared for the chosen cutting method.", bodyId: "Batu dibersihkan, diamankan, dan disiapkan sesuai metode pemotongan." },
    ] },
    { titleEn: "Finish and hand over", titleId: "Menyelesaikan dan menyerahkan", introEn: "Each piece is refined, checked against the brief, then prepared for collection or return.", introId: "Setiap batu dirapikan, diperiksa berdasarkan brief, lalu disiapkan untuk diambil atau dikirim kembali.", steps: [
      { titleEn: "Rough shape", titleId: "Membentuk dasar", bodyEn: "The cutter removes material gradually to establish the approved outline.", bodyId: "Pengrajin mengurangi material secara bertahap untuk membentuk siluet yang disetujui." },
      { titleEn: "Refine the geometry", titleId: "Merapikan geometri", bodyEn: "Angles, curves, symmetry, and dimensions are brought closer to the agreed design.", bodyId: "Sudut, lengkung, simetri, dan dimensi dirapikan mengikuti desain yang disepakati." },
      { titleEn: "Progress through abrasives", titleId: "Menghaluskan bertahap", bodyEn: "The surface is refined through suitable abrasive grades to remove marks from shaping.", bodyId: "Permukaan dihaluskan dengan tingkat abrasif yang sesuai untuk mengurangi bekas pembentukan." },
      { titleEn: "Polish and clean", titleId: "Memoles dan membersihkan", bodyEn: "The agreed finish is applied, then the piece is cleaned for careful inspection.", bodyId: "Hasil akhir yang disepakati diterapkan, lalu batu dibersihkan untuk pemeriksaan." },
      { titleEn: "Inspect and hand over", titleId: "Memeriksa dan menyerahkan", bodyEn: "We review the result, document completion, and arrange collection or return shipping.", bodyId: "Kami meninjau hasil, mendokumentasikan penyelesaian, dan mengatur pengambilan atau pengiriman kembali." },
    ] },
  ],
  noteEyebrowEn: "A NOTE ON NATURAL STONE", noteEyebrowId: "CATATAN TENTANG BATU ALAM",
  noteTitleEn: "The stone always has a say.", noteTitleId: "Karakter alami batu tetap menjadi pertimbangan.",
  noteBodyEn: "Inclusions and internal fractures may only become visible during cutting. If a new condition could change the agreed result or risk, we pause and contact you before continuing.",
  noteBodyId: "Inklusi dan rekahan di dalam batu mungkin baru terlihat saat dipotong. Jika kondisi baru dapat mengubah hasil atau risiko, kami berhenti dan menghubungi Anda sebelum melanjutkan.",
  ctaLabelEn: "Discuss a custom project", ctaLabelId: "Diskusikan proyek custom", ctaTarget: "customOrder",
  backLabelEn: "Lapidary", backLabelId: "Lapidary", contactPromptEn: "Have a question about a step?", contactPromptId: "Ada pertanyaan tentang prosesnya?",
  contactLabelEn: "Talk to our studio", contactLabelId: "Hubungi studio kami",
  metaTitleEn: "Lapidary Process — RENDI VIRGO", metaTitleId: "Proses Lapidary — RENDI VIRGO",
  metaDescriptionEn: "Explore the 15 steps RENDI VIRGO follows to assess, shape, finish, and review a custom stone commission.",
  metaDescriptionId: "Kenali 15 tahap RENDI VIRGO dalam menilai, membentuk, memoles, dan memeriksa pesanan batu custom.",
  visualStyle: "mineral", layout: "timeline", motionEnabled: true,
};
