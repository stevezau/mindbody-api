import soap from 'soap';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import tough from 'tough-cookie';
import { RateLimiter } from 'limiter';
import FormData from 'form-data';

puppeteer.use(StealthPlugin());
const limiter = new RateLimiter(1, 500);
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36';

const MB_API = 'https://api.mindbodyonline.com/0_5_1';

function removeTokens(count, limiter) {
  return new Promise((resolve, reject) => {
    limiter.removeTokens(count, (err, remainingRequests) => {
      if (err) return reject(err);
      resolve(remainingRequests);
    });
  });
}

function loginRequired(rsp) {
  if (typeof (rsp.data) == 'object') {
    return rsp.data.sessionExpired;
  }
  if (rsp.request.path.startsWith('/launch') || rsp.request.path.startsWith('/Error')) return true;
  if (!rsp.data) return false;
  return (
    rsp.data.includes('MINDBODY: Login') ||
    rsp.data.includes('MINDBODY Status') ||
    rsp.data.includes('.resetSession();') ||
    rsp.data.includes('launchHome()')
  );
}

export default class MindBodyBase {
  constructor(serviceName, siteId, username, password, sourceName, apiToken, jar) {
    this.apiToken = apiToken;
    this.sourceName = sourceName;
    this.siteId = siteId;
    this.serviceWSDL = `${MB_API}/${serviceName}Service.asmx?wsdl`;
    this.username = username;
    this.password = password;
    this.jar = jar;
    this.axios = axios.create({
      jar,
      withCredentials: true,
      headers: { 'User-Agent': ua }
    });
    // Set directly after wrapping instance.
    axiosCookieJarSupport(this.axios);
    this.axios.defaults.jar = this.jar;
  }

  soapReq(reqName, resultName, req) {
    return new Promise((resolve, reject) => {
      this.soapClient()
        .then((client) => {
          client[reqName]({ Request: req }, (err, result) => {
            if (err) {
              return reject(err);
            }
            const resultObj = result[resultName];
            if (!resultObj) {
              return reject(new Error(`Invalid result, missing ${resultName}`));
            }
            if (resultObj.ErrorCode !== 200) {
              return reject(new Error(`Error ${resultObj.ErrorCode} ${resultObj.Message}`));
            }
            resolve(resultObj);
          });
        })
        .catch(err => reject(err));
    });
  }

  soapClient(options = {}) {
    return new Promise((resolve, reject) => {
      soap.createClient(this.serviceWSDL, options, (err, client) => {
        if (err) {
          reject(err);
        }
        resolve(client);
      });
    });
  }

  initSoapRequest() {
    return {
      SourceCredentials: {
        SourceName: this.sourceName,
        Password: this.apiToken,
        SiteIDs: [{ int: this.siteId }]
      },
      UserCredentials: {
        Username: this.username,
        Password: this.password,
        SiteIDs: [{ int: this.siteId }]
      },
      XMLDetail: 'Bare'
    };
  }

  async refreshCookies() {
    await this.jar.removeAllCookiesSync();
    const browser = await puppeteer.launch({
      headless: true,
      ignoreDefaultArgs: ['--enable-automation'],
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: 1600,
      height: 1200
    });
    await page.setUserAgent(ua);
    try {
      console.log(`Logging into Mindbody site ${this.siteId}`);
      const url = `https://clients.mindbodyonline.com/launch/site?id=${this.siteId}`;
      await page.goto(url);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      console.log(`Entering Creds`);
      await page.waitForSelector('#username');
      await page.focus('#username');
      await page.keyboard.type(this.username);
      await page.waitForSelector('#password');
      await page.focus('#password');
      await page.keyboard.type(this.password);
      const button = await page.waitForXPath('//span[text() = "Sign In"]');
      await page.evaluate(ele => ele.click(), button);
      await page.waitForXPath('//*[text() = "Sign Out"]');

      const cookies = await page._client.send('Network.getAllCookies');
      cookies.cookies.forEach((cookie) => {
        if (cookie.domain === 'clients.mindbodyonline.com') {
          const newCookie = tough.Cookie.fromJSON({
            'key': cookie.name,
            'value': cookie.value,
            'domain': cookie.domain,
            'path': cookie.path,
            'secure': cookie.secure,
            'httpOnly': cookie.httpOnly,
            'hostOnly': cookie.secure,
            'sameSite': cookie.sameSite
          });
          this.jar.setCookieSync(newCookie, 'https://clients.mindbodyonline.com/');
        }
      });
    } finally {
      await browser.close();
    }
  }

  async request(config) {
    await removeTokens(1, limiter);
    let rsp = await this.axios(config);

    if (loginRequired(rsp)) {
      await this.refreshCookies();
    } else {
      return rsp;
    }

    rsp = await this.axios(config);

    if (loginRequired(rsp)) {
      throw new Error('We thought we logged in but was returned to login screen on 2nd attempt');
    }

    return rsp;
  }

  get(url) {
    return this.request({ url });
  }

  post(url, data) {
    const form = new FormData();
    Object.entries(data).forEach((k, v) => {
      form.append(k, v);
    });

    return this.request({
      method: 'post',
      url,
      data: form,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

}
