/**
 * @name get review basic page interactivity
 *
 * @desc E2E tests for covid19.ca.gov
 */
const puppeteer = require('puppeteer');

const timeout = 60000; // from from 16000, also used for individual tests
jest.setTimeout(timeout);
let server;

/*
More info for writing tests:

Ways to use expect with jest: https://jestjs.io/docs/en/expect

All the stuff you can do with puppeteer: https://github.com/puppeteer/puppeteer/blob/master/docs/api.md
*/

let page;
let browser;
// let hostname = 'https://staging.alpha.technology.ca.gov'
const hostname = `https://covid19.ca.gov`;
const width = 1200;
const height = 800;

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false,
    slowMo: 80,
    args: [`--window-size=${width},${height}`]
  });
  page = await browser.newPage();
  await page.setViewport({ width, height });
});

describe('homepage', () => {
  test('page has some links on it', async () => {
    await page.goto(hostname);
    await page.waitForSelector('.jumbotron');

    const links = await page.$$eval('a', anchors => anchors);
    expect(links.length).toBeGreaterThan(10);

    let answers = await page.$$eval('.col-md-6 li', answers => { return answers })
    expect(answers.length).toBeGreaterThan(6);
    
  }, timeout);
});


describe("stay home", () => {
  test("stay home", async () => {
    await page.goto(hostname+'/stay-home-except-for-essential-needs/');
    let answers = await page.$$eval('.col-lg-8 p', answers => { return answers });
    expect(answers.length).toBeGreaterThan(1);

   
  }, timeout);

});

describe("alerts", () => {
  test("sign up for alerts", async () => {
    await page.goto(hostname+'/sign-up-for-county-alerts/');

    await page.waitForSelector(".city-search");
    await page.type(".city-search", '9582');

    await page.waitForSelector("#awesomplete_list_1 li");
    let listitems = await page.$$eval('#awesomplete_list_1 li', listitems => { return listitems });
    expect(listitems.length).toBeGreaterThan(1);

    await page.type(".city-search", '1');
    await page.click('button[type="submit"]');

    let answers = await page.$$eval('.js-county-alert p', answers => { return answers });
    expect(answers.length).toBeGreaterThan(0);
   
  }, timeout);

});


afterAll(() => {
  browser.close();
});