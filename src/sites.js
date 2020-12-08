import MindbodyBase from './base';

export default class Sites extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiKey, cookieJar) {
    super('Site', siteId, username, password, sourceName, apiKey, cookieJar);
  }

  async getAllPrograms(fields = []) {
    return await this.apiRequest('site/programs', 'Programs', {
      method: 'get',
    });
  }

  async getAllSessionTypes(fields = []) {
    return await this.apiRequest('site/sessiontypes', 'SessionTypes', {
      method: 'get',
    });
  }

  async getSite() {
    const sites = await this.apiRequest('site/sites', 'Sites', {
      method: 'get',
    });

    const rsp = await this.webPost('https://clients.mindbodyonline.com/BusinessAndConnectLocations/BusinessAndLocationData');
    return Object.assign(sites[0], rsp.data);
  }
}
