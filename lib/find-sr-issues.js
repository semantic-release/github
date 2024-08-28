import { ISSUE_ID } from "./definitions/constants.js";

export default async (octokit, title, owner, repo) => {
  const {
    data: { items: issues },
  } = await octokit.request("GET /search/issues", {
    q: `in:title+repo:${owner}/${repo}+type:issue+state:open+${title}`,
  });

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
          bodyText
        }
      }
    }
  }
`;