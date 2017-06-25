import moment from 'moment-timezone'
import MindbodyBase from './base'

export default class Staff extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, timezone, cookieJar) {
    super('Staff', siteId, username, password, sourceName, apiToken, cookieJar)
    this.timezone = timezone
  }

  _getStaff () {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'

    return new Promise((resolve, reject) => {
      this._soapReq('GetStaff', 'GetStaffResult', req)
        .then(result => {
          if (result.StaffMembers && result.StaffMembers.Staff) {
            resolve(result.StaffMembers.Staff)
          } else {
            resolve([])
          }
        })
        .catch(err => reject(err))
    })
  }

  _getStaffInactive () {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'

    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/Staff/Manage')
        .then(rsp => {
          const staff = []
          const $ = this._parse(rsp.body)
          $('#inactiveStaffTable > tbody > tr').each((i, tr) => {
            const tds = $(tr).children('td').map((i, td) => {
              return $(td)
            })
            const name = tds[0].text().trim()
            const staffHref = tds[0].find('a').attr('href')
            if (staffHref.length > 0) {
              const staffID = parseInt(staffHref.match(/ID=([0-9]+)/)[1])
              staff.push({Name: name, ID: staffID})
            }
          })
          resolve(staff)
        })
        .catch(err => reject(err))
    })
  }

  getStaff () {
    return new Promise((resolve, reject) => {
      Promise.all([this._getStaff(), this._getStaffInactive()])
        .then(results => {
          resolve(results[0].concat(results[1]))
        })
        .catch(err => reject(err))
    })
  }

  _parseTSTable (body) {
    const $ = this._parse(body)
    const timesheets = []
    let currentStaff = null
    let currentTask = null
    let lastDate = null

    $('table[cellspacing="10"] tr').each((i, tr) => {
      tr = $(tr)
      if (tr.attr('class') && tr.attr('class').includes('whiteHeader')) {
        currentStaff = tr.text().trim()
      }
      if (tr.attr('style') && tr.attr('style').includes('background-color:#D0D0D0')) {
        currentTask = tr.text().trim()
      }
      const bgColors = tr.attr('bgcolor') || ''
      if (bgColors.includes('F2F2F2') || bgColors.includes('FAFAFA')) {
        if (!currentStaff) {
          console.log('Unable to find task assigned to staff timesheet for', currentStaff)
          return
        }
        const tds = tr.children('td').map((i, td) => {
          return $(td)
        })
        if (tds.length === 9) {
          const dateText = tds[1].find('strong').text().trim()
          if (dateText) {
            let [day, month, year] = dateText.split('/')
            lastDate = `${year}-${month}-${day}`
          }
          const checkInAt = tds[3].text().replace(/.*at/, '').trim()
          const checkOutAt = tds[5].text().replace(/.*at/, '').trim()

          if (!checkInAt || !checkOutAt) {
            return // Still pending
          }

          const checkIn = moment.tz(`${lastDate} ${checkInAt}`, 'YYYY-MM-DD h:mm:ss a', this.timezone)
          const checkOut = moment.tz(`${lastDate} ${checkInAt}`, 'YYYY-MM-DD h:mm:ss a', this.timezone)

          const hours = tds[7].text().trim()
          const id = tds[8].find('a').attr('href').match(/timeClockID=([0-9]+)&/)
          if (id.length < 1) {
            return // Invalid ID?
          }
          timesheets.push({
            'id': parseInt(id[1]),
            'start': checkIn,
            'finish': checkOut,
            'hours': hours,
            'staff': currentStaff,
            'task': currentTask
          })
        }
      }
    })
    return timesheets
  }

  getTimesheets (from, to) {
    let form = {
      'CSRFToken': '',
      'category': 'Staff',
      'reportUrl': '/ASP/adm/adm_tlbx_timeclock_list.asp',
      'frmShowReport': 'true',
      'frmExpReport': 'false',
      'trainerID': '0',
      'optLocation': '0',
      'optTask': '',
      'optInactive': 'on',
      'requiredtxtDateStart': moment(from).format('YYYY/MM/DD'),
      'requiredtxtDateEnd': moment(to).format('YYYY/MM/DD')
    }

    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_timeclock_list.asp')
        .then(rsp => {
          let $ = this._parse(rsp.body)
          form.CSRFToken = $('input[name=CSRFToken]').attr('value')
          return this.post('https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_timeclock_list.asp', form)
        })
        .then(rsp => {
          const timesheets = this._parseTSTable(rsp.body)
          resolve(timesheets)
        })
        .catch(err => reject(err))
    })
  }
}
