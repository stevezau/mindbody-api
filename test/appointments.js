import MBAppts from '../src/appointments';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBAppts(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

describe('MindBody Appointments', () => {
  it('should return appointments api', (done) => {
    const toDate = new Date(Date.now());
    const fromDate = new Date(Date.now() - 2.592e+9); // minus 30 days
    cli.getAppointmentsAPI(fromDate, toDate)
      .then((appointments) => {
        assert.isAbove(appointments.length, 1);
        done();
      })
      .catch(err => done(err));
  });

  it('should return appointments web', (done) => {
    const toDate = new Date(Date.now());
    const fromDate = new Date(Date.now() - 2.592e+9); // minus 30 days
    cli.getAppointmentsWeb(fromDate, toDate)
      .then((appointments) => {
        assert.isAbove(appointments.length, 1);
        done();
      })
      .catch(err => done(err));
  });
});
