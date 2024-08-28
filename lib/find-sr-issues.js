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