import * as ts from 'typescript';
import { describe, expect, test } from 'vite-plus/test';

import capabilitySource from '../../../src-tauri/capabilities/main.json?raw';
import coverPluginSource from '../../../src-tauri/src/plugins/cover.rs?raw';
import databasePluginSource from '../../../src-tauri/src/plugins/db.rs?raw';
import tauriConfigSource from '../../../src-tauri/tauri.conf.json?raw';

type Permission =
  | string
  | { identifier: string; allow?: Array<{ url: string }> };

interface Capability {
  permissions: Array<Permission>;
}

interface TauriConfig {
  app: {
    security: {
      assetProtocol: {
        scope: {
          allow: Array<string>;
        };
      };
      csp: Record<string, string>;
    };
  };
}

const expectedPermissionIdentifiers = [
  'core:app:allow-version',
  'core:app:allow-tauri-version',
  'core:event:allow-listen',
  'core:event:allow-unlisten',
  'core:menu:allow-new',
  'core:menu:allow-popup',
  'core:window:allow-is-minimized',
  'core:window:allow-is-focused',
  'core:window:allow-theme',
  'core:window:allow-start-dragging',
  'core:window:allow-set-theme',
  'core:window:allow-internal-toggle-maximize',
  'core:webview:allow-set-webview-zoom',
  'clipboard-manager:allow-write-text',
  'dialog:allow-open',
  'dialog:allow-ask',
  'fs:allow-lstat',
  'opener:allow-open-url',
  'opener:allow-reveal-item-in-dir',
  'process:allow-restart',
  'log:allow-log',
  'notification:allow-is-permission-granted',
  'notification:allow-notify',
  'app-menu:allow-show',
  'app-menu:allow-hide',
  'app-menu:allow-show-window',
  'config:allow-get-storage-dir',
  'config:allow-set-config',
  'config:allow-get-config',
  'cover:allow-get-cover',
  'database:allow-scan-library',
  'database:allow-get-all-tracks',
  'database:allow-get-tracks',
  'database:allow-update-track',
  'database:allow-remove-tracks',
  'database:allow-get-artists',
  'database:allow-get-artist-tracks',
  'database:allow-get-compilation-albums',
  'database:allow-has-compilations',
  'database:allow-get-all-playlists',
  'database:allow-get-playlist',
  'database:allow-create-playlist',
  'database:allow-rename-playlist',
  'database:allow-set-playlist-tracks',
  'database:allow-export-playlist',
  'database:allow-delete-playlist',
  'database:allow-reset',
  'default-view:allow-set',
  'sleepblocker:allow-enable',
  'sleepblocker:allow-disable',
];

const expectedOpenerUrls = [
  'https://github.com/yifulin114514143/YifuMusic',
  'https://github.com/yifulin114514143/YifuMusic/releases',
  'https://github.com/yifulin114514143/YifuMusic/graphs/contributors',
  'https://github.com/yifulin114514143/YifuMusic/issues',
];

function getPermissionIdentifier(permission: Permission): string {
  return typeof permission === 'string' ? permission : permission.identifier;
}

function importsCoreInvoke(path: string, source: string): boolean {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@tauri-apps/api/core'
    ) {
      return false;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      return false;
    }

    return bindings.elements.some(
      (element) =>
        element.name.text === 'invoke' ||
        element.propertyName?.text === 'invoke',
    );
  });
}

describe('stage 2 capability boundary', () => {
  test('keeps only the audited Tauri permissions and fixed opener URLs', () => {
    const capability = JSON.parse(capabilitySource) as Capability;
    const permissionIdentifiers = capability.permissions.map(
      getPermissionIdentifier,
    );

    expect(permissionIdentifiers).toStrictEqual(expectedPermissionIdentifiers);
    expect(permissionIdentifiers).not.toContain('opener:allow-default-urls');
    expect(permissionIdentifiers).not.toContain('shell:allow-open');
    expect(permissionIdentifiers).not.toContain('notification:default');

    const openerPermission = capability.permissions.find(
      (permission): permission is Exclude<Permission, string> =>
        typeof permission !== 'string' &&
        permission.identifier === 'opener:allow-open-url',
    );

    expect(openerPermission).toStrictEqual({
      identifier: 'opener:allow-open-url',
      allow: expectedOpenerUrls.map((url) => ({ url })),
    });
  });

  test('uses an empty static asset scope and audited CSP sources', () => {
    const config = JSON.parse(tauriConfigSource) as TauriConfig;
    const { assetProtocol, csp } = config.app.security;

    expect(assetProtocol.scope.allow).toStrictEqual([]);
    expect(csp['connect-src'].split(' ')).toStrictEqual([
      "'self'",
      'ipc:',
      'http://ipc.localhost',
      'https://api.github.com',
    ]);
    expect(csp['img-src'].split(' ')).toStrictEqual([
      "'self'",
      'asset:',
      'http://asset.localhost',
      'data:',
    ]);
    expect(csp['media-src'].split(' ')).toStrictEqual([
      "'self'",
      'asset:',
      'http://asset.localhost',
      'http://127.0.0.1:*',
    ]);
  });

  test('keeps runtime asset grants tied to verified local media', () => {
    expect(databasePluginSource).toContain(
      'get_track_id_for_path(&track_path)',
    );
    expect(databasePluginSource).toContain(
      'persisted_track_paths.contains(&track_path)',
    );
    expect(databasePluginSource).toContain(
      'asset_protocol_scope.allow_file(track_path)',
    );
    expect(coverPluginSource).toContain('asset_protocol_scope.is_allowed');
    expect(coverPluginSource).toContain('return Ok(None);');
    expect(coverPluginSource).not.toContain('AssetAccessDenied');
    expect(coverPluginSource).toContain('asset_protocol_scope.allow_file');
  });

  test('allows core invoke imports only in bridge modules', () => {
    const sourceFiles = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    const filesWithCoreInvoke = Object.entries(sourceFiles)
      .filter(
        ([path, source]) =>
          !path.includes('/__tests__/') &&
          !path.startsWith('/src/generated/') &&
          importsCoreInvoke(path, source),
      )
      .map(([path]) => path.slice(1))
      .sort((left, right) => left.localeCompare(right));

    expect(filesWithCoreInvoke).toStrictEqual([
      'src/lib/bridge-config.ts',
      'src/lib/bridge-cover.ts',
      'src/lib/bridge-database.ts',
      'src/lib/bridge-settings.ts',
    ]);
  });
});
