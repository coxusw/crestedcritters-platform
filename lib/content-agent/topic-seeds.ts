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
  "the debit card declining like it is doing performance art",
  "checking the account balance with one eye open",
  "adding avocado and suddenly needing a payment plan",
  "buying gas and pretending half a tank is emotional stability",
  "the cart total asking if you are sure about living indoors",
  "your savings account getting visited like a relative in witness protection",
  "trying to budget while past-you left financial jump scares",
  "the credit card minimum payment acting like a participation trophy",
  "payday arriving dressed as a hostage negotiator for bills",
  "opening the fridge and calling it a financial strategy meeting",
  "using the calculator app in the grocery aisle like a survival tool",
  "telling yourself a sale saved money after spending money",
  "rent taking the whole paycheck out for a romantic dinner",
  "checking bank notifications like they are horror movie subtitles",
  "the emergency fund being two nickels and confidence",
  "meal planning around whatever expires first",
  "your budget hearing the word brunch and filing a complaint",
  "trying to build credit while credit keeps acting exclusive",
  "the bank app loading slower because it knows you are fragile",
  "choosing store pickup to avoid impulse-buy side quests",
  "turning leftovers into meal prep because poverty has branding now",
  "canceling subscriptions like firing tiny employees",
  "your account balance saying absolutely not in lowercase",
  "the grocery receipt needing its own therapy session",
  "side hustle math after gas and fees ate the profit",
  "asking for a raise because vibes are not legal tender",
  "checking if fun money survived the rent attack",
  "watching insurance renewals act personally offended",
  "when the cheap option is still rude",
  "your budget and your appetite filing separate reports",
  "pretending tap water is a premium beverage",
  "waiting for payday like it owes you an apology",
  "the savings transfer immediately boomeranging back",
  "calling customer service with humble villain energy",
  "using cash envelopes because the debit card has no manners",
  "when a small fee starts multiplying like it found friends",
  "buying one treat and the budget acting betrayed",
  "a no-spend weekend with main-character withdrawal symptoms",
  "checking prices online while standing in the store",
  "using the library because free is a love language",
  "trying to save for retirement while dinner is pantry roulette",
  "the car making a noise that sounds expensive in three languages",
  "realizing convenience fees are just tiny financial insults",
  "making coffee at home with the enthusiasm of a hostage video",
  "when the paycheck is gone before the direct deposit confetti settles",
  "the bank balance looking back like you both made mistakes",
  "comparing unit prices like a mathlete under duress",
  "asking if the coupon stacks because dignity is expensive",
  "your wallet entering airplane mode at checkout",
  "rent week turning everyone into a minimalist",
  "the budget seeing takeout and calling security",
  "using 'later' as a savings plan and getting humbled",
  "when the fun purchase creates a boring consequence",
  "having champagne taste and tap-water logistics",
  "the overdraft fee arriving like a villain monologue",
  "treating payday like a limited-time event",
  "opening a bill and immediately needing to sit down",
  "trying to be financially responsible while ads are screaming",
  "the account balance giving jump-scare energy without special effects",
];

const povertySatireSubjects = [
  ["bank app bravery", "checking balances before spending instead of letting the card freestyle"],
  ["raise negotiation", "asking for more money with receipts instead of hoping effort gets noticed by telepathy"],
  ["grocery math", "building meals from cheap staples before the cart total starts insulting the family name"],
  ["subscription cleanup", "canceling quiet charges that keep sneaking into the account like unpaid roommates"],
  ["payday planning", "assigning dollars before bills drag them into a back alley"],
  ["rent week survival", "protecting rent money before small purchases start a tiny coup"],
  ["emergency fund crumbs", "starting with tiny savings because zero dollars is not a safety net, it is a plot twist"],
  ["side hustle receipts", "counting gas, fees, supplies, and taxes before calling it profit"],
  ["debt payoff pride", "paying extra principal when possible instead of letting interest do cardio"],
  ["cheap fun", "having a social life without letting the debit card audition for tragedy"],
  ["fee reversals", "calling the bank with polite menace and asking for the fee back"],
  ["retirement match", "not leaving employer match money on the table unless the table is on fire"],
  ["credit utilization", "keeping balances from yelling at the credit score"],
  ["meal prep reality", "making boring food useful without pretending rice is a personality"],
  ["cash envelopes", "using buckets because the bank app cannot supervise behavior by itself"],
  ["car maintenance", "planning for oil, tires, and repairs before the dashboard starts sending threats"],
  ["holiday spending", "setting gift limits before December starts cosplaying as bankruptcy theater"],
  ["medical bills", "asking for itemized bills and assistance because scary paper is still negotiable"],
  ["windfall discipline", "giving surprise money a job before chaos hires it first"],
  ["cheap living swaps", "choosing boring savings that actually survive the week"],
  ["job hopping math", "knowing when loyalty is just a discount coupon for your employer"],
  ["salary receipts", "tracking wins before asking for money like a professional with evidence"],
  ["no-spend resets", "using a short reset without turning it into a punishment arc"],
  ["budget categories", "naming the leaks before the account becomes a crime scene"],
  ["price comparison", "checking unit prices because packaging is a liar with good lighting"],
  ["financial boundaries", "saying no when your wallet is already breathing through a straw"],
  ["student loans", "choosing a repayment plan instead of letting emails pile up like haunted confetti"],
  ["insurance quotes", "shopping rates because loyalty does not pay dividends"],
  ["buy now pay later", "asking whether future-you consented to this nonsense"],
  ["minimum payment traps", "knowing when minimum payments are keeping the debt on life support"],
  ["cheap dates", "romance that does not require sacrificing the electric bill"],
  ["moving costs", "budgeting deposits, boxes, and utility starts before moving day gets rude"],
  ["pet costs", "planning for adorable dependents with tiny paws and expensive opinions"],
  ["kids and money", "building buffers because children treat shoes like disposable software"],
  ["utility bills", "calling before shutoff panic becomes a personality test"],
  ["cash flow calendar", "matching bills to paydays instead of manifesting electricity"],
  ["used purchases", "buying secondhand when it is smart, not when it is trash wearing a discount sticker"],
  ["tax refund plans", "making refund money useful before the cart starts flirting"],
  ["fun money limits", "letting fun exist without giving it access to the rent envelope"],
  ["savings automation", "moving tiny money before your impulses discover it"],
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

const crestedMemeSubjects = [
  "checking an isopod bin and seeing everyone vanish under bark",
  "springtails appearing only after you stop trying to count them",
  "a dairy cow colony acting like protein is rent",
  "new keepers mistaking normal mold for the end times",
  "rubber duckies making patience part of the care sheet",
  "buying one culture and suddenly needing more bins",
  "leaf litter disappearing like someone paid it to leave",
  "the dry side and wet side both being judged by tiny crustaceans",
  "finding mancae after declaring the colony inactive",
  "overfeeding once and fungus gnats filing paperwork",
  "isopods ignoring fancy food and eating the boring leaf",
  "springtails treating mold like a buffet reservation",
  "the colony hiding until guests come over",
  "adding cork bark and calling it interior design",
  "checking humidity like a tiny weather station operator",
  "a cleanup crew that still expects you to clean up",
  "the moment you learn bioactive does not mean autopilot",
  "powder oranges acting beginner-friendly but still having standards",
  "Cubaris owners explaining slow growth with haunted patience",
  "terrarium plants surviving until isopods discover soft leaves",
  "the first time an isopod molts and looks like two ghosts",
  "adding calcium like you are stocking a tiny gym",
  "the bin looking empty while everyone is under one leaf",
  "trying to photograph an isopod that chose violence and speed",
  "telling yourself one more species is a reasonable business decision",
  "spending the grocery budget on terrarium plants and calling it ecosystem investment",
  "buying moss like it has retirement benefits",
  "telling yourself the new enclosure is definitely the last one",
  "springtails doing unpaid mold management while you take credit",
  "isopods treating cork bark like luxury real estate",
  "the terrarium plant looking innocent while the isopods discuss snacks",
  "building a bioactive setup and immediately needing three more microhabitats",
  "the moment you realize leaf litter is now something you have opinions about",
  "checking humidity more often than your bank balance",
  "buying a rare isopod culture and pretending money is temporary anyway",
  "springtails appearing in every photo except the one you actually need",
  "terrarium plants thriving until you brag about them",
  "an isopod colony hiding like rent is due",
  "the cleanup crew asking why you keep making messes",
  "bioactive keepers saying it is self-sustaining while holding six tools",
  "spending all your money on tiny crustaceans with excellent camouflage",
  "telling yourself botanicals are supplies and not a shopping addiction",
  "the isopods getting better housing upgrades than you",
  "springtail culture maintenance becoming a personality trait",
  "plant quarantine feeling dramatic until pests show up",
  "the terrarium looking peaceful while the substrate is running a tiny economy",
  "asking if one more plant will fit like the enclosure can negotiate",
  "buying a misting bottle and suddenly becoming weather itself",
  "the colony eating zucchini like it has restaurant reservations",
  "watching isopods ignore the expensive food for a decaying leaf",
  "spending hobby money and then calling it research",
  "bioactive hobby math where one bin somehow becomes twelve",
  "explaining to normal people why you bought dirt on purpose",
  "the plant light bill joining the hobby budget without asking",
  "finding a single springtail and acting like the ecosystem waved hello",
  "isopods making you excited about rotten wood like that is normal",
  "terrarium plants getting names before your budget gets a category",
  "the cleanup crew clocking in only when guests cannot see them",
  "buying pods, plants, cork, leaves, and then pretending the container was the expensive part",
  "trying to make a naturalistic setup while the isopods rearrange everything",
  "the enclosure becoming prettier than your living room",
  "telling yourself it is not hoarding if each bin has a label",
  "springtails being tiny employees with zero HR paperwork",
  "the humidity gauge judging your entire husbandry career",
  "bioactive keepers hearing free leaf litter and entering gatherer mode",
  "the terrarium plant melting just to keep you humble",
  "your isopod wishlist having more financial ambition than your savings account",
  "spending money on plants the isopods may immediately taste-test",
  "the colony multiplying after you finally stop staring at it",
  "buying one cleanup crew and accidentally joining a whole hobby",
  "telling yourself the expo purchase is business inventory and emotional support",
  "isopods turning a slice of squash into a community event",
  "springtails cleaning mold while everyone asks what they even do",
  "bioactive setup costs sneaking up one cute supply at a time",
  "the hobby budget getting buried under leaf litter",
  "plants, pods, and springtails forming a tiny committee to drain your wallet",
  "the terrarium looking effortless after three hours of fussing",
  "realizing your isopods have better calcium access than you do",
  "the springtail culture surviving neglect better than your houseplants",
  "buying a backup culture because trust issues are part of husbandry",
  "the isopods refusing to pose after you hyped them up",
  "bioactive keepers casually discussing mold like weather",
  "the moment a tiny bin of dirt becomes your most checked project",
  "terrarium plants making you learn lighting terminology against your will",
  "the cleanup crew disappearing the second someone says show me",
  "spending money on a hobby where the stars hide under bark",
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

  const satire = povertySatireSubjects.flatMap(([subject, detail], index) => [
    seed(
      "poverty-finance",
      povertyMatchers,
      `Satire humor ${index + 1}: ${subject}`,
      "Satire Humor",
      `Make it a joke first: roast the broke-budget behavior and the absurd situation, not the person's worth. Push the line with playful sass, then land one practical fix. Topic focus: ${detail}.`
    ),
    seed(
      "poverty-finance",
      povertyMatchers,
      `Real finance tip: ${subject}`,
      "Real Finance Tip",
      `Give useful money advice with a sharp comedic opener. Keep the attitude high, make the broke-life joke obvious, and avoid cruelty. Topic focus: ${detail}.`
    ),
    seed(
      "poverty-finance",
      povertyMatchers,
      `Broke roast: ${subject}`,
      "Broke Roast",
      `Write a punchy post that jokes about broke habits like a friend roasting you with love. Include one action step so the joke has a point. Topic focus: ${detail}.`
    ),
  ]);

  return [...tips, ...memes, ...satire];
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

  const memes = crestedMemeSubjects.map((subject) =>
    seed(
      "crested-critters",
      crestedMatchers,
      `Crested Critters meme: ${subject}`,
      "Meme",
      "Create a friendly isopod, springtail, bioactive, or terrarium-keeper meme concept. Keep it accurate enough for hobbyists and include a tiny care takeaway."
    )
  );

  return [...care, ...facts, ...memes];
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

export const requestedTopicSeedTypeCounts = requestedTopicSeeds.reduce(
  (counts, seedItem) => {
    counts[seedItem.brand] ||= {};
    counts[seedItem.brand][seedItem.postType] =
      (counts[seedItem.brand][seedItem.postType] || 0) + 1;
    return counts;
  },
  {} as Record<TopicSeed["brand"], Record<string, number>>
);
