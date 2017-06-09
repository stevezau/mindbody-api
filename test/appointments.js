import MBAppts from '../src/appointments'
import config from './index'
import chai from 'chai'

const assert = chai.assert
const cli = new MBAppts(config.id, config.username, config.password, config.sourceName, config.apiToken)

describe('MindBody Appointments', function () {
  it('should return appointments', function (done) {
    let toDate = new Date(Date.now())
    let fromDate = new Date(Date.now() - 2.592e+9) // minus 30 days
    cli.getAppointments(fromDate, toDate)
      .then(({appointments}) => {
        assert.isAbove(appointments.length, 1)
        done()
      })
      .catch(err => done(err))
  })

})
