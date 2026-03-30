import { getGit } from '../git/client.js';

export type FlowAction =
  | 'init'
  | 'feature-start'
  | 'feature-finish'
  | 'feature-publish'
  | 'feature-list'
  | 'release-start'
  | 'release-finish'
  | 'release-publish'
  | 'release-list'
  | 'hotfix-start'
  | 'hotfix-finish'
  | 'hotfix-list'
  | 'support-start'
  | 'support-list';

export interface FlowConfig {
  mainBranch: string;
  developBranch: string;
  featurePrefix: string;
  releasePrefix: string;
  hotfixPrefix: string;
  supportPrefix: string;
  versionTagPrefix: string;
}

export interface FlowOptions {
  readonly action: FlowAction;
  /** Feature/release/hotfix name or version string. */
  readonly name?: string;
  /** Override the main branch (default: from gitflow config or 'main'). */
  readonly mainBranch?: string;
  /** Override the develop branch (default: from gitflow config or 'develop'). */
  readonly developBranch?: string;
  /** Remote for publish actions. */
  readonly remote?: string;
  /** Whether to create a tag when finishing a release/hotfix (default: true). */
  readonly tag?: boolean;
  /** Message for the version tag. */
  readonly tagMessage?: string;
  /** Whether to delete the branch after finish (default: true). */
  readonly deleteBranch?: boolean;
}

async function getFlowConfig(git: ReturnType<typeof getGit>, overrides: FlowOptions): Promise<FlowConfig> {
  const get = async (key: string, fallback: string): Promise<string> => {
    try {
      const value = await git.raw(['config', '--local', key]);
      return value.trim() || fallback;
    } catch {
      return fallback;
    }
  };

  const mainBranch = overrides.mainBranch ?? (await get('gitflow.branch.master', 'main'));
  const developBranch = overrides.developBranch ?? (await get('gitflow.branch.develop', 'develop'));

  return {
    mainBranch,
    developBranch,
    featurePrefix: await get('gitflow.prefix.feature', 'feature/'),
    releasePrefix: await get('gitflow.prefix.release', 'release/'),
    hotfixPrefix: await get('gitflow.prefix.hotfix', 'hotfix/'),
    supportPrefix: await get('gitflow.prefix.support', 'support/'),
    versionTagPrefix: await get('gitflow.prefix.versiontag', ''),
  };
}

async function listBranchesByPrefix(git: ReturnType<typeof getGit>, prefix: string): Promise<string> {
  const result = await git.branch(['-a']);
  const matching = result.all
    .map(b => b.replace(/^remotes\/[^/]+\//, '').trim())
    .filter((b, idx, arr) => b.startsWith(prefix) && arr.indexOf(b) === idx)
    .map(b => b.slice(prefix.length));
  return matching.length > 0 ? matching.join('\n') : `No ${prefix.slice(0, -1)} branches found.`;
}

async function branchExists(git: ReturnType<typeof getGit>, branch: string): Promise<boolean> {
  try {
    const result = await git.branch(['-a']);
    return result.all.some(b => b === branch || b === `remotes/origin/${branch}` || b.endsWith(`/${branch}`));
  } catch {
    return false;
  }
}

export async function runFlowAction(repoPath: string, options: FlowOptions): Promise<string> {
  const git = getGit(repoPath);
  const cfg = await getFlowConfig(git, options);
  const deleteBranch = options.deleteBranch ?? true;
  const tagOnFinish = options.tag ?? true;

  switch (options.action) {
    // -----------------------------------------------------------------------
    // init
    // -----------------------------------------------------------------------
    case 'init': {
      // Persist flow config into local git config
      const sets: Array<[string, string]> = [
        ['gitflow.branch.master', cfg.mainBranch],
        ['gitflow.branch.develop', cfg.developBranch],
        ['gitflow.prefix.feature', cfg.featurePrefix],
        ['gitflow.prefix.release', cfg.releasePrefix],
        ['gitflow.prefix.hotfix', cfg.hotfixPrefix],
        ['gitflow.prefix.support', cfg.supportPrefix],
        ['gitflow.prefix.versiontag', cfg.versionTagPrefix],
      ];
      for (const [key, val] of sets) {
        await git.raw(['config', '--local', key, val]);
      }

      // Create develop branch if it doesn't exist
      if (!(await branchExists(git, cfg.developBranch))) {
        await git.checkoutLocalBranch(cfg.developBranch);
        const lines = [`Initialized git flow.`, `Created branch: ${cfg.developBranch}`];
        lines.push(`Main branch: ${cfg.mainBranch}, Develop branch: ${cfg.developBranch}`);
        return lines.join('\n');
      }

      return [
        `Initialized git flow.`,
        `Main branch: ${cfg.mainBranch}, Develop branch: ${cfg.developBranch}`,
        `Prefixes — feature: ${cfg.featurePrefix}, release: ${cfg.releasePrefix}, hotfix: ${cfg.hotfixPrefix}`,
      ].join('\n');
    }

    // -----------------------------------------------------------------------
    // feature
    // -----------------------------------------------------------------------
    case 'feature-list': {
      return listBranchesByPrefix(git, cfg.featurePrefix);
    }

    case 'feature-start': {
      if (!options.name) throw new Error('name is required for feature-start.');
      const branch = `${cfg.featurePrefix}${options.name}`;
      await git.checkoutBranch(branch, cfg.developBranch);
      return `Created and switched to branch ${branch} from ${cfg.developBranch}.`;
    }

    case 'feature-finish': {
      if (!options.name) throw new Error('name is required for feature-finish.');
      const branch = `${cfg.featurePrefix}${options.name}`;
      await git.checkout(cfg.developBranch);
      await git.raw(['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${cfg.developBranch}`]);
      if (deleteBranch) {
        await git.deleteLocalBranch(branch);
        return `Merged ${branch} into ${cfg.developBranch} and deleted branch.`;
      }
      return `Merged ${branch} into ${cfg.developBranch}.`;
    }

    case 'feature-publish': {
      if (!options.name) throw new Error('name is required for feature-publish.');
      const branch = `${cfg.featurePrefix}${options.name}`;
      const remote = options.remote ?? 'origin';
      await git.push(remote, branch, ['--set-upstream']);
      return `Published ${branch} to ${remote}.`;
    }

    // -----------------------------------------------------------------------
    // release
    // -----------------------------------------------------------------------
    case 'release-list': {
      return listBranchesByPrefix(git, cfg.releasePrefix);
    }

    case 'release-start': {
      if (!options.name) throw new Error('name is required for release-start.');
      const branch = `${cfg.releasePrefix}${options.name}`;
      await git.checkoutBranch(branch, cfg.developBranch);
      return `Created and switched to branch ${branch} from ${cfg.developBranch}.`;
    }

    case 'release-finish': {
      if (!options.name) throw new Error('name is required for release-finish.');
      const branch = `${cfg.releasePrefix}${options.name}`;
      const tagName = `${cfg.versionTagPrefix}${options.name}`;
      const tagMsg = options.tagMessage ?? `Release ${options.name}`;

      // Merge into main
      await git.checkout(cfg.mainBranch);
      await git.raw(['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${cfg.mainBranch}`]);

      // Tag the release on main
      if (tagOnFinish) {
        await git.addAnnotatedTag(tagName, tagMsg);
      }

      // Merge back into develop
      await git.checkout(cfg.developBranch);
      await git.raw(['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${cfg.developBranch}`]);

      const lines = [
        `Merged ${branch} into ${cfg.mainBranch}.`,
        ...(tagOnFinish ? [`Tagged: ${tagName}`] : []),
        `Merged ${branch} into ${cfg.developBranch}.`,
      ];

      if (deleteBranch) {
        await git.deleteLocalBranch(branch);
        lines.push(`Deleted branch ${branch}.`);
      }

      return lines.join('\n');
    }

    case 'release-publish': {
      if (!options.name) throw new Error('name is required for release-publish.');
      const branch = `${cfg.releasePrefix}${options.name}`;
      const remote = options.remote ?? 'origin';
      await git.push(remote, branch, ['--set-upstream']);
      return `Published ${branch} to ${remote}.`;
    }

    // -----------------------------------------------------------------------
    // hotfix
    // -----------------------------------------------------------------------
    case 'hotfix-list': {
      return listBranchesByPrefix(git, cfg.hotfixPrefix);
    }

    case 'hotfix-start': {
      if (!options.name) throw new Error('name is required for hotfix-start.');
      const branch = `${cfg.hotfixPrefix}${options.name}`;
      await git.checkoutBranch(branch, cfg.mainBranch);
      return `Created and switched to branch ${branch} from ${cfg.mainBranch}.`;
    }

    case 'hotfix-finish': {
      if (!options.name) throw new Error('name is required for hotfix-finish.');
      const branch = `${cfg.hotfixPrefix}${options.name}`;
      const tagName = `${cfg.versionTagPrefix}${options.name}`;
      const tagMsg = options.tagMessage ?? `Hotfix ${options.name}`;

      // Merge into main
      await git.checkout(cfg.mainBranch);
      await git.raw(['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${cfg.mainBranch}`]);

      // Tag the hotfix on main
      if (tagOnFinish) {
        await git.addAnnotatedTag(tagName, tagMsg);
      }

      // Merge back into develop
      await git.checkout(cfg.developBranch);
      await git.raw(['merge', '--no-ff', branch, '-m', `Merge branch '${branch}' into ${cfg.developBranch}`]);

      const lines = [
        `Merged ${branch} into ${cfg.mainBranch}.`,
        ...(tagOnFinish ? [`Tagged: ${tagName}`] : []),
        `Merged ${branch} into ${cfg.developBranch}.`,
      ];

      if (deleteBranch) {
        await git.deleteLocalBranch(branch);
        lines.push(`Deleted branch ${branch}.`);
      }

      return lines.join('\n');
    }

    // -----------------------------------------------------------------------
    // support
    // -----------------------------------------------------------------------
    case 'support-list': {
      return listBranchesByPrefix(git, cfg.supportPrefix);
    }

    case 'support-start': {
      if (!options.name) throw new Error('name is required for support-start.');
      const branch = `${cfg.supportPrefix}${options.name}`;
      await git.checkoutBranch(branch, cfg.mainBranch);
      return `Created and switched to branch ${branch} from ${cfg.mainBranch}.`;
    }
  }
}
