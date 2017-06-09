import moment from 'moment-timezone'
import MindbodyBase from './base'

export default class Sales extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, timezone, cj) {
    super('Sale', siteId, username, password, sourceName, apiToken, cj)
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

  _parseTable ($, table, sales) {
    let rep = table.children('caption').text().trim().split(',', 2)
    rep = (rep.length === 2 ? `${rep[1]} ${rep[0]}` : `${rep[0]}`).trim()

    table.children('tr').each((i, tr) => {
      const tds = $(tr).children('td').map((i, td) => {
        return $(td)
      })
      const saleId = parseInt($(tds[0]).text())
      if (isNaN(saleId)) {
        return  // Probably html table thead
      }

      if (!sales[saleId]) {
        sales[saleId] = {Units: []}
      }
      let sale = sales[saleId]

      sale.Rep = rep

      if (!sale.client) {
        const clientID = $(tds[2]).find('a').attr('href').match(/ID=([0-9]+)/)
        const clientArr = $(tds[2]).text().trim().split(',', 2)
        sale.Client = {
          ID: parseInt(clientID[1]),
          FirstName: (clientArr.length === 2 ? clientArr[1] : clientArr[0]).trim(),
          LastName: (clientArr.length === 2 ? clientArr[0] : '').trim()
        }
      }

      const dollarRegex = /[%$,]/

      sale.Units.push({
        Name: $(tds[3]).text().trim(),
        Price: parseFloat($(tds[5]).text().replace(dollarRegex, '')),
        Quantity: parseInt($(tds[6]).text().trim()),
        Subtotal: parseFloat($(tds[7]).text().replace(dollarRegex, '')),
        DiscountPercent: parseFloat($(tds[8]).text().replace(dollarRegex, '')),
        DiscountAmount: parseFloat($(tds[9]).text().replace(dollarRegex, '')),
        Tax: parseFloat($(tds[10]).text().replace(dollarRegex, '')),
        Total: parseFloat($(tds[11]).text().replace(dollarRegex, '')),
      })
    })
  }

  _getRepSales (fromDate, toDate) {
    let form = {
      'hPostAction': 'Generate',
      'sr-range-opt': '',
      'sr-name': '',
      'autogenerate': 'hasGenerated',
      'reportUrl': '/Report/Sales/SalesByRep',
      'category': 'Sales',
      'requiredtxtDateStart': moment(fromDate).format('YYYY/MM/DD'),
      'requiredtxtDateEnd': moment(toDate).format('YYYY/MM/DD'),
      'optFilterTagged': 'false',
      'optProdServ': 'All',
      'optRep': '0',
      'optIncludeAutoRenews': 'Include',
      'optDisMode': 'Detail',
      'optAllCombined': 'on',
      'optIncludeReturns': 'true',
      'quickDateSelectionTwo': '',
      'optSaleLoc': [],
      'optCategory': []
    }

    return new Promise((resolve, reject) => {
      console.log('Running SalesByRep from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd)
      this.get('https://clients.mindbodyonline.com/Report/Sales/SalesByRep')
        .then(rsp => {
          let $ = this._parse(rsp.body)
          $('#optSaleLoc option').each((i, el) => {
            form.optSaleLoc.push($(el).attr('value'))
          })
          return this.get('https://clients.mindbodyonline.com/Ajax/GetCategoriesByType')
        })
        .then(rsp => {
          let $ = this._parse(rsp.body)
          $('option').each((i, el) => {
            form.optCategory.push($(el).attr('value'))
          })
          return this.post('https://clients.mindbodyonline.com/Report/Sales/SalesByRep/Generate?reportID=undefined', form)
        })
        .then(rsp => {
          let sales = {}
          let $ = this._parse(rsp.body)
          $('table.result-table').each((i, el) => {
            this._parseTable($, $(el), sales)
          })
          resolve(sales)
        })
        .catch(err => reject(err))
    })
  }

  _getSales (fromDate, toDate) {
    let req = this._initSoapRequest()
    req.XMLDetail = 'Full'
    req.StartSaleDateTime = fromDate.toISOString()
    req.EndSaleDateTime = toDate.toISOString()

    return new Promise((resolve, reject) => {
      console.log('Getting sales via soap from:', fromDate.toISOString(), 'to:', toDate.toISOString())
      this._soapReq('GetSales', 'GetSalesResult', req)
        .then(result => {
          if (result.Sales) {
            let sales = result.Sales.Sale.filter((s) => {
              return s.Payments !== null
            })
            sales = sales.map(sale => {
              sale.ID = parseInt(sale.ID)
              sale.Payments = sale.Payments.Payment.map(payment => {
                payment.ID = parseInt(payment.ID)
                payment.Amount = parseFloat(payment.Amount)
                return payment
              })
              return sale
            })
            resolve({sales: sales, countTotal: result.ResultCount, pagesTotal: result.TotalPageCount})
          } else {
            resolve([])
          }
        })
        .catch(err => reject(err))
    })
  }

  getSaleUnits (saleId) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_voidedit.asp?saleno=${saleId}`)
        .then(rsp => {
          let $ = this._parse(rsp.body)
          let sale = {
            id: saleId,
            units: []
          }

          $('table.adyenClass tr').each((i, tr) => {
            const tds = $(tr).children('td').map((i, td) => {
              return $(td)
            })
            const text = tds[0].text()
            const a = tds[0].find('a')
            let unit = {}
            if (tds.length !== 4 || !text.contains('Item:')) return
            if (text.contains('Gift Card')) {
              unit.type = 'gift_card'
            } else if (a) {
              unit.id = parseInt($(a).attr('href').match(/Id=([0-9]+)/)[1])
              unit.type = 'product'
            } else {
              unit.type = 'service'
              const service_a = tds[-1].find('a')
              if (service_a) {
                const href = a.attr('href')
                if (href.contains('saleno')) {
                  // Returned item, go to the original sale
                  m = re.match('.*saleno=([0-9]+).*', a_href['href'])
                  units = self.sale_units_by_id(int(m.group(1))) + units
                } else {
                  m = re.match('.*doRefund\\([0-9]+.([0-9]+).*', a_href['href'], re.IGNORECASE)
                  unit_id = int(m.group(1))
                }
              }
            }
          })
          return resolve(sale)
        })
        .catch(err => reject(err))
    })
  }

  getSales (fromDate, toDate) {
    return new Promise((resolve, reject) => {
      Promise.all([this._getSales(fromDate, toDate), this._getRepSales(fromDate, toDate)])
        .then(result => {
          let sales = []
          if (result[0].sales) {
            for (let sale of result[0].sales) {
              if (!result[1][parseInt(sale.ID)]) {
                console.log(`Sale ${sale.ID} was not found`, fromDate, toDate)
              } else {
                sales.push(Object.assign(result[1][parseInt(sale.ID)], sale))
              }
            }
          }

          resolve({sales: sales, countTotal: result[0].ResultCount, pagesTotal: result[0].TotalPageCount})
        })
        .catch(err => reject(err))
    })
  }
}
