import { Config } from "../../data/model/config";
import { Execution } from "../../data/model/execution";
import { IssueContentInterface } from "./base/issue_content_interface";
export declare class ConfigurationHandler extends IssueContentInterface {
    get id(): string;
    get visibleContent(): boolean;
    update: (execution: Execution) => Promise<string | undefined>;
    get: (execution: Execution) => Promise<Config | undefined>;
}
