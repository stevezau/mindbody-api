import moment from 'moment-timezone'
import MindbodyBase from './base'
import escape from 'html-escape'
import unescape from 'unescape'

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

  _getAppointments (fromDate, toDate, staffIDs, fields = null) {
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
          resolve(appointments)
        })
        .catch(err => reject(err))
    })
  }

  _getAppointmentsExtras (fromDate, toDate) {

    let form = {
      'hPostAction': 'Generate',
      'sr-range-opt': '',
      'sr-name': '',
      'autogenerate': 'hasGenerated',
      'reportUrl': '/Report/Staff/ScheduleAtAGlance',
      'category': 'Staff',
      'requiredtxtDateStart': moment.tz(fromDate, this.timezone).format('YYYY/MM/DD'),
      'requiredtxtDateEnd': moment.tz(toDate, this.timezone).format('YYYY/MM/DD'),
      'optFilterTagged': 'false',
      'optfilterByCreated': 'Scheduled',
      'optTG': '',
      'optStatus': '',
      'optBookingType': '',
      'quickDateSelectionTwo': '',
      'optTrn': []
    }

    return new Promise((resolve, reject) => {
      console.log('Running ScheduleAtAGlance from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd)
      this.get('https://clients.mindbodyonline.com/Report/Staff/ScheduleAtAGlance')
        .then(rsp => {
          let $ = this._parse(rsp.body)
          $('#optTrn option').each((i, el) => {
            form.optTrn.push($(el).attr('value'))
          })
          return this.post('https://clients.mindbodyonline.com/Report/Staff/ScheduleAtAGlance/Generate?reportID=undefined', form)
        })
        .then(rsp => {
          const appts = []
          let lastDate = null
          let lastStart = null
          let lastFinish = null

          // Sometimes descriptionCell can have < or > which causes issues with parsing.
          let $ = this._parse(rsp.body.replace(/(descriptionCell.+?<a.+?target="_parent">)(.+?)(<\/a>)/g, (full, g1, g2, g3) => {
            return `${g1}${escape(g2)}${g3}`
          }))

          $('table.result-table tr').each((i, tr) => {
            const tds = $(tr).children('td').map((i, td) => {
              return $(td)
            })

            if (tds.length !== 9) return

            const date = tds[1].attr('data-sortval')
            if (!date) return
            if (date.length === 8) lastDate = date
            const startFinish = tds[2].text().trim().split('-')
            if (startFinish.length === 2) {
              lastStart = startFinish[0].trim()
              lastFinish = startFinish[1].trim()
            }

            const clientA = tds[5].find('a')
            if (clientA.length !== 1) return
            const clientHref = clientA.attr('href').match(/ID=([0-9]+)/)
            if (clientHref.length !== 2) return
            const clientID = parseInt(clientHref[1])
            const service = unescape(tds[3].text()).replace(/&nbsp;/g, ' ').trim()
            const id = parseInt(tds[3].attr('data-art').match(/([0-9]+)/)[1])
            if (service) {
              appts.push({
                id: id,
                clientId: clientID,
                start: moment.tz(`${lastDate} ${lastStart}`, 'YYYYMMDD h:m A', this.timezone).toISOString(),
                finish: moment.tz(`${lastDate} ${lastFinish}`, 'YYYYMMDD h:m A', this.timezone).toISOString(),
                service: service
              })
            }
          })
          resolve(appts)
        })
        .catch(err => reject(err))
    })
  }

  getAppointments (fromDate, toDate, staffIDs, fields = null) {
    return Promise.all([
      this._getAppointments(fromDate, toDate, staffIDs, fields),
      this._getAppointmentsExtras(fromDate, toDate)
    ])
      .then(rsp => {
        console.log(rsp)
      })
  }
}
