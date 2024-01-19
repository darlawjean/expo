import arg from 'arg';
import path from 'path';

import { env } from '../utils/env';

export interface Options {
  exportPath?: string;
  embeddedManifestPath?: string;
  platform: string;
  verbose: boolean;
}

export interface ValidatedOptions {
  exportPath: string;
  embeddedManifestPath: string;
  platform: string;
  verbose: boolean;
}

export const defaultOptions = {
  exportPath: './dist',
  embeddedManifestPath:
    './ios/build/Build/Products/Release-iphonesimulator/EXUpdates/EXUpdates.bundle/app.manifest',
  platform: 'ios',
};

export function resolveOptions(projectRoot: string, args: arg.Result<arg.Spec>): ValidatedOptions {
  return {
    exportPath: path.resolve(projectRoot, args['--export-path'] ?? defaultOptions.exportPath),
    embeddedManifestPath: path.resolve(
      projectRoot,
      args['--embedded-manifest-path'] ?? defaultOptions.embeddedManifestPath
    ),
    platform: args['--platform'] ?? 'ios',
    verbose: args['--verbose'] ?? env.EXPO_DEBUG,
  };
}
