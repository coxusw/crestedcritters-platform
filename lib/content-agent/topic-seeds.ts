export type TopicSeed = {
  brand: "poverty-finance" | "tap-deck" | "crested-critters" | "isopedia";
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

type TopicSource = {
  subject: string;
  detail: string;
  source: string;
  url: string;
};

const povertyMatchers = ["povertyfinance", "poverty finance"];
const tapDeckMatchers = ["tapdeck", "tap-deck", "tap deck"];
const crestedMatchers = ["crested", "crested critters"];
const isopediaMatchers = ["isopedia", "isopeida"];

function seed(
  brand: TopicSeed["brand"],
  pageMatchers: string[],
  topic: string,
  postType: string,
  notes: string
): TopicSeed {
  return { brand, pageMatchers, topic, postType, notes };
}

function sourceLine(source: TopicSource) {
  return `Source angle: ${source.source}. Reference: ${source.url}. Topic focus: ${source.detail}`;
}

const povertySources: TopicSource[] = [
  { subject: "getting a raise before lifestyle creep eats it", detail: "turning a raise into emergency savings, retirement match, and debt payoff before new spending gets brave", source: "Reddit personal finance discussions around raise planning", url: "https://www.reddit.com/r/personalfinance/comments/1bu659v/what_do_i_do_with_my_raise/" },
  { subject: "asking for a raise with receipts", detail: "tracking wins, extra duties, revenue saved, customer praise, and measurable outcomes before asking", source: "Recurring Reddit career and finance raise questions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "grocery bills acting like a car payment", detail: "unit pricing, cheap proteins, frozen vegetables, store brands, pantry meals, and avoiding fantasy groceries", source: "r/povertyfinance and r/personalfinance grocery-budget discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "rent week survival", detail: "protecting rent before small purchases drain the account and create panic math", source: "r/povertyfinance rent and paycheck-to-paycheck discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "emergency fund crumbs", detail: "building a tiny starter buffer even when the budget is rude and unstable", source: "Personal finance emergency fund advice threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "subscriptions sneaking around like financial roaches", detail: "auditing recurring charges and canceling quiet leaks before they become a personality", source: "Common budgeting pain point across finance communities", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "side hustle math after gas and fees", detail: "subtracting supplies, mileage, platform fees, taxes, and time before calling it profit", source: "Reddit side hustle and poverty finance discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "bill negotiation without sounding scared", detail: "calling providers for retention offers, hardship plans, fee reversals, and lower rates", source: "Common money-saving tip threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "retirement when the wallet is coughing", detail: "starting with employer match, tiny IRA contributions, and automatic savings without pretending cash is everywhere", source: "Retirement questions from low-income finance communities", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "cash flow calendars for people allergic to math", detail: "matching due dates to paydays so bills stop ambushing the account", source: "Budgeting systems discussed in personal finance communities", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "debt payoff when minimum payments are clowning you", detail: "snowball vs avalanche, extra principal, due dates, and staying motivated with small wins", source: "Debt payoff advice threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "credit score damage control", detail: "utilization, payment history, old accounts, and avoiding panic applications", source: "Credit score questions in finance communities", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "medical bill negotiation", detail: "asking for itemized bills, assistance, coding review, and payment plans", source: "Recurring US personal finance medical debt threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "tax refund discipline", detail: "using refunds for bills, debt, savings, and boring progress before treating it like lottery money", source: "Tax refund planning discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "buy now pay later traps", detail: "checking whether future-you consented before splitting a want into four tiny regrets", source: "Consumer debt and BNPL finance discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "cheap living without making misery the brand", detail: "boring swaps that leave money behind while keeping life livable", source: "Cheap living tip threads", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "no-spend resets that do not become punishment", detail: "short spending freezes, pantry challenges, and avoiding rebound spending", source: "No-spend challenge discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "insurance renewal disrespect", detail: "shopping quotes, checking coverage, and refusing loyalty pricing that acts personal", source: "Insurance shopping discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "car costs beyond the payment", detail: "gas, tires, oil, insurance, repairs, registration, and the true monthly cost", source: "Car budgeting threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "financial boundaries with family", detail: "saying no when helping someone else would put your own bills in danger", source: "Family money boundary discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "meal prep when motivation is bankrupt", detail: "repeatable cheap meals that work for tired people and not just influencers", source: "Grocery and meal prep budgeting discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "bank fees with villain energy", detail: "overdraft prevention, fee reversals, alerts, and switching accounts", source: "Bank fee complaint and advice threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "windfalls before chaos touches them", detail: "giving bonuses, refunds, and surprise money a job immediately", source: "Windfall handling advice threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "student loan autopilot", detail: "repayment plans, autopay discounts, and not letting scary emails pile up", source: "Student loan finance discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "holiday spending before December starts yelling", detail: "gift caps, sinking funds, homemade options, and refusing panic shopping", source: "Seasonal budget discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "cheap dates with dignity still attached", detail: "social life and romance without sacrificing the electric bill", source: "Cheap living and frugal social-life discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "price comparison as a survival skill", detail: "unit pricing, store brands, refill math, and not being seduced by packaging", source: "Grocery budget advice threads", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "moving costs that jump out of the walls", detail: "deposits, boxes, utility starts, truck rental, and emergency cash", source: "Moving budget threads", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "pet costs before the cute face wins", detail: "food, vet care, emergency savings, supplies, and realistic ownership costs", source: "Budget planning discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "the raise that disappears in 11 minutes", detail: "automatic transfers on raise day so bills and wants do not eat the whole improvement", source: "Raise planning and lifestyle creep discussions", url: "https://www.reddit.com/r/personalfinance/comments/1bu659v/what_do_i_do_with_my_raise/" },
  { subject: "renters needing a move-out fund", detail: "saving for deposits and surprise housing costs while still broke", source: "Rent and moving finance discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "panic spending after a bad day", detail: "building a pause rule for emotional purchases and finding cheaper pressure releases", source: "Behavioral budgeting discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "cash envelopes for debit-card chaos", detail: "using buckets when the bank app cannot supervise behavior", source: "Budget method discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "sinking funds for predictable surprises", detail: "car tags, school fees, gifts, vet visits, and the expenses that keep pretending to be emergencies", source: "Budgeting system discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "cheap food that still has protein", detail: "beans, eggs, canned fish, chicken thighs, tofu, lentils, and realistic shopping lists", source: "Grocery survival discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "the bank app avoidance problem", detail: "checking balances without spiraling so the debit card stops freelancing", source: "Budget anxiety discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "using libraries like broke royalty", detail: "free books, tools, passes, internet, printing, classes, and entertainment", source: "Cheap living discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "job hopping vs loyalty discounts", detail: "when a new job is the only realistic raise and how to compare the full offer", source: "Career finance discussions", url: "https://www.reddit.com/r/personalfinance/" },
  { subject: "paycheck triage when everything is due", detail: "ranking shelter, utilities, food, transportation, debt, and late fees by actual consequence", source: "Paycheck-to-paycheck discussions", url: "https://www.reddit.com/r/povertyfinance/" },
  { subject: "owner of a cart full of wants", detail: "waiting 24 hours, removing half the cart, and not confusing sale pricing with savings", source: "Spending-control discussions", url: "https://www.reddit.com/r/personalfinance/" },
];

const povertyAngles: TopicPattern[] = [
  { title: "Broke people need a plan for", postType: "Broke Tip", notes: "Make it funny, sharp, and useful. Tease broke-budget chaos like a friend roasting someone with love. End with one sassy action step." },
  { title: "The no-delusion guide to", postType: "Real Finance Tip", notes: "Give real financial advice for low-cash people. Push the line with the joke, but do not be cruel. End with a sassy one-liner." },
  { title: "Stop letting your wallet get bullied by", postType: "Broke Roast", notes: "Roast the habit and the situation. Include a practical fix. Keep it monetization-safe enough for a public page while still feeling spicy." },
  { title: "If your account is wheezing, start with", postType: "Broke Tip", notes: "Give one small step, one thing to stop doing, and one next move. Add a playful insult toward the bad habit, not the person's worth." },
  { title: "The poverty finance receipt check for", postType: "Real Finance Tip", notes: "Tell followers what proof, screenshots, numbers, or documents they need before making a money move. Finish with attitude." },
  { title: "A rude little reminder about", postType: "Satire Humor", notes: "Make the post a joke first, then sneak in useful advice. Include #satire and a sassy closer." },
  { title: "Before you act rich around", postType: "Broke Roast", notes: "Push the line. Mock impulsive spending and broke math, then give a realistic alternative." },
  { title: "Tiny wins for people losing to", postType: "Broke Tip", notes: "Offer quick wins under ten minutes or ten dollars. Keep it encouraging, but do not let the follower off the hook." },
];

function buildPovertySeeds() {
  return povertySources.flatMap((item) =>
    povertyAngles.map((angle) =>
      seed(
        "poverty-finance",
        povertyMatchers,
        `${angle.title} ${item.subject}`,
        angle.postType || "Broke Tip",
        `${angle.notes} Inspiration only: ${item.detail}. Do not mention or link the source. Poverty Finance voice: make fun of broke behavior and chaotic choices, keep the joke obvious, and include one practical move.`
      )
    )
  );
}

const tapDeckSources: TopicSource[] = [
  { subject: "following up within 24 hours", detail: "networking contacts go cold fast when the follow-up has no context", source: "r/sales discussion about what makes people follow up after exchanging cards", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "saving the conversation context", detail: "notes on where you met, what they needed, and the promised next step turn a contact into a relationship", source: "r/sales networking follow-up thread", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "not handing cards to everyone with a pulse", detail: "better networking comes from relevance, not spraying contact info at strangers", source: "r/sales follow-up and business card discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "marketing consistency for small businesses", detail: "owners struggle less with ideas and more with a repeatable system they can maintain", source: "r/smallbusiness marketing discussion", url: "https://www.reddit.com/r/smallbusiness/comments/1surwnr/how_do_small_businesses_do_marketing/" },
  { subject: "turning customer questions into content", detail: "real questions become better posts, pages, and ads than guessed-at content calendars", source: "r/smallbusiness marketing systems discussion", url: "https://www.reddit.com/r/smallbusiness/comments/1p8pi4y/what_do_small_business_owners_do_for_marketing/" },
  { subject: "local networking before expensive ads", detail: "service businesses often need relationship channels before broad paid reach", source: "r/smallbusiness promotion discussions", url: "https://www.reddit.com/r/smallbusiness/comments/1s0ure8/how_do_yall_promote_yalls_businesses/" },
  { subject: "community-first marketing", detail: "answering real questions without pitching builds trust before the ask", source: "Reddit Business small business guidance", url: "https://www.business.reddit.com/learning-hub/articles/why-you-should-be-on-reddit-smb" },
  { subject: "finding where customers already talk", detail: "communities and interests can define better audiences before spending ad budget", source: "Reddit Business customer-finding guidance", url: "https://www.business.reddit.com/learning-hub/articles/how-to-find-customers-on-reddit" },
  { subject: "X social listening", detail: "advanced search, lists, replies, and quote posts help brands join live conversations", source: "X Business community management guidance", url: "https://business.x.com/en/basics/community-management" },
  { subject: "real-time engagement for SMBs", detail: "fast public replies can build trust and credibility for small businesses", source: "X for Business SMB guidance", url: "https://business.x.com/en/blog/x-is-committed-to-small-and-medium-businesses.html" },
  { subject: "event booth follow-up", detail: "capture why the contact cared while the conversation is fresh", source: "X marketing event case-study angle", url: "https://marketing.x.com/en/success-stories/how-mulesoft-uses-twitter-to-drive-booth-traffic" },
  { subject: "budget advertising clarity", detail: "separate marketing, advertising, and networking before buying random monthly packages", source: "r/smallbusiness advertising advice discussions", url: "https://www.reddit.com/r/smallbusiness/comments/1r0tmkl/business_advertising_advice/" },
  { subject: "review and referral loops", detail: "small businesses need repeated customer touchpoints, not one-off random posts", source: "r/smallbusiness marketing consistency discussions", url: "https://www.reddit.com/r/smallbusiness/comments/1surwnr/how_do_small_businesses_do_marketing/" },
  { subject: "LinkedIn plus local groups", detail: "targeted professional visibility beats being everywhere badly", source: "Small business promotion discussions", url: "https://www.reddit.com/r/smallbusiness/comments/1r0nw5j/how_to_promote_my_small_business/" },
  { subject: "anti-AI in-person networking", detail: "physical presence and specific follow-up stand out while inboxes feel automated", source: "r/sales networking discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "lead quality over contact volume", detail: "a smaller list with context is more useful than a phone full of forgotten names", source: "r/sales follow-up discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "ad creative from objections", detail: "turn sales objections and FAQs into posts, landing copy, and ad hooks", source: "Small business marketing discussions", url: "https://www.reddit.com/r/smallbusiness/" },
  { subject: "relationship CRM hygiene", detail: "tag contacts by event, interest, urgency, and promised follow-up", source: "r/sales networking follow-up discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "content that helps before it sells", detail: "helpful replies and tips build credibility before pitching", source: "Reddit Business SMB guidance", url: "https://www.business.reddit.com/learning-hub/articles/why-you-should-be-on-reddit-smb" },
  { subject: "retargeting warm interest", detail: "website visitors and engaged contacts deserve different follow-up than cold strangers", source: "X partner retargeting guidance", url: "https://partners.x.com/en/partners/perfect-audience" },
  { subject: "using social profiles as trust checks", detail: "people check profiles after meeting; stale profiles waste warm curiosity", source: "X profile presence guidance", url: "https://business.x.com/en/resources/guides-and-webinars" },
  { subject: "event notes that sell later", detail: "write down the personal hook, business need, and next action while the memory is fresh", source: "r/sales business card follow-up discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "marketing burnout prevention", detail: "create repeatable weekly moves instead of trying to become a full-time media company", source: "r/smallbusiness marketing burnout discussions", url: "https://www.reddit.com/r/smallbusiness/comments/1r8prh9/how_are_other_small_business_owners_handling/" },
  { subject: "local partnership maps", detail: "track who sends referrals, who serves the same buyer, and who needs a warm intro", source: "Small business local promotion discussions", url: "https://www.reddit.com/r/smallbusiness/" },
  { subject: "tap-to-save contact moments", detail: "make the contact exchange fast, then make the follow-up personal", source: "r/sales digital card/noise discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "post-event sorting", detail: "separate hot leads, referral partners, vendors, peers, and nice-but-no-fit contacts", source: "r/sales networking discussion", url: "https://www.reddit.com/r/sales/comments/1puzk04/when_networking_what_actually_makes_you_follow_up/" },
  { subject: "small budget ad discipline", detail: "know the offer, audience, and next step before spending money", source: "Reddit Business small business ad guidance", url: "https://www.business.reddit.com/learning-hub/articles/small-business-ads" },
  { subject: "customer list ownership", detail: "email and CRM notes protect relationships from algorithm changes", source: "r/smallbusiness marketing tools discussion", url: "https://www.reddit.com/r/smallbusiness/comments/1surwnr/how_do_small_businesses_do_marketing/" },
  { subject: "networking opener quality", detail: "specific questions beat generic what-do-you-do conversations", source: "Sales networking discussion", url: "https://www.reddit.com/r/sales/" },
  { subject: "public conversation as marketing", detail: "commenting helpfully can outperform posting into the void", source: "X Business community management guidance", url: "https://business.x.com/en/basics/community-management" },
  { subject: "turning event traffic into booked calls", detail: "a contact card should lead to a specific next step, not a digital graveyard", source: "MuleSoft event traffic case-study angle", url: "https://marketing.x.com/en/success-stories/how-mulesoft-uses-twitter-to-drive-booth-traffic" },
];

const tapDeckAngles: TopicPattern[] = [
  { title: "Tap-Deck networking play:", postType: "Networking Tip", notes: "Give a practical, real-world move and tie it back to using Tap-Deck to capture contact context." },
  { title: "Small business marketing system:", postType: "Marketing Tip", notes: "Give a repeatable marketing habit for busy owners and connect it to Tap-Deck follow-up or profile sharing." },
  { title: "Advertising reality check:", postType: "Advertising Tip", notes: "Explain the advertising lesson with clear steps before spending money. Bring it back to Tap-Deck as the relationship bridge." },
  { title: "Sales networking script:", postType: "Sales Networking Tip", notes: "Include a short script or follow-up template. Make Tap-Deck the tool that keeps the context from dying." },
  { title: "Connection cleanup:", postType: "Networking Tip", notes: "Show how to organize contacts after events by next step, value, urgency, and notes." },
  { title: "One better follow-up for", postType: "Sales Networking Tip", notes: "Make the follow-up specific, human, and useful. Tie it to Tap-Deck instead of generic business card swapping." },
  { title: "Stop wasting warm leads from", postType: "Marketing Tip", notes: "Make the post direct and tactical. Explain how Tap-Deck helps make the warm lead remember why they cared." },
];

function buildTapDeckSeeds() {
  return tapDeckSources.flatMap((item) =>
    tapDeckAngles.map((angle) =>
      seed(
        "tap-deck",
        tapDeckMatchers,
        `${angle.title} ${item.subject}`,
        angle.postType || "Networking Tip",
        `${angle.notes} Inspiration only: ${item.detail}. Do not mention or link the source. Keep the post practical for business owners, marketers, sales reps, and event networkers.`
      )
    )
  );
}

const crestedScienceSources: TopicSource[] = [
  { subject: "isopods as leaf litter fragmenters", detail: "terrestrial isopods speed litter breakdown by fragmenting leaf material and interacting with microbes", source: "Geoderma paper on terrestrial isopods and soil nutrients during litter decomposition", url: "https://www.sciencedirect.com/science/article/pii/S0016706120300586" },
  { subject: "species-specific decomposition effects", detail: "different terrestrial isopod species can affect leaf litter decomposition differently", source: "Open-access paper on terrestrial isopods and leaf litter decomposition processes", url: "https://www.sciencedirect.com/science/article/pii/S2090989615000363" },
  { subject: "leaf chemistry and feeding preference", detail: "litter chemistry can change consumption rates and gut/faecal microbiomes in detritivores", source: "Soil Biology and Biochemistry paper on litter chemistry and soil invertebrates", url: "https://www.sciencedirect.com/science/article/pii/S0038071722003753" },
  { subject: "calcium storage before molting", detail: "terrestrial isopods resorb and store calcium before ecdysis so the new cuticle can mineralize", source: "PLOS One paper on mineral deposition in isopod calcium bodies", url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0058968" },
  { subject: "isopods molt in two halves", detail: "isopods molt posterior and anterior halves separately, which explains the half-white molt look keepers notice", source: "Review on calcium transport and deposition in terrestrial isopods", url: "https://pubmed.ncbi.nlm.nih.gov/15629645/" },
  { subject: "bacteria and calcium bodies", detail: "microbial communities can colonize isopod calcium bodies, showing molting is biologically complex", source: "FEMS Microbiology Ecology paper on calcium bodies in terrestrial isopods", url: "https://academic.oup.com/femsec/article/doi/10.1093/femsec/fix053/3753549" },
  { subject: "springtail aerial righting", detail: "some semiaquatic springtails can jump, right themselves in air, and land on water with impressive control", source: "PNAS/arXiv research on springtail jumping and landing", url: "https://arxiv.org/abs/2211.04285" },
  { subject: "springtails and stress tolerance", detail: "Folsomia candida exposed to alpha-pinene showed increased survival after cold shock in one study", source: "ScienceDirect paper on alpha-pinene and Folsomia candida stress tolerance", url: "https://www.sciencedirect.com/science/article/pii/S1532045619303977" },
  { subject: "springtails as microbial grazers", detail: "springtails influence decomposition indirectly through microbial grazing and movement through litter", source: "General Collembola ecology references and springtail decomposition literature", url: "https://www.sciencedirect.com/topics/agricultural-and-biological-sciences/collembola" },
  { subject: "springtails in mold management", detail: "springtails can help consume fungi, but they are not a cure for overfeeding or stagnant husbandry", source: "Recent r/isopods springtail/mold keeper questions", url: "https://www.reddit.com/r/isopods/comments/1sldg6y/to_add_springtails_or_no/" },
  { subject: "bioactive does not mean maintenance-free", detail: "keeper discussions show frass, overpopulation, and leaf litter still need management in isopod terrariums", source: "Recent r/isopods bioactive maintenance discussion", url: "https://www.reddit.com/r/isopods/comments/1slv3w4/bioactive_terrarium_maintenance/" },
  { subject: "small jar terrariums and isopod limits", detail: "tiny terrariums can look stable while still being a poor long-term fit for many isopods", source: "r/isopods magic potion jarrarium care discussion", url: "https://www.reddit.com/r/isopods/comments/1i3ocwc/advice_for_magic_potion_isopods_in_bioactive_terrarium/" },
  { subject: "moist refuges in arid builds", detail: "cleanup crews in drier enclosures need humid pockets even when the display side is dry", source: "r/isopods bioactive tank tips discussion", url: "https://www.reddit.com/r/isopods/comments/mvoq3x/bioactive_tank_tips/" },
  { subject: "plants and terrarium humidity", detail: "terrarium humidity is shaped by evaporation and plant transpiration, which is useful but still needs monitoring", source: "University of Arizona Extension terrarium humidity guide", url: "https://extension.arizona.edu/sites/extension.arizona.edu/files/pubs/az2050-2023.pdf" },
  { subject: "leaf litter as food and habitat", detail: "leaf litter feeds microbes first and isopods later while also creating shelter and humidity structure", source: "Isopod decomposition papers and keeper bioactive discussions", url: "https://www.sciencedirect.com/science/article/pii/S2090989615000363" },
  { subject: "protein moderation", detail: "protein can support colonies, but excess food fuels pests, odor, and mold before it helps growth", source: "Bioactive maintenance and overfeeding keeper discussions", url: "https://www.reddit.com/r/isopods/" },
  { subject: "ventilation versus moisture", detail: "good setups balance airflow with a moisture gradient rather than chasing one humidity number", source: "r/isopods moisture and humidity keeper discussions", url: "https://www.reddit.com/r/isopods/comments/1l8tvgx/moisture_vs_humidity/" },
  { subject: "springtails and isopods together", detail: "keepers frequently pair springtails with isopods, but the setup still needs species-appropriate moisture and food", source: "r/isopods springtails together discussion", url: "https://www.reddit.com/r/isopods/comments/1krp48m/isopods_and_springtails_together_or_separate/" },
  { subject: "overcrowding in display terrariums", detail: "beautiful bioactive displays can still need population management if fast-breeding isopods boom", source: "Bioactive terrarium maintenance keeper discussions", url: "https://www.reddit.com/r/isopods/comments/1slv3w4/bioactive_terrarium_maintenance/" },
  { subject: "plant choice in cleanup crew setups", detail: "hardy plants matter because some isopods nibble soft growth when easier food is missing", source: "Bioactive plant and cleanup crew keeper discussions", url: "https://www.reddit.com/r/bioactive/" },
  { subject: "cork bark as microclimate furniture", detail: "bark provides shelter, climbing surfaces, and humidity pockets that help cleanup crews regulate themselves", source: "Keeper husbandry discussions and bioactive setup guides", url: "https://www.reddit.com/r/isopods/" },
  { subject: "fungus gnats as husbandry feedback", detail: "gnats often indicate excess moisture, extra food, or decomposing organics that need adjustment", source: "Bioactive troubleshooting discussions", url: "https://www.reddit.com/r/bioactive/" },
  { subject: "calcium sources for captive colonies", detail: "cuttlebone, limestone, eggshell, and other calcium sources support molting, but moisture and stress also matter", source: "Isopod molting research plus keeper molt-problem discussions", url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0058968" },
  { subject: "new colony patience", detail: "young colonies may look inactive while individuals settle into hidden humid pockets", source: "Recurring keeper questions in r/isopods", url: "https://www.reddit.com/r/isopods/" },
  { subject: "closed terrarium caution", detail: "sealed humidity can work for many tropical plants but can create ventilation problems for larger cleanup crew populations", source: "Terrarium humidity references and r/terrariums discussion", url: "https://www.reddit.com/r/terrariums/comments/1dmyfnq/is_96_humidity_too_high_for_a_terrarium/" },
  { subject: "substrate depth and stability", detail: "deeper substrate and organic structure can buffer moisture, provide burrowing zones, and stabilize microclimates", source: "Bioactive setup discussions", url: "https://www.reddit.com/r/isopods/comments/1iv1y9z/starting_a_bioactive_advise_welcomed/" },
  { subject: "decaying wood in isopod diets", detail: "rotting wood supports microbial food webs and gives isopods more than just decorative bark", source: "Isopod nutrition and decomposition literature", url: "https://onlinelibrary.wiley.com/doi/pdf/10.1017/S1464793102005912" },
  { subject: "mancae hiding behavior", detail: "babies often stay hidden in stable humid pockets, so a quiet bin is not always an empty bin", source: "Keeper observation angle from r/isopods", url: "https://www.reddit.com/r/isopods/" },
  { subject: "bioactive clean-up crew mismatch", detail: "arid reptiles, humid springtails, and isopods may need carefully separated microhabitats", source: "r/isopods bioactive tank tips discussion", url: "https://www.reddit.com/r/isopods/comments/mvoq3x/bioactive_tank_tips/" },
  { subject: "leaf litter quality over leaf litter quantity", detail: "not all leaves decompose or feed the same way because chemistry and conditioning matter", source: "Paper on litter chemistry, feeding preference, and detritivore microbiomes", url: "https://www.sciencedirect.com/science/article/pii/S0038071722003753" },
];

const crestedAngles: TopicPattern[] = [
  { title: "Science-backed keeper note:", postType: "Isopod Fact", notes: "Share one sourced tidbit, translate it into plain keeper language, and include the source link." },
  { title: "Bioactive reality check:", postType: "Care Tip", notes: "Use the source to correct a common keeper assumption. Mention what to watch in the enclosure." },
  { title: "Random isopod fact:", postType: "Isopod Fact", notes: "Make it concise, interesting, and useful for hobbyists. Include the research/source link." },
  { title: "Terrarium keeper takeaway:", postType: "Care Tip", notes: "Connect the source to isopods, springtails, terrarium plants, or bioactive care." },
];

const crestedEngagementSubjects = [
  "what isopod species surprised you the most",
  "which springtail culture has been easiest for you",
  "what terrarium plant has survived your cleanup crew the best",
  "what was your first isopod species",
  "what is the most dramatic thing your colony has done",
  "what leaf litter do your pods seem to love most",
  "what bioactive mistake taught you the fastest lesson",
  "which enclosure do you check first every day",
  "what is your favorite hide or cork bark setup",
  "what species is still on your wishlist",
  "what is the funniest place you have found springtails",
  "what plant did your isopods immediately taste-test",
  "what is your favorite beginner species and why",
  "what is your most underrated cleanup crew tip",
  "what food gets the biggest colony response",
  "what humidity trick made your setup easier",
  "what is the best expo pickup you ever made",
  "what is a species you love but rarely see discussed",
  "what is the one supply you always keep extra",
  "what did you believe about bioactive setups before keeping one",
  "what is your go-to calcium source",
  "what species hides the most in your collection",
  "what is your favorite terrarium plant combo",
  "what cleanup crew myth do you wish would disappear",
  "what is your most chaotic feeding response",
  "what is one thing you wish beginners knew",
  "what setup change made the biggest difference",
  "what species bred faster than you expected",
  "what species made you learn patience",
  "what is your favorite isopod behavior to watch",
];

const crestedEngagementAngles: TopicPattern[] = [
  {
    title: "Keeper question:",
    postType: "Engagement Question",
    notes: "Ask a simple, inviting question that gets keepers commenting with their own experience. No source link needed.",
  },
  {
    title: "Community check-in:",
    postType: "Engagement Question",
    notes: "Make it friendly and conversational. Encourage photos, species names, or short keeper stories in the comments.",
  },
  {
    title: "Bioactive keeper debate:",
    postType: "Engagement Question",
    notes: "Frame it as a light discussion prompt, not a formal fact post. Keep the Crested Critters voice warm and hobby-focused.",
  },
];

function buildCrestedSeeds() {
  const facts = crestedScienceSources.flatMap((item) =>
    crestedAngles.map((angle) =>
      seed(
        "crested-critters",
        crestedMatchers,
        `${angle.title} ${item.subject}`,
        angle.postType || "Care Tip",
        `${angle.notes} ${sourceLine(item)} Do not overstate the science. Share the source link in the caption and turn the tidbit into a practical keeper takeaway.`
      )
    )
  );

  const engagement = crestedEngagementSubjects.flatMap((subject) =>
    crestedEngagementAngles.map((angle) =>
      seed(
        "crested-critters",
        crestedMatchers,
        `${angle.title} ${subject}`,
        angle.postType || "Engagement Question",
        `${angle.notes} Focus on isopods, springtails, terrarium plants, bioactive setups, or keeper habits.`
      )
    )
  );

  return [...facts, ...engagement];
}

const isopediaGrowthSources: TopicSource[] = [
  { subject: "what Isopedia is", detail: "a community-built database for isopods, springtails, bioactive cleanup crews, terrarium plants, expos, profiles, photos, and care knowledge", source: "Crested Critters Isopedia product direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "creating a keeper profile", detail: "profiles give contributors a visible identity for submissions, photos, collection pages, and community knowledge", source: "Isopedia profile and collection features", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "submitting species knowledge", detail: "the community can add species, morphs, care notes, origin info, humidity, diet, substrate, and photos for review", source: "Isopedia submission workflow", url: "https://isopedia.crestedcritters.com/isopedia/submit" },
  { subject: "suggesting edits", detail: "community corrections keep care information from going stale or staying wrong", source: "Isopedia suggested edit workflow", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "uploading useful species images", detail: "clear photos help keepers identify species, morphs, mancae, and setup examples", source: "Isopedia gallery image workflow", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "adding expo listings", detail: "community-submitted expos make the calendar stronger and bring keepers back to the site", source: "Isopedia expo calendar", url: "https://isopedia.crestedcritters.com/isopedia/expos" },
  { subject: "why verification matters", detail: "review helps community-submitted knowledge stay useful instead of becoming another pile of random internet claims", source: "Isopedia review workflow", url: "https://isopedia.crestedcritters.com/isopedia/review" },
  { subject: "turning scattered comments into searchable knowledge", detail: "the best care tips should not disappear in social threads after two days", source: "Isopedia community knowledge mission", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "new keeper welcome", detail: "beginners can join even if they only have questions, one culture, one photo, or one useful observation", source: "Isopedia community growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "experienced keeper knowledge preservation", detail: "advanced keepers can document rare species, hard lessons, breeding notes, and setup observations before they get lost", source: "Isopedia community growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "collection pages as connection tools", detail: "public collection pages can help keepers connect, trade, buy, sell, and compare experience", source: "Isopedia collection feature direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "species page gaps", detail: "missing pages are an invitation for keepers to contribute, not a reason to wait until the database is perfect", source: "Isopedia database growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "photo credit and contributor recognition", detail: "contributors should feel seen when their photos, edits, and species submissions help the hobby", source: "Isopedia contribution direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "expo discovery teaser", detail: "people should visit the expo calendar rather than only seeing event details on Facebook", source: "Isopedia expo calendar strategy", url: "https://isopedia.crestedcritters.com/isopedia/expos" },
  { subject: "community over gatekeeping", detail: "helpful knowledge grows faster when keepers contribute openly and respectfully", source: "Isopedia community mission", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "one small contribution challenge", detail: "ask followers to add one photo, one edit, one species note, one expo, or one profile update", source: "Isopedia community growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "keeper credibility", detail: "profiles and contributions help people show what they actually keep and what they have learned", source: "Isopedia profile direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "bioactive knowledge sharing", detail: "cleanup crew, plant, humidity, substrate, and pest notes become more useful when searchable", source: "Isopedia bioactive content direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "verified species shoutouts", detail: "new verified species posts should thank the submitter and verifier and use the species image when available", source: "Isopedia smart post behavior", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "submission review shoutouts", detail: "new species review posts should invite knowledgeable keepers to help review fresh submissions", source: "Isopedia smart post behavior", url: "https://isopedia.crestedcritters.com/isopedia/review" },
  { subject: "why lurkers matter", detail: "quiet keepers often have the exact observation that helps someone else solve a problem", source: "Isopedia community growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "species comparison value", detail: "photos and notes make it easier to compare similar species, morphs, and care expectations", source: "Isopedia database mission", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "local keeper connections", detail: "profiles, collections, and expo listings can help keepers find community beyond algorithm feeds", source: "Isopedia community direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "database before perfection", detail: "a living database gets better through use, submissions, corrections, and review", source: "Isopedia product direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "keeper experience as data", detail: "real outcomes from real cultures can make care pages stronger than generic summaries", source: "Isopedia community knowledge direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "monthly contributor push", detail: "encourage people to build profiles and make one useful contribution this month", source: "Isopedia growth direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "care notes that save beginners", detail: "humidity, ventilation, diet, substrate, and difficulty notes can prevent avoidable mistakes", source: "Isopedia submission workflow", url: "https://isopedia.crestedcritters.com/isopedia/submit" },
  { subject: "expo calendar missing shows", detail: "ask followers to add expos they know about so the calendar gets less embarrassing and more useful", source: "Isopedia expo calendar strategy", url: "https://isopedia.crestedcritters.com/isopedia/expos" },
  { subject: "community review as a feature", detail: "review is how Isopedia avoids becoming a random unverified care sheet", source: "Isopedia review workflow", url: "https://isopedia.crestedcritters.com/isopedia/review" },
  { subject: "share the weird little detail", detail: "odd observations about behavior, feeding, molting, or plants may be exactly what another keeper needs", source: "Isopedia community knowledge direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "turn collections into profiles", detail: "ask people to make a profile and start logging what they keep", source: "Isopedia profile direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "build the resource you wanted as a beginner", detail: "frame contribution as making the hobby easier for the next keeper", source: "Isopedia community mission", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "verified information with human credit", detail: "Isopedia should feel like a community, not a faceless database", source: "Isopedia smart post direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "species submission challenge", detail: "ask people to submit one species, morph, or cleanup crew entry they know well", source: "Isopedia submission workflow", url: "https://isopedia.crestedcritters.com/isopedia/submit" },
  { subject: "photo-first contribution", detail: "some people may not write care guides, but a clear photo can still help the database", source: "Isopedia image contribution direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "expo Monday habit", detail: "weekly posts should tease the number of upcoming expos and push people to the expo page", source: "Isopedia expo calendar strategy", url: "https://isopedia.crestedcritters.com/isopedia/expos" },
  { subject: "community stats as accountability", detail: "show growth, ask for help, and make the community feel like they are building something together", source: "Isopedia smart stats direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "from Facebook thread to permanent page", detail: "turn useful posts and comments into lasting Isopedia entries", source: "Isopedia community knowledge mission", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "why profiles help future paid backup", detail: "profiles and collections lay groundwork for optional future backup features without forcing server storage today", source: "Isopedia product direction", url: "https://isopedia.crestedcritters.com/isopedia" },
  { subject: "community challenge for reviewers", detail: "ask knowledgeable members to help review pending submissions so good info goes live faster", source: "Isopedia review workflow", url: "https://isopedia.crestedcritters.com/isopedia/review" },
];

const isopediaAngles: TopicPattern[] = [
  { title: "Help build Isopedia:", postType: "Growth Post", notes: "Explain what Isopedia is and give one specific community action." },
  { title: "Isopedia community call:", postType: "Growth Post", notes: "Use a direct CTA to create a profile, contribute knowledge, upload photos, suggest edits, add expos, or review submissions." },
  { title: "Why keepers should join Isopedia for", postType: "Growth Post", notes: "Focus on benefits for the keeper and the hobby. Make the community feel needed." },
  { title: "One small way to grow Isopedia:", postType: "Growth Post", notes: "Make the contribution feel easy and low-pressure." },
  { title: "The Isopedia pitch for", postType: "Growth Post", notes: "Explain the feature/value clearly without sounding like an ad." },
  { title: "Community knowledge reminder:", postType: "Growth Post", notes: "Make the post warm, practical, and contribution-focused." },
];

function buildIsopediaSeeds() {
  return isopediaGrowthSources.flatMap((item) =>
    isopediaAngles.map((angle) =>
      seed(
        "isopedia",
        isopediaMatchers,
        `${angle.title} ${item.subject}`,
        angle.postType || "Growth Post",
        `${angle.notes} Inspiration only: ${item.detail}. Do not mention or link the source. Do not present this as the once-daily stats recap, verified species alert, submitted-for-review alert, or expo roundup unless the post type says so.`
      )
    )
  );
}

export const requestedTopicSeeds: TopicSeed[] = [
  ...buildPovertySeeds(),
  ...buildTapDeckSeeds(),
  ...buildCrestedSeeds(),
  ...buildIsopediaSeeds(),
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
    isopedia: 0,
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
