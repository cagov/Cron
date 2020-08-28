const puppeteer = require('puppeteer');
const fs = require('fs');
const TurndownService = require('turndown')
let turndownService = new TurndownService()

let urls = ["https://covid19.ca.gov/symptoms-and-risks/", "https://covid19.ca.gov/taxes/", "https://covid19.ca.gov/stay-home-except-for-essential-needs/", "https://covid19.ca.gov/healthcare/", "https://covid19.ca.gov/business-and-employers/", "https://covid19.ca.gov/education/", "https://covid19.ca.gov/workers/", "https://covid19.ca.gov/get-financial-help/", "https://covid19.ca.gov/housing-and-homelessness/", "https://covid19.ca.gov/childcare/", "https://covid19.ca.gov/state-local-resources/", "https://covid19.ca.gov/guide-immigrant-californians/", "https://covid19.ca.gov/resources-for-emotional-support-and-well-being/", "https://covid19.ca.gov/contact-tracing/", "https://covid19.ca.gov/testing-and-treatment/", "https://covid19.ca.gov/healthcorps/", "https://covid19.ca.gov/industry-guidance/", "https://covid19.ca.gov/manage-stress-for-health/", "https://covid19.ca.gov/food-resources/", "https://covid19.ca.gov/masks-and-ppe/", "https://covid19.ca.gov/plasma/" ]

async function goTo(url, page) {
  await page.goto(url);
  console.log('loaded '+url);

  let pageData = await page.evaluate(() => {
    let data = {};
    data.title = document.title.replace(' - Coronavirus COVID-19 Response','');
    data.accordions = [];
    let accordions = document.querySelectorAll(`cwds-accordion`);
    accordions.forEach((acc) => {
      let acObj = {};
      if(!acc.querySelector('.js-qa-exclude')) {
        acObj.question = acc.querySelector('.accordion-title').textContent.trim();
        if(acObj.question !== "Menu") {
          acObj.answer = acc.querySelector('.card-body').innerHTML.replace(/\r?\n|\r/g,'');
          data.accordions.push(acObj);
        }  
      }
    })

    let otherQAItems = document.querySelectorAll(`.js-qa`);
    let freeRangeQA = {};
    otherQAItems.forEach(el => {
      if(el.classList.contains('js-qa-question')) {
        if(freeRangeQA.question && freeRangeQA.answer) {
          data.accordions.push(freeRangeQA);
          freeRangeQA = {};
        }
        freeRangeQA.question = el.textContent.trim();
      }
      if(el.classList.contains('js-qa-answer')) {
        let answerContent = el.outerHTML.replace(/\r?\n|\r/g,'');
        if(freeRangeQA.answer) {
          freeRangeQA.answer += ' '+answerContent;
        } else {
          freeRangeQA.answer = answerContent;
        }
      }
    })
    if(freeRangeQA.question && freeRangeQA.answer) {
      data.accordions.push(freeRangeQA);
    }

    return data;
  });
  return pageData;
}

async function run() {
  let qnaFile = `Question	Answer	Source\n`
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  for(let i = 0;i<urls.length;i++) {
    pageData = await goTo(urls[i], page);
    if(pageData.accordions) {
      pageData.accordions.forEach(item => {
        // we are using comments to add keywords but they get stripped by turndown so the following lines
        let commentContent = '';
        let commentStart = item.answer.indexOf('<!--');
        if(commentStart > -1) {
          let commentEnd = item.answer.indexOf('-->');
          if(commentEnd > commentStart) {
            commentContent = item.answer.substr(commentStart,commentEnd - commentStart + 3);
          }
        }
        let answer = turndownService.turndown(`${item.answer}<p>More info: <a href="${urls[i]}">${pageData.title}</a></p>`).replace(/\r?\n|\r/g,'\\n');
        qnaFile += `${item.question}	${answer + commentContent}	${urls[i]}\n`;
      })
    }
  }
  fs.writeFileSync('./qna.tsv',qnaFile,'utf8');
  browser.close();
}
run();