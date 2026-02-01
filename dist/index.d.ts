import { Client as Client$1 } from 'discord.js';
import { EventEmitter } from 'events';

interface Track {
    track: string;
    info: TrackInfo;
    src: string;
    requester?: any;
}
interface TrackInfo {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string;
    artworkUrl?: string;
    isrc?: string;
    sourceName: string;
    /**
     * The duration of the track in milliseconds. Alias for length.
     */
    duration: number;
}

interface ResolveResult {
    type: 'track' | 'playlist' | 'search' | 'error';
    tracks: Track[];
    playlistName?: string;
    playlistArtworkUrl?: string;
}
declare class SrcMan {
    readonly client: Client;
    constructor(client: Client);
    resolve(input: string): Promise<ResolveResult>;
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
    setVolume(volume: number): Promise<void>;
    setFilters(filters: any): Promise<void>;
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
    };
    destroy(): void;
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
    destroy(guildId: string): void;
    handleVoiceUpdate(data: any): void;
}

declare enum LoopMode {
    None = "none",
    Track = "track",
    Queue = "queue"
}
declare class Queue {
    tracks: Track[];
    current: Track | null;
    previous: Track[];
    loop: LoopMode;
    autoplay: boolean;
    add(track: Track | Track[]): void;
    next(): boolean;
    skip(): boolean;
    shuffle(): void;
    clear(): void;
    remove(index: number): Track | null;
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
    playerDestroy: (player: Player) => void;
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

export { Client, EvtMan, type LavxEvents, type LavxOptions, LoopMode, Node, NodeMan, type NodeOptions, PlatformMap, PlayMan, Player, type PlayerOptions, QMan, Queue, type ResolveResult, Rest, Sock, SrcMan, type Track, type TrackInfo, Voice };
