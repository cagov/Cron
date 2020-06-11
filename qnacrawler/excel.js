const xlsx = require('node-xlsx');
const fs = require('fs');
const tsvtojson = require('tsvtojson');

let editorial, scrape;

async function writeFile() {
  await tsvtojson('./merged.tsv')
  .then(data=>{
    scrape = data;
  })
  .catch(err=>{
    console.log(err);
  })

  let data = [];
  let header = [];
  for (let [key, value] of Object.entries(scrape[0])) {
    header.push(key)
  }
  data.push(header)
  scrape.forEach(s => {
    let row = [];
    for (let [key, value] of Object.entries(s)) {
      row.push(value)
    }
    data.push(row);
  })

  // const data = [[1, 2, 3], [true, false, null, 'sheetjs'], ['foo', 'bar', new Date('2014-02-19T14:30Z'), '0.3'], ['baz', null, 'qux']];

  var buffer = xlsx.build([{name: "mySheetName", data: data}]); // Returns a buffer
  fs.writeFileSync('merged.xlsx', buffer, 'utf8')
}

writeFile();