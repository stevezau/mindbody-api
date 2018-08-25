import cheerio from 'cheerio';
import moment from 'moment-timezone';
import MindbodyBase from './base';

function parseTable($, table, sales) {
  let payMethod = table.children('caption').text().trim();

  // Reformat PayMethod
  const payFormat = payMethod.match(/\((.+?)-/);
  if (payFormat) {
    payMethod = payFormat[1]; // eslint-disable-line
  }


  // Figure out the col mappings
  const headers = Array.from(table.first('thead').find('th'));
  const findHeader = name => (
    headers.findIndex(h => $(h).text().trim().toLowerCase() === name.toLowerCase())
  );

  const index = {
    saleId: findHeader('Sale ID'),
    client: findHeader('Client'),
    item: findHeader('Item Name'),
    subtotal: findHeader('Subtotal (excluding tax)'),
    discountAmount: findHeader('Discount amount'),
    discountPercent: findHeader('Discount %'),
    tax: findHeader('Tax'),
    total: findHeader('Item Total'),
    paid: findHeader('Total Paid w/ Payment Method'),
    quantity: findHeader('Quantity'),
  };

  table.children('tbody').children('tr').each((i, tr) => {
    let tds = $(tr).children('td').map((_, td) => $(td));
    const saleId = Number($(tds[index.saleId]).text());
    if (Number.isNaN(saleId)) {
      return; // Probably html table thead
    }

    // Handle case where item name has a < > which causes issues with parsing via cheerio
    if (!$(tds[index.item]).text()) {
      const html = $(tr).html();
      const found = html.match(/(itemnameCell">)(.+)(<="" td="">)/);
      if (!found) return;
      const name = found[2].replace('=""', '').replace('<', '&lt;').replace('>', '&gt;');
      const parsed = cheerio.load(html.replace(found[0], `${found[1]}${name}</td>`), { decodeEntities: true });
      tds = parsed('td');
    }

    if (!sales[saleId]) {
      sales[saleId] = { ID: saleId, Units: [] }; // eslint-disable-line
    }
    const sale = sales[saleId];

    if (!sale.client) {
      const clientID = $(tds[index.client]).find('a').attr('href').match(/ID=([0-9]+)/);
      const clientArr = $(tds[index.client]).text().trim().split(',', 2);
      sale.Client = {
        ID: Number(clientID[1]),
        FirstName: (clientArr.length === 2 ? clientArr[1] : clientArr[0]).trim(),
        LastName: (clientArr.length === 2 ? clientArr[0] : '').trim()
      };
    }

    const dollarRegex = /[%$,]/g;

    sale.Units.push({
      Name: $(tds[index.item]).text().trim(),
      Quantity: Number($(tds[index.quantity]).text().trim()),
      Subtotal: parseFloat($(tds[index.subtotal]).text().replace(dollarRegex, '')),
      DiscountPercent: parseFloat($(tds[index.discountPercent]).text().replace(dollarRegex, '')),
      DiscountAmount: parseFloat($(tds[index.discountAmount]).text().replace(dollarRegex, '')),
      Tax: parseFloat($(tds[index.tax]).text().replace(dollarRegex, '')),
      Total: parseFloat($(tds[index.total]).text().replace(dollarRegex, '')),
      Paid: parseFloat($(tds[index.paid]).text().replace(dollarRegex, '')),
      Payment: payMethod,
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

  getSalesWeb(fromDate, toDate) {
    const form = {
      hPostAction: 'Generate',
      'sr-range-opt': '',
      'sr-name': '',
      autogenerate: 'hasGenerated',
      reportUrl: '/Report/Sales/Sales',
      category: 'Sales',
      requiredtxtDateStart: moment.tz(fromDate, this.timezone).format('YYYY/MM/DD'),
      requiredtxtDateEnd: moment.tz(toDate, this.timezone).format('YYYY/MM/DD'),
      optFilterTagged: 'false',
      optSaleLoc: [],
      optHomeStudio: [],
      optPayMethod: [],
      optCategory: [],
      optEmployee: '',
      optRep: '0',
      optIncludeAutoRenews: 'Include',
      optDisMode: 'Detail',
      optBasis: 'AccrualBasis',
      optIncludeReturns: 'true',
      optShowSupplier: 'false',
      quickDateSelectionTwo: ''
    };

    return new Promise((resolve, reject) => {
      console.log('Running SalesWeb from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd);
      this.get('https://clients.mindbodyonline.com/Report/Sales/Sales')
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          $('#optSaleLoc option').each((i, el) => form.optSaleLoc.push($(el).attr('value')));
          $('#optHomeStudio option').each((i, el) => form.optHomeStudio.push($(el).attr('value')));
          $('#optPayMethod option').each((i, el) => form.optPayMethod.push($(el).attr('value')));
          return this.get('https://clients.mindbodyonline.com/Ajax/GetCategoriesByType');
        })
        .then((rsp) => {
          const $ = cheerio.load(rsp.body);
          $('option').each((i, el) => {
            form.optCategory.push($(el).attr('value'));
          });
          return this.post('https://clients.mindbodyonline.com/Report/Sales/Sales/Generate?reportID=undefined', form);
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

          $('table.result-table').each((i, elem) => {
            const table = $(elem);
            const headers = Array.from(table.first('thead').find('th'));
            const saleIndex = headers.findIndex(h => $(h).text().trim().toLowerCase() === 'sale id');
            table.children('tbody').children('tr').each((_, tr) => {
              const tds = $(tr).children('td').map((idx, td) => $(td));
              const saleId = Number($(tds[saleIndex]).text());
              if (!Number.isNaN(saleId)) {
                let rep = table.children('caption').text().trim().split(',', 2);
                rep = (rep.length === 2 ? `${rep[1]} ${rep[0]}` : `${rep[0]}`).trim();
                sales[saleId] = rep;
              }
            });
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
          const sales = {};

          if (result.Sales) {
            result.Sales.Sale.filter(s => s.Payments !== null).forEach((s) => {
              const sale = { ...s };
              sale.ID = Number(s.ID);
              sale.ClientID = Number(s.ClientID);
              sale.Payments = s.Payments.Payment.map((p) => {
                const payment = { ...p };
                payment.ID = Number(p.ID);
                payment.Amount = parseFloat(p.Amount);
                return payment;
              });
              sales[s.ID] = sale;
            });
          }
          resolve({ sales, countTotal: result.ResultCount, pagesTotal: result.TotalPageCount });
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
      const getData = [
        this.getSalesWeb(fromDate, toDate),
        this.getSalesSoap(fromDate, toDate),
        this.getRepSales(fromDate, toDate)
      ];

      Promise.all(getData)
        .then((result) => {
          const webSales = result[0];
          const soapSales = result[1].sales || {};
          const repSales = result[2];
          const sales = [];

          Object.values(webSales).forEach((s) => {
            const sale = { ...s };
            if (!soapSales[sale.ID]) {
              console.log(`Sale ${sale.ID} was not found in SOAP`, fromDate, toDate);
            } else {
              sale.Rep = repSales[sale.ID] || 'Unknown Staff';
              sales.push(Object.assign(soapSales[Number(sale.ID)], sale));
            }
          });

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
