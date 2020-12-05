import MindbodyBase from './base';

export default class Sites extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiToken, cookieJar) {
    super('Site', siteId, username, password, sourceName, apiToken, cookieJar);
  }

  getSite() {
    const req = this.initSoapRequest();
    req.XMLDetail = 'Full';

    return new Promise((resolve, reject) => {
      this.soapReq('GetSites', 'GetSitesResult', req)
        .then((result) => {
          if (result.Sites && result.Sites.Site) {
            // Enrich with timezone
            this.post('https://clients.mindbodyonline.com/BusinessAndConnectLocations/BusinessAndLocationData')
              .then((rsp) => {
                resolve(Object.assign(result.Sites.Site[0], JSON.parse(rsp.data)));
              })
              .catch(err => reject(err));
          } else {
            reject(new Error('No site was returned'));
          }
        })
        .catch(err => reject(err));
    });
  }
}
