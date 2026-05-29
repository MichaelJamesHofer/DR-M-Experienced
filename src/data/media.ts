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
    "Covers the cognitive checklists he uses with patients and professionals who want sharper recall, focus, and long-term protection.",
    "https://www.youtube.com/watch?v=_2bIACfd694"
  ),
  createMediaFeature(
    "Joints, Tendons, and Case Sequencing",
    "YouTube",
    "Functional Medicine Foundations Live",
    "Video",
    "Explains how tissue history, load, pain processing, and care-team context can be organized before deciding next steps.",
    "https://www.youtube.com/watch?v=nrXGbtoeuTE"
  ),
  createMediaFeature(
    "Episode 29: Autoimmunity Beyond Suppressing Symptoms",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "Details how he thinks about nutrition, immune triggers, recovery capacity, and sequencing in autoimmune cases.",
    "https://www.youtube.com/watch?v=20xhj9VAdjM"
  ),
  createMediaFeature(
    "Episode 22: Tissues and Issues",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "A conversation about tissue readiness, rehab phases, pain patterns, and the importance of context before procedures.",
    "https://www.youtube.com/watch?v=dxQAuHjZ8GU"
  ),
  createMediaFeature(
    "Episode 21: Osteoarthritis (OA)",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "Integrative OA strategy with movement, nutrition, microcurrent, case history, and clinical sequencing from his Metabolic Orthopedics work.",
    "https://www.youtube.com/watch?v=ad0ceCO9uq8"
  ),
  createMediaFeature(
    "Episode 8: Scars and Mechanical History",
    "YouTube",
    "Functional Medicine Foundations Podcast",
    "Podcast",
    "How scar tissue and mechanical history can affect symptoms and why sequencing matters before choosing interventions.",
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
    "Explains how his concussion framework scales from acute injury to long-running brain-injury recovery and why sequence matters.",
    "https://www.youtube.com/watch?v=1aXndnysq3o"
  ),
  createMediaFeature(
    "Episode 111: David Musnick",
    "YouTube",
    "Frequency Specific Microcurrent Podcast",
    "Podcast",
    "Long-form conversation exploring functional neurology, complex care, and the personal experiments that inform his teaching.",
    "https://www.youtube.com/watch?v=EbU-ZPdshwM"
  ),
  createMediaFeature(
    "Frequency Specific Microcurrent Essentials",
    "YouTube",
    "Frequency Specific Microcurrent Series",
    "Series",
    "Curated playlist covering FSM fundamentals, including Dr. Musnick's explanations of how he integrates the tech into tissue, pain, and neurologic care.",
    "https://www.youtube.com/watch?v=Znqj_vldUz0&list=PLYvFL_gzSBvtu7LWnXx2TS0wGIUEYJbmE"
  ),
];
