type ProjectItem = {
    id: string;
    project: {
        id: string;
        title: string;
        url: string;
    };
};

type IssueProjectsResponse = {
    repository: {
        issue: {
            projectItems: {
                nodes: ProjectItem[];
            };
        };
    };
};