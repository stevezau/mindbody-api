import moment from 'moment-timezone'
import MindbodyBase from './base'

export default class Appointment extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, cookieJar, timezone) {
    super('Appointment', siteId, username, password, sourceName, apiToken, cookieJar)
    this.timezone = timezone
  }

  _soapClient () {
    return super._soapClient({
      customDeserializer: {
        dateTime: (text, context) => {
          return moment.tz(text, this.timezone)
        },
        date: (text, context) => {
          return moment.tz(text, this.timezone)
        }
      }
    })
  }

  getAppointmentsSOAP (fromDate, toDate, staffIDs, fields = null) {
    let req = this._initSoapRequest()
    req.XMLDetail = fields ? 'Basic' : 'Full'
    req.StaffIDs = this._soapArray(staffIDs || [0], 'long')
    req.IgnorePrepFinishTimes = false
    req.Fields = this._soapArray(fields, 'string')
    req.StartDate = moment(fromDate).format('YYYY-MM-DDTHH:mm:ss')
    req.EndDate = moment(toDate).format('YYYY-MM-DDTHH:mm:ss')

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
          resolve({appointments})
        })
        .catch(err => reject(err))
    })
  }

  getAppointmentsWeb (fromDate, toDate) {
    const startTZ = moment.tz(fromDate, this.timezone)
    const endTZ = moment.tz(toDate, this.timezone)
    const startUTC = moment.tz(startTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day')
    const endUTC = moment.tz(endTZ.format('YYYY-MM-DDTHH:mm:ss'), 'UTC').startOf('day')

    const start = startUTC.unix()
    const end = endUTC.unix()

    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/DailyStaffSchedule/DailyStaffSchedules?studioID=${this.siteId}&isLibAsync=true&isJson=true&StartDate=${start}&EndDate=${end}&View=week&TabID=9`)
        .then(rsp => {
          const data = JSON.parse(rsp.body)
          let appointments = []
          for (let staff of data.json) {
            if (staff.Appointments) {
              for (let appt of staff.Appointments) {
                appointments.push(appt)
              }
            }
          }
          resolve({appointments})
        })
        .catch(err => reject(err))
    })
  }
}
