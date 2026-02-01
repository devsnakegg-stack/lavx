import { Track } from './Track';

export interface HistoryMetadata {
    title: string;
    author: string;
    uri: string;
    length: number;
    source: string;
    time: number;
    requester?: any;
}

export interface HistoryStore {
    get: (guildId: string) => Promise<HistoryMetadata[]>;
    set: (guildId: string, history: HistoryMetadata[]) => Promise<void>;
    clear: (guildId: string) => Promise<void>;
}

export class MemoryHistoryStore implements HistoryStore {
    private stores = new Map<string, HistoryMetadata[]>();

    async get(guildId: string) {
        return this.stores.get(guildId) || [];
    }

    async set(guildId: string, history: HistoryMetadata[]) {
        this.stores.set(guildId, history);
    }

    async clear(guildId: string) {
        this.stores.delete(guildId);
    }
}

export class History {
    public readonly guildId: string;
    private store: HistoryStore;
    private maxLimit: number;

    constructor(guildId: string, options: { store?: HistoryStore; maxLimit?: number } = {}) {
        this.guildId = guildId;
        this.store = options.store || new MemoryHistoryStore();
        this.maxLimit = options.maxLimit || 30;
    }

    public async push(track: Track) {
        if (!track.info || track.isAutoplay) return;

        const metadata: HistoryMetadata = {
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            length: track.info.length,
            source: track.src,
            time: Date.now(),
            requester: track.requester
        };

        const history = await this.store.get(this.guildId);

        // No duplicates
        if (history.some(h => h.uri === metadata.uri)) return;

        history.push(metadata);

        // Enforce max limit (Ring buffer)
        if (history.length > this.maxLimit) {
            history.shift();
        }

        await this.store.set(this.guildId, history);
    }

    public async get(max?: number): Promise<HistoryMetadata[]> {
        const history = await this.store.get(this.guildId);
        return history.slice(-(max || this.maxLimit));
    }

    public async clear() {
        await this.store.clear(this.guildId);
    }

    public async last(): Promise<HistoryMetadata | null> {
        const history = await this.store.get(this.guildId);
        return history.length > 0 ? history[history.length - 1] : null;
    }

    public async size(): Promise<number> {
        const history = await this.store.get(this.guildId);
        return history.length;
    }
}
