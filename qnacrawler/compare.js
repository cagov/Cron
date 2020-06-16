const fs = require('fs')
const csvFilePath='./Quick Answers content.csv'
const csv=require('csvtojson')
const tsvtojson = require('tsvtojson');

let qnaScrape = [];
let googleSheet = [];


async function run() {
  await csv()
    .fromFile(csvFilePath)
    .then((jsonObj)=>{
      googleSheet = jsonObj;
    })

  await tsvtojson('./merged.tsv')
    .then(data=>{
      qnaScrape = data;
    })
    .catch(err=>{
      console.log(err);
    })

  let match = 0;
  let noMatch = 0;
  let matches = [];
  let nomatches = [];
  let newones = [];
  qnaScrape.forEach(item => {
    let found = false;
    googleSheet.forEach( g => {
      if(g.Question == item.Question) {
        match++;
        found = true;
        item['Proposed revised question'] = g['Proposed revised question']
        item['Proposed revised answer for Quick answer'] = g['Proposed revised answer for Quick answer']
        item['potential tags'] = g['potential tags']
        item['Suggested changes'] = g['Suggested changes']
        item['Content captain'] = g['Content captain']
        item['Content type (accordion, other)'] = g['Content type (accordion, other)']
        item.Comments = g.Comments
        item.Source = g.Source
        item['Page Links'] = g['Page Links']
        item['Revised (Y/N)'] = g['Revised (Y/N)']
        item.Metadata = g.Metadata
        item.SuggestedQuestions = g.SuggestedQuestions
        item.IsContextOnly = g.IsContextOnly
        item.Prompts = g.Prompts
        matches.push(g);
        newones.push(g)
      }
    })
    if(!found) {
      noMatch++;
      nomatches.push(item)
      newones.push(item)
    }
  })
  fs.writeFileSync('./matches.json',JSON.stringify(matches),'utf8')
  fs.writeFileSync('./nomatches.json',JSON.stringify(nomatches),'utf8')
  fs.writeFileSync('./all.json',JSON.stringify(newones),'utf8')
  console.log(match)
  console.log(noMatch)
/*
  googleSheet.forEach(g => {
    let found = false;
    qnaScrape.forEach(item => {
      if(g.Question == item.Question) {
        found = true;
      }
    })
    if(!found) {
      newones.push(g);
    }
  })
  fs.writeFileSync('./newones.json',JSON.stringify(newones),'utf8')
  */
}

run()


// read qna.tsv
// how many non matches
// with addl data added
// how many matches