import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TraceEntryInputV2, TraceEntryV2 } from '../domain/trace.js';

export interface TraceStoreOptions {
  readonly now?: () => Date;
  readonly onAppend?: (entry: TraceEntryV2) => void | Promise<void>;
}

export class TraceStore {
  private readonly tracePath: string;
  private entries: TraceEntryV2[] = [];
  private nextSequence = 0;
  private closed = false;

  constructor(
    readonly runDir: string,
    private readonly options: TraceStoreOptions = {},
  ) {
    this.tracePath = join(runDir, 'trace.ndjson');
  }

  async load(): Promise<readonly TraceEntryV2[]> {
    let raw = '';
    try {
      raw = await readFile(this.tracePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = [];
        this.nextSequence = 0;
        this.closed = false;
        return this.entries;
      }
      throw error;
    }

    const parsed = raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as TraceEntryV2);
    this.entries = parsed;
    this.nextSequence =
      parsed.length === 0 ? 0 : Math.max(...parsed.map((entry) => entry.sequence)) + 1;
    this.closed = parsed.some((entry) => entry.kind === 'run.closed');
    return this.entries;
  }

  async append(input: TraceEntryInputV2): Promise<TraceEntryV2> {
    if (this.closed) {
      throw new Error('cannot append trace entry after run close');
    }

    const entry: TraceEntryV2 = {
      ...input,
      recorded_at: input.recorded_at ?? (this.options.now ?? (() => new Date()))().toISOString(),
      sequence: this.nextSequence,
    };
    await mkdir(this.runDir, { recursive: true });
    await appendFile(this.tracePath, `${JSON.stringify(entry)}\n`, 'utf8');

    this.nextSequence += 1;
    this.entries.push(entry);

    if (entry.kind === 'run.closed') {
      this.closed = true;
    }

    try {
      await this.options.onAppend?.(entry);
    } catch {
      // Progress/projection side channels must not corrupt trace persistence.
    }

    return entry;
  }

  getAll(): readonly TraceEntryV2[] {
    return this.entries;
  }
}
