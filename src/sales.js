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
  constructor(siteId, username, password, sourceName, apiKey, cookieJar, timezone) {
    super('Sale', siteId, username, password, sourceName, apiKey, cookieJar);
    this.timezone = timezone;
  }

  async getSalesWeb(fromDate, toDate) {
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

    console.log('Running SalesWeb from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd);
    let rsp = await this.webGet('https://clients.mindbodyonline.com/Report/Sales/Sales');
    let $ = cheerio.load(rsp.data);
    $('#optSaleLoc option').each((i, el) => form.optSaleLoc.push($(el).attr('value')));
    $('#optHomeStudio option').each((i, el) => form.optHomeStudio.push($(el).attr('value')));
    $('#optPayMethod option').each((i, el) => form.optPayMethod.push($(el).attr('value')));

    rsp = await this.webGet('https://clients.mindbodyonline.com/Ajax/GetCategoriesByType');
    $ = cheerio.load(rsp.data);
    $('option').each((i, el) => {
      form.optCategory.push($(el).attr('value'));
    });
    rsp = await this.webPost('https://clients.mindbodyonline.com/Report/Sales/Sales/Generate?reportID=undefined', form);

    const sales = {};
    $ = cheerio.load(rsp.data);
    $('table.result-table').each((i, el) => {
      parseTable($, $(el), sales);
    });
    return sales;
  }

  async getRepSales(fromDate, toDate) {
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

    console.log('Running SalesByRep from:', form.requiredtxtDateStart, 'to:', form.requiredtxtDateEnd);
    let rsp = await this.webGet('https://clients.mindbodyonline.com/Report/Sales/SalesByRep');
    let $ = cheerio.load(rsp.data);
    $('#optSaleLoc option').each((i, el) => {
      form.optSaleLoc.push($(el).attr('value'));
    });

    rsp = await this.webGet('https://clients.mindbodyonline.com/Ajax/GetCategoriesByType');
    $ = cheerio.load(rsp.data);
    $('option').each((i, el) => {
      form.optCategory.push($(el).attr('value'));
    });
    rsp = await this.webPost('https://clients.mindbodyonline.com/Report/Sales/SalesByRep/Generate?reportID=undefined', form);
    const sales = {};
    $ = cheerio.load(rsp.data);

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
    return sales;
  }

  async getSalesAPI(fromDate, toDate) {
    const data = await this.apiRequest('sale/sales', 'Sales', {
      method: 'get',
      params: {
        StartSaleDateTime: fromDate.toISOString(),
        EndSaleDateTime: toDate.toISOString()
      }
    });

    const sales = {};
    data.filter(s => s.Payments !== null).forEach((s) => {
      const sale = { ...s };
      sale.ID = Number(s.Id);
      sale.ClientID = Number(s.ClientId);
      sale.Payments = s.Payments.map((p) => {
        const payment = { ...p };
        payment.ID = Number(p.Id);
        payment.Amount = parseFloat(p.Amount);
        return payment;
      });
      sale.SaleDate = moment.tz(sale.SaleDate, this.timezone);
      sale.SaleDateTime = moment.tz(sale.SaleDateTime, this.timezone);
      sales[sale.ID] = sale;
    });

    return sales;
  }

  async getSaleUnits(saleId) {
    const rsp = await this.webGet(`https://clients.mindbodyonline.com/ASP/adm/adm_tlbx_voidedit.asp?saleno=${saleId}`);
    const units = [];
    const $ = cheerio.load(rsp.data);

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

    return await Promise.all(units);
  }

  async getSales(fromDate, toDate) {
    const getData = [
      this.getSalesWeb(fromDate, toDate),
      this.getSalesAPI(fromDate, toDate),
      this.getRepSales(fromDate, toDate)
    ];

    const result = await Promise.all(getData);
    const webSales = result[0];
    const apiSales = result[1] || {};
    const repSales = result[2];
    const sales = [];

    Object.values(webSales).forEach((s) => {
      const sale = { ...s };
      if (!apiSales[sale.ID]) {
        console.log(`Sale ${sale.ID} was not found in API`, fromDate, toDate);
      } else {
        sale.Rep = repSales[sale.ID] || 'Unknown Staff';
        sales.push(Object.assign(apiSales[Number(sale.ID)], sale));
      }
    });

    return sales;
  }
}
