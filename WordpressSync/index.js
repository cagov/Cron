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

const commonMeta = {
  api_version: "v2",
  process: {
    source_code: "https://github.com/cagov/cron",
    source_data: wordPressUrl,
    deployment_target: `https://github.com/${githubUser}/${githubRepo}/tree/main/${outputPath}`
  },
  refresh_frequency: "as needed"
};

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
 * @param {string} file_path_html
 * @param {string} file_path_json 
 */
const getWpCommonJsonData = (wpRow,userlist,file_path_html,file_path_json) => ({
  id: wpRow.id,
  slug: wpRow.slug,
  title: wpRow.title.rendered,
  author: userlist[wpRow.author],
  date_gmt: wpRow.date_gmt,
  modified_gmt: wpRow.modified_gmt,
  wordpress_url: wpRow.link,
  file_path_html,
  file_path_json,
  excerpt: wpRow.excerpt.rendered
});

const startManifest = () => ({
  meta: commonMeta,
  data: {
    pages: [],
    posts: []
  }
});

/**
 * @param {{ date_gmt: string, modified_gmt: string }} data 
 */
const wrapInFileMeta = data => ({
  meta: {
    created_date: data.date_gmt,
    updated_date: data.modified_gmt,
    ...commonMeta
  },
  data
});

/**
 * returns a copy of the JsonData excluding fields that are not desired in the manifest
 * @param {{}} JsonData 
 * @returns manifestRow
 */
const covertWpJsonDataToManifestRow = JsonData => {
  const manifestRow = {...JsonData};
  delete manifestRow.modified_gmt;
  delete manifestRow.excerpt;
  return manifestRow;
};

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
    const jsonData = getWpCommonJsonData(x,userlist,`posts/${x.slug}.html`,`posts/${x.slug}.json`);
    jsonData.categories = x.categories.map(t=>categorylist[t]);
    jsonData.tags = x.tags.map(t=>taglist[t]);

    allFilesMap.set(jsonData.file_path_json,wrapInFileMeta(jsonData));
    allFilesMap.set(jsonData.file_path_html,cleanupContent(x.content.rendered));

    manifest.data.posts.push(covertWpJsonDataToManifestRow(jsonData));
  });

  allPages.forEach(x=>{
    const jsonData = getWpCommonJsonData(x,userlist,`pages/${x.slug}.html`,`pages/${x.slug}.json`);
    jsonData.parent = x.parent;
    jsonData.menu_order = x.menu_order;

    allFilesMap.set(jsonData.file_path_json,wrapInFileMeta(jsonData));
    allFilesMap.set(jsonData.file_path_html,cleanupContent(x.content.rendered));

    manifest.data.pages.push(covertWpJsonDataToManifestRow(jsonData));
  });

  allFilesMap.set('manifest.json',manifest);

  const workTree = await createTreeFromFileMap(gitRepo,masterBranch,allFilesMap,outputPath);

  await PrIfChanged(gitRepo, masterBranch, workTree, `${todayDateString()} Testing Wordpress`, committer);
};