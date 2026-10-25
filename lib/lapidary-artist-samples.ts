import type { LapidaryArtistProfile } from "@/lib/storefront";
import type { Language } from "@/lib/i18n";

/** Local preview profiles, surfaced only when no published profiles exist in development. */
export function getLapidaryArtistSamples(language: Language): LapidaryArtistProfile[] {
  const en = language !== "id";
  return [
    {
      id: "sample-arif-hidayat", slug: "arif-hidayat", name: "Arif Hidayat",
      signatureStyle: en ? "Organic, flowing forms" : "Bentuk organik yang mengalir",
      location: en ? "Sukabumi, Indonesia" : "Sukabumi, Indonesia",
      bio: en ? "Arif approaches each commission from first material assessment to final review. He is drawn to cuts that follow the natural movement of a stone, especially the fine landscapes found in moss and dendritic agates." : "Arif menangani setiap pesanan dari penilaian material hingga pemeriksaan akhir. Ia menyukai bentuk yang mengikuti alur alami batu, terutama lanskap halus pada moss agate dan dendritic agate.",
      experience: en ? "Full-process lapidary practice, with a particular feel for agates with botanical inclusions." : "Praktik lapidary menyeluruh, dengan kepekaan khusus pada agate dengan inklusi menyerupai tumbuhan.",
      stoneExperience: ["Moss agate", "Dendritic agate", "Plume agate"], imageUrl: "/images/lapidary/artists/arif-hidayat.jpg",
      imageAlt: en ? "Sample portrait for lapidary artist Arif Hidayat" : "Foto contoh pengrajin lapidary Arif Hidayat", imagePosition: "center", portfolioImages: [],
    },
    {
      id: "sample-dimas-prasetyo", slug: "dimas-prasetyo", name: "Dimas Prasetyo",
      signatureStyle: en ? "Balanced lines and geometry" : "Garis dan geometri seimbang",
      location: en ? "West Java, Indonesia" : "Jawa Barat, Indonesia",
      bio: en ? "Dimas works across the complete cutting and finishing process, adapting the plan to the shape, durability, and character of each piece. His eye favors clear proportions and composed geometry, particularly in quartz and jasper." : "Dimas bekerja di seluruh tahap pemotongan dan penyelesaian, menyesuaikan rencana dengan bentuk, ketahanan, dan karakter setiap batu. Ia menyukai proporsi yang rapi dan geometri seimbang, terutama pada quartz dan jasper.",
      experience: en ? "Full-process lapidary practice, with an interest in proportion-led shapes and durable materials." : "Praktik lapidary menyeluruh, dengan minat pada bentuk berproporsi terukur dan material yang kuat.",
      stoneExperience: ["Quartz", "Jasper", "Amethyst"], imageUrl: "/images/lapidary/artists/dimas-prasetyo.jpg",
      imageAlt: en ? "Sample portrait for lapidary artist Dimas Prasetyo" : "Foto contoh pengrajin lapidary Dimas Prasetyo", imagePosition: "center", portfolioImages: [],
    },
    {
      id: "sample-siti-maharani", slug: "siti-maharani", name: "Siti Maharani",
      signatureStyle: en ? "Pattern-led shaping" : "Bentuk yang mengikuti pola",
      location: en ? "Sukabumi, Indonesia" : "Sukabumi, Indonesia",
      bio: en ? "Siti takes a stone through the full process, beginning with close observation of its patterns and inclusions. She looks for a cut that brings those natural details forward, especially in moss agate and other patterned agates." : "Siti menangani batu dari awal hingga akhir, dimulai dengan mengamati pola dan inklusinya secara saksama. Ia mencari bentuk yang menonjolkan detail alami tersebut, terutama pada moss agate dan agate berpola lainnya.",
      experience: en ? "Full-process lapidary practice, with a patient eye for patterned and included stones." : "Praktik lapidary menyeluruh, dengan perhatian cermat pada batu berpola dan berinklusi.",
      stoneExperience: ["Moss agate", "Dendritic agate", "Chalcedony"], imageUrl: "/images/lapidary/artists/siti-maharani.jpg",
      imageAlt: en ? "Sample portrait for lapidary artist Siti Maharani" : "Foto contoh pengrajin lapidary Siti Maharani", imagePosition: "center", portfolioImages: [],
    },
    {
      id: "sample-bima-saputra", slug: "bima-saputra", name: "Bima Saputra",
      signatureStyle: en ? "Confident, sculptural forms" : "Bentuk pahatan yang tegas",
      location: en ? "West Java, Indonesia" : "Jawa Barat, Indonesia",
      bio: en ? "Bima is comfortable carrying a commission from initial assessment through shaping, cutting, polishing, and final review. His work often emphasizes presence and strong silhouette, informed by time spent with jasper, petrified wood, and agate." : "Bima menangani pesanan sejak penilaian awal hingga pembentukan, pemotongan, pemolesan, dan pemeriksaan akhir. Karyanya kerap menonjolkan siluet yang kuat, dipengaruhi pengalamannya dengan jasper, kayu fosil, dan agate.",
      experience: en ? "Full-process lapidary practice, with an affinity for richly textured and characterful material." : "Praktik lapidary menyeluruh, dengan ketertarikan pada material yang kaya tekstur dan karakter.",
      stoneExperience: en ? ["Jasper", "Petrified wood", "Agate"] : ["Jasper", "Kayu fosil", "Agate"], imageUrl: "/images/lapidary/artists/bima-saputra.jpg",
      imageAlt: en ? "Sample portrait for lapidary artist Bima Saputra" : "Foto contoh pengrajin lapidary Bima Saputra", imagePosition: "center", portfolioImages: [],
    },
    {
      id: "sample-lestari-putri", slug: "lestari-putri", name: "Lestari Putri",
      signatureStyle: en ? "Quiet, refined contours" : "Kontur yang halus dan tenang",
      location: en ? "Sukabumi, Indonesia" : "Sukabumi, Indonesia",
      bio: en ? "Lestari guides a piece through the same complete studio practice as the rest of the team, making choices that preserve its natural character. She is especially attentive to subtle color and translucency in agate, chrysocolla, and quartz." : "Lestari mengerjakan setiap batu melalui keseluruhan proses studio seperti anggota tim lainnya, dengan keputusan yang menjaga karakter alaminya. Ia memberi perhatian khusus pada warna lembut dan tembus cahaya pada agate, chrysocolla, dan quartz.",
      experience: en ? "Full-process lapidary practice, with a preference for restrained shapes and nuanced color." : "Praktik lapidary menyeluruh, dengan preferensi pada bentuk sederhana dan warna yang kaya nuansa.",
      stoneExperience: ["Agate", "Chrysocolla", "Quartz"], imageUrl: "/images/lapidary/artists/lestari-putri.jpg",
      imageAlt: en ? "Sample portrait for lapidary artist Lestari Putri" : "Foto contoh pengrajin lapidary Lestari Putri", imagePosition: "center", portfolioImages: [],
    },
  ];
}
