import tough from 'tough-cookie';
import { RateLimiter } from 'limiter';
import qs from 'qs';
import { Mutex } from 'async-mutex';

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;

const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36';

const v6Api = 'https://api.mindbodyonline.com/public/v6';

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
  if (rsp.request.path.startsWith('/launch') || rsp.request.path.startsWith('/Error') || rsp.request.path.startsWith('/?err')) return true;
  if (!rsp.data) return false;

  // refresh token
  if (!rsp.data.includes('window.UserToken') && rsp.data.includes('Your username is not authorized to view this screen')) {
    return true;
  }

  if (rsp.data.includes('window.UserToken')) {
    return false;
  }

  return (
    rsp.data.includes('MINDBODY: Login') ||
    rsp.data.includes('MINDBODY Status') ||
    rsp.data.includes('.resetSession();') ||
    rsp.data.includes('launchHome()') ||
    rsp.data.includes('Your username is not authorized to view this screen')
  );
}

export default class MindBodyBase {
  constructor(serviceName, siteId, username, password, sourceName, apiKey, jar) {
    this.apiKey = apiKey;
    this.sourceName = sourceName;
    this.siteId = siteId;
    this.username = username;
    this.password = password;
    this.jar = jar;
    this.successAuth = false;
    this.mutux = new Mutex();
    this.limiter = new RateLimiter(1, 300);
    this.webAxios = axios.create({
      jar,
      withCredentials: true,
      headers: { 'User-Agent': ua }
    });
    // Set directly after wrapping instance.
    axiosCookieJarSupport(this.webAxios);
    this.webAxios.defaults.jar = this.jar;

    this.apiAxios = null;
  }

  async refreshCookies() {
    let browser = null;
    let page = null;

    console.log(`Waiting for access to puppteer for site ${this.siteId}`);
    const release = await this.mutux.acquire();
    console.log(`Got access to puppeteer for site ${this.siteId}`);

    if (this.successAuth) {
      console.log(`Already authed so ignoring`);
      return;
    }

    async function setupBrowser() {
      if (process.env.BROWSERLESS_WSS) {
        browser = await puppeteer.connect({
          browserWSEndpoint: process.env.BROWSERLESS_WSS
        });
      } else {
        browser = await puppeteer.launch({
          headless: false,
          ignoreDefaultArgs: ['--enable-automation'],
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      page = await browser.newPage();
      await page.setViewport({
        width: 1600,
        height: 1200
      });
      await page.setUserAgent(ua);
    }

    try {
      await setupBrowser();
      await page.setCookie(...this.jar.getCookiesSync('https://clients.mindbodyonline.com').map(c => c.toJSON()).map(c => ({
        name: c.key,
        value: c.value || '',
        url: 'https://clients.mindbodyonline.com/',
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        secure: c.hostOnly
      })));

      // First let's check if we just need to refresh the user token
      await page.goto('https://clients.mindbodyonline.com/mainappointments/index?tabid=9');
      const currentUrl = await page.url();
      if (currentUrl.includes('mainappointments')) {
        // Check if we need to log out due to invalid refresh token
        const expired = await page.$x('//*[text()[contains(.,\'We were unable to complete your request\')]]');
        if (expired.length) {
          console.log('refresh token issue, create fresh browser');
          await browser.close();
          await setupBrowser();
        }
      }

      console.log(`Logging into Mindbody site ${this.siteId}`);
      const url = `https://clients.mindbodyonline.com/launch/site?id=${this.siteId}`;
      await page.goto(url);
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Check if we are authenticated?
      const authed = await page.$x('//*[text() = "Sign Out"]');
      if (!authed.length) {
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
      }

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
          this.jar.setCookieSync(newCookie.toString(), 'https://clients.mindbodyonline.com/');
        }
      });
      this.successAuth = true;
    } finally {
      if (browser) {
        await browser.close();
      }
      console.log(`Release access to puppteer for site ${this.siteId}`);
      release();
    }
  }

  async webRequest(config) {
    await removeTokens(1, this.limiter);
    let rsp = await this.webAxios(config);
    if (loginRequired(rsp)) {
      await this.refreshCookies();
    } else {
      return rsp;
    }

    rsp = await this.webAxios(config);

    if (loginRequired(rsp)) {
      throw new Error('We thought we logged in but was returned to login screen on 2nd attempt');
    }

    return rsp;
  }

  async setupAPI() {
    if (this.apiAxios) return;

    let token = null;

    const headers = {
      'Api-Key': this.apiKey,
      'SiteId': this.siteId,
    };

    // First get user Auth Token
    try {
      const rsp = await axios({
        method: 'POST',
        url: `${v6Api}/usertoken/issue`,
        data: {
          Username: this.username,
          Password: this.password
        },
        headers
      });
      token = rsp.data.AccessToken;
    } catch (err) {
      throw new Error(`Unable to auth due to ${err}`);
    }

    this.apiAxios = axios.create({
      headers: {
        ...headers,
        'authorization': token
      }
    });
  }

  async apiRequest(path, field, settings = {}) {
    await this.setupAPI();
    // handle pagination
    let offset = 0;

    const handlePagination = async () => {
      const params = settings.params || {};
      const rsp = await this.apiAxios({
        ...settings,
        url: `${v6Api}/${path}`,
        params: {
          offset,
          limit: 200,
          ...params,
        }
      });

      const data = rsp.data[field];
      const totalResults = rsp.data.PaginationResponse.TotalResults;
      const currentSize = rsp.data.PaginationResponse.PageSize;
      const requestedOffset = rsp.data.PaginationResponse.RequestedOffset;
      const upToo = requestedOffset + currentSize;

      if (totalResults > upToo) {
        offset = upToo;
        return data.concat(await handlePagination());
      } else {
        return data;
      }
    };

    return await handlePagination();
  }

  webGet(url) {
    return this.webRequest({ url });
  }

  webPost(url, data) {
    return this.webRequest({
      method: 'post',
      url,
      data: qs.stringify(data),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

}
