import MindbodyBase from './base';


let zPad = (num, pad = 2) => {
  return String('0' + num).slice(-pad)
};

export default class Appointment extends MindbodyBase {

  constructor(siteId, username, password, sourceName, apiToken, driverPath, cookies) {
    super('Appointment', siteId, username, password, sourceName, apiToken, driverPath, cookies);
  }

  getAppointments(fromDate, toDate, staffIDs, fields) {
    let req = this._initSoapRequest();
    req.XMLDetail = 'Full';
    req.StaffIDs = this._soapArray(staffIDs ? staffIDs : [0], 'long');
    req.IgnorePrepFinishTimes = false;
    req.Fields = this._soapArray(fields, 'string');
    req.StartDate = `${fromDate.getFullYear()}-${zPad(toDate.getMonth())}-${zPad(fromDate.getDate())}T${zPad(fromDate.getHours())}:${zPad(fromDate.getMinutes())}:${zPad(fromDate.getSeconds())}`;
    req.EndDate = `${toDate.getFullYear()}-${zPad(toDate.getMonth())}-${zPad(toDate.getDate())}T${zPad(toDate.getHours())}:${zPad(toDate.getMinutes())}:${zPad(toDate.getSeconds())}`;

    return new Promise((resolve, reject) => {
      this._soapReq('GetScheduleItems', 'GetScheduleItemsResult', req)
          .then(result => {
            let appointments = [];
            if (result.StaffMembers && result.StaffMembers.Staff) {
              for (let staff of result.StaffMembers.Staff) {
                if (staff.Appointments && staff.Appointments.Appointment) {
                  for (let appt of staff.Appointments.Appointment) {
                    appointments.push(appt);
                  }
                }
              }
            }
            resolve(appointments);
          })
          .catch(err => reject(err));
    })
  }

}