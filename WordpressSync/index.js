const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'automation-development-target';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const outputPath = 'wordpress_output';
const masterBranch = 'main';
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
const wordPressUrl = 'https://as-go-covid19-d-001.azurewebsites.net';
const wordPressApiUrl = `${wordPressUrl}/wp-json/wp/v2/`;

const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

/**
 * Call the paged wordpress api
 * @param {string} objecttype 
 * @returns {Promise<{
 *    id:number,
 *    date_gmt:string
 * }[]]>}
 */
const WpApi_GetPagedData = async objecttype => {
  const fetchquery = `${wordPressApiUrl}${objecttype}?per_page=100&orderby=slug&order=asc`;

  let totalpages = 999;

  const rows = [];
  
  for(let currentpage = 1; currentpage<=totalpages; currentpage++) {
    const fetchResponse = await fetchRetry(`${fetchquery}&page=${currentpage}`,{method:"Get",retries:3,retryDelay:2000});
    totalpages = Number(fetchResponse.headers.get('x-wp-totalpages'));
    const fetchResponseJson = await fetchResponse.json();

    fetchResponseJson.forEach(x=>rows.push(x));
  }

  return rows;
};


module.exports = async () => {
  const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
  const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
  //const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

  //List of WP categories
  const categorylist = (await fetchRetry(`${wordPressApiUrl}categories?context=embed&hide_empty=true&per_page=100&orderby=slug&order=asc`,
    {method:"Get",retries:3,retryDelay:2000})        
    .then(res => res.json()))
    .map(x=>({id:x.id,name:x.name}));

  const taglist = (await fetchRetry(`${wordPressApiUrl}tags?context=embed&hide_empty=true&per_page=100&orderby=slug&order=asc`,
    {method:"Get",retries:3,retryDelay:2000})        
    .then(res => res.json()))
    .map(x=>({id:x.id,name:x.name}));

  const allPosts = await WpApi_GetPagedData('posts');
  //const allPages = await WpApi_GetPagedData('pages');


  const allFilesMap = new Map();
  allPosts.forEach(x=>{

    const jsonFilepath = `posts/${x.slug}.json`;
    const json = {
      id: x.id,
      slug: x.slug,
      author: x.author,
      date_gmt: x.date_gmt,
      modified_gmt: x.modified_gmt,
      tags: x.tags.map(t=>taglist.find(l=>l.id===t).name),
      categories: x.categories.map(t=>categorylist.find(l=>l.id===t).name),
      title: x.title.rendered
    };

    const htmlFilepath = `posts/${x.slug}.html`;
    
    allFilesMap.set(jsonFilepath,json);
    allFilesMap.set(htmlFilepath,x.content.rendered);
  });

  const workTree = await createTreeFromFileMap(gitRepo,masterBranch,allFilesMap,outputPath);

  await PrIfChanged(gitRepo, masterBranch, workTree, `${todayDateString()} Testing Wordpress`, committer);

};