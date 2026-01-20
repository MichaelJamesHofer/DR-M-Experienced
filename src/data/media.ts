import { extractYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube";

export type MediaFeature = {
  title: string;
  platform: string;
  show: string;
  type: "Video" | "Podcast" | "Series";
  summary: string;
  url: string;
  thumbnailUrl?: string;
  videoId?: string; // YouTube video ID for embeds
};

// Helper function to create media feature with auto-generated thumbnails
function createMediaFeature(
  title: string,
  platform: string,
  show: string,
  type: "Video" | "Podcast" | "Series",
  summary: string,
  url: string
): MediaFeature {
  const videoId = platform === "YouTube" ? extractYouTubeVideoId(url) : null;
  const thumbnailUrl = videoId ? getYouTubeThumbnail(videoId) : undefined;

  return {
    title,
    platform,
    show,
    type,
    summary,
    url,
    videoId: videoId || undefined,
    thumbnailUrl,
  };
}

export const MEDIA_FEATURES: MediaFeature[] = [
  createMediaFeature(
    "Autoimmunity Talk",
    "YouTube",
    "Functional Medicine Foundations Live",
    "Video",
    "Walk-through of Dr. Musnick's order-of-operations for calming autoimmune flares—what to address before labs, medications, or advanced tools.",
    "https://www.youtube.com/watch?v=Wu30s71p1_U"
  ),
  createMediaFeature(
    "Brain Memory Sharpness",
    "YouTube",
    "Functional Medicine Foundations Live",
    "Video",
    "Covers the cognitive checklists he uses with athletes and executives who want sharper recall, focus, and long-term protection.",
    "https://www.youtube.com/watch?v=_2bIACfd694"
  ),
  createMediaFeature(
    "Joints & Tendons Talk",
    "YouTube",
    "Functional Medicine Foundations Live",
    "Video",
    "Explains tissue diagnostics, ultrasound insights, and regenerative sequencing for tendons, ligaments, and joint capsules.",
    "https://www.youtube.com/watch?v=nrXGbtoeuTE"
  ),
  createMediaFeature(
    "Episode 29: Autoimmunity Beyond Suppressing Symptoms",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "Details how he layers nutrition, microcurrent, and regenerative tools so autoimmune athletes can keep training.",
    "https://www.youtube.com/watch?v=20xhj9VAdjM"
  ),
  createMediaFeature(
    "Episode 22: Tissues, Issues, PRP & More",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "A full PRP and regenerative medicine primer—tissue readiness, rehab phases, and when to say yes to procedures.",
    "https://www.youtube.com/watch?v=dxQAuHjZ8GU"
  ),
  createMediaFeature(
    "Episode 21: Osteoarthritis (OA)",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "Integrative OA strategy combining movement, nutrition, microcurrent, Prolotherapy, and Bone Marrow Aspirate from his Metabolic Orthopedics chapter.",
    "https://www.youtube.com/watch?v=ad0ceCO9uq8"
  ),
  createMediaFeature(
    "Episode 8: Scars and Prolotherapy",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "How scar tissue alters joint stability and how he sequences Prolotherapy plus neural therapies to restore mechanics.",
    "https://www.youtube.com/watch?v=tKXHwsX4kAk"
  ),
  createMediaFeature(
    "Episode 5: Healing the Brain After Concussion",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "The integrative concussion protocol—pathophysiology, diet, EMF hygiene, microcurrent, and progressive neuro rehab.",
    "https://www.youtube.com/watch?v=Bxx9mRAVnMs"
  ),
  createMediaFeature(
    "Healing the Blood-Brain Barrier for Lasting Brain Health",
    "Apple Podcasts",
    "The Vibrant Wellness Podcast",
    "Podcast",
    "A deep dive on neuroinflammation markers, blood-brain barrier repair, and how he explains the process to patients and peers.",
    "https://podcasts.apple.com/us/podcast/healing-the-blood-brain-barrier-for-lasting-brain/id1687196275?i=1000715406961&l=fr-FR"
  ),
  createMediaFeature(
    "Autoimmunity & Frequency Specific Microcurrent",
    "YouTube",
    "Frequency Specific Microcurrent Podcast",
    "Podcast",
    "Episode 144 features Dr. Musnick and Kim Pittis discussing FSM protocols for autoimmune fatigue, recovery, and nervous-system calm.",
    "https://www.youtube.com/watch?v=F3IKAnVyQRU"
  ),
  createMediaFeature(
    "Life-Changing Method for Healing TBIs",
    "YouTube",
    "Dr. Kara Fitzgerald Podcast",
    "Video",
    "Explains how his concussion framework scales from athletes to everyday brain-injury survivors and why sequence matters.",
    "https://www.youtube.com/watch?v=1aXndnysq3o"
  ),
  createMediaFeature(
    "Episode 111: David Musnick",
    "YouTube",
    "Frequency Specific Microcurrent Podcast",
    "Podcast",
    "Long-form conversation exploring regenerative medicine, functional neurology, and the experiments he runs personally.",
    "https://www.youtube.com/watch?v=EbU-ZPdshwM"
  ),
  createMediaFeature(
    "Frequency Specific Microcurrent Essentials",
    "YouTube",
    "Frequency Specific Microcurrent Series",
    "Series",
    "Curated playlist covering FSM fundamentals, including Dr. Musnick's explanations of how he integrates the tech into orthopedic and neuro care.",
    "https://www.youtube.com/watch?v=Znqj_vldUz0&list=PLYvFL_gzSBvtu7LWnXx2TS0wGIUEYJbmE"
  ),
];
