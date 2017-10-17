import MBClients from '../src/clients';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBClients(config.id, config.username, config.password, config.sourceName, config.apiToken);

describe('MindBody Clients', () => {
  it('should return 10 clients', () => {
    cli.getClients(null, null, 0, 10).then(({ clients }) => {
      assert.lengthOf(clients, 10);
    });
  });

  it('should return second page 10 clients', () => {
    cli.getClients(null, null, 1, 10).then(({ clients }) => {
      assert.lengthOf(clients, 10);
    });
  });

  it('should search client 100014514', (done) => {
    cli.getClients(null, [100014514], 0, 10)
      .then(({ clients }) => {
        assert.lengthOf(clients, 1);
        const client = clients[0];
        assert.equal(client.ID, '100014514');
        assert.equal(client.FirstName, 'Sally');
        assert.equal(client.LastName, 'Demo');
        done();
      })
      .catch(err => done(err));
  });

  it('should return single client 100014514', (done) => {
    cli.getClient([100014514])
      .then((client) => {
        assert.equal(client.ID, '100014514');
        assert.equal(client.FirstName, 'Sally');
        assert.equal(client.LastName, 'Demo');
        done();
      })
      .catch(err => done(err));
  });

  it('should return search demo andrew', (done) => {
    cli.getClients('demo andrew', null, 0, 10)
      .then(({ clients }) => {
        assert.lengthOf(clients, 1);
        const client = clients[0];
        assert.equal(client.ID, '100015036');
        assert.equal(client.FirstName, 'Andrew');
        assert.equal(client.LastName, 'Demo');
        done();
      })
      .catch(err => done(err));
  });
});
