const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');
/**
 * Halts processing for a set time
 * @param {number} ms milliseconds to sleep (1000 = 1s)
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

//Git generates the SHA by concatenating a header in the form of blob {content.length} {null byte} and the contents of your file
const sha1 = require('sha1');
/**
 * Returns a Github equivalent sha hash for any given content
 * @param {string} content string content to hash
 * @returns SHA Hash that would be used on Github for the given content
 */
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
 * @param {{name:string,email:string}} committer Github Name/Email
 * @returns {Promise<{html_url:string;number:number,head:{ref:string}}>} the new PR
 */
const PrIfChanged = async (gitRepo, masterBranch, tree, PrTitle,committer) => {
  if(!tree.length) {
    console.log(`No tree changes for - ${PrTitle}`);
    return null;
  }

  const newBranchName = `${PrTitle}-${todayTimeString()}`.replace(/ /g,'_');
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
      console.log(`Creating tree for ${PrTitle} - ${rowCount}/${totalRows} items`);
      createTreeResult = await gitRepo.createTree(treePart,createTreeResult.data.sha);
  }

  //Create a commit the maps to all the tree changes
  const commitResult = await gitRepo.commit(baseSha,createTreeResult.data.sha,PrTitle,committer);
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
  PrIfChanged,
  todayDateString,
  todayTimeString,
  nowPacTime,
  sleep
};