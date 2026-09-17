/**
 * Synthetic entity roster for the demo. Names are fictional — they do not
 * represent real DSAC public entities or NPOs. `riskProfile` seeds a
 * deterministic performance "story" across the dashboard: healthy entities
 * mostly hit targets on time, watch entities drift, and critical entities
 * carry missed deadlines and adverse audit history.
 */

export type RiskProfile = "healthy" | "watch" | "critical";
export type EntitySector =
  | "SPORT"
  | "ARTS"
  | "CULTURE"
  | "HERITAGE"
  | "MUSEUMS"
  | "LIBRARIES"
  | "ARCHIVES"
  | "OTHER";
export type EntityKind = "PUBLIC_ENTITY" | "NPO";

export interface EntitySeed {
  slug: string;
  name: string;
  type: EntityKind;
  sector: EntitySector;
  description: string;
  fundingAllocation: number;
  riskProfile: RiskProfile;
}

export const ENTITY_SEEDS: EntitySeed[] = [
  // --- Sport (Public Entities) ---
  { slug: "national-sports-excellence-agency", name: "National Sports Excellence Agency", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Coordinates high-performance athlete development and national federations.", fundingAllocation: 412_000_000, riskProfile: "healthy" },
  { slug: "amandla-athletics-council", name: "Amandla Athletics Council", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Regulates and grows grassroots and school athletics.", fundingAllocation: 158_000_000, riskProfile: "healthy" },
  { slug: "combat-sports-regulatory-council", name: "Combat Sports Regulatory Council", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Licenses and regulates professional combat sport in South Africa.", fundingAllocation: 46_000_000, riskProfile: "watch" },
  { slug: "clean-sport-assurance-agency", name: "Clean Sport Assurance Agency", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Runs the national anti-doping testing and education programme.", fundingAllocation: 89_000_000, riskProfile: "healthy" },
  { slug: "school-sport-development-board", name: "School Sport Development Board", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Delivers school sport leagues and talent identification.", fundingAllocation: 203_000_000, riskProfile: "watch" },
  { slug: "paralympic-sport-council", name: "Paralympic Sport Council", type: "PUBLIC_ENTITY", sector: "SPORT", description: "Supports athletes with disabilities from grassroots to podium.", fundingAllocation: 97_000_000, riskProfile: "critical" },

  // --- Arts (Public Entities) ---
  { slug: "vibrant-arts-development-council", name: "Vibrant Arts Development Council", type: "PUBLIC_ENTITY", sector: "ARTS", description: "Grant-making body for artists and arts organisations.", fundingAllocation: 276_000_000, riskProfile: "watch" },
  { slug: "zamani-performing-arts-board", name: "Zamani Performing Arts Board", type: "PUBLIC_ENTITY", sector: "ARTS", description: "Oversees national performing arts companies and touring.", fundingAllocation: 331_000_000, riskProfile: "healthy" },
  { slug: "national-craft-design-institute", name: "National Craft & Design Institute", type: "PUBLIC_ENTITY", sector: "ARTS", description: "Develops the craft and design sector and export readiness.", fundingAllocation: 64_000_000, riskProfile: "healthy" },
  { slug: "national-lyric-theatre-company", name: "National Lyric Theatre Company", type: "PUBLIC_ENTITY", sector: "ARTS", description: "National opera, ballet and theatre production house.", fundingAllocation: 245_000_000, riskProfile: "critical" },
  { slug: "national-screen-video-institute", name: "National Screen & Video Institute", type: "PUBLIC_ENTITY", sector: "ARTS", description: "Funds and develops the local film and video industry.", fundingAllocation: 389_000_000, riskProfile: "watch" },
  { slug: "contemporary-visual-arts-agency", name: "Contemporary Visual Arts Agency", type: "PUBLIC_ENTITY", sector: "ARTS", description: "Manages national galleries and public art commissions.", fundingAllocation: 118_000_000, riskProfile: "healthy" },

  // --- Culture (Public Entities) ---
  { slug: "cultural-linguistic-heritage-board", name: "Cultural & Linguistic Heritage Board", type: "PUBLIC_ENTITY", sector: "CULTURE", description: "Promotes and develops the official languages and oral heritage.", fundingAllocation: 142_000_000, riskProfile: "watch" },
  { slug: "rainbow-nation-cultural-institute", name: "Rainbow Nation Cultural Institute", type: "PUBLIC_ENTITY", sector: "CULTURE", description: "Runs national cultural events, festivals and heritage days.", fundingAllocation: 176_000_000, riskProfile: "healthy" },

  // --- Heritage (Public Entities) ---
  { slug: "heritage-legacy-authority", name: "Heritage Legacy Authority", type: "PUBLIC_ENTITY", sector: "HERITAGE", description: "National coordinating body for heritage resource management.", fundingAllocation: 221_000_000, riskProfile: "watch" },
  { slug: "liberation-heritage-council", name: "Liberation Heritage Council", type: "PUBLIC_ENTITY", sector: "HERITAGE", description: "Preserves liberation-history sites and memorials.", fundingAllocation: 133_000_000, riskProfile: "healthy" },
  { slug: "ancestral-sites-preservation-agency", name: "Ancestral Sites Preservation Agency", type: "PUBLIC_ENTITY", sector: "HERITAGE", description: "Protects and restores sites of ancestral and spiritual significance.", fundingAllocation: 58_000_000, riskProfile: "critical" },
  { slug: "cultural-landscapes-authority", name: "Cultural Landscapes Authority", type: "PUBLIC_ENTITY", sector: "HERITAGE", description: "Manages World Heritage-listed cultural landscapes.", fundingAllocation: 94_000_000, riskProfile: "healthy" },

  // --- Museums (Public Entities) ---
  { slug: "national-museum-natural-heritage", name: "National Museum of Natural Heritage", type: "PUBLIC_ENTITY", sector: "MUSEUMS", description: "National natural history collections and public education.", fundingAllocation: 187_000_000, riskProfile: "healthy" },
  { slug: "highland-cultural-museums-agency", name: "Highland Cultural Museums Agency", type: "PUBLIC_ENTITY", sector: "MUSEUMS", description: "Runs a network of regional cultural history museums.", fundingAllocation: 109_000_000, riskProfile: "watch" },
  { slug: "maritime-heritage-museum-board", name: "Maritime Heritage Museum Board", type: "PUBLIC_ENTITY", sector: "MUSEUMS", description: "Preserves and exhibits South Africa's maritime history.", fundingAllocation: 72_000_000, riskProfile: "healthy" },
  { slug: "frontier-history-museum-trust", name: "Frontier History Museum Trust", type: "PUBLIC_ENTITY", sector: "MUSEUMS", description: "Documents and exhibits frontier and settlement history.", fundingAllocation: 51_000_000, riskProfile: "critical" },

  // --- Libraries (Public Entities) ---
  { slug: "national-library-knowledge-service", name: "National Library & Knowledge Service", type: "PUBLIC_ENTITY", sector: "LIBRARIES", description: "Legal deposit, national bibliography and research access.", fundingAllocation: 264_000_000, riskProfile: "healthy" },
  { slug: "community-libraries-development-agency", name: "Community Libraries Development Agency", type: "PUBLIC_ENTITY", sector: "LIBRARIES", description: "Grant funding and capacity building for community libraries.", fundingAllocation: 298_000_000, riskProfile: "watch" },
  { slug: "braille-audio-library-service", name: "Braille & Audio Library Service", type: "PUBLIC_ENTITY", sector: "LIBRARIES", description: "Accessible-format library service for blind and low-vision readers.", fundingAllocation: 43_000_000, riskProfile: "healthy" },

  // --- Archives (Public Entity) ---
  { slug: "provincial-archives-records-authority", name: "Provincial Archives & Records Authority", type: "PUBLIC_ENTITY", sector: "ARCHIVES", description: "Custodian of provincial public records and archival access.", fundingAllocation: 61_000_000, riskProfile: "watch" },

  // --- NPOs (6) ---
  { slug: "youth-cultural-development-fund", name: "Youth Cultural Development Fund", type: "NPO", sector: "CULTURE", description: "NPO channelling grants to youth cultural programmes.", fundingAllocation: 22_000_000, riskProfile: "watch" },
  { slug: "indigenous-games-federation", name: "Indigenous Games Federation", type: "NPO", sector: "SPORT", description: "NPO preserving and promoting indigenous games.", fundingAllocation: 14_000_000, riskProfile: "healthy" },
  { slug: "karoo-sports-development-trust", name: "Karoo Sports Development Trust", type: "NPO", sector: "SPORT", description: "NPO delivering rural sport development in the Karoo region.", fundingAllocation: 9_500_000, riskProfile: "critical" },
  { slug: "township-arts-outreach-trust", name: "Township Arts Outreach Trust", type: "NPO", sector: "ARTS", description: "NPO running township-based arts education programmes.", fundingAllocation: 17_000_000, riskProfile: "watch" },
  { slug: "rural-heritage-custodians-trust", name: "Rural Heritage Custodians Trust", type: "NPO", sector: "HERITAGE", description: "NPO supporting community heritage custodianship in rural areas.", fundingAllocation: 11_000_000, riskProfile: "healthy" },
  { slug: "disability-sport-support-foundation", name: "Disability Sport Support Foundation", type: "NPO", sector: "SPORT", description: "NPO providing equipment and coaching for disability sport.", fundingAllocation: 13_500_000, riskProfile: "watch" },
];

export const PUBLIC_ENTITY_COUNT = ENTITY_SEEDS.filter((e) => e.type === "PUBLIC_ENTITY").length;
export const NPO_COUNT = ENTITY_SEEDS.filter((e) => e.type === "NPO").length;
