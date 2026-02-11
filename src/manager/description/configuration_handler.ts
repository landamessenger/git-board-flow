import { Config } from "../../data/model/config";
import { Execution } from "../../data/model/execution";
import { logError } from "../../utils/logger";
import { IssueContentInterface } from "./base/issue_content_interface";

/** Keys that must be preserved from stored config when current has undefined (e.g. when branch already existed). */
const CONFIG_KEYS_TO_PRESERVE = [
    'parentBranch',
    'workingBranch',
    'releaseBranch',
    'hotfixBranch',
    'hotfixOriginBranch',
    'branchType',
] as const;

export class ConfigurationHandler extends IssueContentInterface {
    get id(): string {
        return 'configuration'
    }

    get visibleContent(): boolean {
        return false;
    }

    update = async (execution: Execution) => {
        try {
            const current = execution.currentConfiguration;
            const payload: Record<string, unknown> = {
                branchType: current.branchType,
                releaseBranch: current.releaseBranch,
                workingBranch: current.workingBranch,
                parentBranch: current.parentBranch,
                hotfixOriginBranch: current.hotfixOriginBranch,
                hotfixBranch: current.hotfixBranch,
                results: current.results,
                branchConfiguration: current.branchConfiguration,
            };

            const storedRaw = await this.internalGetter(execution);
            if (storedRaw != null && storedRaw.trim().length > 0) {
                try {
                    const stored = JSON.parse(storedRaw) as Record<string, unknown>;
                    for (const key of CONFIG_KEYS_TO_PRESERVE) {
                        if (payload[key] === undefined && stored[key] !== undefined) {
                            payload[key] = stored[key];
                        }
                    }
                } catch {
                    /* ignore parse errors, save current as-is */
                }
            }

            return await this.internalUpdate(execution, JSON.stringify(payload, null, 4));
        } catch (error) {
            logError(`Error updating issue description: ${error}`);
            return undefined;
        }
    }

    get = async (execution: Execution): Promise<Config | undefined> => {
        try {
            const config = await this.internalGetter(execution)
            if (config === undefined) {
                return undefined;
            }
            const branchConfig = JSON.parse(config);
            return new Config(branchConfig);
        } catch (error) {
            logError(`Error reading issue configuration: ${error}`);
            throw error;
        }
    }
}
