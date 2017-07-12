import MBSales from '../src/sales'
import config from './index'
import chai from 'chai'

const assert = chai.assert
const cli = new MBSales(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar, null)

describe('MindBody Sales', function () {
  it('should return sales', function (done) {
    let toDate = new Date(Date.now())
    let fromDate = new Date(Date.now() - (4 * 86400 * 1000)) // minus 2 days
    cli.getSales(fromDate, toDate)
      .then(({sales}) => {
        assert.isAbove(sales.length, 10)
        done()
      })
      .catch(err => done(err))
  })

  it('should return sale units', function (done) {
    cli.getSaleUnits(100159252)
      .then(({units}) => {
        assert.isAbove(units.length, 0)
        done()
      })
      .catch(err => done(err))
  })
})
