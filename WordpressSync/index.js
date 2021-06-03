const GitHub = require('github-api');
const githubUser = 'cagov';
const wordPressUrl = 'https://as-go-covid19-d-001.azurewebsites.net';
const githubRepo = 'automation-development-target';
const outputPath = 'wordpress_output';
//const githubRepo = 'digital.ca.gov';
//const outputPath = 'wordpress';
//const wordPressUrl = 'https://live-odi-content-api.pantheonsite.io';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'main';
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
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

/**
 * prepares WP content for storage
 * @param {string} html WP html to clean
 */
const cleanupContent = html => html
  .replace(/\n\n\n/g,'\n') //reduce triple spacing
  .replace(/^\n/g,'') //remove leading CR
  ;

/**
 * fetches a dictionary object from WP
 * @param {string} listname the list to get
 * @returns {Promise<{}>} the dictionary
 */
const fetchDictionary = async listname => Object.assign({}, ...
  (await fetchRetry(`${wordPressApiUrl}${listname}?context=embed&hide_empty=true&per_page=100`,
    {method:"Get",retries:3,retryDelay:2000})
    .then(res => res.json()))
    .map(x=>({[x.id]:x.name})));

/**
 * Gets a JSON starting point common to many WP items
 * @param {{}} wpRow row from API
 * @param {{}} userlist dictionary of users
 */
const getWpCommonJson = (wpRow,userlist) => ({
  id: wpRow.id,
  slug: wpRow.slug,
  title: wpRow.title.rendered,
  author: userlist[wpRow.author],
  date_gmt: wpRow.date_gmt,
  modified_gmt: wpRow.modified_gmt,
  link: wpRow.link,
  excerpt: wpRow.excerpt.rendered
});

const startManifest = () => ({
  meta: {

  },
  data: {
    pages: [],
    posts: []
  }
});

module.exports = async () => {
  const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
  const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
  //const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

  //List of WP categories
  const categorylist = await fetchDictionary('categories');
  const taglist = await fetchDictionary('tags');
  const userlist = await fetchDictionary('users');

  const allPosts = await WpApi_GetPagedData('posts');
  const allPages = await WpApi_GetPagedData('pages');

  const allFilesMap = new Map();
  const manifest = startManifest();
  allPosts.forEach(x=>{

    const json = getWpCommonJson(x,userlist);
    json.categories = x.categories.map(t=>categorylist[t]);
    json.tags = x.tags.map(t=>taglist[t]);

    const htmlFilepath = `posts/${x.slug}.html`;
    const jsonFilepath = `posts/${x.slug}.json`;
    allFilesMap.set(jsonFilepath,json);
    allFilesMap.set(htmlFilepath,cleanupContent(x.content.rendered));

    const manifestRow = {...json};
    delete manifestRow.modified_gmt;
    delete manifestRow.excerpt;
    manifest.data.posts.push(manifestRow);
  });

  allPages.forEach(x=>{
    const json = getWpCommonJson(x,userlist);
    json.parent = x.parent;
    json.menu_order = x.menu_order;

    const jsonFilepath = `pages/${x.slug}.json`;
    const htmlFilepath = `pages/${x.slug}.html`;
    allFilesMap.set(jsonFilepath,json);
    allFilesMap.set(htmlFilepath,cleanupContent(x.content.rendered));

    const manifestRow = {...json};
    delete manifestRow.modified_gmt;
    delete manifestRow.excerpt;
    manifest.data.pages.push(manifestRow);
  });

  allFilesMap.set('manifest.json',manifest);

  const workTree = await createTreeFromFileMap(gitRepo,masterBranch,allFilesMap,outputPath);

  await PrIfChanged(gitRepo, masterBranch, workTree, `${todayDateString()} Testing Wordpress`, committer);
};