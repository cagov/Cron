const puppeteer = require("puppeteer");
const fs = require("fs");
const TurndownService = require("turndown");
let turndownService = new TurndownService();

let urls = [
  "https://covid19.ca.gov/",
  "https://covid19.ca.gov/agency-response/",
  "https://covid19.ca.gov/business-and-employers/",
  "https://covid19.ca.gov/care-in-senior-facilities/",
  "https://covid19.ca.gov/childcare/",
  "https://covid19.ca.gov/contact-tracing/",
  "https://covid19.ca.gov/contracts/",
  "https://covid19.ca.gov/data-and-tools/",
  "https://covid19.ca.gov/discrimination/",
  "https://covid19.ca.gov/distance-learning/",
  "https://covid19.ca.gov/education/",
  "https://covid19.ca.gov/equity/",
  "https://covid19.ca.gov/food-resources/",
  "https://covid19.ca.gov/get-financial-help/",
  "https://covid19.ca.gov/get-local-information/",
  "https://covid19.ca.gov/get-tested/",
  "https://covid19.ca.gov/guidance-languages/",
  "https://covid19.ca.gov/guide-immigrant-californians/",
  "https://covid19.ca.gov/healthcare/",
  "https://covid19.ca.gov/healthcorps/",
  "https://covid19.ca.gov/help-for-seniors/",
  "https://covid19.ca.gov/holidays/",
  "https://covid19.ca.gov/hotel-rooms-for-california-healthcare-workers/",
  "https://covid19.ca.gov/hotline/",
  "https://covid19.ca.gov/housing-and-homelessness/",
  "https://covid19.ca.gov/housing-for-agricultural-workers/",
  "https://covid19.ca.gov/industry-guidance/",
  "https://covid19.ca.gov/latest-news/",
  "https://covid19.ca.gov/manage-stress-for-health/",
  "https://covid19.ca.gov/masks-and-ppe/",
  "https://covid19.ca.gov/more-ways-to-help/",
  "https://covid19.ca.gov/plasma/",
  "https://covid19.ca.gov/request-ppe/",
  "https://covid19.ca.gov/resources-for-emotional-support-and-well-being/",
  "https://covid19.ca.gov/restaurants-deliver-home-meals-for-seniors/",
  "https://covid19.ca.gov/safer-economy/",
  "https://covid19.ca.gov/sign-up-for-county-alerts/",
  "https://covid19.ca.gov/state-dashboard/",
  "https://covid19.ca.gov/stay-home-except-for-essential-needs/",
  "https://covid19.ca.gov/symptoms-and-risks/",
  "https://covid19.ca.gov/taxes/",
  "https://covid19.ca.gov/testing-and-treatment/",
  "https://covid19.ca.gov/telehealth/",
  "https://covid19.ca.gov/translate/",
  "https://covid19.ca.gov/travel/",
  "https://covid19.ca.gov/treatment-for-covid-19/",
  "https://covid19.ca.gov/vaccines/",
  "https://covid19.ca.gov/workers/",
];

async function goTo(url, page) {
  await page.goto(url);
  console.log("loaded " + url);

  let pageData = await page.evaluate(() => {
    let data = {};
    data.title = document.title.replace(" - Coronavirus COVID-19 Response", "");
    data.accordions = [];
    let accordions = document.querySelectorAll(`cwds-accordion`);
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
}
run();
