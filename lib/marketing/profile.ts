export const chapters = [
  { id: "meet", label: "Meet Ananya" },
  { id: "world", label: "Her world" },
  { id: "profile", label: "Profile" },
  { id: "desire", label: "Desire" },
  { id: "voice", label: "Voice" },
  { id: "approach", label: "Approach" },
  { id: "promos", label: "Promos" },
  { id: "brief", label: "Brief" },
] as const;

export const dimensions = [
  {
    title: "Life stage",
    body: "An established adult balancing work, relationships and personal time. The same mindset can span the wider 28-60 age range.",
  },
  {
    title: "Spending style",
    body: "Selective and willing to pay a premium, while still expecting quality, usefulness and value.",
  },
  {
    title: "Personal taste",
    body: "Distinctive fragrance, considered packaging, natural textures and products that feel good to use and display.",
  },
  {
    title: "Values",
    body: "Environmental responsibility, fair treatment of people, transparency and thoughtful consumption.",
  },
  {
    title: "Relationship with wellness",
    body: "Wants manageable rituals that fit daily life. Appreciates pleasure, comfort and time for herself.",
  },
  {
    title: "Relationship with brands",
    body: "Curious but questioning. A compelling story attracts her; clear information and a good experience earn her loyalty.",
  },
  {
    title: "Gifting style",
    body: "Chooses gifts that express care and good taste. Wants the recipient to feel personally considered.",
  },
] as const;

export const purchases = [
  {
    title: "A moment for herself",
    body: "An everyday product can make a rushed morning or evening feel more considered.",
  },
  {
    title: "Sensory pleasure",
    body: "Fragrance, texture and presentation matter. Ethical credentials support a product she already wants to use.",
  },
  {
    title: "Confidence in her choices",
    body: "She wants understandable ingredients and specific explanations of how products are made.",
  },
  {
    title: "Personal expression",
    body: "Her purchases reflect her taste and the kind of business she wants to support.",
  },
  {
    title: "Connection through gifting",
    body: "She wants something beautiful, useful and meaningful enough to give.",
  },
] as const;

export const hesitations = [
  {
    question: "What will this actually smell or feel like?",
    answer:
      "Familiar scent references, fragrance intensity, texture and clear descriptions of the experience.",
  },
  {
    question: "Why is it worth this price?",
    answer:
      "Product size, ingredients, craftsmanship and other concrete reasons for its value.",
  },
  {
    question: "What does “natural” mean here?",
    answer:
      "Clear ingredient information and precise, product-specific explanations.",
  },
  {
    question: "How do I know the ethical story is real?",
    answer:
      "Actual people, production processes and evidence supporting the claims you make.",
  },
  {
    question: "Which product should I choose?",
    answer: "Simple guidance by fragrance preference, use or gifting occasion.",
  },
  {
    question: "Will this make a good gift?",
    answer:
      "The exact contents, presentation, dimensions and delivery information.",
  },
] as const;

export const voiceSteps = [
  {
    title: "The pleasure",
    body: "Introduce the fragrance or ritual through its character. Let her imagine the sensation first.",
  },
  {
    title: "The everyday occasion",
    body: "Show where it belongs in an ordinary day: coming home, after a shower, wrapping a gift.",
  },
  {
    title: "The reason to trust",
    body: "Give one relevant, verified production detail. Specific is more persuasive than broad.",
  },
  {
    title: "An easy next step",
    body: "Help her select the right product by scent, use or the person she is buying for.",
  },
] as const;

export const creativeLines = [
  {
    use: "Everyday rituals",
    line: "A little time that belongs to you.",
  },
  {
    use: "Fragrance",
    line: "Find a fragrance that feels like you.",
  },
  {
    use: "Gifting",
    line: "For someone whose tastes you know by heart.",
  },
  {
    use: "Brand storytelling",
    line: "Meet the people behind your everyday favourites.",
  },
] as const;

export const avoidWords = ["pure", "premium", "sustainable"] as const;

export const contentIdeas = [
  {
    title: "Ritual demonstrations",
    body: "Short films of small, believable moments: lighting incense at dusk, a body-care step after a shower, setting a table for guests.",
  },
  {
    title: "Fragrance guides",
    body: "Clear maps of character, intensity and familiar references so she can choose without guessing.",
  },
  {
    title: "Maker stories",
    body: "The people and processes behind the product, shown specifically enough to feel true.",
  },
  {
    title: "Gift suggestions",
    body: "Organised around the recipient’s tastes, with contents, presentation and delivery made obvious.",
  },
] as const;

export const approaches = [
  {
    title: "Acquisition",
    body: "Test personal pleasure and thoughtful gifting as separate messages. Do not blend them into one vague promise.",
  },
  {
    title: "Repeat purchase",
    body: "Build on what she has already enjoyed: her preferred fragrance, a familiar ritual or a product she has previously given.",
  },
  {
    title: "How to show the product",
    body: "Place it in inviting, believable settings, with enough detail that she can picture owning and using it.",
  },
] as const;

export const secondaryMarkets = [
  "Men buying natural grooming and fragrance products",
  "International customers attracted to Auroville, Indian botanicals and conscious living",
  "Gift buyers seeking meaningful, premium products",
  "Spas, hotels, wellness retreats and independent boutiques",
  "Corporate, wholesale and private-label buyers",
] as const;

export const worldImages = [
  {
    src: "/marketing/ananya-home.jpg",
    alt: "Ananya in her sunlit Bengaluru living room, with plants, teak furniture and a quiet afternoon.",
    caption: "Home in Bengaluru. Selective about what she brings in.",
    layout: "wide",
    ratio: "hero",
  },
  {
    src: "/marketing/ananya-still-life.jpg",
    alt: "A still life of incense, an amber perfume bottle, botanicals and chai on a teak table.",
    caption: "Objects she would keep on a table, not hide in a cupboard.",
    layout: "side",
    ratio: "landscape",
  },
  {
    src: "/marketing/ananya-evening.jpg",
    alt: "Ananya lighting incense at dusk in her apartment.",
    caption: "A small evening ritual after the day has loosened.",
    layout: "side",
    ratio: "landscape",
  },
  {
    src: "/marketing/ananya-ritual.png",
    alt: "Ananya applying a natural body cream at a bright bathroom counter.",
    caption: "Body care that fits an ordinary morning.",
    layout: "half",
    ratio: "landscape",
  },
  {
    src: "/marketing/ananya-gifting.png",
    alt: "Ananya tying a linen ribbon on a simply wrapped gift.",
    caption: "Gifts that feel personally considered.",
    layout: "half",
    ratio: "landscape",
  },
  {
    src: "/marketing/ananya-fragrance.png",
    alt: "Ananya sampling a fragrance on a paper strip in a quiet boutique.",
    caption: "She chooses with her nose, then asks why it is worth it.",
    layout: "half",
    ratio: "landscape",
  },
  {
    src: "/marketing/ananya-quiet.png",
    alt: "Ananya sitting with tea by a window, looking out over the city.",
    caption: "Pleasure as a pause, not a performance.",
    layout: "half",
    ratio: "landscape",
  },
] as const;
