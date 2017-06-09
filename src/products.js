import MindbodyBase from './base'

let prodIdRegex = new RegExp(/.*id=([0-9]+).*/, 'i')

export default class Products extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, cookieJar) {
    super(null, siteId, username, password, sourceName, apiToken, cookieJar)
  }

  getCategories () {
    console.log('Running report adm_rpt_inv for revenue categories')
    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp')
        .then(rsp => {
          let categories = []
          let $ = this._parse(rsp.body)
          $('select[name=optCat] option').each((i, elem) => {
            if ($(elem).attr('value') !== '0') {
              categories.push({
                'name': $(elem).text(),
                'id': parseInt($(elem).attr('value'))
              })
            }
          })
          resolve({categories: categories})
        })
        .catch(err => reject(err))
    })
  }

  getProduct (productId) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/productmanagement/editproduct?descriptionId=${productId}`)
        .then(rsp => {
          let $ = this._parse(rsp.body)
          let supplier = $('#SelectedProductSuppliersId option:selected')
          let revenueCategory = $('#PrimaryCategoryId option:selected')
          resolve({
            'id': productId,
            'name': $('#ProductName').attr('value'),
            'cost': Number($('#WholesaleCost').attr('value')),
            'retail': Number($('#ProductPrice').attr('value')),
            'supplierName': supplier ? supplier.text() : null,
            'supplierId': parseInt(supplier ? supplier.attr('value') : 0),
            'revenueCategoryName': revenueCategory ? revenueCategory.text() : null,
            'revenueCategoryId': parseInt(revenueCategory ? revenueCategory.attr('value') : 0)
          })
        })
        .catch(err => reject(err))
    })
  }

  getAllProducts (category, invDate) {
    console.log(`Running report adm_rpt_inv for product category id ${category.id}`)

    let form = {
      'CSRFToken': '',
      'reportUrl': '/ASP/adm/adm_rpt_inv.asp',
      'category': category.name,
      'frmGenReport': 'true',
      'frmExpReport': 'false',
      'updateInv': 'false',
      'optLoc': '0',
      'optSupplier': '0',
      'optCat': category.id,
      'inventoryOnDate': `${invDate.getFullYear()}-${invDate.getMonth() + 1}-${invDate.getDate()}`,
      'optSortBy': '0',
      'optIncludeNoInvProd': 'on',
      'optIncludeDisc': 'on',
      'optIncludeNeg': 'on',
      'CurrentPage': '1',
      'FrmSubmit': ''
    }

    // First get CSRF Token
    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp')
        .then(rsp => {
          let $ = this._parse(rsp.body)
          form.CSRFToken = $('input[name=CSRFToken]').attr('value')
          return this.post('https://clients.mindbodyonline.com/ASP/adm/adm_rpt_inv.asp', form)
        })
        .then(rsp => {
          let products = []
          let $ = this._parse(rsp.body)
          $('#resultsTable1 .rows').each((i, elem) => {
            let tds = $(elem).find('td')
            let match = prodIdRegex.exec($(tds[2]).find('a').attr('href'))

            if (match) {
              let costTd = 9
              let retailTd = 10
              // Depending on the site the report might show an extra td for 'Online Pending Order'
              if (tds.length === 14) {
                costTd = 10
                retailTd = 11
              }

              products.push({
                'ID': parseInt(match[1]),
                'Name': $(tds[2]).text().trim(),
                'Supplier': $(tds[4]).text().trim(),
                'Location': $(tds[7]).text().trim(),
                'Cost': Number($(tds[costTd]).text().replace(/[^0-9\\.]+/g, '')),
                'Retail': Number($(tds[retailTd]).text().replace(/[^0-9\\.]+/g, ''))
              })
            }
          })
          resolve({products: products})
        })
        .catch(err => reject(err))
    })
  }

  getAllSuppliers () {
    console.log('Running report adm_tlbx_prod_sup for suppliers')
    return new Promise((resolve, reject) => {
      this.get('https://clients.mindbodyonline.com/asp/adm/adm_tlbx_prod_sup.asp')
        .then(rsp => {
          let suppliers = []
          let $ = this._parse(rsp.body)
          $('select[name=optSupplier] option').each((i, elem) => {
            let supplierId = parseInt($(elem).attr('value'))
            if (supplierId !== 0) {
              suppliers.push({
                'id': $(elem).attr('value'),
                'name': $(elem).text().trim()
              })
            }
          })
          resolve({suppliers: suppliers})
        })
        .catch(err => reject(err))
    })
  }
}
