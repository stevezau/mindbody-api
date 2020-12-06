import MBSites from '../src/sites';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBSites(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

describe('MindBody Sites', () => {
  it('should return site', (done) => {
    cli.getSite()
      .then((site) => {
        assert.equal(config.id, site.Id);
        done();
      })
      .catch(err => done(err));
  });
});
