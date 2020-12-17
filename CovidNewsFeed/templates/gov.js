module.exports = function createGovItem(sourceFile) {
  let newFile = {};
  const meta = sourceFile.excerpt.rendered.replace(/<p>/,'').replace(/<\/p>/,'').replace(/\n/,'').trim();
  newFile.filename = sourceFile.id;
  newFile.html = `---\nlayout: "page.njk"\ntitle: "${sourceFile.title.rendered}"\nmeta: "${meta}"\ntags: "guidancefeed"\nurl: "${sourceFile.link}"\nauthor: "State of California"\npublishdate: "${sourceFile.modified_gmt}Z"\npermalink: false\n---\n\n<p><a href="${sourceFile.link}">${sourceFile.title.rendered}</a></p><p>${meta}</p>`;
  return newFile;
};