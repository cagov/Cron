const request = require('request');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

module.exports =  (success, failure) => {
  let url = 'https://www.cdph.ca.gov/Programs/OPA/Pages/New-Release-2020.aspx';
  let newStuff = [];

  console.log(`fetching ${url}`);
  request(url, (error, response, body) => {
    if(error) {
      failure(error);
    }
    const dom = new JSDOM(body);
    let allNews = dom.window.document.querySelectorAll('#MSOZoneCell_WebPartWPQ4 tr');
    allNews.forEach( news => {
      let content = news.textContent;
      if(content.toLowerCase().indexOf('covid') > -1 || content.toLowerCase().indexOf('corona') > -1) {
        let parsedItem = parseItem(news);
        if(parsedItem) {
          newStuff.push(parsedItem);
        }
      }
    });
    success(newStuff);
  });
};

function parseItem(news) {
  /*
  <th class="ms-rteTableFirstCol-default" rowspan="1" colspan="1" style="width: 100%;">
  <h4 class="ms-rteElement-H4B">
    <a href="/Programs/OPA/Pages/NR20-023.aspx">State Health &amp; Emergency Officials Announce Latest COVID-19 Facts&nbsp;
    </a>
  </h4>
  <p style="line-height: 1.6; color: #777777;">March 15, 2020 -&nbsp;<span lang="EN">The California Department of Public Health today announced the most recent statistics on COVID-19.&nbsp;</span></p></th>"
  */
  let newsObject = {};
  if(news.querySelector('a')) {
    newsObject.title = news.querySelector('a').textContent.replace(/"/g,'&quot;');
    newsObject.url = news.querySelector('a').href;
    let desc = news.textContent.replace(newsObject.title,'');
    let delimiter = ', 2020';
    if(desc.indexOf(delimiter) > -1) {
      let pieces = desc.split(delimiter);
      let parsedDate = new Date(pieces[0]
        .replace(/\u200B/g,'') //also remove char 8203 (Unicode Character 'ZERO WIDTH SPACE' (U+200B).)
        .trim()+delimiter);
      if(parsedDate && parsedDate.getTime() > 1577865600000 && parsedDate.getTime() < 1609401600000) {
        newsObject.date = parsedDate.toISOString();
      } else {
        console.error('date fail');
      }
      let description = pieces[1].trim();
      if(description.indexOf('-') === 0 || description.indexOf('–') === 0) {
        newsObject.description = description.replace('-','').replace('-&nbsp;','').replace('–','').replace('– ​','').trim();
      }
    }
    if(newsObject.date) {
      return newsObject;
    }
  }
  return false;
}