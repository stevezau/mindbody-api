import moment from 'moment-timezone';
import MindbodyBase from './base';

export default class Appointment extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiToken, cookieJar, timezone) {
    super('Appointment', siteId, username, password, sourceName, apiToken, cookieJar);
    this.timezone = timezone;
  }

  soapClient() {
    return super.soapClient({
      customDeserializer: {
        dateTime: text => moment.tz(text, this.timezone),
        date: text => moment.tz(text, this.timezone)
      }
    });
  }

  getAppointmentsSOAP(fromDate, toDate, staffIDs, fields = null) {
    const req = this.initSoapRequest();
    req.XMLDetail = fields ? 'Basic' : 'Full';
    req.StaffIDs = (staffIDs || [0]).map(value => ({ long: value }));
    req.IgnorePrepFinishTimes = false;
    req.Fields = (fields || []).map(value => ({ string: value }));
    req.StartDate = moment(fromDate).format('YYYY-MM-DDTHH:mm:ss');
    req.EndDate = moment(toDate).format('YYYY-MM-DDTHH:mm:ss');

    return new Promise((resolve, reject) => {
      this.soapReq('GetScheduleItems', 'GetScheduleItemsResult', req)
        .then((result) => {
          const appointments = [];
          if (result.StaffMembers && result.StaffMembers.Staff) {
            result.StaffMembers.Staff.forEach((staff) => {
              if (staff.Appointments && staff.Appointments.Appointment) {
                staff.Appointments.Appointment.forEach(appt => appointments.push(appt));
              }
            });
          }
          resolve({ appointments });
        })
        .catch(err => reject(err));
    });
  }

  getAppointmentsWeb(fromDate, toDate) {
    const startTZ = moment.tz(fromDate, this.timezone);
    const endTZ = moment.tz(toDate, this.timezone);
    const startUTC = moment.tz(startTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day');
    const endUTC = moment.tz(endTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day');

    const start = startUTC.unix();
    const end = endUTC.unix();

    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/DailyStaffSchedule/DailyStaffSchedules?studioID=${this.siteId}&isLibAsync=true&isJson=true&StartDate=${start}&EndDate=${end}&View=week&TabID=9`)
        .then((rsp) => {
          const data = JSON.parse(rsp.body);
          const appointments = [];
          data.json.forEach((staff) => {
            if (staff.Appointments) {
              staff.Appointments.forEach(appt => appointments.push(appt));
            }
          });
          resolve({ appointments });
        })
        .catch(err => reject(err));
    });
  }
}
