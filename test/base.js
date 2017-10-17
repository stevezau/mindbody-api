import MBBase from '../src/base';
import config from './index';

const cli = new MBBase('', config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

describe('MBBase', () => {
  it('should login', (done) => {
    cli.login()
      .then((rsp) => {
        done();
      }).catch(err => done(err));
  });
});
