import moment from 'moment-timezone';
import MindbodyBase from './base';

export default class Appointment extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiKey, cookieJar, timezone) {
    super('Appointment', siteId, username, password, sourceName, apiKey, cookieJar);
    this.timezone = timezone;
  }

  async getAppointmentsAPI(fromDate, toDate, staffIDs, fields = null) {
    const sessionTypes = await this.apiRequest('site/sessiontypes', 'SessionTypes', {
      method: 'get',
    });

    const sessionsMap = sessionTypes.reduce((accum, s) => {
      accum[s.Id] = s;
      return accum;
    }, {});

    const staff = await this.apiRequest('appointment/scheduleitems', 'StaffMembers', {
      method: 'get',
      params: {
        StaffIDs: (staffIDs || [0]),
        IgnorePrepFinishTimes: false,
        StartDate: fromDate.format('YYYY-MM-DDTHH:mm:ss'),
        EndDate: toDate.format('YYYY-MM-DDTHH:mm:ss')
      }
    });


    const appointments = [];

    staff.forEach(staff => {
      if (staff.Appointments) {
        try {
          staff.Appointments.forEach((appt) => {
            const staffName = `${staff.FirstName} ${staff.LastName}`.trim();
            appointments.push({
              ...appt,
              StartDateTimeRAW: appt.StartDateTime,
              StartDateTime: moment.tz(appt.StartDateTime, this.timezone),
              EndDateTimeRAW: appt.EndDateTime,
              EndDateTime: moment.tz(appt.EndDateTime, this.timezone),
              staff: {
                Id: appt.StaffId,
                name: staffName
              },
              session: sessionsMap[appt.SessionTypeId] || {},
            });
          });
        } catch (err) {
          console.log(err);
        }
      }
    });

    return appointments;
  }

  async getAppointmentsWeb(fromDate, toDate) {
    const startTZ = moment.tz(fromDate, this.timezone);
    const endTZ = moment.tz(toDate, this.timezone);
    const startUTC = moment.tz(startTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day');
    const endUTC = moment.tz(endTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day');

    const start = startUTC.unix();
    const end = endUTC.unix();

    const rsp = await this.webGet(`https://clients.mindbodyonline.com/DailyStaffSchedule/DailyStaffSchedules?studioID=${this.siteId}&isLibAsync=true&isJson=true&StartDate=${start}&EndDate=${end}&View=week&TabID=9`);
    const appointments = [];
    if (rsp.data.json) {
      rsp.data.json.forEach((staff) => {
        if (staff.Appointments) {
          staff.Appointments.forEach(appt => appointments.push(appt));
        }
      });
    }

    return appointments;
  }
}
