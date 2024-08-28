import { ISSUE_ID, RELEASE_FAIL_LABEL } from "./definitions/constants.js";

export default async (octokit, title, owner, repo) => {
  let issues = [];

  const {
    data: {
      repository: {
        issues: { nodes: issueNodes },
      },
    },
  } = await octokit.graphql(loadGetSRIssuesQuery, {
    owner,
    repo,
    labels: RELEASE_FAIL_LABEL,
  });

  issues.push(...issueNodes);
  
  /**
   * BACKWARD COMPATIBILITY: Fallback to the search API if the issue was not found in the GraphQL response.
   * This fallback will be removed in a future release
   */
  if (issueNodes.length === 0) {
    try {
      const {
        data: { items: backwardIssues },
      } = await octokit.request("GET /search/issues", {
        q: `in:title+repo:${owner}/${repo}+type:issue+state:open+${title}`,
      });
      issues.push(...backwardIssues);
    } catch (error) {
      console.log("Error: ", error);
    }
  }

  return issues.filter((issue) => issue.body && issue.body.includes(ISSUE_ID));
};

/**
 * GraphQL Query to et the semantic-release issues for a repository.
 */
const loadGetSRIssuesQuery = `#graphql
  query getSRIssues($owner: String!, $repo: String!, $labels: [String] | String) {
    repository(owner: $owner, name: $repo) {
      issues(first: 100, states: OPEN, filterBy: { labels: $labels }) {
        nodes {
          number
          title
          body: bodyText
        }
      }
    }
  }
`;