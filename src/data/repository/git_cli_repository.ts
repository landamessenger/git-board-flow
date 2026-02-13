import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { logDebugInfo } from '../../utils/logger';
import { getLatestVersion } from '../../utils/version_utils';

/**
 * Repository for Git operations executed via CLI (exec).
 * Isolated to allow unit tests with mocked @actions/exec and @actions/core.
 */
export class GitCliRepository {

    fetchRemoteBranches = async (): Promise<void> => {
        try {
            logDebugInfo('Fetching tags and forcing fetch...');
            await exec.exec('git', ['fetch', '--tags', '--force']);

            logDebugInfo('Fetching all remote branches with verbose output...');
            await exec.exec('git', ['fetch', '--all', '-v']);

            logDebugInfo('Successfully fetched all remote branches.');
        } catch (error) {
            core.setFailed(`Error fetching remote branches: ${error}`);
        }
    };

    getLatestTag = async (): Promise<string | undefined> => {
        try {
            logDebugInfo('Fetching the latest tag...');
            await exec.exec('git', ['fetch', '--tags']);

            const tags: string[] = [];
            await exec.exec('git', ['tag', '--sort=-creatordate'], {
                listeners: {
                    stdout: (data: Buffer) => {
                        tags.push(...data.toString().split('\n').map((v) => {
                            return v.replace('v', '');
                        }));
                    },
                },
            });

            const validTags = tags.filter(tag => /\d+\.\d+\.\d+$/.test(tag));

            if (validTags.length > 0) {
                const latestTag = getLatestVersion(validTags);
                logDebugInfo(`Latest tag: ${latestTag}`);
                return latestTag;
            } else {
                logDebugInfo('No valid tags found.');
                return undefined;
            }
        } catch (error) {
            core.setFailed(`Error fetching the latest tag: ${error}`);
            return undefined;
        }
    };

    getCommitTag = async (latestTag: string | undefined): Promise<string | undefined> => {
        try {
            if (!latestTag) {
                core.setFailed('No LATEST_TAG found in the environment');
                return undefined;
            }

            let tagVersion: string;
            if (latestTag.startsWith('v')) {
                tagVersion = latestTag;
            } else {
                tagVersion = `v${latestTag}`;
            }

            logDebugInfo(`Fetching commit hash for the tag: ${tagVersion}`);
            let commitOid = '';
            await exec.exec('git', ['rev-list', '-n', '1', tagVersion], {
                listeners: {
                    stdout: (data: Buffer) => {
                        commitOid = data.toString().trim();
                    },
                },
            });

            if (commitOid) {
                logDebugInfo(`Commit tag: ${commitOid}`);
                return commitOid;
            } else {
                core.setFailed('No commit found for the tag');
            }
        } catch (error) {
            core.setFailed(`Error fetching the commit hash: ${error}`);
        }
        return undefined;
    };
}
