import MBClients from '../src/clients';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBClients(config.id, config.username, config.password, config.sourceName, config.apiToken);

describe('MindBody Clients', () => {
  it('should return clients', (done) => {
    cli.getClients('', [], 0).then((clients) => {
      assert.isAbove(clients.length, 10);
      done();
    });
  });

  it('should search client 100000000', (done) => {
    cli.getClients(null, [100000000], 0, 10)
      .then((clients) => {
        assert.lengthOf(clients, 1);
        const client = clients[0];
        assert.equal(client.Id, '100000000');
        assert.isNotEmpty(client.FirstName);
        assert.isNotEmpty(client.LastName);
        done();
      })
      .catch(err => done(err));
  });

  it('should return single client 100000000', (done) => {
    cli.getClient(100000000)
      .then((client) => {
        assert.equal(client.Id, '100000000');
        assert.isNotEmpty(client.FirstName);
        assert.isNotEmpty(client.LastName);
        done();
      })
      .catch(err => done(err));
  });

  it('should return search', (done) => {
    cli.getClients('gemma', [], 0, 10)
      .then((clients) => {
        const client = clients[0];
        assert.isNotNull(client.ID);
        assert.isNotEmpty(client.FirstName);
        assert.isNotEmpty(client.LastName);
        done();
      })
      .catch(err => done(err));
  });
});
