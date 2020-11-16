const fetch = require('node-fetch');
const { fetchJSON } = require('../fetchJSON');

const githubUser = 'cagov';
const githubRepo = 'covid19';
const githubApiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/`;
const committer = {
  'name': process.env["GITHUB_NAME"],
  'email': process.env["GITHUB_EMAIL"]
};

const gitAuthheader = () => {
    const token = process.env["GITHUB_TOKEN"];
    if (!committer.name || !committer.email || !token) {
        throw new Error(`Must define env variables for Github (GITHUB_NAME, GITHUB_EMAIL, GITHUB_TOKEN)`);
    }

    return {
        'Authorization' : `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

const gitDefaultOptions = () => ({method: 'GET', headers:gitAuthheader() });

//Common function for creating a PUT option
const gitPutOptions = bodyJSON =>
    ({
        method: 'PUT',
        headers: gitAuthheader(),
        body: JSON.stringify(bodyJSON)
    });

const gitHubMessage = (action, file) => `${action} - ${file}`;

const branchGetHeadUrl = branch => `${githubApiUrl}git/refs/heads/${branch}`;

//Return a branch head record
const branchGetHead = async branch =>
    fetchJSON(branchGetHeadUrl(branch),gitDefaultOptions());

//create a branch for this update
const gitHubBranchCreate = async (branch,mergetarget) => {
  const branchGetResult = await branchGetHead(mergetarget);
  const sha = branchGetResult.object.sha;

  const branchCreateBody = {
      method: 'POST',
      headers: gitAuthheader(),
      body: JSON.stringify({
          committer,
          ref: `refs/heads/${branch}`,
          sha
      })
  };

  await fetchJSON(`${githubApiUrl}git/refs`, branchCreateBody)
      .then(() => {console.log(`BRANCH CREATE Success: ${branch}`); });
}

const gitHubPrGetByBranchName = async (base, branch) => {
//xample...
//https://developer.github.com/v3/pulls/#list-pull-requests
//https://api.github.com/repos/cagov/covid19/pulls?state=all&base=master&head=cagov:mybranch
    const url = `${githubApiUrl}pulls?state=all&base=${base}&head=${githubUser}:${branch}`;

    const results = await fetchJSON(url, gitDefaultOptions());
    return results.length ? results[0] : null;
}

//get matching references example...
//https://developer.github.com/v3/git/refs/#get-a-reference
//https://api.github.com/repos/cagov/covid19/git/ref/heads/staging

//https://developer.github.com/v3/git/refs/#list-matching-references
//https://api.github.com/repos/cagov/covid19/git/matching-refs/heads/staging
const gitHubBranchExists = async branch => 
    (await fetch(branchGetHeadUrl(branch), {
        method: 'HEAD',
        headers: gitAuthheader()
    })).ok;

const gitHubBranchDelete = async branch => {
  //delete
  //https://developer.github.com/v3/git/refs/#delete-a-reference
  const deleteBody = {
      method: 'DELETE',
      headers: gitAuthheader()
  };
  const branchDeleteResult = await fetch(branchGetHeadUrl(branch), deleteBody);

  if(branchDeleteResult.status===204) {
      console.log(`BRANCH DELETE Success: ${branch}`);
  } else {
      console.log(`BRANCH DELETE N/A: ${branch}`);
  }
}

//merge and delete branch
const gitHubBranchMerge = async (branch, mergetarget, bPrMode, PrTitle, PrLabels, ApprovePr) => {

  if(!bPrMode) {
      //just merge and delete
      //merge
      //https://developer.github.com/v3/repos/merging/#merge-a-branch
      const mergeOptions = {
          method: 'POST',
          headers: gitAuthheader(),
          body: JSON.stringify({
              committer,
              base: mergetarget,
              head: branch,
              commit_message: `Deploy to ${mergetarget}\n${branch}`
          })
      };

      await fetchJSON(`${githubApiUrl}merges`, mergeOptions)
          .then(() => {console.log(`MERGE Success: ${branch} -> ${mergetarget}`);});
      //End Merge

      await gitHubBranchDelete(branch);
  } else {
      //create a pull request
      //https://developer.github.com/v3/pulls/#create-a-pull-request
      const prbody = {
          method: 'POST',
          headers: gitAuthheader(),
          body: JSON.stringify({
              committer,
              base: mergetarget,
              head: branch,
              title: PrTitle
              //body: PrBody
              //,draft: bKeepPrOpen
          })
      };

      const PrResult = await fetchJSON(`${githubApiUrl}pulls`, prbody)
          .then(r => {
              console.log(`PR create Success`);
              return r;
          });

      //add labels to PR
      //https://developer.github.com/v3/issues/labels/#add-labels-to-an-issue
      if(PrLabels) {
          const prlabelbody = {
              method: 'POST',
              headers: gitAuthheader(),
              body: JSON.stringify({
                  labels: PrLabels
              })
          };

          const issue_number = PrResult.number;
  
          await fetchJSON(`${githubApiUrl}issues/${issue_number}/labels`, prlabelbody)
          .then(r => {
              console.log(`PR Label Success`);
              return r;
          });
      }

      if(ApprovePr) {
          //Auto Merge PR
          //https://developer.github.com/v3/pulls/#merge-a-pull-request
          //Merge method to use. Possible values are merge, squash or rebase. Default is merge.
          const prsha = PrResult.head.sha;
          const prurl = PrResult.url;
          
          const prmergebody = {
              method: 'PUT',
              headers: gitAuthheader(),
              body: JSON.stringify({
                  committer,
                  //commit_title: 'PR merge commit title',
                  //commit_message: 'PR merge commit message',
                  sha: prsha,
                  merge_method: 'squash'
              })
          };

          await fetchJSON(`${prurl}/merge`, prmergebody)
          .then(r => {
                  console.log(`PR MERGE Success`);
                  return r;
              });

          await gitHubBranchDelete(branch);
      }

      return PrResult;
  }
}

const gitHubFileDelete = async (url, sha, message, branch) => 
    await fetchJSON(url, {
        method: 'DELETE',
        headers: gitAuthheader(),
        body: JSON.stringify({
            message,
            committer,
            branch,
            sha
        })});

const gitHubFileUpdate = async (content, url, sha, message, branch) =>
    await fetchJSON(url, gitPutOptions({
        committer,
        content,
        message,
        sha,
        branch
    }));

const gitHubFileAdd = async (content, newFilePath, message, branch) =>
    await fetchJSON(`${githubApiUrl}contents/${newFilePath}`, gitPutOptions({
        committer,
        content,
        message,
        branch
    }));

const gitHubFileGet = async (path, branch) =>
    await fetchJSON(`${githubApiUrl}contents/${path}?ref=${branch}`,gitDefaultOptions());

//input a previously queryed github file, returns an updated file.  Great for sync ops.
const gitHubFileRefresh = async gitHubFile =>
    await fetchJSON(gitHubFile.url,gitDefaultOptions());

const gitHubFileGetBlob = async sha => 
    await fetchJSON(`${githubApiUrl}git/blobs/${sha}`,gitDefaultOptions());

module.exports = {
  gitHubMessage,
  gitHubBranchCreate,
  gitHubBranchMerge,
  gitHubFileDelete,
  gitHubFileUpdate,
  gitHubFileAdd,
  gitHubFileGet,
  gitHubFileRefresh,
  gitHubFileGetBlob,
  gitHubBranchExists,
  gitHubPrGetByBranchName
}