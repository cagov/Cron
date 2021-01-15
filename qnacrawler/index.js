const puppeteer = require("puppeteer");
const fs = require("fs");
const TurndownService = require("turndown");
let turndownService = new TurndownService();

const https = require('https');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();

// Use sitemap to determine pages to crawl
const sitemap_url = 'https://covid19.ca.gov/sitemap.xml';
// Skip non-english pages
const skip_pattern = /^https:\/\/covid19.ca.gov\/(es|ar|ko|tl|vi|zh-hans|zh-hant)\//;

async function goTo(url, page) {
  await page.goto(url);
  console.log("loaded " + url);

  let pageData = await page.evaluate(() => {
    let data = {};
    data.title = document.title.replace(" - Coronavirus COVID-19 Response", "");
    data.accordions = [];
    let accordions = document.querySelectorAll(`cagov-accordion`);
    accordions.forEach((acc) => {
      let acObj = {};
      if (!acc.querySelector(".js-qa-exclude")) {
        acObj.question = acc
          .querySelector(".accordion-title")
          .textContent.trim();
        if (acObj.question !== "Menu") {
          acObj.answer = acc
            .querySelector(".card-body")
            .innerHTML.replace(/\r?\n|\r/g, "");
          data.accordions.push(acObj);
        }
      }
    });

    let otherQAItems = document.querySelectorAll(`.js-qa`);
    let freeRangeQA = {};
    otherQAItems.forEach((el) => {
      if (el.classList.contains("js-qa-question")) {
        if (freeRangeQA.question && freeRangeQA.answer) {
          data.accordions.push(freeRangeQA);
          freeRangeQA = {};
        }
        freeRangeQA.question = el.textContent.trim();
      }
      if (el.classList.contains("js-qa-answer")) {
        let answerContent = el.outerHTML.replace(/\r?\n|\r/g, "");
        if (freeRangeQA.answer) {
          freeRangeQA.answer += " " + answerContent;
        } else {
          freeRangeQA.answer = answerContent;
        }
      }
    });
    if (freeRangeQA.question && freeRangeQA.answer) {
      data.accordions.push(freeRangeQA);
    }

    return data;
  });
  return pageData;
}

async function run() {

  let pdata = '';
  return await https.get(sitemap_url, (result) => {
      result.on('data', (data_) => {
          pdata += data_.toString();
      })
      .on('end', () => {
          parser.parseString(pdata, async (err, result) => {
              let urls = result.urlset.url.map( url =>  url.loc.toString());
              urls = urls.filter( url => !(url.match(skip_pattern)));
              // console.log("this.pagelist = ",urls.length,"items");
              // now do our crawl
              let qnaFile = `Question	Answer	Source\n`;
              const browser = await puppeteer.launch({ headless: true });
              const page = await browser.newPage();
              for (let i = 0; i < urls.length; i++) {
                pageData = await goTo(urls[i], page);
                if (pageData.accordions) {
                  pageData.accordions.forEach((item) => {
                    // we are using comments to add keywords but they get stripped by turndown so the following lines
                    let commentContent = "";
                    let commentStart = item.answer.indexOf("<!--");
                    if (commentStart > -1) {
                      let commentEnd = item.answer.indexOf("-->");
                      if (commentEnd > commentStart) {
                        commentContent = item.answer.substr(
                          commentStart,
                          commentEnd - commentStart + 3
                        );
                      }
                    }
                    let answer = turndownService
                      .turndown(
                        `${item.answer}<p>More info: <a href="${urls[i]}">${pageData.title}</a></p>`
                      )
                      .replace(/\r?\n|\r/g, "\\n");
                    qnaFile += `${item.question}	${answer + commentContent}	${urls[i]}\n`;
                  });
                }
              }
              fs.writeFileSync("./qna.tsv", qnaFile, "utf8");
              browser.close();

          });
      })
      .on('error', (e) => {
          console.log("Error",e);
      });
  });




}
run();
