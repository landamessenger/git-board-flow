import { ProjectDetail } from "../model/project_detail";
export declare class ProjectRepository {
    private readonly priorityLabel;
    private readonly sizeLabel;
    private readonly statusLabel;
    /**
     * Retrieves detailed information about a GitHub project
     * @param projectId - The project number/ID
     * @param token - GitHub authentication token
     * @returns Promise<ProjectDetail> - The project details
     * @throws {Error} If the project is not found or if there are authentication/network issues
     */
    getProjectDetail: (projectId: string, token: string) => Promise<ProjectDetail>;
    private getContentId;
    isContentLinked: (project: ProjectDetail, contentId: string, token: string) => Promise<boolean>;
    linkContentId: (project: ProjectDetail, contentId: string, token: string) => Promise<boolean>;
    private setSingleSelectFieldValue;
    setTaskPriority: (project: ProjectDetail, owner: string, repo: string, issueOrPullRequestNumber: number, priorityLabel: string, token: string) => Promise<boolean>;
    setTaskSize: (project: ProjectDetail, owner: string, repo: string, issueOrPullRequestNumber: number, sizeLabel: string, token: string) => Promise<boolean>;
    moveIssueToColumn: (project: ProjectDetail, owner: string, repo: string, issueOrPullRequestNumber: number, columnName: string, token: string) => Promise<boolean>;
    getRandomMembers: (organization: string, membersToAdd: number, currentMembers: string[], token: string) => Promise<string[]>;
    getAllMembers: (organization: string, token: string) => Promise<string[]>;
    getUserFromToken: (token: string) => Promise<string>;
}
