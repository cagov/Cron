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
    headless: true,
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
    expect(links.length).toBeGreaterThan(4);
  }, timeout);
});


afterAll(() => {
  browser.close();
});
