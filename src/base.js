import soap from 'soap';
import request from 'request-promise-native';
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter(1, 500);

const MB_API = 'https://api.mindbodyonline.com/0_5_1';

function hasCaptcha(rsp) {
  return rsp.body.includes('distil_r_captcha');
}

function loginRequired(rsp) {
  if (rsp.body.startsWith('{')) {
    const json = JSON.parse(rsp.body);
    if (json.sessionExpired) return true;
  }
  if (rsp.req.path.startsWith('/launch') || rsp.req.path.startsWith('/Error')) return true;
  if (!rsp.body) return false;
  return (
    rsp.body.includes('MINDBODY: Login') ||
    rsp.body.includes('MINDBODY Status') ||
    rsp.body.includes('.resetSession();')
  );
}

export default class MindBodyBase {
  constructor(serviceName, siteId, username, password, sourceName, apiToken, cookieJar) {
    this.apiToken = apiToken;
    this.sourceName = sourceName;
    this.siteId = siteId;
    this.serviceWSDL = `${MB_API}/${serviceName}Service.asmx?wsdl`;

    if (cookieJar) {
      this.reqJar = request.jar(cookieJar);
    } else {
      this.reqJar = request.jar();
    }

    this.username = username;
    this.password = password;
  }

  initRequestOptions(method, url, form = null) {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
      },
      resolveWithFullResponse: true,
      jar: this.reqJar,
      gzip: 'true',
      method,
      uri: url,
      followAllRedirects: true
    };
    if (form) {
      options.form = form;
    }
    return options;
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

  login() {
    console.log(`Logging into Mindbody site ${this.siteId}`);

    return new Promise((resolve, reject) => {
      let options = this.initRequestOptions('GET', `https://clients.mindbodyonline.com/launch/site?id=${this.siteId}`);

      // First load home page to get new cookies
      request(options)
        .then(() => {
          // Send Login Creds
          options = this.initRequestOptions('POST', `https://clients.mindbodyonline.com/Login?studioID=${this.siteId}&isLibAsync=true&isJson=true`);
          options.form = {
            launchLogin: true,
            requiredtxtUserName: this.username,
            requiredTxtPassword: this.password,
            optRememberMe: 'on'
          };
          return request(options);
        })
        .then(() => {
          // For some reason you need to post
          options = this.initRequestOptions('POST', `https://clients.mindbodyonline.com/classic/admhome?studioid=${this.siteId}`);
          options.form = {
            justloggedin: 'true'
          };
          return request(options);
        })
        .then((rsp) => {
          // Check if we actually logged in
          if (hasCaptcha(rsp)) return reject(new Error(`Captcha detected during login for site ${this.siteId}`));
          if (loginRequired(rsp)) return reject(new Error(`Unable to login to site ${this.siteId}`));

          if (rsp.statusCode !== 200) {
            return reject(new Error(`Unable to login to site ${this.siteId}, invalid status code ${rsp.statusCode}`));
          }
          console.log('Logged into site');
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  request(options, autoLogin = true) {
    return new Promise((resolve, reject) => {
      limiter.removeTokens(1, () => {
        request(options)
          .then((rsp) => {
            if (hasCaptcha(rsp)) return reject(new Error('Captcha detected, consider using cookies to persist logged in state'));
            if (rsp.statusCode >= 300 && rsp.statusCode <= 199) {
              return reject(new Error(`Invalid response ${rsp.statusCode}`));
            }
            if (loginRequired(rsp)) {
              if (autoLogin) {
                this.login()
                  .then(() => this.request(options, false))
                  .then(rsp2 => resolve(rsp2))
                  .catch(err => reject(err));
              } else {
                reject(new Error('We thought we logged in but was returned to login screen on 2nd attempt'));
              }
            } else {
              resolve(rsp);
            }
          })
          .catch((err) => {
            reject(err);
          });
      });
    });
  }

  get(url) {
    const options = this.initRequestOptions('GET', url);
    return this.request(options);
  }

  post(url, form) {
    const options = this.initRequestOptions('POST', url, form);
    return this.request(options);
  }
}
