export type TopicSeed = {
  brand: "poverty-finance" | "tap-deck" | "crested-critters";
  pageMatchers: string[];
  topic: string;
  postType: string;
  notes: string;
};

type TopicPattern = {
  title: string;
  notes: string;
  postType?: string;
};

const povertyMatchers = ["povertyfinance", "poverty finance"];
const tapDeckMatchers = ["tapdeck", "tap-deck", "tap deck"];
const crestedMatchers = ["crested", "crested critters"];

function seed(
  brand: TopicSeed["brand"],
  pageMatchers: string[],
  topic: string,
  postType: string,
  notes: string
): TopicSeed {
  return { brand, pageMatchers, topic, postType, notes };
}

const povertySubjects = [
  ["getting a raise", "asking for more pay without sounding apologetic"],
  ["raise receipts", "tracking wins, extra duties, numbers, praise, and solved problems"],
  ["job hopping math", "knowing when a new employer is the real raise"],
  ["salary negotiation", "naming a number and staying quiet long enough for the manager to answer"],
  ["paycheck triage", "deciding what gets paid first when payday is already bullied by bills"],
  ["emergency funds", "building a tiny buffer after life already ate the last one"],
  ["bill negotiation", "calling providers, asking for retention, hardship plans, fee reversals, and promo rates"],
  ["grocery survival", "cheap proteins, pantry meals, frozen vegetables, leftovers, and not buying fantasy produce"],
  ["rent pressure", "planning rent before fun money steals the steering wheel"],
  ["utility bills", "averaging plans, usage checks, weatherization, and calling before shutoff panic"],
  ["credit scores", "payment history, utilization, old accounts, and avoiding panic applications"],
  ["debt snowball vs avalanche", "choosing a payoff method that a tired broke person will actually follow"],
  ["minimum payments", "what minimums do and why extra principal matters when possible"],
  ["side hustle profit", "subtracting fees, gas, supplies, taxes, and time before calling it income"],
  ["tax-time discipline", "not treating a refund like lottery winnings in sweatpants"],
  ["retirement when broke", "starting tiny with 401k match, IRA basics, and future-you not being abandoned"],
  ["401k match", "why free employer match money should not be ghosted if cash flow allows"],
  ["Roth IRA basics", "plain-language retirement talk for beginners with small budgets"],
  ["automatic savings", "moving tiny amounts before the debit card starts improvising"],
  ["cash envelopes", "using physical or digital buckets when the bank app is too optimistic"],
  ["subscriptions", "canceling quiet little charges acting like financial termites"],
  ["insurance shopping", "comparing quotes without letting loyalty become an expensive personality flaw"],
  ["meal prep burnout", "cheap repeatable meals that do not require becoming a lifestyle influencer"],
  ["cheap living swaps", "boring substitutions that leave money behind"],
  ["buy nothing weeks", "how to survive a no-spend stretch without making it your whole identity"],
  ["used purchases", "when secondhand is smart and when it is just future trash with a discount sticker"],
  ["car costs", "gas, insurance, maintenance, tires, and the true monthly cost of driving"],
  ["bank fees", "overdraft prevention, fee reversals, and choosing less predatory accounts"],
  ["medical bills", "asking for itemized bills, financial assistance, payment plans, and coding reviews"],
  ["student loans", "repayment plans, autopay discounts, and not ignoring scary mail"],
  ["holiday spending", "setting limits before December starts cosplaying as a financial emergency"],
  ["kids and money", "family budgeting without pretending children are cheap hobbies"],
  ["pet costs", "planning food, vet visits, emergencies, and supplies before the cute face wins"],
  ["cheap dates", "social life ideas that do not require swiping the rent money"],
  ["moving costs", "deposits, boxes, trucks, utility starts, and the sneaky cost pile"],
  ["financial boundaries", "saying no to money requests when your own account is wheezing"],
  ["windfalls", "what to do with bonuses, refunds, or surprise money before chaos votes"],
  ["sinking funds", "saving ahead for predictable expenses that keep pretending to be surprises"],
  ["price comparison", "unit pricing, store brands, and not getting emotionally attached to packaging"],
  ["cash flow calendar", "matching due dates to paydays instead of hoping vibes handle logistics"],
];

const povertyAngles: TopicPattern[] = [
  {
    title: "The broke-but-not-clueless guide to",
    notes: "Give practical, attitude-heavy steps. Mock the broke situation lightly, never shame the person. End with one action to take today.",
  },
  {
    title: "Stop letting your money get jumped by",
    notes: "Frame the problem like the follower's budget is getting ambushed. Give a blunt fix and a tiny first step.",
  },
  {
    title: "A script for handling",
    notes: "Write a short real-world script or checklist. Keep it sassy and useful, with no fake guru energy.",
  },
  {
    title: "The receipt check for",
    notes: "Tell readers what numbers, screenshots, documents, or proof to gather before making a money move.",
  },
  {
    title: "One ugly truth about",
    notes: "Lead with a sharp truth, then soften into practical advice someone broke can actually use.",
  },
  {
    title: "How to make progress on",
    notes: "Focus on small progress, not perfection. Acknowledge that the budget may be rude this month.",
  },
  {
    title: "Broke people need a plan for",
    notes: "Say the quiet part out loud: being broke makes this harder, which is exactly why a simple plan matters.",
  },
  {
    title: "The no-delusion version of",
    notes: "Cut through common internet advice that assumes spare cash is lying around doing nothing.",
  },
  {
    title: "What to do before panic-spending around",
    notes: "Give a pause-and-plan framework for the topic. Keep the tone funny, direct, and slightly disrespectful toward bad habits.",
  },
  {
    title: "Tiny wins for",
    notes: "Offer three tiny wins under ten minutes or ten dollars. Make it encouraging with a sarcastic edge.",
  },
  {
    title: "The lazy budget fix for",
    notes: "Give the simplest workable habit for people who are tired, busy, or overwhelmed.",
  },
  {
    title: "Questions to ask before spending on",
    notes: "Give a decision checklist. Include needs vs wants, timing, cheaper options, and future regret.",
  },
  {
    title: "How to stop future-you from yelling about",
    notes: "Make the post about protecting future self from present self's chaotic spending choices.",
  },
  {
    title: "The paycheck-to-paycheck playbook for",
    notes: "Make the advice realistic for people with tight cash flow. Avoid pretending they can magically save hundreds.",
  },
  {
    title: "If your account is wheezing, start with",
    notes: "Give one starting point, one thing to avoid, and one follow-up move.",
  },
];

const povertyMemeSubjects = [
  "asking for a raise with a bank account that has seen things",
  "opening the banking app after buying groceries",
  "direct deposit arriving and immediately being escorted out by bills",
  "budgeting with three dollars and a dream",
  "checking subscriptions like they personally betrayed you",
  "meal prepping because restaurants started acting premium",
  "retirement planning while lunch is whatever is in the pantry",
  "calling customer service to beg a fee off the bill",
  "buying store brand and pretending it is character development",
  "realizing the side hustle has side expenses",
  "trying to save money while rent does parkour",
  "the emergency fund having its own emergency",
  "credit utilization judging your life choices",
  "job hunting after seeing the price of eggs",
  "trying a no-spend week after already spending",
  "making a budget and watching reality object",
  "bringing lunch from home like a financially responsible adult against your will",
  "finding five dollars in a coat and acting blessed",
  "canceling a subscription you forgot existed",
  "payday optimism lasting eleven minutes",
  "the grocery cart total attacking your personality",
  "using coupons like tiny paper shields",
  "asking whether fun fits in the budget and the budget laughing",
  "planning retirement with couch-cushion energy",
  "telling yourself leftovers are a lifestyle choice",
  "looking at car insurance like it insulted your family",
  "putting money in savings and immediately needing it",
  "price comparing until your soul buffers",
  "the rent due date sprinting toward you",
  "choosing between convenience and not being broke-er",
];

const tapContexts = [
  ["a chamber event", "meeting people in a room full of local business owners"],
  ["a trade show floor", "starting useful conversations without blocking the booth flow"],
  ["a vendor table", "turning quick scans into remembered follow-ups"],
  ["a sales call", "building trust before pitching"],
  ["a cold DM", "warming the conversation before asking for time"],
  ["a referral ask", "making the ask specific and easy to say yes to"],
  ["a coffee chat", "keeping it focused without making it stiff"],
  ["a conference hallway", "using small windows of time well"],
  ["a local meetup", "turning casual introductions into useful relationships"],
  ["a follow-up message", "writing something specific enough to feel human"],
  ["a networking lunch", "balancing conversation with business context"],
  ["a LinkedIn or X reply", "adding value publicly before moving private"],
  ["a customer discovery chat", "asking better questions before pitching"],
  ["a B2B intro", "making clear who you help and what happens next"],
  ["a sales handoff", "sharing context so the next conversation starts warmer"],
];

const tapSkills: TopicPattern[] = [
  {
    title: "How to open",
    notes: "Give real phrasing for starting the conversation. Make the advice practical, warm, and non-cringey.",
  },
  {
    title: "What to ask during",
    notes: "Give two strong questions and one follow-up. Focus on connection, not interrogation.",
  },
  {
    title: "How to make yourself memorable after",
    notes: "Explain how to connect your name, value, and one useful detail so the person remembers you later.",
  },
  {
    title: "How to use Tap-Deck during",
    notes: "Tie digital card sharing to a real human moment: ask first, explain the tap, then add a note afterward.",
  },
  {
    title: "The follow-up template for",
    notes: "Write a short follow-up message template with context, reminder, useful detail, and next step.",
  },
  {
    title: "The mistake people make in",
    notes: "Name a common networking mistake and give the better move.",
  },
  {
    title: "How to exit gracefully from",
    notes: "Give wording to close the conversation without awkwardness while preserving the relationship.",
  },
  {
    title: "How to turn",
    notes: "Explain how to move from first contact to next useful step without hard-selling.",
  },
  {
    title: "How to listen better during",
    notes: "Give active listening cues and how to capture useful notes after the conversation.",
  },
  {
    title: "The one-note system for",
    notes: "Teach what to write down after the interaction so follow-up feels personal.",
  },
  {
    title: "How to avoid sounding salesy in",
    notes: "Show how to lead with relevance, curiosity, and a useful insight before pitching.",
  },
  {
    title: "How to ask for the next step after",
    notes: "Give specific next-step language: intro, call, quote, resource, or check-in.",
  },
  {
    title: "How to recover when",
    notes: "Give advice for awkward moments, forgotten names, quiet rooms, or stalled conversation.",
  },
  {
    title: "The value-first move for",
    notes: "Focus on helping first: useful resource, intro, question, quick audit, or relevant observation.",
  },
];

const tapSalesSubjects = [
  "building a warm prospect list from event conversations",
  "using public posts as context before outreach",
  "sending a DM after someone scans your card",
  "turning a casual chat into a booked meeting",
  "using replies to earn trust before a pitch",
  "qualifying without making people feel interrogated",
  "asking who else should be in the room",
  "following up after a no-show without sounding annoyed",
  "reconnecting with an old lead",
  "making your Tap-Deck profile answer the obvious buyer questions",
  "sharing one case study without dumping a brochure",
  "asking for referrals after helping someone",
  "using events to learn market language",
  "tracking where each lead came from",
  "making the first call feel like a continuation, not a cold start",
  "turning a business card exchange into a tiny CRM habit",
  "spotting buying signals in casual conversation",
  "asking better pain-point questions",
  "handling the 'send me info' brush-off",
  "knowing when not to pitch yet",
];

const crestedSubjects = [
  ["isopod moisture gradients", "why one damp side and one drier side beats soaking the whole bin"],
  ["springtail population booms", "why springtails often explode when mold or food is available"],
  ["bioactive cleanup crews", "what isopods and springtails actually do and what they do not magically fix"],
  ["terrarium plant safety", "plant choice, rinsing roots, avoiding pesticides, and watching for nibbling"],
  ["leaf litter layers", "food, cover, humidity pockets, and microbe habitat"],
  ["calcium sources", "cuttlebone, limestone, calcium carbonate, eggshell, and molting support"],
  ["ventilation balance", "stale air, drying, condensation, and how airflow works with humidity"],
  ["substrate refreshes", "frass buildup, partial changes, and species-dependent maintenance"],
  ["mold in enclosures", "when mold is normal, when it is a warning, and how springtails help"],
  ["protein feeding", "occasional protein, overfeeding risks, and cleanup timing"],
  ["mancae hiding", "why baby isopods are hard to spot and where they stay safe"],
  ["molting in halves", "why molts can look strange and why calcium and humidity matter"],
  ["starter cultures", "why new colonies can look like a bin of dirt for a while"],
  ["population control", "when a culture is thriving too much and how to split or reduce feeding"],
  ["dwarf isopods", "why dwarf species can be useful in smaller or plant-focused setups"],
  ["powder orange care", "hardy beginner care notes and what they still need"],
  ["dairy cow care", "fast breeding, protein appetite, and enclosure management"],
  ["rubber ducky patience", "slow-starting Cubaris care and why patience matters"],
  ["springtail cultures", "charcoal, clay, rice, yeast, moisture, and harvesting tips"],
  ["terrarium plant roots", "how cleanup crews interact with delicate roots and decaying matter"],
  ["fungus gnats", "how overfeeding and wet substrate invite pests"],
  ["bioactive myths", "things bioactive setups still need humans to monitor"],
  ["closed terrariums", "why springtails often fit better than larger isopods in tiny sealed setups"],
  ["arid bioactive setups", "why microclimates matter for cleanup crews in drier enclosures"],
  ["safe botanicals", "hardwood leaves, seed pods, cork bark, and avoiding treated material"],
];

const crestedAngles: TopicPattern[] = [
  {
    title: "Random isopod fact:",
    notes: "Lead with a real isopod or cleanup-crew fact, then give a keeper takeaway.",
    postType: "Isopod Fact",
  },
  {
    title: "Beginner mistake:",
    notes: "Explain the mistake, why it happens, and what to do instead. Keep it helpful and nonjudgmental.",
    postType: "Care Tip",
  },
  {
    title: "Quick care check:",
    notes: "Give a practical checklist people can use today.",
    postType: "Care Tip",
  },
  {
    title: "Bioactive myth check:",
    notes: "Correct a common misconception from terrarium and bioactive discussions.",
    postType: "Bioactive Tip",
  },
  {
    title: "Troubleshooting:",
    notes: "Describe symptoms, likely causes, and first steps. Avoid making hard diagnoses from limited info.",
    postType: "Care Tip",
  },
  {
    title: "Plant keeper note:",
    notes: "Connect terrarium plants to cleanup crew behavior, moisture, roots, or substrate health.",
    postType: "Terrarium Plant Tip",
  },
  {
    title: "Springtail spotlight:",
    notes: "Teach what springtails do, what population changes mean, and how they support the setup.",
    postType: "Springtail Fact",
  },
  {
    title: "Setup upgrade:",
    notes: "Give one enclosure improvement that helps stability without overcomplicating the hobby.",
    postType: "Care Tip",
  },
  {
    title: "Keeper question:",
    notes: "Frame this as a common community question, then answer it clearly.",
    postType: "Care Tip",
  },
  {
    title: "Tiny ecosystem lesson:",
    notes: "Explain how decomposers, plants, moisture, and airflow connect in a bioactive setup.",
    postType: "Bioactive Tip",
  },
  {
    title: "Culture health clue:",
    notes: "Teach one sign that a culture is stable, stressed, overfed, too dry, or too wet.",
    postType: "Care Tip",
  },
  {
    title: "What new keepers miss about",
    notes: "Make it educational and specific. Include one practical action at the end.",
    postType: "Care Tip",
  },
];

function buildPovertySeeds() {
  const tips = povertySubjects.flatMap(([subject, detail]) =>
    povertyAngles.map((angle) =>
      seed(
        "poverty-finance",
        povertyMatchers,
        `${angle.title} ${subject}`,
        angle.postType || "Broke Tip",
        `${angle.notes} Topic focus: ${detail}. Keep Poverty Finance sassy: tease the broke situation and bad habits, but give useful steps.`
      )
    )
  );

  const memes = povertyMemeSubjects.flatMap((subject, index) => [
    seed(
      "poverty-finance",
      povertyMatchers,
      `Broke meme: ${subject}`,
      "Broke Meme",
      "Create a relatable broke-finance meme concept with a short caption, one practical money tip, and #satire. The joke can roast the situation and gently mock the follower's broke behavior, but still be useful."
    ),
    seed(
      "poverty-finance",
      povertyMatchers,
      `Sassy money reminder ${index + 1}: ${subject}`,
      "Broke Tip",
      "Write a sharp, funny reminder tied to this scenario. Include a realistic fix someone can do today even if they are low on cash."
    ),
  ]);

  return [...tips, ...memes];
}

function buildTapDeckSeeds() {
  const networking = tapContexts.flatMap(([context, detail]) =>
    tapSkills.map((skill) =>
      seed(
        "tap-deck",
        tapDeckMatchers,
        `${skill.title} ${context}`,
        "Networking Tip",
        `${skill.notes} Context: ${detail}. Keep it real and tactical for business networking and sales networking.`
      )
    )
  );

  const sales = tapSalesSubjects.flatMap((subject) => [
    seed(
      "tap-deck",
      tapDeckMatchers,
      `Sales networking play: ${subject}`,
      "Sales Networking Tip",
      "Give a clear, practical sales networking move. Emphasize trust, relevance, warm context, and a clean next step."
    ),
    seed(
      "tap-deck",
      tapDeckMatchers,
      `Connection system: ${subject}`,
      "Networking Tip",
      "Explain a repeatable system for managing this kind of networking moment with Tap-Deck, notes, follow-up, and relationship-building."
    ),
  ]);

  return [...networking, ...sales];
}

function buildCrestedSeeds() {
  const care = crestedSubjects.flatMap(([subject, detail]) =>
    crestedAngles.map((angle) =>
      seed(
        "crested-critters",
        crestedMatchers,
        `${angle.title} ${subject}`,
        angle.postType || "Care Tip",
        `${angle.notes} Topic focus: ${detail}. Mention isopods, springtails, bioactive setups, or terrarium plants where relevant.`
      )
    )
  );

  const speciesFacts = [
    "Armadillidium can roll into a ball because of conglobation",
    "Porcellio species often need more ventilation than many beginners expect",
    "Cubaris species can be slower to establish and reward patience",
    "dwarf white isopods reproduce without males in many cultures",
    "powder orange isopods are hardy but still need a moisture gradient",
    "dairy cow isopods are bold feeders and can overrun food quickly",
    "mancae spend a lot of time hidden in stable humid pockets",
    "isopods are crustaceans, not insects",
    "springtails jump with a furcula and often vanish before you can point at them",
    "leaf litter supports microbes before isopods even eat the leaf itself",
    "molting problems often point back to moisture, calcium, stress, or nutrition",
    "bioactive does not mean maintenance-free",
    "plants can raise humidity at night through transpiration",
    "too much food can create pests faster than it creates growth",
    "cork bark doubles as shelter and a microclimate tool",
    "fungus gnats often tell on overwatering or extra food",
    "springtails eat mold and fungi but cannot fix every husbandry issue",
    "some isopods nibble soft plants if easier food is missing",
    "hardwood leaves are a long-term food source and habitat layer",
    "substrate depth changes how stable humidity stays",
    "babies may appear weeks after a colony seems quiet",
    "isopods help recycle organic matter in forest floor ecosystems",
    "closed jars are usually better matched to springtails than large isopods",
    "arid bioactive bins still need humid refuges for cleanup crews",
    "protein is useful in moderation and messy when overdone",
    "calcium access supports exoskeleton growth after molts",
    "overcrowding can stress a colony even when it looks productive",
    "new cultures often look inactive while they settle",
    "temperature swings can slow breeding",
    "clean-up crews need care because they are livestock too",
  ];

  const facts = speciesFacts.map((fact) =>
    seed(
      "crested-critters",
      crestedMatchers,
      `Random isopod fact: ${fact}`,
      "Isopod Fact",
      "Write a concise educational post with a practical keeper takeaway and a friendly Crested Critters voice."
    )
  );

  return [...care, ...facts];
}

export const requestedTopicSeeds: TopicSeed[] = [
  ...buildPovertySeeds(),
  ...buildTapDeckSeeds(),
  ...buildCrestedSeeds(),
];

export const requestedTopicSeedCounts = requestedTopicSeeds.reduce(
  (counts, seedItem) => {
    counts[seedItem.brand] += 1;
    return counts;
  },
  {
    "poverty-finance": 0,
    "tap-deck": 0,
    "crested-critters": 0,
  } satisfies Record<TopicSeed["brand"], number>
);
