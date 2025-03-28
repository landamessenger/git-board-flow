import { Execution } from "../../model/execution";
import { logError } from "../../utils/logger";
import { IssueContentInterface } from "./base/issue_content_interface";

export class MarkdownContentHotfixHandler extends IssueContentInterface {
    get id(): string {
        return 'markdown_content_hotfix_handler';
    }

    get visibleContent(): boolean {
        return true;
    }

    update = async (execution: Execution, content: string) => {
        try {
            return await this.internalUpdate(execution, content)
        } catch (error) {
            logError(`Error updating issue content: ${error}`);
            return undefined;
        }
    }

    get = async (execution: Execution): Promise<string | undefined> => {
        try {
            const content = await this.internalGetter(execution)
            if (content === undefined) {
                return undefined;
            }
            return content;
        } catch (error) {
            logError(`Error reading issue content: ${error}`);
            throw error;
        }
    }
}
