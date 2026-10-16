import {ReactElement} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";

type AbilityKey =
    | "airmanship"
    | "combat"
    | "weapons"
    | "awareness"
    | "systems"
    | "analysis"
    | "intelligence"
    | "reflexes"
    | "composure"
    | "physique";

type OutcomeKey = "YES_AND" | "YES" | "YES_BUT" | "NO" | "NO_AND";

type Resolution = {
    ability: AbilityKey;
    support: AbilityKey | null;
    difficulty: 0 | 1 | 2 | 3;
    roll: number;
    target: number;
    outcome: OutcomeKey;
};

type MessageStateType = {
    lastResolution: Resolution | null;
};

type ChatStateType = Record<string, never>;
type InitStateType = Record<string, never>;

type ConfigType = Partial<Record<AbilityKey, number>> & {
    difficultyBias?: number;
    debugVisible?: boolean;
    triggerSensitivity?: number;
    // Legacy setting from the first draft. Kept so an older saved config still works.
    minimumActionScore?: number;
};

type SettingsType = Record<AbilityKey, number> & {
    difficultyBias: number;
    debugVisible: boolean;
    triggerSensitivity: number;
    minimumActionScore: number;
};

type Rule = {
    ability: AbilityKey;
    patterns: Array<{re: RegExp; weight: number}>;
};

const LABELS: Record<AbilityKey, string> = {
    airmanship: "Airmanship",
    combat: "Combat Maneuvering",
    weapons: "Weapons",
    awareness: "Situational Awareness",
    systems: "Systems",
    analysis: "Analysis",
    intelligence: "Intelligence",
    reflexes: "Reflexes",
    composure: "Composure",
    physique: "Physique",
};

const OUTCOME_LABELS: Record<OutcomeKey, string> = {
    YES_AND: "YES, AND...",
    YES: "YES",
    YES_BUT: "YES, BUT...",
    NO: "NO",
    NO_AND: "NO, AND...",
};

const RULES: Rule[] = [
    {
        ability: "combat",
        patterns: [
            {re: /\b(dogfight|merge|bfm|one[- ]circle|two[- ]circle|scissors|rolling scissors|flat scissors)\b/i, weight: 4},
            {re: /\b(get|move|slide|pull|turn|maneuver)\b.{0,30}\b(behind|onto (his|her|their) six|on (his|her|their) six|into firing position)\b/i, weight: 4},
            {re: /\b(overshoot|reversal|reverse|yo[- ]?yo|lag pursuit|lead pursuit|pure pursuit|energy fight|rate fight|radius fight)\b/i, weight: 4},
            {re: /\b(evade|dodge|break|jink|shake|defeat)\b.{0,35}\b(missile|fighter|bandit|pursuer|lock|attack)\b/i, weight: 4},
            {re: /\bforce\b.{0,25}\b(overshoot|mistake|break)\b/i, weight: 3},
        ],
    },
    {
        ability: "airmanship",
        patterns: [
            {re: /\b(bank|roll|climb|dive|descend|pitch|yaw|turn|pull up|level off|flare|trim)\b/i, weight: 2},
            {re: /\b(take ?off|land|landing|touch down|carrier landing|trap|bolter|approach|formation|rejoin|refuel|aerial refuel)\b/i, weight: 3},
            {re: /\b(terrain follow|nap[- ]of[- ]the[- ]earth|low level|fly through|thread)\b/i, weight: 3},
            {re: /\b(cobra|kulbit|immelmann|split[- ]?s|barrel roll|aileron roll)\b/i, weight: 4},
            {re: /\b(recover)\b.{0,20}\b(stall|spin|aircraft|jet|fighter)\b/i, weight: 4},
        ],
    },
    {
        ability: "weapons",
        patterns: [
            {re: /\b(fire|shoot|launch|pickle|release)\b.{0,35}\b(missile|gun|cannon|bomb|rocket|torpedo|weapon)\b/i, weight: 4},
            {re: /\b(gun run|strafe|strafing|bombing run|missile shot|fox one|fox two|fox three|guns guns guns)\b/i, weight: 4},
            {re: /\b(aim|lead|solution|pipper|lock|tone)\b.{0,30}\b(target|bandit|fighter|bomber|ship|vehicle)\b/i, weight: 3},
            {re: /\b(hit|destroy|disable|shoot down)\b.{0,35}\b(target|bandit|fighter|bomber|aircraft|ship|radar|sam)\b/i, weight: 3},
        ],
    },
    {
        ability: "awareness",
        patterns: [
            {re: /\b(scan|search|look for|spot|find|locate|identify|tally|visual)\b/i, weight: 2},
            {re: /\b(check|watch|monitor)\b.{0,25}\b(radar|rwr|scope|six|airspace|sky|threat|contacts)\b/i, weight: 3},
            {re: /\b(missile warning|spike|nails|mud|bandit|bogey|contact)\b/i, weight: 2},
            {re: /\b(keep track|maintain track|situational awareness|picture)\b/i, weight: 4},
        ],
    },
    {
        ability: "systems",
        patterns: [
            {re: /\b(radar|ecm|jammer|datalink|irst|ins|gps|tacan|iff|avionics|sensor|autopilot)\b/i, weight: 2},
            {re: /\b(switch|set|configure|cycle|restart|reset|reboot|reroute|isolate)\b.{0,30}\b(radar|system|avionics|hydraulic|electrical|engine|sensor|weapon)\b/i, weight: 4},
            {re: /\b(jam|spoof|break lock|countermeasure|chaff|flare)\b/i, weight: 3},
            {re: /\b(damage control|emergency system|manual reversion)\b/i, weight: 4},
        ],
    },
    {
        ability: "analysis",
        patterns: [
            {re: /\b(analy[sz]e|assess|calculate|estimate|predict|anticipate|deduce|infer)\b/i, weight: 3},
            {re: /\b(pattern|trajectory|intercept|geometry|closure|energy state|enemy tactic|flight path)\b/i, weight: 2},
            {re: /\b(plan|plot|choose)\b.{0,30}\b(route|attack|approach|intercept|maneuver|escape)\b/i, weight: 3},
            {re: /\b(work out|figure out)\b.{0,30}\b(what|where|how|why)\b/i, weight: 2},
        ],
    },
    {
        ability: "intelligence",
        patterns: [
            {re: /\b(remember|recall|recognize|know|understand)\b/i, weight: 2},
            {re: /\b(engineer|repair|fix|improvise|jury[- ]rig|bypass)\b/i, weight: 3},
            {re: /\b(technical|mechanical|aerodynamic|electrical|structural|weapons data|aircraft type)\b/i, weight: 2},
            {re: /\b(solve|compute|derive)\b/i, weight: 3},
        ],
    },
    {
        ability: "reflexes",
        patterns: [
            {re: /\b(react|snap|instantly|immediately|last second|split second)\b/i, weight: 3},
            {re: /\b(dodge|duck|jink|break hard|snap roll)\b/i, weight: 3},
            {re: /\b(sudden|unexpected)\b.{0,25}\b(missile|attack|fire|obstacle|threat)\b/i, weight: 3},
        ],
    },
    {
        ability: "composure",
        patterns: [
            {re: /\b(stay calm|keep calm|steady|focus|concentrate|hold it together|keep control)\b/i, weight: 3},
            {re: /\b(panic|fear|stress|shock|overwhelmed|disoriented)\b/i, weight: 2},
            {re: /\b(under fire|taking fire|being chased|missile inbound)\b/i, weight: 2},
        ],
    },
    {
        ability: "physique",
        patterns: [
            {re: /\b(g[- ]?force|high[- ]?g|blackout|greyout|g[- ]loc|strain)\b/i, weight: 3},
            {re: /\b(endure|withstand|hold breath|stay conscious)\b/i, weight: 3},
            {re: /\b(injured|wounded|bleeding|pain|burned|broken)\b/i, weight: 2},
            {re: /\b(climb|crawl|swim|run|carry|lift|drag|eject|parachute)\b/i, weight: 2},
        ],
    },
];

const RISK_PATTERNS: RegExp[] = [
    /\b(missile|sam|aaa|gunfire|under fire|taking fire|enemy|bandit|bogey|dogfight|attack|intercept|combat)\b/i,
    /\b(canyon|tunnel|bridge|city|mountain|terrain|low altitude|low level|deck)\b/i,
    /\b(damaged|engine out|engine failure|hydraulic|fire|stall|spin|flameout)\b/i,
    /\b(storm|thunder|icing|night|fog|poor visibility|cloud)\b/i,
    /\b(outnumbered|multiple missiles|saturation|ace|elite enemy)\b/i,
];

const HARD_PATTERNS: RegExp[] = [
    /\b(canyon|tunnel|under bridge|through the bridge|terrain masking|nap[- ]of[- ]the[- ]earth)\b/i,
    /\b(damaged|engine out|engine failure|hydraulic failure|on fire|flameout|stall|spin)\b/i,
    /\b(carrier landing|night landing|storm landing|aerial refuel)\b/i,
    /\b(missile inbound|missile closing|multiple missiles|sam saturation|outnumbered)\b/i,
];

const EXTREME_PATTERNS: RegExp[] = [
    /\b(flat spin|both engines out|no controls|control failure|blind landing)\b/i,
    /\b(tunnel)\b.{0,40}\b(damaged|missile|supersonic|afterburner)\b/i,
    /\b(multiple missiles|sam saturation)\b.{0,40}\b(low altitude|damaged|outnumbered)\b/i,
];

function clamp(min: number, max: number, value: number): number {
    return Math.max(min, Math.min(max, value));
}

function sensitivityToMinimumScore(sensitivity: number): number {
    // UI is intuitive: a HIGHER sensitivity means MORE actions trigger.
    // Internally, triggering uses a minimum keyword score, so the mapping is inverted.
    const level = Math.round(clamp(1, 5, sensitivity));
    return ({1: 5, 2: 4, 3: 3, 4: 2, 5: 1} as Record<number, number>)[level];
}

function stripQuotedSpeech(text: string): string {
    return text
        .replace(/“[^”]*”/g, " ")
        .replace(/"[^"]*"/g, " ")
        .replace(/‘[^’]*’/g, " ");
}

function isOutOfCharacter(text: string): boolean {
    const t = text.trim();
    return /^(ooc\s*:|\[ooc\]|\(ooc\)|\/ooc\b)/i.test(t);
}

function scoreAbilities(text: string): Array<{ability: AbilityKey; score: number}> {
    const scores = RULES.map(rule => {
        const score = rule.patterns.reduce((sum, pattern) => sum + (pattern.re.test(text) ? pattern.weight : 0), 0);
        return {ability: rule.ability, score};
    });
    return scores.sort((a, b) => b.score - a.score);
}

function estimateDifficulty(text: string, bias: number): 0 | 1 | 2 | 3 {
    if (EXTREME_PATTERNS.some(re => re.test(text))) {
        return clamp(0, 3, 3 + bias) as 0 | 1 | 2 | 3;
    }

    let difficulty = 1;
    const hardHits = HARD_PATTERNS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0);
    const riskHits = RISK_PATTERNS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0);

    if (hardHits >= 1) difficulty = 2;
    if (hardHits >= 2 || riskHits >= 3) difficulty = 3;

    // Benign handling actions are routine unless another risk marker is present.
    const routine = /\b(taxi|cruise|climb to|descend to|join formation|rejoin formation|normal landing|normal takeoff)\b/i.test(text);
    if (routine && riskHits === 0 && hardHits === 0) difficulty = 0;

    return clamp(0, 3, difficulty + bias) as 0 | 1 | 2 | 3;
}

function rollOutcome(primary: number, support: number, difficulty: number): {roll: number; target: number; outcome: OutcomeKey} {
    // Lower is better. At Veteran (3) + Standard difficulty, this is roughly:
    // 9% critical success, 50% normal success, 20% partial, 17% failure, 4% critical failure.
    const target = Math.round(clamp(15, 90, 45 + primary * 8 + support * 2 - difficulty * 10));
    const roll = Math.floor(Math.random() * 100) + 1;
    const critSuccessCutoff = Math.round(clamp(2, 15, target * 0.15));

    if (roll >= 97) return {roll, target, outcome: "NO_AND"};
    if (roll <= critSuccessCutoff) return {roll, target, outcome: "YES_AND"};
    if (roll <= target) return {roll, target, outcome: "YES"};
    if (roll <= Math.min(96, target + 20)) return {roll, target, outcome: "YES_BUT"};
    return {roll, target, outcome: "NO"};
}

function outcomeInstruction(outcome: OutcomeKey): string {
    switch (outcome) {
        case "YES_AND":
            return "The intended action succeeds decisively, and it also creates a meaningful extra advantage, opening, information gain, positional gain, saved resource, or other favorable consequence.";
        case "YES":
            return "The intended action succeeds cleanly. Do not add an arbitrary penalty just to make the scene harder.";
        case "YES_BUT":
            return "The core intent succeeds, but attach one meaningful and immediate cost, complication, tradeoff, reduced effect, lost position, expended resource, damage, delay, or new threat.";
        case "NO":
            return "The intended action fails or does not achieve its goal. Keep the failure plausible and proportionate; do not automatically injure or kill the user character.";
        case "NO_AND":
            return "The intended action fails, and the failure also introduces a serious new complication appropriate to the fiction: worse position, damage, lost energy, separation, systems problem, enemy advantage, or comparable escalation.";
    }
}

function difficultyLabel(value: number): string {
    return ["Routine", "Standard", "Hard", "Extreme"][value] ?? "Standard";
}

export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {
    private state: MessageStateType;
    private settings: SettingsType;

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        super(data);
        const c = data.config ?? {};

        const triggerSensitivity = clamp(1, 5, c.triggerSensitivity ?? 3);
        const legacyThreshold = c.minimumActionScore != null ? clamp(1, 6, c.minimumActionScore) : null;

        this.settings = {
            airmanship: clamp(0, 5, c.airmanship ?? 3),
            combat: clamp(0, 5, c.combat ?? 3),
            weapons: clamp(0, 5, c.weapons ?? 3),
            awareness: clamp(0, 5, c.awareness ?? 3),
            systems: clamp(0, 5, c.systems ?? 2),
            analysis: clamp(0, 5, c.analysis ?? 3),
            intelligence: clamp(0, 5, c.intelligence ?? 2),
            reflexes: clamp(0, 5, c.reflexes ?? 3),
            composure: clamp(0, 5, c.composure ?? 3),
            physique: clamp(0, 5, c.physique ?? 3),
            difficultyBias: clamp(-1, 1, c.difficultyBias ?? 0),
            debugVisible: c.debugVisible ?? false,
            triggerSensitivity,
            minimumActionScore: legacyThreshold ?? sensitivityToMinimumScore(triggerSensitivity),
        };

        this.state = data.messageState ?? {lastResolution: null};
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        return {
            success: true,
            error: null,
            initState: null,
            chatState: null,
        };
    }

    async setState(state: MessageStateType): Promise<void> {
        this.state = state ?? {lastResolution: null};
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        if (userMessage.isBot || !userMessage.content || isOutOfCharacter(userMessage.content)) {
            return {messageState: this.state, stageDirections: null, modifiedMessage: null, systemMessage: null, error: null, chatState: null};
        }

        const actionText = stripQuotedSpeech(userMessage.content);
        const ranked = scoreAbilities(actionText);
        const primary = ranked[0];

        if (!primary || primary.score < this.settings.minimumActionScore) {
            this.state = {lastResolution: null};
            return {messageState: this.state, stageDirections: null, modifiedMessage: null, systemMessage: null, error: null, chatState: null};
        }

        const secondary = ranked.find(item => item.ability !== primary.ability && item.score > 0) ?? null;
        const difficulty = estimateDifficulty(actionText, this.settings.difficultyBias);
        const primaryScore = this.settings[primary.ability] as number;
        const supportScore = secondary ? (this.settings[secondary.ability] as number) : 0;
        const rolled = rollOutcome(primaryScore, supportScore, difficulty);

        const resolution: Resolution = {
            ability: primary.ability,
            support: secondary?.ability ?? null,
            difficulty,
            roll: rolled.roll,
            target: rolled.target,
            outcome: rolled.outcome,
        };
        this.state = {lastResolution: resolution};

        const supportLine = resolution.support ? `Supporting ability: ${LABELS[resolution.support]}.` : "Supporting ability: none.";
        const stageDirections = [
            "[ACE NARRATIVE RESOLUTION — HIDDEN MECHANICAL RESULT]",
            "The user's attempted risky action has already been resolved mechanically. Treat this result as binding when narrating the immediate consequence.",
            `Primary ability: ${LABELS[resolution.ability]}.`,
            supportLine,
            `Difficulty: ${difficultyLabel(resolution.difficulty)}.`,
            `Outcome: ${OUTCOME_LABELS[resolution.outcome]}.`,
            outcomeInstruction(resolution.outcome),
            "Interpret the result naturally inside the current story and aviation context.",
            "Do NOT reroll, override, soften, or reverse this result because of narrative preference.",
            "Do NOT mention dice, target numbers, stats, ability names, the stage, or the phrase 'mechanical result' in the prose.",
            "Do not literally say 'yes, and', 'yes', 'yes, but', 'no', or 'no, and' unless those words belong naturally in dialogue.",
            "For dogfights, model position, energy, closure, sensors, weapons employment, damage, terrain, wingmen, and enemy skill plausibly. A successful maneuver need not automatically destroy an enemy; it achieves the user's stated intent and any extra effect implied by the outcome.",
            "A partial success must preserve the user's core success while adding a real consequence. A critical failure should escalate the situation, not arbitrarily kill the user character.",
            "Do not invent additional voluntary actions for the user character beyond what the user attempted. NPCs and the environment may react normally.",
            "Social dialogue itself never requires a check from this system; only resolved physical, technical, cognitive, or piloting actions do.",
            "[END ACE NARRATIVE RESOLUTION]",
        ].join("\n");

        const systemMessage = this.settings.debugVisible
            ? `Resolver: ${OUTCOME_LABELS[resolution.outcome]} — ${LABELS[resolution.ability]}${resolution.support ? ` + ${LABELS[resolution.support]}` : ""}, ${difficultyLabel(resolution.difficulty)} (roll ${resolution.roll}, target ${resolution.target})`
            : null;

        return {
            stageDirections,
            messageState: this.state,
            modifiedMessage: null,
            systemMessage,
            error: null,
            chatState: null,
        };
    }

    async afterResponse(_botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        return {
            stageDirections: null,
            messageState: this.state,
            modifiedMessage: null,
            systemMessage: null,
            error: null,
            chatState: null,
        };
    }

    render(): ReactElement {
        // This stage is intended to use position: NONE and run invisibly.
        return <></>;
    }
}
