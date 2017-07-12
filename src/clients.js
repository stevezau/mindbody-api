import moment from 'moment-timezone'
import MindbodyBase from './base'

export default class Clients extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, cookieJar, timezone) {
    super('Client', siteId, username, password, sourceName, apiToken, cookieJar)
    this.timezone = timezone
  }

  getClient (clientId) {
    return new Promise((resolve, reject) => {
      this.getClients(null, [clientId])
        .then(({clients}) => {
          if (clients.length === 1) {
            resolve(clients[0])
          } else {
            resolve()
          }
        })
        .catch(err => reject(err))
    })
  }

  _soapClient () {
    return super._soapClient({
      customDeserializer: {
        dateTime: (text, context) => {
          return moment.tz(text, this.timezone)
        },
        date: (text, context) => {
          return moment.tz(text, this.timezone)
        }
      }
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
            resolve({clients: result.Clients.Client, countTotal: result.ResultCount, pagesTotal: result.TotalPageCount})
          } else {
            resolve([])
          }
        })
        .catch(err => reject(err))
    })
  }
}
