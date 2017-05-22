import MindbodyBase from './base'

export default class Sites extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, driverPath, cookies) {
    super('Site', siteId, username, password, sourceName, apiToken, driverPath, cookies)
  }

  getSite () {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'

    return new Promise((resolve, reject) => {
      this._soapReq('GetSites', 'GetSitesResult', req)
        .then(result => {
          if (result.Sites && result.Sites.Site) {
            // Enrich with timezone
            this.post('https://clients.mindbodyonline.com/BusinessAndConnectLocations/BusinessAndLocationData')
              .then(rsp => {
                resolve(Object.assign(result.Sites.Site[0], JSON.parse(rsp.body)))
              })
              .catch(err => reject(err))
          } else {
            reject(new Error('No site was returned'))
          }
        })
        .catch(err => reject(err))
    })
  }
}
