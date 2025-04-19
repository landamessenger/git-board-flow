import { Execution } from "../../data/model/execution";
import { IssueContentInterface } from "./base/issue_content_interface";
export declare class MarkdownContentHotfixHandler extends IssueContentInterface {
    get id(): string;
    get visibleContent(): boolean;
    update: (execution: Execution, content: string) => Promise<string | undefined>;
    get: (execution: Execution) => Promise<string | undefined>;
}
