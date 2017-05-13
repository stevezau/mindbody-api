import soap from 'soap';
import request from 'request-promise-native';
import cheerio from 'cheerio';

const MB_API = 'https://api.mindbodyonline.com/0_5';

export default class MindBodyBase {

  constructor(serviceName, siteId, username, password, sourceName, apiToken, cookieJar) {
    this.apiToken = apiToken;
    this.sourceName = sourceName;
    this.siteId = siteId;
    this.serviceWSDL = `${MB_API}/${serviceName}Service.asmx?wsdl`;
    this.service = `${MB_API}/${serviceName}Service.asmx`;

    this.cookieJar = cookieJar;

    if (cookieJar) {
      this.reqJar = request.jar(cookieJar);
    } else {
      this.reqJar = request.jar();
    }

    this.username = username;
    this.password = password;

  }

  _initRequestOptions(method, url, form = null) {
    let options = {
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:53.0) Gecko/20100101 Firefox/53.0'
      },
      'resolveWithFullResponse': true,
      'jar': this.reqJar,
      'gzip': 'true',
      'method': method,
      'uri': url,
      'followAllRedirects': true
    };
    if (form) {
      options['form'] = form
    }
    return options;
  }

  _soapArray(array, name) {
    let newArray = [];
    if (array) {
      for (let value of array) {
        let obj = {};
        obj[name] = value;
        newArray.push(obj);
      }
    }
    return newArray;
  }

  _parse(body) {
    return cheerio.load(body)
  }

  _soapReq(reqName, resultName, req) {
    return new Promise((resolve, reject) => {
      this._soapClient()
          .then(client => {
            client[reqName]({'Request': req}, (err, result) => {
              if (err) {
                return reject(err)
              }
              let resultObj = result[resultName];
              if (!resultObj) {
                return reject(new Error(`Invalid result, missing ${resultName}`))
              }
              if (resultObj.ErrorCode != 200) {
                return reject(new Error(`Error ${resultObj.ErrorCode} ${resultObj.Message}`))
              }
              resolve(resultObj);
            });
          })
          .catch(err => reject(err))
    });
  }

  _soapClient() {
    return new Promise((resolve, reject) => {
      soap.createClient(this.serviceWSDL, (err, client) => {
        if (err) {
          reject(err)
        }
        resolve(client);
      });
    });
  }

  _initSoapRequest() {
    return {
      'SourceCredentials': {
        'SourceName': this.sourceName,
        'Password': this.apiToken,
        'SiteIDs': [{'int': this.siteId}]
      },
      'UserCredentials': {
        'Username': this.username,
        'Password': this.password,
        'SiteIDs': [{'int': this.siteId}]
      },
      'XMLDetail': 'Bare'
    }
  }

  _loginRequired(rsp) {
    if (rsp.req.path.startsWith('/launch') || rsp.req.path.startsWith('/Error')) return true;
    if (!rsp.body) return false;
    return (rsp.body.includes('MINDBODY: Login') || rsp.body.includes('MINDBODY Status') || rsp.body.includes('.resetSession();'))
  }

  login() {
    console.log(`Logging into Mindbody site ${this.siteId}`);

    return new Promise((resolve, reject) => {
      let options = this._initRequestOptions('GET', `https://clients.mindbodyonline.com/launch/site?id=${this.siteId}`);

      // First load home page to get new cookies
      request(options)
          .then(rsp => {
            // Send Login Creds
            let options = this._initRequestOptions('POST', `https://clients.mindbodyonline.com/Login?studioID=${this.siteId}&isLibAsync=true&isJson=true`);
            options.form = {
              'launchLogin': true,
              'requiredtxtUserName': this.username,
              'requiredTxtPassword': this.password,
              'optRememberMe': 'on'
            };
            return request(options)
          })
          .then(rsp => {
            // For some reason you need to post
            let options = this._initRequestOptions('POST', `https://clients.mindbodyonline.com/classic/admhome?studioid=${this.siteId}`);
            options.form = {
              'justloggedin': 'true'
            };
            return request(options);
          })
          .then(rsp => {
            // Check if we actually logged in
            if (this._loginRequired(rsp)) return reject(new Error(`Unable to login to site ${this.siteId}`));
            if (rsp.statusCode != 200) return reject(new Error(`Unable to login to site ${this.siteId}, invalid status code ${rsp.statusCode}`));
            console.log('Logged into site');
            resolve();
          })
          .catch(err => reject(err))
    });
  }

  _request(options, autoLogin = true) {
    return new Promise((resolve, reject) => {
      request(options)
          .then(rsp => {
            if (rsp.statusCode >= 300 && rsp.statusCode <= 199) {
              return reject(new Error(`Invalid response ${rsp.statusCode}`))
            }
            if (this._loginRequired(rsp)) {
              if (autoLogin) {
                this.login()
                    .then(() => this._request(options, false))
                    .then(rsp => resolve(rsp))
                    .catch(err => reject(err))
              } else {
                reject(new Error('We thought we logged in but was returned to login screen on 2nd attempt'))
              }
            } else {
              resolve(rsp);
            }
          })
          .catch(err => {
            reject(err);
          });
    })
  }

  get(url) {
    let options = this._initRequestOptions('GET', url);
    return this._request(options)
  }

  post(url, form) {
    let options = this._initRequestOptions('POST', url, form);
    return this._request(options)
  }
}
