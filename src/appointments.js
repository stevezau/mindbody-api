import MindbodyBase from './base'

let zPad = (num, pad = 2) => {
  return String('0' + num).slice(-pad)
}

let dateStr = (d) => {
  let date = `${d.getFullYear()}-${zPad(d.getMonth())}-${zPad(d.getDate())}`
  let time = `${zPad(d.getHours())}:${zPad(d.getMinutes())}:${zPad(d.getSeconds())}`
  return `${date}T${time}`
}

export default class Appointment extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, driverPath, cookies) {
    super('Appointment', siteId, username, password, sourceName, apiToken, driverPath, cookies)
  }

  getAppointments (fromDate, toDate, staffIDs, fields) {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'
    req.StaffIDs = this._soapArray(staffIDs, 'long')
    req.IgnorePrepFinishTimes = false
    req.Fields = this._soapArray(fields, 'string')
    req.StartDate = dateStr(fromDate)
    req.EndDate = dateStr(toDate)

    return new Promise((resolve, reject) => {
      this._soapReq('GetScheduleItems', 'GetScheduleItemsResult', req)
        .then(result => {
          let appointments = []
          if (result.StaffMembers && result.StaffMembers.Staff) {
            for (let staff of result.StaffMembers.Staff) {
              if (staff.Appointments && staff.Appointments.Appointment) {
                for (let appt of staff.Appointments.Appointment) {
                  appointments.push(appt)
                }
              }
            }
          }
          resolve(appointments)
        })
        .catch(err => reject(err))
    })
  }
}
