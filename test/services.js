import MBService from '../src/services';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBService(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

const expect = chai.expect;

describe('MindBody Services', () => {
  it('should return services', (done) => {
    cli.getAllServices()
      .then(({ services }) => {
        assert.lengthOf(services, 5);
        done();
      })
      .catch(err => done(err));
  });

  it('should enrich services', (done) => {
    cli.getAllServices()
      .then(({ services }) => cli.enrichService(services[0]))
      .then((service) => {
        done();
      })
      .catch(err => done(err));
  });
});
