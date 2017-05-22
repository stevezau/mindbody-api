import MindbodyBase from './base'

export default class Clients extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, driverPath, cookies) {
    super('Client', siteId, username, password, sourceName, apiToken, driverPath, cookies)
  }

  getClient (clientId) {
    return new Promise((resolve, reject) => {
      this.getClients(null, [clientId])
        .then(result => {
          if (result.length === 1) {
            resolve(result[0])
          } else {
            resolve()
          }
        })
        .catch(err => reject(err))
    })
  }

  getClients (searchText = '', clientIds = [], page = 0, pgSize = 100, fields = null) {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'
    req.PageSize = pgSize
    req.SearchText = searchText
    req.ClientIDs = this._soapArray(clientIds, 'string')
    req.Fields = this._soapArray(fields, 'string')
    req.CurrentPageIndex = page

    return new Promise((resolve, reject) => {
      this._soapReq('GetClients', 'GetClientsResult', req)
        .then(result => {
          if (result.Clients) {
            resolve(result.Clients.Client)
          } else {
            resolve([])
          }
        })
        .catch(err => reject(err))
    })
  }
}
