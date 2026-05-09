export type PackageTreeStatusKind = 'ok' | 'missing' | 'stale' | 'extra-owned-files';

export type PackageTreeComparison = {
  status: PackageTreeStatusKind;
  source: string;
  target: string;
  missing: string[];
  stale: string[];
  extra_owned_files: string[];
  source_file_count: number;
  target_owned_file_count: number;
};

export function isPackageOwnedFile(path: string): boolean;
export function walkPackageFiles(root: string): string[];
export function packageTreeStatus(source: string, target: string): PackageTreeComparison;
export function listPackageDirs(root: string, dir: string): string[];
export function listCommandIds(root: string): string[];
