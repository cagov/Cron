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

  const fetchDictionary = async listname => Object.assign({}, ...
    (await fetchRetry(`${wordPressApiUrl}${listname}?context=embed&hide_empty=true&per_page=100`,
      {method:"Get",retries:3,retryDelay:2000})        
      .then(res => res.json()))
      .map(x=>({[x.id]:x.name})));

  //List of WP categories
  const categorylist = await fetchDictionary('categories');
  const taglist = await fetchDictionary('tags');
  const userlist = await fetchDictionary('users');

  const allPosts = await WpApi_GetPagedData('posts');
  const allPages = await WpApi_GetPagedData('pages');

  const getCommonJson = x => ({
    id: x.id,
    slug: x.slug,
    title: x.title.rendered,
    author: userlist[x.author],
    date_gmt: x.date_gmt,
    modified_gmt: x.modified_gmt,
    link: x.link,
    excerpt: x.excerpt.rendered
  });

  const allFilesMap = new Map();
  allPosts.forEach(x=>{
    const jsonFilepath = `posts/${x.slug}.json`;
    const json = getCommonJson(x);
    json.tags = x.tags.map(t=>taglist[t]);
    json.categories = x.categories.map(t=>categorylist[t]);

    const htmlFilepath = `posts/${x.slug}.html`;
    allFilesMap.set(jsonFilepath,json);
    allFilesMap.set(htmlFilepath,x.content.rendered);
  });

  allPages.forEach(x=>{
    const jsonFilepath = `pages/${x.slug}.json`;
    const json = getCommonJson(x);
    json.parent = x.parent;
    json.menu_order = x.menu_order;

    const htmlFilepath = `pages/${x.slug}.html`;
    allFilesMap.set(jsonFilepath,json);
    allFilesMap.set(htmlFilepath,x.content.rendered);
  });

  const workTree = await createTreeFromFileMap(gitRepo,masterBranch,allFilesMap,outputPath);

  await PrIfChanged(gitRepo, masterBranch, workTree, `${todayDateString()} Testing Wordpress`, committer);
};