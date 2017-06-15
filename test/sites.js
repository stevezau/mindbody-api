import MBSites from '../src/sites'
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBSites(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

describe('MindBody Sites', function () {

  it('should return site -99', function (done) {
    cli.getSite()
        .then(site => {
          assert.equal(config.id, site.ID);
          assert.equal(site.StudioName, 'API Sandbox Site');
          assert.equal(config.id, site.ID);
          done()
        })
        .catch(err => done(err))
  });
});
