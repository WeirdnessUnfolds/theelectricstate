import YAML from 'yaml';

/**
 * Stats that can be inferred from character definitions
 */
export interface InferredStats {
    strength?: number;
    agility?: number;
    wits?: number;
    empathy?: number;
    health?: number;
    hope?: number;
    bliss?: number;
}

/**
 * Trait definitions mapped to stat modifiers
 * These are used to infer stats from character descriptions and personality
 */
const TRAIT_STAT_MAP: Record<string, Partial<InferredStats>> = {
    // Strength traits
    'strong': { strength: 1 },
    'powerful': { strength: 1 },
    'muscular': { strength: 1 },
    'robust': { strength: 1 },
    'tough': { strength: 0.5 },
    'weak': { strength: -1 },
    'frail': { strength: -1 },

    // Agility traits
    'agile': { agility: 1 },
    'nimble': { agility: 1 },
    'quick': { agility: 1 },
    'swift': { agility: 0.5 },
    'fast': { agility: 0.5 },
    'clumsy': { agility: -1 },
    'slow': { agility: -0.5 },

    // Wits traits
    'clever': { wits: 1 },
    'intelligent': { wits: 1 },
    'sharp': { wits: 1 },
    'brilliant': { wits: 1 },
    'quick-witted': { wits: 1 },
    'smart': { wits: 0.5 },
    'wise': { wits: 0.5 },
    'dumb': { wits: -1 },
    'stupid': { wits: -1 },

    // Empathy traits
    'empathetic': { empathy: 1 },
    'compassionate': { empathy: 1 },
    'kind': { empathy: 0.5 },
    'caring': { empathy: 0.5 },
    'friendly': { empathy: 0.5 },
    'charming': { empathy: 0.5 },
    'cruel': { empathy: -1 },
    'cold': { empathy: -1 },
    'heartless': { empathy: -1 },

    // Hope traits
    'optimistic': { hope: 1 },
    'hopeful': { hope: 1 },
    'cheerful': { hope: 0.5 },
    'upbeat': { hope: 0.5 },
    'determined': { hope: 0.5 },
    'pessimistic': { hope: -1 },
    'hopeless': { hope: -1 },
    'depressed': { hope: -1 },

    // Health (general wellness)
    'healthy': { health: 1 },
    'fit': { health: 0.5 },
    'sick': { health: -1 },
    'ill': { health: -1 },
    'injured': { health: -0.5 },
};

/**
 * Archetype definitions with their key attributes
 */
const ARCHETYPES: Record<string, { name: string; keyAttribute: keyof InferredStats }> = {
    artist: { name: 'Artist', keyAttribute: 'empathy' },
    musician: { name: 'Artist', keyAttribute: 'empathy' },
    criminal: { name: 'Criminal', keyAttribute: 'strength' },
    devotee: { name: 'Devotee', keyAttribute: 'empathy' },
    doctor: { name: 'Doctor', keyAttribute: 'empathy' },
    'drone pilot': { name: 'Drone pilot', keyAttribute: 'wits' },
    'drone-pilot': { name: 'Drone pilot', keyAttribute: 'wits' },
    dronepilot: { name: 'Drone pilot', keyAttribute: 'wits' },
    investigator: { name: 'Investigator', keyAttribute: 'wits' },
    outsider: { name: 'Outsider', keyAttribute: 'agility' },
    'runaway kid': { name: 'Runaway kid', keyAttribute: 'agility' },
    'runaway-kid': { name: 'Runaway kid', keyAttribute: 'agility' },
    runawaykid: { name: 'Runaway kid', keyAttribute: 'agility' },
    scientist: { name: 'Scientist', keyAttribute: 'wits' },
    veteran: { name: 'Veteran', keyAttribute: 'strength' },
};

/**
 * Keyword patterns that indicate specific stat ranges
 */
const STAT_KEYWORDS: Record<string, { stat: keyof InferredStats; weight: number }[]> = {
    'warrior|fighter|soldier|strong|powerful|muscular': [
        { stat: 'strength', weight: 2 },
        { stat: 'agility', weight: 1 },
    ],
    'dancer|thief|acrobat|nimble|quick|swift': [
        { stat: 'agility', weight: 2 },
        { stat: 'wits', weight: 1 },
    ],
    'scholar|mage|wizard|sage|genius|clever': [
        { stat: 'wits', weight: 2 },
        { stat: 'empathy', weight: 0.5 },
    ],
    'healer|priest|counselor|diplomat|empath|kind': [
        { stat: 'empathy', weight: 2 },
        { stat: 'hope', weight: 1 },
    ],
    'cheerful|optimistic|joyful|happy|blessed': [
        { stat: 'hope', weight: 1.5 },
    ],
};

/**
 * Load and parse a YAML character file
 */
export async function loadCharacterYAML(filePath: string): Promise<Record<string, any>> {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            console.warn(`Failed to load character file: ${filePath}`);
            return {};
        }
        const yamlText = await response.text();
        return YAML.parse(yamlText) || {};
    } catch (error) {
        console.warn(`Error loading character YAML from ${filePath}:`, error);
        return {};
    }
}

/**
 * Extract text content from a character definition for analysis
 */
function extractCharacterText(character: Record<string, any>): string {
    const textParts = [];

    // Collect all string fields
    if (character.personality) textParts.push(character.personality);
    if (character.description) textParts.push(character.description);
    if (character.scenario) textParts.push(character.scenario);
    if (character.first_message) textParts.push(character.first_message);
    if (character.example_dialogs) textParts.push(character.example_dialogs);
    if (character.system_prompt) textParts.push(character.system_prompt);
    if (character.archetype) textParts.push(character.archetype);

    return textParts.join(' ').toLowerCase();
}

/**
 * Score stats based on trait keyword matching
 */
function scoreStatsFromText(text: string): Partial<InferredStats> {
    const scores: Record<string, number> = {
        strength: 0,
        agility: 0,
        wits: 0,
        empathy: 0,
        health: 0,
        hope: 0,
    };

    // Check trait patterns
    for (const [traits, statMods] of Object.entries(TRAIT_STAT_MAP)) {
        const regex = new RegExp(`\\b${traits}\\b`, 'gi');
        const matches = text.match(regex) || [];
        const count = matches.length;

        for (const [stat, modifier] of Object.entries(statMods)) {
            if (stat in scores) {
                scores[stat] += (modifier || 0) * count;
            }
        }
    }

    // Check keyword patterns
    for (const [keywords, statWeights] of Object.entries(STAT_KEYWORDS)) {
        const regex = new RegExp(keywords, 'gi');
        if (regex.test(text)) {
            for (const { stat, weight } of statWeights) {
                if (stat in scores) {
                    scores[stat] += weight;
                }
            }
        }
    }

    return scores as Partial<InferredStats>;
}

/**
 * Normalize scores to a 1-5 range (excludes bliss which is not inferred)
 */
function normalizeScores(scores: Record<string, number>): Partial<InferredStats> {
    const result: Partial<InferredStats> = {};
    const maxScore = Math.max(...Object.values(scores).map(Math.abs), 1);

    for (const [stat, score] of Object.entries(scores)) {
        if (stat in scores && maxScore > 0 && stat !== 'bliss') {
            // Normalize to 1-5 range (center at 3)
            const normalized = 3 + (score / maxScore) * 2;
            result[stat as keyof InferredStats] = Math.max(1, Math.min(5, Math.round(normalized * 10) / 10));
        }
    }

    return result;
}

/**
 * Infer stats from a character definition
 */
export function inferStatsFromCharacter(character: Record<string, any>): InferredStats {
    // Start with any explicitly defined stats
    const explicit: Partial<InferredStats> = {
        strength: character.stats?.strength,
        agility: character.stats?.agility,
        wits: character.stats?.wits,
        empathy: character.stats?.empathy,
        health: character.stats?.health,
        hope: character.stats?.hope,
        bliss: character.stats?.bliss,
    };

    // Remove undefined values
    const definedExplicit = Object.fromEntries(
        Object.entries(explicit).filter(([, v]) => v !== undefined)
    ) as Partial<InferredStats>;

    // If all non-bliss stats are explicitly defined, we can still use them
    // (bliss is special and always defaults to 0 if not set)

    // Extract and analyze text content
    const characterText = extractCharacterText(character);
    const inferred = scoreStatsFromText(characterText);
    
    // Apply archetype key attribute boost
    const archetypeName = character.archetype || extractArchetype(character);
    const archetypeKey = archetypeName.toLowerCase().replace(/\s+/g, ' ');
    const archetypeMatch = Object.entries(ARCHETYPES).find(([key]) => key === archetypeKey);
    
    if (archetypeMatch) {
        const keyAttribute = archetypeMatch[1].keyAttribute;
        inferred[keyAttribute] = (inferred[keyAttribute] || 0) + 2; // Boost key attribute by 2
    }
    
    const normalized = normalizeScores(
        inferred as Record<string, number>
    ) as Partial<InferredStats>;

    // Merge explicit and inferred, with explicit taking precedence
    // Note: bliss is not inferred and defaults to 0 if not explicitly defined
    const result: InferredStats = {
        strength: definedExplicit.strength ?? (normalized.strength || 3),
        agility: definedExplicit.agility ?? (normalized.agility || 3),
        wits: definedExplicit.wits ?? (normalized.wits || 3),
        empathy: definedExplicit.empathy ?? (normalized.empathy || 3),
        health: definedExplicit.health ?? (normalized.health || 3),
        hope: definedExplicit.hope ?? (normalized.hope || 3),
        bliss: definedExplicit.bliss ?? 0,
    };

    return result;
}

/**
 * Infer other character attributes from definitions
 * Note: Attributes are not inferred - user must enter them explicitly
 */
export function inferAttributesFromCharacter(character: Record<string, any>): {
    archetype?: string;
    description?: string;
    talents?: string;
    dream?: string;
    flaw?: string;
    gear?: string;
    threat?: string;
} {
    return {
        archetype: character.archetype || extractArchetype(character),
        description: character.description || '',
        talents: character.talents || '',
        dream: character.dream || '',
        flaw: character.flaw || '',
        gear: character.gear || '',
        threat: character.threat || '',
    };
}

/**
 * Extract archetype from character definition
 */
function extractArchetype(character: Record<string, any>): string {
    // Check if archetype is explicitly defined
    if (character.archetype) {
        const explicit = character.archetype.toLowerCase();
        const match = Object.entries(ARCHETYPES).find(([key]) => key === explicit);
        if (match) {
            return match[1].name;
        }
        return character.archetype;
    }

    const text = (character.personality || character.description || '').toLowerCase();

    // Search for archetype keywords in text
    for (const [key, archetype] of Object.entries(ARCHETYPES)) {
        if (text.includes(key)) {
            return archetype.name;
        }
    }

    return 'Outsider';
}
