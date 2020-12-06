import MBSales from '../src/sales';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBSales(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar, null);

describe('MindBody Sales', () => {
  it('should return sales', (done) => {
    const toDate = new Date(Date.now());
    const fromDate = new Date(Date.now() - (4 * 86400 * 1000)); // minus 2 days
    cli.getSales(fromDate, toDate)
      .then((sales) => {
        assert.isAbove(sales.length, 10);
        done();
      })
      .catch(err => done(err));
  });

  it('should return sale units', (done) => {
    cli.getSaleUnits(191449)
      .then((units) => {
        assert.isAbove(units.length, 0);
        done();
      })
      .catch(err => done(err));
  });
});
