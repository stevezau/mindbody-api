import moment from 'moment-timezone'
import MindbodyBase from './base'

export default class Appointment extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, timezone) {
    super('Appointment', siteId, username, password, sourceName, apiToken, null)
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

  getAppointments (fromDate, toDate, staffIDs, fields = null) {
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
          resolve({appointments: appointments})
        })
        .catch(err => reject(err))
    })
  }
}
