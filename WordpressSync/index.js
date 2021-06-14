const GitHub = require('github-api');
const endpoints = require('./endpoints.json').data;
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const commitTitle = 'Wordpress Content Update';
const apiPath = '/wp-json/wp/v2/';
const { createTreeFromFileMap, PrIfChanged } = require('../common/gitTreeCommon');
const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

/**
 * @param {{WordPressUrl: string, GitHubTarget: {Owner: string, Repo: string, Path: string,Branch: string}}} endpoint 
 * @returns 
 */
const commonMeta = endpoint => ({
  api_version: "v2",
  api_url: endpoint.WordPressUrl+apiPath,
  process: {
    source_code: "https://github.com/cagov/cron",
    source_data: endpoint.WordPressUrl,
    deployment_target: `https://github.com/${endpoint.GitHubTarget.Owner}/${endpoint.GitHubTarget.Repo}/tree/main/${endpoint.GitHubTarget.Path}`
  },
  refresh_frequency: "as needed"
});

/**
 * Call the paged wordpress api
 * @param {string} wordPressApiUrl WP source URL
 * @param {string} objecttype 
 * @returns {Promise<{
 *    id:number,
 *    date_gmt:string
 * }[]]>}
 */
const WpApi_GetPagedData = async (wordPressApiUrl,objecttype) => {
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
 * @param {string} wordPressApiUrl WP source URL
 * @param {string} listname the list to get
 * @returns {Promise<{}>} the dictionary
 */
const fetchDictionary = async (wordPressApiUrl,listname) => Object.assign({}, ...
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
  date: wpRow.date,
  modified: wpRow.modified,
  date_gmt: wpRow.date_gmt,
  modified_gmt: wpRow.modified_gmt,
  wordpress_url: wpRow.link,
  file_path_html,
  file_path_json,
  excerpt: wpRow.excerpt ? wpRow.excerpt.rendered : null
});

/**
 * @param {{WordPressUrl: string, GitHubTarget: {Owner: string, Repo: string, Path: string,Branch: string}}} endpoint 
 */
const startManifest = endpoint => ({
  meta: commonMeta(endpoint),
  data: {
    pages: [],
    posts: []
  }
});

/**
 * @param {{WordPressUrl: string, GitHubTarget: {Owner: string, Repo: string, Path: string,Branch: string}}} endpoint 
 * @param {{ date_gmt: string, modified_gmt: string }} data 
 */
const wrapInFileMeta = (endpoint,data) => ({
  meta: {
    created_date: data.date_gmt,
    updated_date: data.modified_gmt,
    ...commonMeta(endpoint)
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
  delete manifestRow.modified;
  delete manifestRow.modified_gmt;
  delete manifestRow.excerpt;
  return manifestRow;
};

module.exports = async () => {
  const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });

  for(const endpoint of endpoints.projects) {
    const wordPressApiUrl = endpoint.WordPressUrl+apiPath;
    const gitRepo = await gitModule.getRepo(endpoint.GitHubTarget.Owner,endpoint.GitHubTarget.Repo);
    //const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    //List of WP categories
    const categorylist = await fetchDictionary(wordPressApiUrl,'categories');
    const taglist = await fetchDictionary(wordPressApiUrl,'tags');
    const userlist = await fetchDictionary(wordPressApiUrl,'users');

    const allFilesMap = new Map();
    const manifest = startManifest(endpoint);
    
    // POSTS
    const allPosts = await WpApi_GetPagedData(wordPressApiUrl,'posts');
    allPosts.forEach(x=>{
      const jsonData = getWpCommonJsonData(x,userlist,`posts/${x.slug}.html`,`posts/${x.slug}.json`);
      jsonData.categories = x.categories.map(t=>categorylist[t]);
      jsonData.tags = x.tags.map(t=>taglist[t]);

      allFilesMap.set(jsonData.file_path_json,wrapInFileMeta(endpoint,jsonData));
      allFilesMap.set(jsonData.file_path_html,cleanupContent(x.content.rendered));

      manifest.data.posts.push(covertWpJsonDataToManifestRow(jsonData));
    });

    // PAGES
    const allPages = await WpApi_GetPagedData(wordPressApiUrl,'pages');
    allPages.forEach(x=>{
      const jsonData = getWpCommonJsonData(x,userlist,`pages/${x.slug}.html`,`pages/${x.slug}.json`);
      jsonData.parent = x.parent;
      jsonData.menu_order = x.menu_order;

      allFilesMap.set(jsonData.file_path_json,wrapInFileMeta(endpoint,jsonData));
      allFilesMap.set(jsonData.file_path_html,cleanupContent(x.content.rendered));

      manifest.data.pages.push(covertWpJsonDataToManifestRow(jsonData));
    });

    // MEDIA
    const mediaContentPlaceholder = 'TBD';
    if(endpoint.GitHubTarget.Media) {
      manifest.data.media = [];
      const allMedia = await WpApi_GetPagedData(wordPressApiUrl,'media');

      allMedia.forEach(x=>{
        const jsonData = getWpCommonJsonData(x,userlist,null,`media/${x.slug}.json`);
        delete jsonData.excerpt;
        delete jsonData.file_path_html;
  
        jsonData.sizes = {...x.media_details.sizes};

        allFilesMap.set(jsonData.file_path_json,wrapInFileMeta(endpoint,jsonData));
        //put binary placeholders so they aren't deleted.  Will search for these if an update happens.
        for (const s of Object.keys(jsonData.sizes).map(o=>jsonData.sizes[o])) {
          allFilesMap.set(`media/${s.file}`, mediaContentPlaceholder);
        }
  
        manifest.data.media.push(covertWpJsonDataToManifestRow(jsonData));
      });
    }


    allFilesMap.set('manifest.json',manifest);

    let workTree = await createTreeFromFileMap(gitRepo,endpoint.GitHubTarget.Branch,allFilesMap,endpoint.GitHubTarget.Path);

    //Pull in binaries for any media meta changes
    const updatedBinaries = workTree.filter(x=> x.content!==mediaContentPlaceholder && x.path.includes('media/'));

    for (const m of updatedBinaries) {
      const jsonData = JSON.parse(m.content);

      const sizes = Object.keys(jsonData.data.sizes).map(s=>jsonData.data.sizes[s]);
      for (const s of sizes) {
        const fetchResponse = await fetchRetry(s.source_url,{method:"Get",retries:3,retryDelay:2000});
        const blob = await fetchResponse.arrayBuffer();
        const buffer = Buffer.from(blob);
        const blobResult = await gitRepo.createBlob(buffer); //TODO: replace with non base64 upload

        //swap in the new blob sha here.  If the sha matches something already there it will be determined on server.
        const treeNode = workTree.find(x=>x.path===`${endpoint.GitHubTarget.Path}/media/${s.file}`);
        delete treeNode.content;
        treeNode.sha = blobResult.data.sha;
      }
    }

    //Remove any leftover binary placeholders...
    workTree = workTree.filter(x=>x.content !== mediaContentPlaceholder);

    const HtmlUpdateCount = workTree.filter(x=>x.path.endsWith(".html")).length;

    await PrIfChanged(gitRepo, endpoint.GitHubTarget.Branch, workTree, `${commitTitle} (${HtmlUpdateCount} updates)`, committer, true);
  }
};