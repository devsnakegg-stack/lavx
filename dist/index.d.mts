import { Client as Client$1 } from 'discord.js';
import { EventEmitter } from 'events';

type SourceNames = "youtube" | "youtubemusic" | "soundcloud" | "bandcamp" | "twitch" | "deezer" | "spotify" | "applemusic" | "yandexmusic" | "flowery-tts" | "vkmusic" | "tidal" | "qobuz" | "pandora" | "jiosaavn" | string;
interface TrackInfo {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    duration: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string;
    artworkUrl?: string;
    isrc?: string;
    sourceName: SourceNames;
}
interface PluginInfo {
    type?: string;
    albumName?: string;
    albumUrl?: string;
    albumArtUrl?: string;
    artistUrl?: string;
    artistArtworkUrl?: string;
    previewUrl?: string;
    isPreview?: boolean;
    totalTracks?: number;
    [key: string]: any;
}
interface Track {
    track: string;
    info: TrackInfo;
    pluginInfo: PluginInfo;
    src: string;
    requester?: any;
    userData?: any;
}
interface UnresolvedTrack extends Partial<Track> {
    resolve: (player: any) => Promise<boolean>;
}
declare function isUnresolvedTrack(track: any): track is UnresolvedTrack;

interface ResolveResult {
    type: 'track' | 'playlist' | 'search' | 'error';
    tracks: (Track | UnresolvedTrack)[];
    playlistName?: string;
    playlistArtworkUrl?: string;
}
declare class SrcMan {
    readonly client: Client;
    constructor(client: Client);
    resolve(input: string, requester?: any): Promise<ResolveResult>;
    detectSource(url: string): string;
    fallbackSearch(query: string, requester?: any): Promise<ResolveResult>;
    bestSource(track: Track): Promise<Track>;
    createUnresolved(query: string, requester?: any): UnresolvedTrack;
    private validateInput;
    private isUrl;
    private mapTrack;
}

declare class Sock {
    readonly node: Node;
    private ws;
    private reconnectTimeout;
    private reconnectAttempts;
    constructor(node: Node);
    connect(): void;
    private onOpen;
    private onMessage;
    private handlePlayerEvent;
    private handlePlayerUpdate;
    private onClose;
    private onError;
    private reconnect;
    send(payload: any): void;
    close(): void;
}

declare class Rest {
    readonly node: Node;
    constructor(node: Node);
    private get url();
    request(method: string, path: string, body?: any): Promise<unknown>;
    loadTracks(identifier: string): Promise<unknown>;
    decodeTrack(track: string): Promise<unknown>;
    decodeTracks(tracks: string[]): Promise<unknown>;
    getStats(): Promise<unknown>;
    getInfo(): Promise<unknown>;
    updatePlayer(guildId: string, data: any, noReplace?: boolean): Promise<unknown>;
}

declare class NodeMan {
    readonly client: Client;
    readonly nodes: Map<string, Node>;
    constructor(client: Client);
    add(options: NodeOptions): Node;
    get(name: string): Node | undefined;
    best(): Node;
    destroy(name: string): void;
    migrate(fromNode: Node, toNode?: Node): Promise<void>;
    handleNodeFailure(node: Node): Promise<void>;
}
declare class Node {
    readonly client: Client;
    readonly name: string;
    readonly options: NodeOptions;
    readonly sock: Sock;
    readonly rest: Rest;
    connected: boolean;
    sessionId: string | null;
    stats: any;
    constructor(client: Client, name: string, options: NodeOptions);
    connect(): void;
    destroy(): void;
}

declare class Voice {
    readonly player: Player;
    sessionId: string | null;
    token: string | null;
    endpoint: string | null;
    channelId: string | null;
    constructor(player: Player);
    update(data: any): void;
}

declare enum DestroyReason {
    ChannelDeleted = "CHANNEL_DELETED",
    Disconnected = "DISCONNECTED",
    PlayerDestroyed = "PLAYER_DESTROYED",
    NodeDestroyed = "NODE_DESTROYED",
    LoadFailed = "LOAD_FAILED"
}
declare class Player {
    node: Node;
    readonly guildId: string;
    readonly voice: Voice;
    playing: boolean;
    paused: boolean;
    state: {
        time: number;
        position: number;
        connected: boolean;
        ping: number;
    };
    volume: number;
    filters: any;
    options: {
        autoRecover: boolean;
        autoResume: boolean;
        gapless: boolean;
        smartBuffer: boolean;
    };
    private fadeInterval;
    constructor(node: Node, guildId: string);
    play(options?: {
        track?: string;
        startTime?: number;
        endTime?: number;
        noReplace?: boolean;
    }): Promise<void>;
    stop(): Promise<void>;
    pause(state?: boolean): Promise<void>;
    resume(): Promise<void>;
    seek(position: number): Promise<void>;
    rewind(ms: number): Promise<void>;
    forward(ms: number): Promise<void>;
    restart(): Promise<void>;
    setVolume(volume: number): Promise<void>;
    fadeIn(ms: number): Promise<void>;
    fadeOut(ms: number): Promise<void>;
    setFilters(filters: any): Promise<void>;
    clearFilters(): Promise<void>;
    setEQ(bands: {
        band: number;
        gain: number;
    }[]): Promise<void>;
    setAudioOutput(output: 'left' | 'right' | 'mono' | 'stereo'): Promise<void>;
    balance(left: number, right: number): Promise<void>;
    mono(): Promise<void>;
    stereo(): Promise<void>;
    bassboost(level?: number): Promise<void>;
    nightcore(): Promise<void>;
    vaporwave(): Promise<void>;
    autoplay(): Promise<boolean>;
    autoRecover(): Promise<void>;
    autoResume(): Promise<void>;
    preloadNext(): Promise<void>;
    moveToNode(toNode: Node): Promise<void>;
    moveToChannel(channelId: string, options?: {
        mute?: boolean;
        deaf?: boolean;
    }): Promise<void>;
    connect(channelId: string, options?: {
        mute?: boolean;
        deaf?: boolean;
    }): Promise<void>;
    disconnect(): Promise<void>;
    onTrackEnd(payload: any): Promise<void>;
    private handleAutoplay;
    filterPresets: {
        bassboost: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        nightcore: {
            timescale: {
                speed: number;
                pitch: number;
                rate: number;
            };
        };
        vaporwave: {
            timescale: {
                speed: number;
                pitch: number;
            };
        };
        pop: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        soft: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        electronic: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        dance: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        classical: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        rock: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        fullbass: {
            equalizer: {
                band: number;
                gain: number;
            }[];
        };
        karaoke: {
            karaoke: {
                level: number;
                monoLevel: number;
                filterBand: number;
                filterWidth: number;
            };
        };
        tremolo: {
            tremolo: {
                frequency: number;
                depth: number;
            };
        };
        vibrato: {
            vibrato: {
                frequency: number;
                depth: number;
            };
        };
        rotation: {
            rotation: {
                rotationHz: number;
            };
        };
        distortion: {
            distortion: {
                sinOffset: number;
                sinScale: number;
                cosOffset: number;
                cosScale: number;
                tanOffset: number;
                tanScale: number;
                offset: number;
                scale: number;
            };
        };
        lowpass: {
            lowPass: {
                smoothing: number;
            };
        };
    };
    destroy(reason?: DestroyReason): Promise<void>;
}

interface PlayerOptions {
    guildId: string;
    nodeName?: string;
}
declare class PlayMan {
    readonly client: Client;
    readonly players: Map<string, Player>;
    constructor(client: Client);
    create(options: PlayerOptions): Player;
    get(guildId: string): Player | undefined;
    destroy(guildId: string, reason?: DestroyReason): void;
    handleVoiceUpdate(data: any): void;
}

interface HistoryMetadata {
    title: string;
    author: string;
    uri: string;
    length: number;
    source: string;
    time: number;
    requester?: any;
}
interface HistoryStore {
    get: (guildId: string) => Promise<HistoryMetadata[]>;
    push: (guildId: string, metadata: HistoryMetadata) => Promise<void>;
    clear: (guildId: string) => Promise<void>;
}
declare class MemoryHistoryStore implements HistoryStore {
    private stores;
    get(guildId: string): Promise<HistoryMetadata[]>;
    push(guildId: string, metadata: HistoryMetadata): Promise<void>;
    clear(guildId: string): Promise<void>;
}
declare class History {
    readonly guildId: string;
    private store;
    private maxLimit;
    constructor(guildId: string, options?: {
        store?: HistoryStore;
        maxLimit?: number;
    });
    push(track: Track): Promise<void>;
    get(max?: number): Promise<HistoryMetadata[]>;
    clear(): Promise<void>;
    last(): Promise<HistoryMetadata | null>;
    size(): Promise<number>;
}

declare enum LoopMode {
    None = "none",
    Track = "track",
    Queue = "queue"
}
interface StoredQueue {
    current: Track | null;
    tracks: (Track | UnresolvedTrack)[];
}
interface QueueStore {
    get: (guildId: string) => Promise<StoredQueue | null>;
    set: (guildId: string, value: StoredQueue) => Promise<void>;
    delete: (guildId: string) => Promise<void>;
}
declare class MemoryQueueStore implements QueueStore {
    private stores;
    get(guildId: string): Promise<StoredQueue | null>;
    set(guildId: string, value: StoredQueue): Promise<void>;
    delete(guildId: string): Promise<void>;
}
declare class Queue {
    tracks: (Track | UnresolvedTrack)[];
    current: Track | null;
    readonly history: History;
    loop: LoopMode;
    autoplay: boolean;
    private store;
    private guildId;
    constructor(guildId: string, options?: {
        store?: QueueStore;
        historyStore?: HistoryStore;
    });
    add(track: (Track | UnresolvedTrack) | (Track | UnresolvedTrack)[]): Promise<void>;
    addNext(track: (Track | UnresolvedTrack) | (Track | UnresolvedTrack)[]): Promise<void>;
    insert(index: number, track: Track | UnresolvedTrack): Promise<void>;
    next(): Promise<boolean>;
    skip(): Promise<boolean>;
    jump(index: number): Promise<Track | null>;
    previous(): Promise<HistoryMetadata | null>;
    move(from: number, to: number): Promise<void>;
    swap(i1: number, i2: number): Promise<void>;
    dedupe(): Promise<void>;
    shuffle(): Promise<void>;
    clear(): Promise<void>;
    remove(index: number): Promise<Track | UnresolvedTrack | null>;
    private save;
    load(): Promise<void>;
}

declare class QMan {
    readonly client: Client;
    readonly queues: Map<string, Queue>;
    constructor(client: Client);
    get(guildId: string): Queue;
    delete(guildId: string): void;
}

interface LavxEvents {
    nodeConnect: (node: Node) => void;
    nodeDisconnect: (node: Node, code: number, reason: string) => void;
    nodeError: (node: Node, error: Error) => void;
    nodeReconnect: (node: Node) => void;
    nodeReady: (node: Node, payload: any) => void;
    playerCreate: (player: Player) => void;
    playerDestroy: (player: Player, reason: DestroyReason) => void;
    playerMove: (player: Player, oldChannelId: string | null, newChannelId: string | null) => void;
    playerDisconnect: (player: Player, code: number, reason: string, byRemote: boolean) => void;
    trackStart: (player: Player, track: string) => void;
    trackEnd: (player: Player, track: string, reason: string) => void;
    trackError: (player: Player, track: string, exception: any) => void;
    trackStuck: (player: Player, track: string, thresholdMs: number) => void;
    queueEnd: (player: Player) => void;
    raw: (payload: any) => void;
}
declare class EvtMan extends EventEmitter {
    readonly client: Client;
    constructor(client: Client);
    emit<K extends keyof LavxEvents>(event: K, ...args: Parameters<LavxEvents[K]>): boolean;
    on<K extends keyof LavxEvents>(event: K, listener: LavxEvents[K]): this;
    once<K extends keyof LavxEvents>(event: K, listener: LavxEvents[K]): this;
}

interface LavxOptions {
    nodes: NodeOptions[];
    send?: (guildId: string, payload: any) => void;
    defaultSearchPlatform?: string;
    maxReconnectAttempts?: number;
    whitelist?: string[];
    blacklist?: string[];
}
interface NodeOptions {
    name?: string;
    host: string;
    port: number;
    auth: string;
    secure?: boolean;
}
declare class Client {
    readonly discord: Client$1;
    readonly node: NodeMan;
    readonly play: PlayMan;
    readonly queue: QMan;
    readonly src: SrcMan;
    readonly events: EvtMan;
    readonly options: LavxOptions;
    constructor(discord: Client$1, options: LavxOptions);
    private init;
    sendGatewayPayload(guildId: string, payload: any): void;
    playInput(guildId: string, input: string, requester?: any): Promise<ResolveResult | null>;
}

declare const PlatformMap: Record<string, string>;

export { Client, DestroyReason, EvtMan, History, type HistoryMetadata, type HistoryStore, type LavxEvents, type LavxOptions, LoopMode, MemoryHistoryStore, MemoryQueueStore, Node, NodeMan, type NodeOptions, PlatformMap, PlayMan, Player, type PlayerOptions, type PluginInfo, QMan, Queue, type QueueStore, type ResolveResult, Rest, Sock, type SourceNames, SrcMan, type StoredQueue, type Track, type TrackInfo, type UnresolvedTrack, Voice, isUnresolvedTrack };
