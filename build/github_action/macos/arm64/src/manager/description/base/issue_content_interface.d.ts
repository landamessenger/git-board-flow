import { Execution } from "../../../data/model/execution";
import { ContentInterface } from "./content_interface";
export declare abstract class IssueContentInterface extends ContentInterface {
    private issueRepository;
    internalGetter: (execution: Execution) => Promise<string | undefined>;
    internalUpdate: (execution: Execution, content: string) => Promise<string | undefined>;
}
