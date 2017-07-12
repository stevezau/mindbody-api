import MBStaff from '../src/staff'
import config from './index'
import chai from 'chai'

const assert = chai.assert
const cli = new MBStaff(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar, null)

describe('MindBody Staff', function () {
  it('should return staff staff', function (done) {
    cli.getStaff()
      .then(staff => {
        assert.lengthOf(staff, 2)
        done()
      })
  })

  it('should return timesheets', function (done) {
    let toDate = new Date(Date.now())
    let fromDate = new Date(Date.now() - (4 * 86400 * 1000)) // minus 2 days
    cli.getTimesheets(fromDate, toDate)
      .then(timesheets => {
        assert.lengthOf(timesheets, 10)
        done()
      })
  })
})
