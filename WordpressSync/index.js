
const wordPressUrl = 'https://as-go-covid19-d-001.azurewebsites.net';
const wordPressApiUrl = `${wordPressUrl}/wp-json/wp/v2/`;

const fetch = require('node-fetch');
const fetchRetry = require('fetch-retry')(fetch);

module.exports = async () => {
  const fetchquery = `${wordPressApiUrl}posts?per_page=50&orderby=slug&order=asc`;

  let totalpages = 999999;

  const rows = [];
  
  for(let currentpage = 1; currentpage<=totalpages; currentpage++) {
    totalpages = Number(fetchResponse.headers.get('x-wp-totalpages'));

    const fetchResponse = await fetchRetry(`${fetchquery}&page=${currentpage}`,{method:"Get",retries:3,retryDelay:2000});
    const fetchResponseJson = await fetchResponse.json();

    fetchResponseJson.forEach(x=>rows.push(x));
  }



  const yo =1;

};