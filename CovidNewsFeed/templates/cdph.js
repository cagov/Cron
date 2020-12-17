const md5 = require('md5');

module.exports = function createCDPHItem(sourceFile) {
  let newFile = {};
  newFile.filename = md5(sourceFile.url);
  let linkUrl = sourceFile.url;
  if(linkUrl.indexOf('http') === -1) {
    linkUrl = `https://www.cdph.ca.gov${sourceFile.url}`;
  }
  newFile.html = `---\nlayout: "page.njk"\ntitle: "${sourceFile.title}"\nmeta: "${sourceFile.description}"\ntags: "guidancefeed"\nurl: "${linkUrl}"\nauthor: "California Department of Public Health"\npublishdate: "${sourceFile.date}"\npermalink: false\n---\n\n<p><a href="${linkUrl}">${sourceFile.title}</a></p><p>${sourceFile.description}</p>`;
  return newFile;
};