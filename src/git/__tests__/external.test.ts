import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (
    file: string,
    args: readonly string[],
    options: unknown,
    callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ) => {
    execFileMock(file, args, options);
    callback(null, { stdout: 'gh 2.0.0\n', stderr: '' });
  },
}));

vi.mock('../../platform/exec.js', () => ({
  resolveExecutable: (binary: string) => `C:/bin/${binary}`,
}));

import { probeBinary, resetProbeCache } from '../external.js';

beforeEach(() => {
  execFileMock.mockClear();
  resetProbeCache();
});

describe('probeBinary', () => {
  it('reports the version and resolves the binary through the platform helper', async () => {
    await expect(probeBinary('gh')).resolves.toEqual({ available: true, version: 'gh 2.0.0' });
    expect(execFileMock).toHaveBeenCalledWith('C:/bin/gh', ['--version'], { timeout: 15_000 });
  });

  it('caches per binary, so repeated probes do not respawn', async () => {
    await probeBinary('gh');
    await probeBinary('gh');
    await probeBinary('gh');
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('caches per args, not just per binary', async () => {
    await probeBinary('jj', ['--version']);
    await probeBinary('jj', ['log', '--no-pager']);
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('caches unavailability too — a missing tool stays missing', async () => {
    execFileMock.mockImplementationOnce(() => {
      throw Object.assign(new Error('spawn jj ENOENT'), { code: 'ENOENT' });
    });
    await expect(probeBinary('jj')).resolves.toMatchObject({ available: false });
    await expect(probeBinary('jj')).resolves.toMatchObject({ available: false });
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});
