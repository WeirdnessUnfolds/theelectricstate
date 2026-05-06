import {ReactElement, useEffect, useState} from "react";
import {StageBase, StageResponse, InitialData, Message} from "@chub-ai/stages-ts";
import {LoadResponse} from "@chub-ai/stages-ts/dist/types/load";
import {inferStatsFromCharacter, inferAttributesFromCharacter, loadCharacterYAML, InferredStats} from "./characterStats";

type AnyRecord = {[key: string]: any};

type TensionEntry = {
    with: string;
    value: string;
};

type CharacterStatus = {
    id: string;
    name: string;
    archetype: string;
    favoriteSong: string;
    description: string;
    strength: string;
    agility: string;
    wits: string;
    empathy: string;
    health: string;
    hope: string;
    bliss: string;
    permanent: string;
    talents: string;
    dream: string;
    flaw: string;
    gear: string;
    cash: string;
    journey: string;
    goal: string;
    threat: string;
    injuriesAndTrauma: string;
    tension: TensionEntry[];
};

function firstDefinedString(values: any[], fallback: string): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }
    return fallback;
}


type CharacterStatusBoardProps = {
    initialStatuses: CharacterStatus[];
};

type DiceRoll = {
    dice: number[];
    modifiers: number;
};

function DiceRoller({statuses, onUpdateStatus}: {statuses: CharacterStatus[]; onUpdateStatus: (characterId: string, field: keyof Omit<CharacterStatus, "id" | "tension">, value: string) => void}): ReactElement {
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>(statuses[0]?.id ?? "");
    const [selectedAttribute, setSelectedAttribute] = useState<string>("strength");
    const [modifiers, setModifiers] = useState<number>(0);
    const [rollHistory, setRollHistory] = useState<DiceRoll[]>([]);
    const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
    const [hopePenalty, setHopePenalty] = useState<number>(0);

    const attributes = ["strength", "agility", "wits", "empathy"];

    function rollDice(baseCount: number): number[] {
        const dice: number[] = [];
        for (let i = 0; i < baseCount; i++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
        return dice;
    }

    function handleRoll(): void {
        const diceCount = Math.max(1, 6 + modifiers);
        const dice = rollDice(diceCount);
        const roll: DiceRoll = {dice, modifiers};
        setLastRoll(roll);
        setRollHistory([roll, ...rollHistory]);
        setHopePenalty(0);
    }

    function handlePush(): void {
        if (!lastRoll) return;
        const rerollable = lastRoll.dice.filter((d) => d !== 1 && d !== 6);
        if (rerollable.length === 0) {
            setLastRoll({...lastRoll, dice: lastRoll.dice});
            return;
        }
        const rerolled = rollDice(rerollable.length);
        const newOnes = rerolled.filter((d) => d === 1).length;
        const allDice = lastRoll.dice.filter((d) => d === 1 || d === 6).concat(rerolled);
        const updatedRoll: DiceRoll = {dice: allDice, modifiers: lastRoll.modifiers};
        setLastRoll(updatedRoll);
        setRollHistory([updatedRoll, ...rollHistory]);
        setHopePenalty(newOnes);

        if (newOnes > 0 && selectedCharacterId) {
            const selected = statuses.find((s) => s.id === selectedCharacterId);
            if (selected) {
                const currentHope = parseInt(selected.hope, 10) || 0;
                const newHope = Math.max(0, currentHope - newOnes);
                onUpdateStatus(selectedCharacterId, "hope", String(newHope));
            }
        }
    }

    const selected = statuses.find((s) => s.id === selectedCharacterId);
    const successCount = lastRoll ? lastRoll.dice.filter((d) => d === 6).length : 0;
    const partialCount = lastRoll ? lastRoll.dice.filter((d) => d >= 4 && d <= 5).length : 0;

    return <div style={{
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        overflowY: "auto",
        background: "linear-gradient(160deg, #f7f0df 0%, #d5e6f8 55%, #f4f7e8 100%)",
        padding: "1.5rem",
        color: "#1f2a3d",
        fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif"
    }}>
        <div style={{maxWidth: "900px", margin: "0 auto"}}>
            <h1 style={{margin: "0 0 1rem 0"}}>Dice Roller</h1>

            <div style={{
                border: "1px solid #98aec7",
                borderRadius: "14px",
                padding: "1rem",
                background: "rgba(255, 255, 255, 0.84)",
                boxShadow: "0 10px 26px rgba(37, 67, 102, 0.14)",
                marginBottom: "1rem"
            }}>
                <div style={{display: "grid", gap: "0.75rem"}}>
                    <label>Character
                        <select value={selectedCharacterId} onChange={(e) => setSelectedCharacterId(e.target.value)} style={{width: "100%"}}>
                            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name || `Character ${s.id}`}</option>)}
                        </select>
                    </label>
                    <label>Attribute
                        <select value={selectedAttribute} onChange={(e) => setSelectedAttribute(e.target.value)} style={{width: "100%"}}>
                            {attributes.map((attr) => <option key={attr} value={attr}>{attr.charAt(0).toUpperCase() + attr.slice(1)}</option>)}
                        </select>
                    </label>
                    <label>Modifiers (add/remove dice)
                        <div style={{display: "flex", gap: "0.5rem"}}>
                            <button onClick={() => setModifiers((m) => m - 1)}>−</button>
                            <input type="number" value={modifiers} onChange={(e) => setModifiers(parseInt(e.target.value, 10) || 0)} style={{flex: 1}} />
                            <button onClick={() => setModifiers((m) => m + 1)}>+</button>
                        </div>
                    </label>
                    <div><strong>Dice to roll:</strong> {Math.max(1, 6 + modifiers)}</div>
                </div>
                <button onClick={handleRoll} style={{marginTop: "1rem", padding: "0.5rem 1rem", background: "#4CAF50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>Roll</button>
            </div>

            {lastRoll && (
                <div style={{
                    border: "1px solid #98aec7",
                    borderRadius: "14px",
                    padding: "1rem",
                    background: "rgba(255, 255, 255, 0.84)",
                    boxShadow: "0 10px 26px rgba(37, 67, 102, 0.14)",
                    marginBottom: "1rem"
                }}>
                    <h2>Last Roll</h2>
                    <div style={{display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem"}}>
                        {lastRoll.dice.map((d, i) => (
                            <div key={i} style={{
                                width: "40px",
                                height: "40px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "2px solid #333",
                                borderRadius: "4px",
                                background: d === 6 ? "#90EE90" : d >= 4 ? "#FFD700" : d === 1 ? "#FFB6C6" : "#E8E8E8",
                                fontWeight: "bold"
                            }}>
                                {d}
                            </div>
                        ))}
                    </div>
                    <div style={{marginBottom: "0.5rem"}}><strong>Successes (6s):</strong> {successCount}</div>
                    <div style={{marginBottom: "0.5rem"}}><strong>Partial (4-5s):</strong> {partialCount}</div>
                    {hopePenalty > 0 && <div style={{color: "#d9534f"}}><strong>Hope penalty from push:</strong> −{hopePenalty}</div>}
                    <button onClick={handlePush} style={{marginTop: "0.75rem", padding: "0.5rem 1rem", background: "#FF9800", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>Push Roll</button>
                </div>
            )}

            {rollHistory.length > 1 && (
                <div style={{
                    border: "1px solid #98aec7",
                    borderRadius: "14px",
                    padding: "1rem",
                    background: "rgba(255, 255, 255, 0.84)",
                    boxShadow: "0 10px 26px rgba(37, 67, 102, 0.14)"
                }}>
                    <h2>Roll History</h2>
                    <div style={{display: "grid", gap: "0.5rem"}}>
                        {rollHistory.slice(1).map((roll, i) => {
                            const successes = roll.dice.filter((d) => d === 6).length;
                            return <div key={i} style={{display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem", background: "#f9f9f9", borderRadius: "4px"}}>
                                <div style={{flex: 1}}>Roll {rollHistory.length - i - 1}: {roll.dice.join(", ")}</div>
                                <div style={{minWidth: "100px"}}>Successes: {successes}</div>
                            </div>;
                        })}
                    </div>
                </div>
            )}
        </div>
    </div>;
}

function CharacterStatusBoard({initialStatuses}: CharacterStatusBoardProps): ReactElement {
    const [statuses, setStatuses] = useState<CharacterStatus[]>(initialStatuses);
    const [view, setView] = useState<"status" | "roller">("status");

    useEffect(() => {
        setStatuses(initialStatuses);
    }, [initialStatuses]);

    function updateField(characterId: string, field: keyof Omit<CharacterStatus, "id" | "tension">, value: string): void {
        setStatuses((current) => current.map((status) => {
            if (status.id !== characterId) {
                return status;
            }
            return {...status, [field]: value};
        }));
    }

    function updateTension(characterId: string, withName: string, value: string): void {
        setStatuses((current) => current.map((status) => {
            if (status.id !== characterId) {
                return status;
            }
            return {
                ...status,
                tension: status.tension.map((entry) => {
                    if (entry.with !== withName) {
                        return entry;
                    }
                    return {...entry, value};
                })
            };
        }));
    }

    if (view === "roller") {
        return <DiceRoller statuses={statuses} onUpdateStatus={updateField} />;
    }

    return <div style={{
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        overflowY: "auto",
        background: "linear-gradient(160deg, #f7f0df 0%, #d5e6f8 55%, #f4f7e8 100%)",
        padding: "1.5rem",
        color: "#1f2a3d",
        fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif"
    }}>
        <div style={{
            maxWidth: "1200px",
            margin: "0 auto"
        }}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem"}}>
                <h1 style={{margin: 0}}>Character Status Window</h1>
                <button onClick={() => setView(view === "status" ? "roller" : "status")} style={{padding: "0.5rem 1rem", background: "#2196F3", color: "white", border: "none", borderRadius: "6px", cursor: "pointer"}}>
                    {view === "status" ? "Go to Roller" : "Back to Status"}
                </button>
            </div>
            <p style={{margin: "0 0 1.25rem 0"}}>
                Edit any field below for each active character in this chat.
            </p>
            <div style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
            }}>
                {statuses.map((status) => (
                    <article key={status.id} style={{
                        border: "1px solid #98aec7",
                        borderRadius: "14px",
                        padding: "1rem",
                        background: "rgba(255, 255, 255, 0.84)",
                        boxShadow: "0 10px 26px rgba(37, 67, 102, 0.14)"
                    }}>
                        <h2 style={{margin: "0 0 0.8rem 0"}}>{status.name || `Character ${status.id}`}</h2>
                        <div style={{display: "grid", gap: "0.45rem"}}>
                            <label>Archetype <input value={status.archetype} onChange={(event) => updateField(status.id, "archetype", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Favorite Song <input value={status.favoriteSong} onChange={(event) => updateField(status.id, "favoriteSong", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Description <textarea value={status.description} onChange={(event) => updateField(status.id, "description", event.target.value)} rows={2} style={{width: "100%"}} /></label>
                            <label>Strength (Numerical) <input type="number" value={status.strength} onChange={(event) => updateField(status.id, "strength", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Agility (Numerical) <input type="number" value={status.agility} onChange={(event) => updateField(status.id, "agility", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Wits (Numerical) <input type="number" value={status.wits} onChange={(event) => updateField(status.id, "wits", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Empathy (Numerical) <input type="number" value={status.empathy} onChange={(event) => updateField(status.id, "empathy", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Health <input type="number" value={status.health} onChange={(event) => updateField(status.id, "health", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Hope <input type="number" value={status.hope} onChange={(event) => updateField(status.id, "hope", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Bliss <input type="number" value={status.bliss} onChange={(event) => updateField(status.id, "bliss", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Permanent <input value={status.permanent} onChange={(event) => updateField(status.id, "permanent", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Talents <input value={status.talents} onChange={(event) => updateField(status.id, "talents", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Dream <input value={status.dream} onChange={(event) => updateField(status.id, "dream", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Flaw <input value={status.flaw} onChange={(event) => updateField(status.id, "flaw", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Gear <input value={status.gear} onChange={(event) => updateField(status.id, "gear", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Cash <input type="number" value={status.cash} onChange={(event) => updateField(status.id, "cash", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Journey <input value={status.journey} onChange={(event) => updateField(status.id, "journey", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Goal <input value={status.goal} onChange={(event) => updateField(status.id, "goal", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Threat <input value={status.threat} onChange={(event) => updateField(status.id, "threat", event.target.value)} style={{width: "100%"}} /></label>
                            <label>Injuries and Trauma <textarea value={status.injuriesAndTrauma} onChange={(event) => updateField(status.id, "injuriesAndTrauma", event.target.value)} rows={2} style={{width: "100%"}} /></label>
                        </div>

                        <section style={{marginTop: "0.9rem"}}>
                            <h3 style={{margin: "0 0 0.4rem 0", fontSize: "1rem"}}>Tension</h3>
                            {status.tension.length === 0 ? (
                                <div>No other active characters in this chat.</div>
                            ) : (
                                <div style={{display: "grid", gap: "0.45rem"}}>
                                    {status.tension.map((entry) => (
                                        <label key={`${status.id}-${entry.with}`}>
                                            {entry.with}
                                            <input
                                                type="number"
                                                value={entry.value}
                                                onChange={(event) => updateTension(status.id, entry.with, event.target.value)}
                                                style={{width: "100%"}}
                                            />
                                        </label>
                                    ))}
                                </div>
                            )}
                        </section>
                    </article>
                ))}
            </div>
        </div>
    </div>;
}

/***
 The type that this stage persists message-level state in.
 This is primarily for readability, and not enforced.

 @description This type is saved in the database after each message,
  which makes it ideal for storing things like positions and statuses,
  but not for things like history, which is best managed ephemerally
  in the internal state of the Stage class itself.
 ***/
type MessageStateType = any;

/***
 The type of the stage-specific configuration of this stage.

 @description This is for things you want people to be able to configure,
  like background color.
 ***/
type ConfigType = any;

/***
 The type that this stage persists chat initialization state in.
 If there is any 'constant once initialized' static state unique to a chat,
 like procedurally generated terrain that is only created ONCE and ONLY ONCE per chat,
 it belongs here.
 ***/
type InitStateType = any;

/***
 The type that this stage persists dynamic chat-level state in.
 This is for any state information unique to a chat,
    that applies to ALL branches and paths such as clearing fog-of-war.
 It is usually unlikely you will need this, and if it is used for message-level
    data like player health then it will enter an inconsistent state whenever
    they change branches or jump nodes. Use MessageStateType for that.
 ***/
type ChatStateType = any;

/***
 A simple example class that implements the interfaces necessary for a Stage.
 If you want to rename it, be sure to modify App.js as well.
 @link https://github.com/CharHubAI/chub-stages-ts/blob/main/src/types/stage.ts
 ***/
export class Stage extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType> {

    /***
     A very simple example internal state. Can be anything.
     This is ephemeral in the sense that it isn't persisted to a database,
     but exists as long as the instance does, i.e., the chat page is open.
     ***/
    myInternalState: {[key: string]: any};
    private characterStatsCache: Map<string, InferredStats> = new Map();

    private toCharacterStatusList(): CharacterStatus[] {
        const allCharacters = this.myInternalState["characters"] as AnyRecord;
        const allUsers = this.myInternalState["users"] as AnyRecord;
        const entries: Array<{id: string; character?: any; isUser?: boolean}> = [];

        // Add all active characters
        Object.entries(allCharacters ?? {})
            .filter(([, character]) => !character?.isRemoved)
            .forEach(([id, character]) => {
                entries.push({id, character, isUser: false});
            });

        // Add user(s) as the first entry or primary participant
        Object.entries(allUsers ?? {})
            .filter(([, user]) => !user?.isRemoved)
            .forEach(([id, user]) => {
                entries.unshift({id: `user_${id}`, character: user, isUser: true});
            });

        const statusList: CharacterStatus[] = entries.map(({id, character, isUser}) => {
            const ext = character?.partial_extensions?.chub ?? {};
            const status = ext?.status ?? {};
            const profile = character ?? {};

            // Try to get inferred stats from cache or use the explicit values
            const inferredStats = this.characterStatsCache.get(id) || inferStatsFromCharacter(character || {});

            const attributes = inferAttributesFromCharacter(character || {});

            return {
                id,
                name: firstDefinedString([status.name, profile.name, profile.chatProfile], isUser ? "You" : ""),
                archetype: firstDefinedString([status.archetype, attributes.archetype], ""),
                favoriteSong: firstDefinedString([status.favoriteSong, status.favorite_song], ""),
                description: firstDefinedString([status.description, attributes.description, profile.description], ""),
                strength: firstDefinedString([String(status.strength ?? inferredStats.strength)], String(inferredStats.strength || "")),
                agility: firstDefinedString([String(status.agility ?? inferredStats.agility)], String(inferredStats.agility || "")),
                wits: firstDefinedString([String(status.wits ?? inferredStats.wits)], String(inferredStats.wits || "")),
                empathy: firstDefinedString([String(status.empathy ?? inferredStats.empathy)], String(inferredStats.empathy || "")),
                health: firstDefinedString([String(status.health ?? inferredStats.health)], String(inferredStats.health || "")),
                hope: firstDefinedString([String(status.hope ?? inferredStats.hope)], String(inferredStats.hope || "")),
                bliss: firstDefinedString([String(status.bliss ?? inferredStats.bliss)], String(inferredStats.bliss || "")),
                permanent: firstDefinedString([status.permanent], ""),
                talents: firstDefinedString([status.talents, attributes.talents], ""),
                dream: firstDefinedString([status.dream, attributes.dream], ""),
                flaw: firstDefinedString([status.flaw, attributes.flaw], ""),
                gear: firstDefinedString([status.gear, attributes.gear], ""),
                cash: firstDefinedString([String(status.cash ?? "")], ""),
                journey: firstDefinedString([status.journey], ""),
                goal: firstDefinedString([status.goal], ""),
                threat: firstDefinedString([status.threat, attributes.threat], ""),
                injuriesAndTrauma: firstDefinedString([status.injuriesAndTrauma], ""),
                tension: []
            };
        });

        return statusList.map((status) => {
            const tensions = statusList
                .filter((candidate) => candidate.id !== status.id)
                .map((candidate) => {
                    return {
                        with: candidate.name,
                        value: ""
                    };
                });
            return {...status, tension: tensions};
        });
    }

    constructor(data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>) {
        /***
         This is the first thing called in the stage,
         to create an instance of it.
         The definition of InitialData is at @link https://github.com/CharHubAI/chub-stages-ts/blob/main/src/types/initial.ts
         Character at @link https://github.com/CharHubAI/chub-stages-ts/blob/main/src/types/character.ts
         User at @link https://github.com/CharHubAI/chub-stages-ts/blob/main/src/types/user.ts
         ***/
        super(data);
        const {
            characters,         // @type:  { [key: string]: Character }
            users,                  // @type:  { [key: string]: User}
            config,                                 //  @type:  ConfigType
            messageState,                           //  @type:  MessageStateType
            environment,                     // @type: Environment (which is a string)
            initState,                             // @type: null | InitStateType
            chatState                              // @type: null | ChatStateType
        } = data;
        this.myInternalState = messageState != null ? messageState : {'someKey': 'someValue'};
        this.myInternalState['numUsers'] = Object.keys(users).length;
        this.myInternalState['numChars'] = Object.keys(characters).length;
        this.myInternalState['characters'] = characters;
        this.myInternalState['users'] = users;
    }

    async load(): Promise<Partial<LoadResponse<InitStateType, ChatStateType, MessageStateType>>> {
        /***
         This is called immediately after the constructor, in case there is some asynchronous code you need to
         run on instantiation.
         ***/
        
        // Load character stats from YAML definitions if available
        await this.preloadCharacterStats();
        
        return {
            /*** @type boolean @default null
             @description The 'success' boolean returned should be false IFF (if and only if), some condition is met that means
              the stage shouldn't be run at all and the iFrame can be closed/removed.
              For example, if a stage displays expressions and no characters have an expression pack,
              there is no reason to run the stage, so it would return false here. ***/
            success: true,
            /*** @type null | string @description an error message to show
             briefly at the top of the screen, if any. ***/
            error: null,
            initState: null,
            chatState: null,
        };
    }

    /***
     Preload character stats from YAML definitions
     ***/
    private async preloadCharacterStats(): Promise<void> {
        const allCharacters = this.myInternalState["characters"] as AnyRecord;

        for (const [id, character] of Object.entries(allCharacters ?? {})) {
            if (character?.isRemoved) continue;

            // Try to load stats from a YAML file if available
            const characterName = character?.name?.toLowerCase().replace(/\s+/g, '_') || `character_${id}`;
            const yamlPath = `/characters/${characterName}.yaml`;

            try {
                const yamlData = await loadCharacterYAML(yamlPath);
                if (Object.keys(yamlData).length > 0) {
                    const inferredStats = inferStatsFromCharacter(yamlData);
                    this.characterStatsCache.set(id, inferredStats);
                }
            } catch (error) {
                // Silently fail if YAML file not found, will use default inference
            }
        }
    }

    async setState(state: MessageStateType): Promise<void> {
        /***
         This can be called at any time, typically after a jump to a different place in the chat tree
         or a swipe. Note how neither InitState nor ChatState are given here. They are not for
         state that is affected by swiping.
         ***/
        if (state != null) {
            this.myInternalState = {...this.myInternalState, ...state};
        }
    }

    async beforePrompt(userMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        /***
         This is called after someone presses 'send', but before anything is sent to the LLM.
         ***/
        const {
            content,            /*** @type: string
             @description Just the last message about to be sent. ***/
            anonymizedId,       /*** @type: string
             @description An anonymized ID that is unique to this individual
              in this chat, but NOT their Chub ID. ***/
            isBot             /*** @type: boolean
             @description Whether this is itself from another bot, ex. in a group chat. ***/
        } = userMessage;
        return {
            /*** @type null | string @description A string to add to the
             end of the final prompt sent to the LLM,
             but that isn't persisted. ***/
            stageDirections: null,
            /*** @type MessageStateType | null @description the new state after the userMessage. ***/
            messageState: {'someKey': this.myInternalState['someKey']},
            /*** @type null | string @description If not null, the user's message itself is replaced
             with this value, both in what's sent to the LLM and in the database. ***/
            modifiedMessage: null,
            /*** @type null | string @description A system message to append to the end of this message.
             This is unique in that it shows up in the chat log and is sent to the LLM in subsequent messages,
             but it's shown as coming from a system user and not any member of the chat. If you have things like
             computed stat blocks that you want to show in the log, but don't want the LLM to start trying to
             mimic/output them, they belong here. ***/
            systemMessage: null,
            /*** @type null | string @description an error message to show
             briefly at the top of the screen, if any. ***/
            error: null,
            chatState: null,
        };
    }

    async afterResponse(botMessage: Message): Promise<Partial<StageResponse<ChatStateType, MessageStateType>>> {
        /***
         This is called immediately after a response from the LLM.
         ***/
        const {
            content,            /*** @type: string
             @description The LLM's response. ***/
            anonymizedId,       /*** @type: string
             @description An anonymized ID that is unique to this individual
              in this chat, but NOT their Chub ID. ***/
            isBot             /*** @type: boolean
             @description Whether this is from a bot, conceivably always true. ***/
        } = botMessage;
        return {
            /*** @type null | string @description A string to add to the
             end of the final prompt sent to the LLM,
             but that isn't persisted. ***/
            stageDirections: null,
            /*** @type MessageStateType | null @description the new state after the botMessage. ***/
            messageState: {'someKey': this.myInternalState['someKey']},
            /*** @type null | string @description If not null, the bot's response itself is replaced
             with this value, both in what's sent to the LLM subsequently and in the database. ***/
            modifiedMessage: null,
            /*** @type null | string @description an error message to show
             briefly at the top of the screen, if any. ***/
            error: null,
            systemMessage: null,
            chatState: null
        };
    }


    render(): ReactElement {
        /***
         There should be no "work" done here. Just returning the React element to display.
         If you're unfamiliar with React and prefer video, I've heard good things about
         @link https://scrimba.com/learn/learnreact but haven't personally watched/used it.

         For creating 3D and game components, react-three-fiber
           @link https://docs.pmnd.rs/react-three-fiber/getting-started/introduction
           and the associated ecosystem of libraries are quite good and intuitive.

         Cuberun is a good example of a game built with them.
           @link https://github.com/akarlsten/cuberun (Source)
           @link https://cuberun.adamkarlsten.com/ (Demo)
         ***/
        const statuses = this.toCharacterStatusList();
        return <CharacterStatusBoard initialStatuses={statuses} />;
    }

}
