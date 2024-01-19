#!/usr/bin/env node
import arg from 'arg';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { Command } from '../../bin/cli';
import { getProjectRoot, assertWithOptionsArgs, printHelp } from '../utils/args';
import { CommandError } from '../utils/errors';

export const expoVerifyNativeAssets: Command = async (argv) => {
  const rawArgsMap: arg.Spec = {
    // Types
    '--export-path': String,
    '--embedded-manifest-path': String,
    '--platform': String,

    // This is here for compatibility with the `npx react-native bundle` command.
    // devs should use `DEBUG=expo:*` instead.
    '--verbose': Boolean,
    '--help': Boolean,
    // Aliases
    '-h': '--help',
    '-v': '--verbose',
  };
  const args = assertWithOptionsArgs(rawArgsMap, {
    argv,
    permissive: true,
  });

  const [{ resolveOptions, defaultOptions }, { logCmdError }] = await Promise.all([
    import('./resolveOptions.js'),
    import('../utils/errors.js'),
  ]);

  if (args['--help']) {
    printHelp(
      `(Internal) Verify that all static files in an exported bundle are in either the export or an embedded bundle`,
      chalk`npx expo verifyNativeAssets {dim <dir>}`,
      [
        chalk`<dir>                                  Directory of the Expo project. {dim Default: Current working directory}`,
        chalk`--export-path <path>                   Path to the exported bundle {dim Default: ${defaultOptions.exportPath}}`,
        chalk`--embedded-manifest-path <path>        Path to the build's embedded manifest {dim Default: ${defaultOptions.embeddedManifestPath}}`,
        chalk`-p, --platform <platform>              Options: android, ios {dim Default: ${defaultOptions.platform}}`,
        `-v, --verbose                          Enables debug logging`,
        `-h, --help                             Usage info`,
      ].join('\n')
    );
  }

  return (async () => {
    const projectRoot = getProjectRoot(args);

    const validatedArgs = resolveOptions(projectRoot, args);
    if (validatedArgs.verbose) {
      console.warn(JSON.stringify(validatedArgs, null, 2));
    }
    const buildManifestAssetSet = getBuildManifestAssetSet(validatedArgs.embeddedManifestPath);
    const fullAssetMap = getFullAssetMap(validatedArgs.exportPath);
    const fullAssetSet = getFullAssetSet(fullAssetMap);
    const exportedAssetSet = getExportedAssetSet(validatedArgs.exportPath, validatedArgs.platform);

    if (validatedArgs.verbose) {
      console.warn(`Assets in build: ${JSON.stringify([...buildManifestAssetSet], null, 2)}`);
      console.warn(`Assets in exported bundle: ${JSON.stringify([...exportedAssetSet], null, 2)}`);
      console.warn(`All assets resolved by Metro: ${JSON.stringify([...fullAssetSet], null, 2)}`);
    }

    const buildAssetsPlusExportedAssets = new Set(buildManifestAssetSet);
    exportedAssetSet.forEach((hash) => buildAssetsPlusExportedAssets.add(hash));

    let count = 0;
    [...fullAssetSet].forEach((hash) => {
      if (!buildAssetsPlusExportedAssets.has(hash)) {
        const asset = fullAssetMap[hash];
        console.warn(`  Missing asset: hash = ${hash}, file = ${asset.files[0]}`);
        count = count + 1;
      }
    });

    if (count > 0) {
      console.warn(`${count} assets not found in either embedded manifest or in exported bundle`);
    } else {
      console.warn(`All resolved assets found in either embedded manifest or in exported bundle.`);
    }
    process.exit(0);
  })().catch(logCmdError);
};

function getBuildManifestAssetSet(buildManifestPath: string) {
  const embeddedManifestString = fs.readFileSync(buildManifestPath, { encoding: 'utf-8' });
  const embeddedManifest: { assets: { packagerHash: string }[] } =
    JSON.parse(embeddedManifestString);
  return new Set((embeddedManifest.assets ?? []).map((asset) => asset.packagerHash));
}

function getFullAssetMap(exportPath: string) {
  const assetMapPath = path.resolve(exportPath, 'assetmap.json');
  if (!fs.existsSync(assetMapPath)) {
    throw new CommandError(
      `The export bundle chosen does not contain assetmap.json. Please generate the bundle with "npx expo export --dump-assetmap"`
    );
  }
  const assetMapString = fs.readFileSync(assetMapPath, { encoding: 'utf-8' });
  const assetMap: { [k: string]: any } = JSON.parse(assetMapString);
  return assetMap;
}

function getFullAssetSet(assetMap: { [k: string]: any }) {
  const assetSet = new Set<string>();
  for (const hash in assetMap) {
    assetSet.add(hash);
  }
  return assetSet;
}

function getExportedAssetSet(exportPath: string, platform: string) {
  const metadataPath = path.resolve(exportPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new CommandError(
      `The export bundle chosen does not contain metadata.json. Please generate the bundle with "npx expo export --dump-assetmap"`
    );
  }
  const metadataString = fs.readFileSync(metadataPath, { encoding: 'utf-8' });
  const metadata: { [k: string]: any } = JSON.parse(metadataString);
  const assetSet = new Set<string>();
  const assets: { path: string; ext: string }[] = metadata.fileMetadata[platform].assets;
  assets.forEach((asset) => {
    assetSet.add(asset.path.substring(7, asset.path.length));
  });
  return assetSet;
}
