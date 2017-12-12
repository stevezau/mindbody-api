import cheerio from 'cheerio';
import moment from 'moment-timezone';
import MindbodyBase from './base';

export default class Staff extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiToken, cookieJar, timezone) {
    super('Staff', siteId, username, password, sourceName, apiToken, cookieJar);
    this.timezone = timezone;
  }

  getStaffSoap() {
    const req = this.initSoapRequest();
    req.XMLDetail = 'Full';

    return new Promise((resolve, reject) => {
      this.soapReq('GetStaff', 'GetStaffResult', req)
        .then((result) => {
          if (result.StaffMembers && result.StaffMembers.Staff) {
            resolve(result.StaffMembers.Staff);
          } else {
            resolve([]);
          }
        })
        .catch(err => reject(err));
    });
  }

  getStaffInactive() {
    const req = this.initSoapRequest();
    req.XMLDetail = 'Full';

    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/Staff/Manage')
        .then((rsp) => {
          const staffIds = [];
          const $ = cheerio.load(rsp.body);
          $('#inactiveStaffTable > tbody > tr').each((i, tr) => {
            const tds = $(tr).children('td').map((_, td) => $(td));
            const staffHref = tds[0].find('a').attr('href');
            if (staffHref.length > 0) {
              staffIds.push(Number(staffHref.match(/ID=([0-9]+)/)[1]));
            }
          });
          return Promise.resolve(staffIds);
        })
        .then((staffIds) => {
          staffIds.reduce((p, staffID) => {
            return p.then(staff => this.getStaffByID(staffID).then(parsedStaff => [...staff, parsedStaff]));
          }, Promise.resolve([])).then(staff => resolve(staff));
        })
        .catch(err => reject(err));
    });
  }

  getStaff() {
    return new Promise((resolve, reject) => {
      Promise.all([this.getStaffSoap(), this.getStaffInactive()])
        .then((results) => {
          resolve(results[0].concat(results[1]));
        })
        .catch(err => reject(err));
    });
  }

  getStaffByID(staffID) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/asp/adm/adm_trn_e.asp?trnID=${staffID}`)
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          const firstName = $('#fauxFirst_Name').attr('value');
          const lastName = $('#fauxLast_Name').attr('value');
          const displayName = $('#txtDisplayName').attr('value');

          resolve({
            ID: staffID,
            FirstName: firstName,
            LastName: lastName,
            Name: displayName || `${firstName} ${lastName}`.trim()
          });
        })
        .catch(err => reject(err));
    });
  }

  parseTSTable(body) {
    const $ = cheerio.load(body);
    const timesheets = [];
    let currentStaff = null;
    let currentTask = null;
    let lastDate = null;

    $('table[cellspacing="10"] tr').each((i, value) => {
      const tr = $(value);
      if (tr.attr('class') && tr.attr('class').includes('whiteHeader')) {
        currentStaff = tr.text().trim().replace(/\u00A0/g, ' '); // MB Uses a weird space char, replace with space
      }
      if (tr.attr('style') && tr.attr('style').includes('background-color:#D0D0D0')) {
        currentTask = tr.text().trim();
      }
      const bgColors = tr.attr('bgcolor') || '';
      if (bgColors.includes('F2F2F2') || bgColors.includes('FAFAFA')) {
        if (!currentStaff) {
          console.log('Unable to find task assigned to staff timesheet for', currentStaff);
          return;
        }
        const tds = tr.children('td').map((_, td) => $(td));
        if (tds.length === 9) {
          const dateText = tds[1].find('strong').text().trim();
          if (dateText) {
            const [day, month, year] = dateText.split('/');
            lastDate = `${year}-${month}-${day}`;
          }
          const checkInAt = tds[3].text().replace(/.*at/, '').trim();
          const checkOutAt = tds[5].text().replace(/.*at/, '').trim();

          if (!checkInAt || !checkOutAt) {
            return; // Still pending
          }

          const checkIn = moment.tz(`${lastDate} ${checkInAt}`, 'YYYY-MM-DD h:mm:ss a', this.timezone);
          const checkOut = moment.tz(`${lastDate} ${checkInAt}`, 'YYYY-MM-DD h:mm:ss a', this.timezone);

          const hours = tds[7].text().trim();
          const id = tds[8].find('a').attr('href').match(/timeClockID=([0-9]+)&/);
          if (id.length < 1) {
            return; // Invalid ID?
          }
          timesheets.push({
            id: Number(id[1]),
            start: checkIn,
            finish: checkOut,
            hours: parseFloat(hours),
            staff: currentStaff,
            task: currentTask
          });
        }
      }
    });
    return timesheets;
  }

  getTimesheets(from, to) {
    const form = {
      CSRFToken: '',
      reportUrl: '/ASP/adm/adm_tlbx_timeclock_list.asp',
      frmGenReport: true,
      frmExpReport: false,
      trainerID: 0,
      optLocation: 0,
      requiredtxtDateStart: moment.tz(from, this.timezone).format('YYYY/MM/DD'),
      requiredtxtDateEnd: moment.tz(to, this.timezone).format('YYYY/MM/DD'),
      optInactive: 'on',
      frmGenPdf: false
    };

    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_timeclock_list.asp')
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          form.CSRFToken = $('input[name=CSRFToken]').attr('value');
          return this.post('https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_timeclock_list.asp', form);
        })
        .then((rsp) => {
          const timesheets = this.parseTSTable(rsp.body);
          resolve(timesheets);
        })
        .catch(err => reject(err));
    });
  }
}
