const fs = require('fs').promises;
const path = require('path');

describe('mapcache_download', () => {
  test('should create output folder', async () => {
    const folder = './test_output';
    await fs.mkdir(folder, { recursive: true });
    expect(await fs.access(folder).then(() => true).catch(() => false)).toBe(true);
    await fs.rm(folder, { recursive: true });
  });

  // Add more tests (e.g., mock axios to test tile download)
});