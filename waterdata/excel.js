  
'use strict';

const fs = require('fs')
const excelToJson = require('convert-excel-to-json');


let url = 'https://www.waterboards.ca.gov/water_issues/programs/hr2w/docs/data/hr2w_web_data_active.xlsx'


 
const result = excelToJson({
  source: fs.readFileSync('./data/hr2w_web_data_active.xlsx') // fs.readFileSync return a Buffer
});

fs.writeFileSync('./json/violations-unformatted.json', JSON.stringify(result), 'utf8')


let data = JSON.parse(fs.readFileSync('./json/violations-unformatted.json'));
let outputArr = [];

let fields = data['Active Out of Compliance System'][0];

data['Active Out of Compliance System'].forEach( (item, index) => {
  if(index > 0) {
    let obj = {};
    for(var key in fields) {
      obj[fields[key]] = item[key];
    }
    outputArr.push(obj)
  }
})

fs.writeFileSync('./json/violations.json',JSON.stringify(outputArr),'utf8');

function updateList(map,key,newItem) {
  let existingItems = map.get(key);
  existingItems.push(newItem);
  map.set(key,existingItems);
}

let viols = JSON.parse(fs.readFileSync('./json/violations.json','utf8'))

let systemMap = new Map();

viols.forEach( (v) => {
  let foundSystemMap = systemMap.get(v.WATER_SYSTEM_NUMBER)
  if(typeof(foundSystemMap) == 'undefined') {
    systemMap.set(v.WATER_SYSTEM_NUMBER,[v]);
  } else {
    updateList(systemMap,v.WATER_SYSTEM_NUMBER,v);
  }
})

systemMap.forEach( (value, key, index) => {
  fs.writeFileSync('./json/output/'+key+'.json',JSON.stringify(value),'utf8');
})