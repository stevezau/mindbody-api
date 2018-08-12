import cheerio from 'cheerio';
import moment from 'moment-timezone';
import MindbodyBase from './base';

function parseTable($, table, sales) {
  let rep = table.children('caption').text().trim().split(',', 2);
  rep = (rep.length === 2 ? `${rep[1]} ${rep[0]}` : `${rep[0]}`).trim();

  table.children('tbody').children('tr').each((i, tr) => {
    let tds = $(tr).children('td').map((_, td) => $(td));
    const saleId = Number($(tds[0]).text());
    if (Number.isNaN(saleId)) {
      return; // Probably html table thead
    }

    // Handle case where item name has a < > which causes issues with parsing via cheerio
    if (!$(tds[5]).text()) {
      const html = $(tr).html();
      const found = html.match(/(itemnameCell">)(.+)(<="" td="">)/);
      if (!found) return;
      const name = found[2].replace('=""', '').replace('<', '&lt;').replace('>', '&gt;');
      const parsed = cheerio.load(html.replace(found[0], `${found[1]}${name}</td>`), { decodeEntities: true });
      tds = parsed('td');
    }

    if (!sales[saleId]) {
      sales[saleId] = { Units: [] }; // eslint-disable-line
    }
    const sale = sales[saleId];

    sale.Rep = rep;

    if (!sale.client) {
      const clientID = $(tds[2]).find('a').attr('href').match(/ID=([0-9]+)/);
      const clientArr = $(tds[2]).text().trim().split(',', 2);
      sale.Client = {
        ID: Number(clientID[1]),
        FirstName: (clientArr.length === 2 ? clientArr[1] : clientArr[0]).trim(),
        LastName: (clientArr.length === 2 ? clientArr[0] : '').trim()
      };
    }

    const dollarRegex = /[%$,]/g;

    sale.Units.push({
      Name: $(tds[3]).text().trim(),
      Price: parseFloat($(tds[5]).text().replace(dollarRegex, '')),
      Quantity: Number($(tds[6]).text().trim()),
      Subtotal: parseFloat($(tds[7]).text().replace(dollarRegex, '')),
      DiscountPercent: parseFloat($(tds[8]).text().replace(dollarRegex, '')),
      DiscountAmount: parseFloat($(tds[9]).text().replace(dollarRegex, '')),
      Tax: parseFloat($(tds[10]).text().replace(dollarRegex, '')),
      Total: parseFloat($(tds[11]).text().replace(dollarRegex, ''))
    });
  });
}

export default class Sales extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiToken, cookieJar, timezone) {
    super('Sale', siteId, username, password, sourceName, apiToken, cookieJar);
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

  getRepSales(fromDate, toDate) {
    const form = {
      hPostAction: 'Generate',
      'sr-range-opt': '',
      'sr-name': '',
      autogenerate: 'hasGenerated',
      reportUrl: '/Report/Sales/SalesByRep',
      category: 'Sales',
      requiredtxtDateStart: moment.tz(fromDate, this.timezone).format('YYYY/MM/DD'),
      requiredtxtDateEnd: moment.tz(toDate, this.timezone).format('YYYY/MM/DD'),
      optFilterTagged: 'false',
      optProdServ: 'All',
      optRep: '0',
      optIncludeAutoRenews: 'Include',
      optDisMode: 'Detail',
      optBasis: 'AccrualBasis',
      optIncludeReturns: 'true',
      quickDateSelectionTwo: '',
      optSaleLoc: [],
      optCategory: []
    };

    return new Promise((resolve, reject) => {
      console.log('Running SalesByRep from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd);
      this.get('https://clients.mindbodyonline.com/Report/Sales/SalesByRep')
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          $('#optSaleLoc option').each((i, el) => {
            form.optSaleLoc.push($(el).attr('value'));
          });
          return this.get('https://clients.mindbodyonline.com/Ajax/GetCategoriesByType');
        })
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          $('option').each((i, el) => {
            form.optCategory.push($(el).attr('value'));
          });
          return this.post('https://clients.mindbodyonline.com/Report/Sales/SalesByRep/Generate?reportID=undefined', form);
        })
        .then((rsp) => {
          const sales = {};
          const $ = cheerio.load(rsp.body);
          $('table.result-table').each((i, el) => {
            parseTable($, $(el), sales);
          });
          resolve(sales);
        })
        .catch(err => reject(err));
    });
  }

  getSalesSoap(fromDate, toDate) {
    const req = this.initSoapRequest();
    req.XMLDetail = 'Full';
    req.StartSaleDateTime = fromDate.toISOString();
    req.EndSaleDateTime = toDate.toISOString();

    return new Promise((resolve, reject) => {
      console.log('Getting sales via soap from:', fromDate.toISOString(), 'to:', toDate.toISOString());
      this.soapReq('GetSales', 'GetSalesResult', req)
        .then((result) => {
          if (result.Sales) {
            let sales = result.Sales.Sale.filter(s => s.Payments !== null);
            sales = sales.map((sale) => {
              /* eslint-disable */
              sale.ID = Number(sale.ID);
              sale.Payments = sale.Payments.Payment.map((payment) => {
                payment.ID = Number(payment.ID);
                payment.Amount = parseFloat(payment.Amount);
                return payment;
              });
              /* eslint-enable */
              return sale;
            });
            resolve({ sales, countTotal: result.ResultCount, pagesTotal: result.TotalPageCount });
          } else {
            resolve([]);
          }
        })
        .catch(err => reject(err));
    });
  }

  getSaleUnits(saleId) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_voidedit.asp?saleno=${saleId}`)
        .then((rsp) => {
          const units = [];
          const $ = cheerio.load(rsp.body);

          $('table.adyenClass tr').each((_, tr) => {
            const tds = $(tr).children('td').map((__, td) => $(td));
            const text = tds[0].text();
            const a = tds[0].find('a');
            const unit = {
              name: tds[0].find('b').text().trim(),
              id: 0
            };
            if (tds.length !== 4 || !text.includes('Item:')) return;

            if (a.length > 0) {
              unit.id = Number($(a).attr('href').match(/Id=([0-9]+)/)[1]);
              unit.type = 'product';
            } else {
              unit.type = text.includes('Gift Card') ? 'gift_card' : 'service';
              const unitA = tds[tds.length - 1].find('a');
              if (unitA.length > 0) {
                const href = unitA.attr('href');
                if (href.includes('saleno')) {
                  // Returned item, go to the original sale
                  const parsedHref = href.match(/.*saleno=([0-9]+)/);
                  if (parsedHref.length > 0) {
                    return units.push(this.getSaleUnits(Number(href[1])));
                  }
                } else {
                  const parsedHref = href.match(/.*doRefund\([0-9]+.([0-9]+).*/);
                  if (parsedHref && parsedHref.length > 0) {
                    unit.id = Number(parsedHref[1]);
                  }
                }
              }
            }
            units.push(Promise.resolve(unit));
          });
          return Promise.all(units);
        })
        .then((units) => {
          resolve({ units });
        })
        .catch(err => reject(err));
    });
  }

  getSales(fromDate, toDate) {
    return new Promise((resolve, reject) => {
      Promise.all([this.getSalesSoap(fromDate, toDate), this.getRepSales(fromDate, toDate)])
        .then((result) => {
          const sales = [];
          if (result[0].sales) {
            result[0].sales.forEach((sale) => {
              if (!result[1][Number(sale.ID)]) {
                console.log(`Sale ${sale.ID} was not found`, fromDate, toDate);
              } else {
                sales.push(Object.assign(result[1][Number(sale.ID)], sale));
              }
            });
          }
          resolve({
            sales,
            countTotal: result[0].ResultCount,
            pagesTotal: result[0].TotalPageCount
          });
        })
        .catch(err => reject(err));
    });
  }
}
