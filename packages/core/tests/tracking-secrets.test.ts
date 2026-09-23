import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { SCHEMA_NAME, CURRENT_SCHEMA_VERSION, type Manifest } from '@kubuild/schema';
import {
  migrateDocument,
  exportPackage,
  importPackage,
  preflightPackage,
  createBlankDocument,
  stripDocumentTrackingSecretsInPlace,
  sanitizeDocumentTracking,
} from '../src';

const legacyTracking = {
  enabled: true,
  providers: {
    meta: {
      enabled: true,
      credentialId: 'cred_meta',
      pixelId: '123',
      capiEnabled: true,
      capiAccessToken: 'EAAB-SECRET',
      testEventCode: 'TEST1',
      serverRelayUrl: '/api/meta',
    },
    google: { enabled: true, measurementId: 'G-1', measurementProtocolSecret: 'GA-SECRET', serverRelayUrl: '/ga' },
    gtm: { enabled: true, containerId: 'GTM-1', serverRelayUrl: '/gtm' },
    tiktok: { enabled: true, pixelId: 'TT', eventsApiEnabled: true, accessToken: 'TT-SECRET', serverRelayUrl: '/tt' },
    custom: { enabled: true, endpointUrl: 'https://hook.example', headers: { Authorization: 'Bearer HOOK-SECRET' } },
  },
};

function legacyDoc(version = '1.0.0') {
  const doc = createBlankDocument('Legacy Tracking') as unknown as Record<string, unknown>;
  doc.version = version;
  doc.tracking = JSON.parse(JSON.stringify(legacyTracking));
  return doc;
}

const SECRETS = ['EAAB-SECRET', 'GA-SECRET', 'TT-SECRET', 'HOOK-SECRET', 'hook.example', '/api/meta'];

function expectNoSecrets(value: unknown) {
  const text = JSON.stringify(value);
  for (const s of SECRETS) expect(text).not.toContain(s);
}

describe('Tracking secrets are removed from documents', () => {
  it('schema version is bumped to 1.1.0', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('1.1.0');
  });

  it('migrates 1.0.0 -> 1.1.0, strips secrets and emits a TRACKING_SECRET_REMOVED warning', () => {
    const result = migrateDocument(legacyDoc());
    expect(result.success).toBe(true);
    expect(result.document?.version).toBe('1.1.0');
    expect(result.diagnostic.migrationPath).toEqual(['1.0.0', '1.1.0']);
    expectNoSecrets(result.document);

    // Public ids, flags and credentialId survive
    const providers = result.document!.tracking!.providers;
    expect(providers.meta).toMatchObject({ credentialId: 'cred_meta', pixelId: '123', capiEnabled: true, testEventCode: 'TEST1' });
    expect(providers.gtm?.containerId).toBe('GTM-1');

    const warning = result.diagnostic.warnings?.[0];
    expect(warning?.code).toBe('TRACKING_SECRET_REMOVED');
    expect(warning?.message).toContain('Tracking secret removed; re-link credential via credentialId');
    expect(warning?.paths).toEqual(
      expect.arrayContaining([
        'tracking.providers.meta.capiAccessToken',
        'tracking.providers.google.measurementProtocolSecret',
        'tracking.providers.tiktok.accessToken',
        'tracking.providers.custom.endpointUrl',
        'tracking.providers.custom.headers',
        'tracking.providers.gtm.serverRelayUrl',
      ]),
    );
  });

  it('also strips secrets from older versions migrating through 1.0.0 and from metadata.tracking', () => {
    const doc = legacyDoc('0.9.0');
    doc.metadata = { title: 'x', tracking: JSON.parse(JSON.stringify(legacyTracking)) };
    const result = migrateDocument(doc);
    expect(result.success).toBe(true);
    expect(result.document?.version).toBe('1.1.0');
    expectNoSecrets(result.document);
    expect(result.diagnostic.warnings?.[0].paths).toEqual(
      expect.arrayContaining(['metadata.tracking.providers.meta.capiAccessToken']),
    );
  });

  it('does not warn when there is nothing to strip', () => {
    const doc = createBlankDocument('Clean') as unknown as Record<string, unknown>;
    doc.version = '1.0.0';
    const result = migrateDocument(doc);
    expect(result.success).toBe(true);
    expect(result.diagnostic.warnings).toBeUndefined();
  });

  it('defensively strips secrets from a current-version document', () => {
    const result = migrateDocument(legacyDoc(CURRENT_SCHEMA_VERSION));
    expect(result.success).toBe(true);
    expect(result.diagnostic.stepsApplied).toBe(0);
    expectNoSecrets(result.document);
    expect(result.diagnostic.warnings?.[0].code).toBe('TRACKING_SECRET_REMOVED');
  });

  it('sanitizer helpers work on page and project shaped documents without mutating input', () => {
    const page = legacyDoc();
    const { document, removed } = sanitizeDocumentTracking(page);
    expectNoSecrets(document);
    expect(removed.length).toBeGreaterThan(0);
    expect(JSON.stringify(page)).toContain('EAAB-SECRET');

    const project = { schema: 'stora.project', artboards: [{ id: 'a', document: legacyDoc() }] };
    const projectRemoved = stripDocumentTrackingSecretsInPlace(project);
    expectNoSecrets(project);
    expect(projectRemoved[0]).toMatch(/^artboards\.0\.document\.tracking\.providers\./);

    expect(stripDocumentTrackingSecretsInPlace(null)).toEqual([]);
    expect(stripDocumentTrackingSecretsInPlace({ tracking: { providers: 'nope' } })).toEqual([]);
  });

  it('exportPackage never writes tracking secrets into the .stora archive', async () => {
    const doc = legacyDoc(CURRENT_SCHEMA_VERSION);
    const result = await exportPackage(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const files = unzipSync(result.archive);
    const page = JSON.parse(strFromU8(files['page.json']));
    expectNoSecrets(page);
    expect(page.tracking.providers.meta.pixelId).toBe('123');
  });

  it('importPackage strips secrets from untrusted current-version packages and reports a warning', async () => {
    const page = legacyDoc(CURRENT_SCHEMA_VERSION);
    const manifest: Manifest = {
      schema: SCHEMA_NAME,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      packageVersion: '1.0.0',
      builderCompatibility: '>=0.1.0',
      requiredComponents: [],
      requiredCapabilities: [],
      assets: [],
    };
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'page.json': strToU8(JSON.stringify(page)),
    });

    const preflight = await preflightPackage(archive);
    expect(preflight.diagnostics.some((d) => d.code === 'TRACKING_SECRET_REMOVED' && d.severity === 'warning')).toBe(
      true,
    );

    const imported = await importPackage(archive);
    expect(imported.success).toBe(true);
    if (!imported.success) return;
    expectNoSecrets(imported.document);
    expect(imported.warnings?.[0].code).toBe('TRACKING_SECRET_REMOVED');
  });

  it('importPackage migrates legacy 1.0.0 packages and strips secrets', async () => {
    const page = legacyDoc('1.0.0');
    const manifest: Manifest = {
      schema: SCHEMA_NAME,
      schemaVersion: '1.0.0',
      packageVersion: '1.0.0',
      builderCompatibility: '>=0.1.0',
      requiredComponents: [],
      requiredCapabilities: [],
      assets: [],
    };
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'page.json': strToU8(JSON.stringify(page)),
    });
    const imported = await importPackage(archive);
    expect(imported.success).toBe(true);
    if (!imported.success) return;
    expect(imported.document.version).toBe('1.1.0');
    expectNoSecrets(imported.document);
  });
});
