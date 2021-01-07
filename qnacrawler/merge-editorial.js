/*
new steps:
  dedupe the scraped content
  append the editorial content
*/

const fs = require('fs')
const tsvtojson = require('tsvtojson');

let editorial, scrape;

async function writeFile() {
  await tsvtojson('./qna.tsv')
  .then(data=>{
    scrape = data;
  })
  .catch(err=>{
    console.log(err);
  })

  await tsvtojson('./editorial.tsv')
  .then(data=>{
    editorial = data;
  })
  .catch(err=>{
    console.log(err);
  })

  let scrapeMap = new Map();
  let dups = [];

  function addItem(s){
    if(scrapeMap.get(s.Question)) {
      console.log('found dup',s.Question);
      s.duplicate = scrapeMap.get(s.Question)
      dups.push(s)
    } else {
      scrapeMap.set(s.Question,s);
      // console.log('unique')
    }
  }

  scrape.forEach(s => {
    addItem(s);
  })
  editorial.forEach(e => {
    addItem(e);
  })


  let qnaFile = `Question	Answer	Source	Metadata	SuggestedQuestions	IsContextOnly	Prompts	QnaId\n`
  let QnaId = 1;
  scrapeMap.forEach(item => {
    qnaFile += `${item.Question}	${item.Answer}	${item.Source}	 	[]	false	[]	${QnaId}\n`;
    QnaId++;
  })
  fs.writeFileSync('./merged.tsv',qnaFile,'utf8');
  // console.log(dups)
}

writeFile();