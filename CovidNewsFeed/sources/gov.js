const fetch = require('node-fetch');

module.exports =  async function(success,failure) {
  let url = 'https://www.gov.ca.gov/wp-json/wp/v2/posts?per_page=25';
  let newStuff = [];

  fetch(url)
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(json => {
      json.forEach( news => {
        if(news.content.rendered.toLowerCase().indexOf('covid') > -1 || news.content.rendered.toLowerCase().indexOf('corona') > -1) {
          newStuff.push(news);
        }
      });
      success(newStuff);
    })
    .catch(async res => {
      await res.json();
      failure('wtf');
    });
};

