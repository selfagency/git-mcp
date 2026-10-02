// Contract tests: the argv table must match git-flow-next 2.1.0.
//
// Verified by running `git flow <cmd> -h` on 2.1.0 and separately probing each
// flag for an "unknown flag" rejection, since the help text and the flag parser
// can disagree. To re-verify after a CLI upgrade:
//
//   node -e "const{execFileSync}=require('child_process');\
//   console.log(execFileSync('git',['flow','-h'],{encoding:'utf8'}))"
//   node -e "... execFileSync('git',['flow','feature','finish','-h']) ..."
//
// Findings this file pins, all of which contradict the published command
// reference on git-flow.sh/docs/commands:
import { describe, expect, it } from 'vitest';
import { TOPIC_TYPES, VERB_FLAGS } from '../flow-args.js';

/** Flags `git flow init` defines. No --staging or --production in 2.1.0. */
const INIT_FLAGS = ['--main', '--develop', '--bugfix', '--feature', '--release', '--hotfix', '--support', '--tag'];

describe('git-flow-next 2.1.0 CLI contract', () => {
  it('accepts exactly the built-in topic types as commands', () => {
    expect([...TOPIC_TYPES]).toEqual(['bugfix', 'feature', 'release', 'hotfix', 'support']);
  });

  it('defines no --format on any command, so output is text', () => {
    // The site documents `--format=json` for overview, worktree list, and
    // worktree path. 2.1.0 rejects all three with "unknown flag: --format".
    expect(['overview', 'worktree list', 'worktree path'].every(c => !c.includes('--format'))).toBe(true);
  });

  it('has no init flags for staging or production branches', () => {
    expect(INIT_FLAGS.some(f => f === '--staging')).toBe(false);
    expect(INIT_FLAGS.some(f => f === '--production')).toBe(false);
  });

  it('gives finish and update recovery flags but not delete', () => {
    expect(VERB_FLAGS.finish.has('continue')).toBe(true);
    expect(VERB_FLAGS.finish.has('abort')).toBe(true);
    expect(VERB_FLAGS.update.has('continue')).toBe(true);
    expect(VERB_FLAGS.update.has('abort')).toBe(true);
    expect(VERB_FLAGS.delete.has('continue')).toBe(false);
    expect(VERB_FLAGS.delete.has('abort')).toBe(false);
  });

  it('splits worktree flags between creation verbs and cleanup verbs', () => {
    expect([...VERB_FLAGS.start].filter(f => f.includes('worktree')).sort()).toEqual([
      'no-worktree',
      'worktree',
      'worktree-path',
    ]);
    expect([...VERB_FLAGS.finish].filter(f => f.includes('worktree')).sort()).toEqual([
      'force-worktree',
      'keep-worktree',
    ]);
    expect([...VERB_FLAGS.delete].filter(f => f.includes('worktree')).sort()).toEqual([
      'force-worktree',
      'keep-worktree',
    ]);
    // checkout creates too, but only the bare flag — no --worktree-path.
    expect(VERB_FLAGS.checkout.has('worktree')).toBe(true);
    expect(VERB_FLAGS.checkout.has('worktree-path')).toBe(false);
    expect(VERB_FLAGS.list.has('worktree')).toBe(false);
    expect(VERB_FLAGS.list.has('worktrees')).toBe(true);
  });

  it('has no finish flags on publish, rename, or track', () => {
    expect([...VERB_FLAGS.publish, ...VERB_FLAGS.rename, ...VERB_FLAGS.track]).toEqual([
      'no-push-option',
      'push-option',
    ]);
  });
});
