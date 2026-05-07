export interface Selection {
  readonly model?: {
    readonly provider: string;
    readonly model: string;
  };
  readonly effort?: string;
  readonly skills?: unknown;
  readonly depth?: string;
  readonly invocation_options?: Record<string, unknown>;
}
