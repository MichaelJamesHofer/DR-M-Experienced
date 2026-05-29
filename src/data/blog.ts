export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  sections: {
    heading: string;
    body: string;
  }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "complex-cases-need-a-better-map",
    title: "Complex Cases Need a Better Map",
    category: "Clinical reasoning",
    excerpt:
      "A concise explanation of the order-of-operations thinking behind DrMExperienced and Peak Medicine consultations.",
    sections: [
      {
        heading: "Why the map matters",
        body:
          "Complex health problems often involve several systems at once: immune activation, gut tolerance, sleep, autonomic load, injury history, pain processing, cognition, infections, and environmental exposures. The useful first step is usually not a bigger list; it is a better order.",
      },
      {
        heading: "How this site fits",
        body:
          "DrMExperienced uses episodes and articles to explain the reasoning behind complex case sequencing. Peak Medicine remains the practice site for consultations, speaking, and medical-legal inquiries.",
      },
    ],
  },
  {
    slug: "concussion-memory-and-brain-fog",
    title: "Concussion, Memory, and Brain Fog",
    category: "Brain & memory",
    excerpt:
      "How concussion, TBI, brain fog, memory concerns, sleep, pain, and autonomic load can be discussed without reducing the case to one symptom label.",
    sections: [
      {
        heading: "A physiology-first frame",
        body:
          "Brain recovery can involve neuroinflammation, sleep disruption, visual and vestibular strain, pain, blood-brain barrier stress, hormone context, immune triggers, and nervous-system regulation. The podcast keeps those relationships visible without turning them into a one-size protocol.",
      },
      {
        heading: "When consultation may fit",
        body:
          "A consultation through Peak Medicine may be useful when someone needs help organizing the timeline, identifying likely drivers, and deciding which questions should go back to the care team.",
      },
    ],
  },
  {
    slug: "functional-medicine-topics-worth-sequencing",
    title: "Functional Medicine Topics Worth Sequencing",
    category: "Functional medicine",
    excerpt:
      "A focused look at autoimmunity, hypermobility, diagnostics, diet tolerance, long COVID, infections, and autonomic dysfunction.",
    sections: [
      {
        heading: "Keep categories useful",
        body:
          "Functional medicine is most useful when categories clarify decisions. Autoimmune triggers, hypermobility and hEDS, diagnostic strategy, diet and GI tolerance, long COVID, infection history, and autonomic dysfunction each matter differently depending on the case timeline.",
      },
      {
        heading: "Education before escalation",
        body:
          "DrMExperienced gives listeners language for the questions they may want to ask. Peak Medicine remains the place to request a formal consultation or professional inquiry.",
      },
    ],
  },
];
