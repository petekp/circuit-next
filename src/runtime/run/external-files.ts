import { readFile } from 'node:fs/promises';

export interface ExternalFileReader {
  readText(path: string): Promise<string>;
}

export const nodeExternalFileReader: ExternalFileReader = {
  async readText(path) {
    return await readFile(path, 'utf8');
  },
};
