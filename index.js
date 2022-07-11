const puppeteerExtra = require("puppeteer-extra");
const stealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
require('dotenv').config();
const puppeteer = require("puppeteer");

const openBlaze = async () => {
  puppeteerExtra.use(stealthPlugin());

  const browser = await puppeteerExtra.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://blaze.com/pt/games/crash", {
    waitUntil: "networkidle2",
  });

  return page;
};

const authenticate = async (page) => {
  const LOGIN_SELECTOR = "#header > div > div.right > div > div > div:nth-child(1) > a";
  await page.waitForSelector(
    LOGIN_SELECTOR,
    { visible: true }
  );
  await page.click(
    LOGIN_SELECTOR
  );

  const AUTH_MODAL_SELECTOR = "#auth-modal > div.body > div.row > div:nth-child(1) > button";
  await page.waitForSelector(
    AUTH_MODAL_SELECTOR,
    { visible: true }
  );
  await page.click(
    AUTH_MODAL_SELECTOR
  );

  await page.waitForTimeout(2000);

  await page.type('[type="email"]', process.env.EMAIL);
  await page.click("#identifierNext");

  await page.waitForTimeout(1500);

  await page.type('[type="password"', process.env.PASSWORD);
  await page.click("#passwordNext");

  const GO_TO_CRASH_SELECTOR = "#original-games > div > div:nth-child(1) > div > a > img:nth-child(2)";
  await page.waitForSelector(
    GO_TO_CRASH_SELECTOR,
    { visible: true }
  );
  await page.click(
    GO_TO_CRASH_SELECTOR
  );
};

const getEntries = async (page) => {
  await page.waitForTimeout(3000);
  const entriesData = await page.evaluate(async () => {
    const entries = document.querySelector(".entries");

    return Array.from(entries?.childNodes)
      .map((el) => ({
        date: new Date().toISOString(),
        value: el?.innerText,
      }))
      .reverse();
  });

  return entriesData;
};

const getEntriesData = async (page) => {
  const entriesData = await getEntries(page);

  const lastEntryValueText = entriesData?.at(-1)?.value;
  const lastCrash = Number(lastEntryValueText.replace("X", ""));

  return { numEntries: entriesData.length, lastCrash };
};

const clickBetButton = async (page) => {
  const BET_BUTTON_SELECTOR =
    "#crash-controller > div.body > div.regular-betting-controller > div.place-bet > button";
  await page.waitForSelector(BET_BUTTON_SELECTOR);
  await page.waitForTimeout(2500);
  await page.click(BET_BUTTON_SELECTOR);
};

// Espera o site acrescentar uma nova entry na lista de entries
// Quando acontece isso quer dizer que a partida terminou e começou uma nova partida
const waitMatchEnd = async (page, previousNumEntries) => {
  await page.waitForFunction(
    (previousNumEntries) => {
      return (
        document.querySelector(".entries").childNodes?.length >
        previousNumEntries
      );
    },
    { timeout: 0 },
    previousNumEntries
  );
};

const writeBetReport = (newBet) => {
  const REPORT_FILE = "bet_report.json";

  const data = fs.readFileSync(REPORT_FILE);

  var json = data !== "" ? JSON.parse(data) : [];
  json.push(newBet);

  fs.writeFileSync(REPORT_FILE, JSON.stringify(json));
};

const run = async () => {
  const page = await openBlaze();

  await authenticate(page);

  // previousNumEntries número de entries na lista de entries
  let previousNumEntries = -1;

  while (true) {
    // Pega último valor do crash na lista de entries e o número atual de entries
    let entriesData = await getEntriesData(page);

    let lastCrash = entriesData.lastCrash;
    previousNumEntries = entriesData.numEntries;

    // console.log(`LastCrash: ${lastCrash}, Entries: ${previousNumEntries}`);

    if (lastCrash < 1.1) {
      console.log(
        `[${new Date().toISOString()}] Time to bet, last crash was ${lastCrash}X`
      );

      await clickBetButton(page);

      console.log(`[${new Date().toISOString()}] Bet button clicked`);

      const newBet = {
        date: new Date().toISOString(),
        previous_value: lastCrash,
      };

      // writeBetReport(newBet);
    }

    // Aguarda inicio de uma nova partida
    await waitMatchEnd(page, previousNumEntries);
  }
};

run();