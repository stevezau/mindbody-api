import moment from 'moment-timezone';
import MindbodyBase from './base';

export default class Clients extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiKey, cookieJar, timezone) {
    super('Client', siteId, username, password, sourceName, apiKey, cookieJar);
    this.timezone = timezone;
  }

  async getClient(clientId) {
    const clients = await this.getClients(null, [clientId]);
    if (clients.length === 1) {
      return {
        ...clients[0],
        CreationDate: moment.tz(c.CreationDate, this.timezone),
      };
    }
  }


  async getClients(searchText = '', clientIds = [], lastModifiedDate = null) {
    const clients = await this.apiRequest('client/clients', 'Clients', {
      method: 'get',
      params: {
        ClientIDs: (clientIds || [0]),
        LastModifiedDate: lastModifiedDate ? lastModifiedDate.toISOString() : null,
        SearchText: searchText
      }
    });
    return clients.map(c => {
      return {
        ...c,
        CreationDate: moment.tz(c.CreationDate, this.timezone),
      }
    })
  }
}
