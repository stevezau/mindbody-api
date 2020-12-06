import cheerio from 'cheerio';
import MindbodyBase from './base';

const prodIdRegex = new RegExp(/.*id=([0-9]+).*/, 'i');

export default class Products extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiKey, cookieJar) {
    super(null, siteId, username, password, sourceName, apiKey, cookieJar);
  }

  async getCategories() {
    console.log('Running report adm_rpt_inv for revenue categories');

    const rsp = await this.webGet('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp');
    const categories = [];
    const $ = cheerio.load(rsp.data);
    $('select[name=optCat] option').each((i, elem) => {
      if ($(elem).attr('value') !== '0') {
        categories.push({
          name: $(elem).text(),
          id: Number($(elem).attr('value'))
        });
      }
    });

    return categories;
  }

  async getProduct(productId) {
    const rsp = await this.webGet(`https://clients.mindbodyonline.com/productmanagement/editproduct?descriptionId=${productId}`);

    const $ = cheerio.load(rsp.data);
    const supplier = $('#SelectedProductSuppliersId option:selected');
    const revenueCategory = $('#PrimaryCategoryId option:selected');

    return {
      ID: productId,
      Name: $('#ProductName').attr('value').trim(),
      Cost: Number($('#WholesaleCost').attr('value')),
      Retail: Number($('#ProductPrice').attr('value')),
      Supplier: supplier ? supplier.text().trim() : null,
      SupplierId: Number(supplier ? supplier.attr('value') : 0),
      RevenueCategoryName: revenueCategory ? revenueCategory.text().trim() : null,
      RevenueCategoryId: Number(revenueCategory ? revenueCategory.attr('value') : 0)
    };
  }

  async getAllProducts(category, invDate) {
    console.log(`Running report adm_rpt_inv for product category id ${category.id}`);

    const form = {
      CSRFToken: '',
      reportUrl: '/ASP/adm/adm_rpt_inv.asp',
      category: category.name || '',
      frmGenReport: 'true',
      frmExpReport: 'false',
      updateInv: 'false',
      optLoc: '0',
      optSupplier: '0',
      optCat: category.id,
      inventoryOnDate: `${invDate.getFullYear()}-${invDate.getMonth() + 1}-${invDate.getDate()}`,
      optSortBy: '0',
      optIncludeNoInvProd: 'on',
      optIncludeDisc: 'on',
      optIncludeNeg: 'on',
      CurrentPage: '1',
      FrmSubmit: ''
    };

    let rsp = await this.webGet('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp');
    let $ = cheerio.load(rsp.data);
    form.CSRFToken = $('input[name=CSRFToken]').attr('value');
    rsp = await this.webPost('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp', form);

    const products = [];
    $ = cheerio.load(rsp.data);

    $('#resultsTable1 .rows').each((i, elem) => {
      const tds = $(elem).find('td');
      const match = prodIdRegex.exec($(tds[2]).find('a').attr('href'));

      if (match) {
        let costTd = 9;
        let retailTd = 10;
        // Depending on the site the report might show an extra td for 'Online Pending Order'
        if (tds.length === 14) {
          costTd = 10;
          retailTd = 11;
        }

        products.push({
          ID: Number(match[1]),
          Name: $(tds[2]).text().trim(),
          Supplier: $(tds[4]).text().trim(),
          Location: $(tds[7]).text().trim(),
          Cost: Number($(tds[costTd]).text().replace(/[^0-9\\.]+/g, '')),
          Retail: Number($(tds[retailTd]).text().replace(/[^0-9\\.]+/g, ''))
        });
      }
    });

    return products;
  }

  async getAllSuppliers() {
    console.log('Running report adm_tlbx_prod_sup for suppliers');
    const rsp = await this.webGet('https://clients.mindbodyonline.com/asp/adm/adm_tlbx_prod_sup.asp');
    const suppliers = [];
    const $ = cheerio.load(rsp.data);
    $('select[name=optSupplier] option').each((i, elem) => {
      const supplierId = Number($(elem).attr('value'));
      if (supplierId !== 0) {
        suppliers.push({
          id: $(elem).attr('value'),
          name: $(elem).text().trim()
        });
      }
    });

    return suppliers;
  }
}
