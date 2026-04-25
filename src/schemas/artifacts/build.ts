import { z } from 'zod';

const BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'build.brief': 'build.brief@v1',
  'build.plan': 'build.plan@v1',
  'build.implementation': 'build.implementation@v1',
  'build.verification': 'build.verification@v1',
  'build.review': 'build.review@v1',
} as const;

const SHELL_BINARIES = new Set([
  'sh',
  'bash',
  'zsh',
  'fish',
  'dash',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
]);

function commandBinaryName(argv0: string): string {
  const normalized = argv0.replaceAll('\\', '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
}

const ProjectRelativeCwd = z
  .string()
  .min(1)
  .superRefine((cwd, ctx) => {
    if (cwd.startsWith('/') || cwd.startsWith('~') || /^[A-Za-z]:[\\/]/.test(cwd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cwd must be project-relative and cannot use absolute or home paths',
      });
    }
    if (cwd.startsWith('\\\\') || cwd.startsWith('//')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cwd must not use UNC or network absolute paths',
      });
    }
    const parts = cwd.split('/');
    if (parts.some((part) => part === '..')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cwd must not escape the project root',
      });
    }
    if (cwd !== '.' && parts.some((part) => part.length === 0 || part === '.')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cwd must be "." or a normalized project-relative path',
      });
    }
  });

export const BuildVerificationCommand = z
  .object({
    id: z.string().min(1),
    cwd: ProjectRelativeCwd,
    argv: z.array(z.string().min(1)).min(1),
    timeout_ms: z.number().int().positive(),
    max_output_bytes: z.number().int().positive(),
    env: z.record(z.string(), z.string()),
  })
  .strict()
  .superRefine((command, ctx) => {
    const firstArg = command.argv[0];
    if (firstArg === undefined) return;
    const binary = commandBinaryName(firstArg);
    if (SHELL_BINARIES.has(binary)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['argv'],
        message: 'verification commands must use direct argv execution, not a shell executable',
      });
    }
  });
export type BuildVerificationCommand = z.infer<typeof BuildVerificationCommand>;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

const BuildCheckpointPointer = z
  .object({
    request_path: z.string().min(1),
    response_path: z.string().min(1).optional(),
    allowed_choices: NonEmptyStringArray,
  })
  .strict();

export const BuildBrief = z
  .object({
    objective: z.string().min(1),
    scope: z.string().min(1),
    success_criteria: NonEmptyStringArray,
    verification_command_candidates: z.array(BuildVerificationCommand).min(1),
    checkpoint: BuildCheckpointPointer,
  })
  .strict();
export type BuildBrief = z.infer<typeof BuildBrief>;

export const BuildPlan = z
  .object({
    objective: z.string().min(1),
    approach: z.string().min(1),
    slices: NonEmptyStringArray,
    verification: z
      .object({
        commands: z.array(BuildVerificationCommand).min(1),
      })
      .strict(),
  })
  .strict();
export type BuildPlan = z.infer<typeof BuildPlan>;

export const BuildImplementation = z
  .object({
    summary: z.string().min(1),
    changed_files: z.array(z.string().min(1)),
    evidence: NonEmptyStringArray,
  })
  .strict();
export type BuildImplementation = z.infer<typeof BuildImplementation>;

export const BuildVerificationCommandResult = z
  .object({
    command_id: z.string().min(1),
    argv: z.array(z.string().min(1)).min(1),
    cwd: ProjectRelativeCwd,
    exit_code: z.number().int().nonnegative(),
    status: z.enum(['passed', 'failed']),
    duration_ms: z.number().int().nonnegative(),
    stdout_summary: z.string(),
    stderr_summary: z.string(),
  })
  .strict()
  .superRefine((result, ctx) => {
    const expected = result.exit_code === 0 ? 'passed' : 'failed';
    if (result.status !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['status'],
        message: `status must be '${expected}' when exit_code is ${result.exit_code}`,
      });
    }
  });
export type BuildVerificationCommandResult = z.infer<typeof BuildVerificationCommandResult>;

export const BuildVerification = z
  .object({
    overall_status: z.enum(['passed', 'failed']),
    commands: z.array(BuildVerificationCommandResult).min(1),
  })
  .strict()
  .superRefine((verification, ctx) => {
    const expected = verification.commands.some((command) => command.status === 'failed')
      ? 'failed'
      : 'passed';
    if (verification.overall_status !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overall_status'],
        message: `overall_status must be '${expected}' for command results`,
      });
    }
  });
export type BuildVerification = z.infer<typeof BuildVerification>;

export const BuildReviewVerdict = z.enum(['accept', 'accept-with-fixes', 'reject']);
export type BuildReviewVerdict = z.infer<typeof BuildReviewVerdict>;

export const BuildReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type BuildReviewFinding = z.infer<typeof BuildReviewFinding>;

export const BuildReview = z
  .object({
    verdict: BuildReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(BuildReviewFinding),
  })
  .strict();
export type BuildReview = z.infer<typeof BuildReview>;

export const BuildResultArtifactId = z.enum([
  'build.brief',
  'build.plan',
  'build.implementation',
  'build.verification',
  'build.review',
]);
export type BuildResultArtifactId = z.infer<typeof BuildResultArtifactId>;

export const BuildResultArtifactPointer = z
  .object({
    artifact_id: BuildResultArtifactId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.artifact_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for artifact_id '${pointer.artifact_id}'`,
      });
    }
  });
export type BuildResultArtifactPointer = z.infer<typeof BuildResultArtifactPointer>;

export const BuildResult = z
  .object({
    summary: z.string().min(1),
    outcome: z.enum(['complete', 'failed']),
    verification_status: z.enum(['passed', 'failed']),
    review_verdict: BuildReviewVerdict,
    artifact_pointers: z.array(BuildResultArtifactPointer).length(5),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<BuildResultArtifactId>();
    for (const [index, pointer] of result.artifact_pointers.entries()) {
      if (seen.has(pointer.artifact_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers', index, 'artifact_id'],
          message: `duplicate artifact_id '${pointer.artifact_id}'`,
        });
      }
      seen.add(pointer.artifact_id);
    }
    for (const artifactId of BuildResultArtifactId.options) {
      if (!seen.has(artifactId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers'],
          message: `missing artifact_id '${artifactId}'`,
        });
      }
    }
  });
export type BuildResult = z.infer<typeof BuildResult>;
