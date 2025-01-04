import * as core from "@actions/core";
import {IssueContentInterface} from "./base/issue_content_interface";
import {Execution} from "../../model/execution";

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
            core.error(`Error updating issue content: ${error}`);
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
            core.error(`Error reading issue content: ${error}`);
            throw error;
        }
    }
}
