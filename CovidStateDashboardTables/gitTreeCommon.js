const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};

//Git generates the SHA by concatenating a header in the form of blob {content.length} {null byte} and the contents of your file
const sha1 = require('sha1');
const gitHubBlobPredictSha = content => sha1(`blob ${Buffer.byteLength(content)}\0${content}`);

/**
 * Creates a gitHub Tree array, skipping duplicates based on the outputpath
 * @param {*} gitRepo from github-api
 * @param {string} masterBranch usually "master" or "main"
 * @param {Map<string,any>} filesMap contains the data to push
 * @param {string} outputPath the root path for all files
 * @returns 
 */
 const createTreeFromFileMap = async (gitRepo, masterBranch, filesMap, outputPath) => {
  const rootTree = await gitRepo.getSha(masterBranch,outputPath.split('/')[0]);
  const referenceTreeSha = rootTree.data.find(f=>f.path===outputPath).sha;
  const referenceTree = await gitRepo.getTree(`${referenceTreeSha}?recursive=true`);

  const targetTree = [];
  //Tree parts...
  //https://docs.github.com/en/free-pro-team@latest/rest/reference/git#create-a-tree
  const mode = '100644'; //code for tree blob
  const type = 'blob';

  for (const [key,value] of filesMap) {
      let content = JSON.stringify(value,null,2);
      let existingFile = referenceTree.data.tree.find(x=>x.path===key);
      if(!existingFile || existingFile.sha !== gitHubBlobPredictSha(content)) {
        targetTree.push({
          path: `${outputPath}/${key}`,
          content, 
          mode, 
          type
        });
      }
  }

  return targetTree;
};

/**
 *  return a new PR if the tree has changes
 * @param {*} gitRepo from github-api
 * @param {string} masterBranch usually "master" or "main"
 * @param {{}[]} tree from createTreeFromFileMap
 * @param {string} PrTitle the name of the new branch to create
 * @returns {Promise<{html_url:string;number:number,head:{ref:string}}>} the new PR
 */
const PrIfChanged = async (gitRepo, masterBranch, tree, PrTitle) => {
  if(!tree.length) {
    console.log('No tree changes');
    return null;
  }

  const commitName = PrTitle;
  const newBranchName = PrTitle.replace(/ /g,'_');

  let treeParts = [tree];
  const totalRows = tree.length;

  console.log(`Tree data is ${Buffer.byteLength(JSON.stringify(tree))} bytes`);

  //Split the tree into allowable sizes
  let evalIndex = 0;
  while(evalIndex < treeParts.length) {
      if(JSON.stringify(treeParts[evalIndex]).length>9000000) {
          let half = Math.ceil(treeParts[evalIndex].length / 2);
          treeParts.unshift(treeParts[evalIndex].splice(0, half));
      } else {
          evalIndex++;
      }
  }

  //Grab the starting point for a fresh tree
  const refResult = await gitRepo.getRef(`heads/${masterBranch}`);
  const baseSha = refResult.data.object.sha;

  //Loop through adding items to the tree
  let createTreeResult = {data:{sha:baseSha}};
  let rowCount = 0;
  for(let treePart of treeParts) {
      rowCount += treePart.length;
      console.log(`Creating tree for ${commitName} - ${rowCount}/${totalRows} items`);
      createTreeResult = await gitRepo.createTree(treePart,createTreeResult.data.sha);
  }

  //Create a commit the maps to all the tree changes
  const commitResult = await gitRepo.commit(baseSha,createTreeResult.data.sha,commitName,committer);
  const commitSha = commitResult.data.sha;

  //Compare the proposed commit with the trunk (master) branch
  const compare = await gitRepo.compareBranches(baseSha,commitSha);
  if (compare.data.files.length) {
      console.log(`${compare.data.files.length} changes.`);
      //Create a new branch and assign this commit to it, return the new branch.
      await gitRepo.createBranch(masterBranch,newBranchName);
      await gitRepo.updateHead(`heads/${newBranchName}`,commitSha);

      const Pr = (await gitRepo.createPullRequest({
          title: PrTitle,
          head: newBranchName,
          base: masterBranch
      }))
      .data;

      console.log(`PR created - ${Pr.html_url}`);

      return Pr;

  } else {
      console.log('no changes');
      return null;
  }
};

module.exports = {
  createTreeFromFileMap,
  PrIfChanged
};