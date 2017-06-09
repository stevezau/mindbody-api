import MindbodyBase from './base'

let serviceRegex = new RegExp(/var jsonModel = JSON.parse\("(.+?)"\);/, 'i')

function findById (service, keyType, keyId, value) {
  for (let item of service[keyType]) {
    if (item[keyId] === value) {
      return item
    }
  }
}

export default class Services extends MindbodyBase {
  constructor (siteId, username, password, sourceName, apiToken, cookieJar) {
    super('Sale', siteId, username, password, sourceName, apiToken, cookieJar)
  }

  getAllServices (fields) {
    let req = this._initSoapRequest()
    req.XMLDetail = fields ? 'Basic' : 'Full'
    req.Fields = this._soapArray(fields, 'string')

    return new Promise((resolve, reject) => {
      this._soapReq('GetServices', 'GetServicesResult', req)
        .then(result => {
          if (result.Services) {
            resolve({
              services: result.Services.Service,
              countTotal: result.ResultCount,
              pagesTotal: result.TotalPageCount
            })
          } else {
            resolve([])
          }
        })
        .catch(err => reject(err))
    })
  }

  enrichService (service) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/AddEditPricingOption/Edit?Id=${service.ID}`)
        .then((rsp) => {
          console.log(`Enriching ${service.Name}:${service.ID}`)
          let serviceJSON = JSON.parse(serviceRegex.exec(rsp.body)[1].replace(/\\/g, ''))

          service.AppointmentType = {}
          if (serviceJSON.SelectedAppointmentTypes) {
            const apptType = findById(serviceJSON, 'AvailableAppointmentTypes', 'AppointmentTypeId', serviceJSON.SelectedAppointmentTypes[0])
            service.AppointmentType.ID = apptType ? apptType['AppointmentTypeId'] : null
            service.AppointmentType.Name = apptType ? apptType['AppointmentTypeDisplayName'] : null
          }

          const serviceType = findById(serviceJSON, 'AvailableServiceTypes', 'ServiceTypeId', serviceJSON.SelectedServiceType)
          service.Type = {
            Name: serviceType.ServiceTypeDisplayName,
            ID: serviceType.ServiceTypeId
          }

          const serviceCategory = findById(serviceJSON, 'AvailableServiceCategories', 'ServiceCategoryId', serviceJSON.SelectedServiceCategory)
          service.ServiceCategory = {
            Name: serviceCategory['ServiceCategoryDisplayName'],
            ID: serviceCategory['ServiceCategoryId']
          }

          const revenueCategory = findById(serviceJSON, 'AvailableRevenueCategories', 'RevenueCategoryId', serviceJSON.SelectedRevenueCategory)
          service.RevenueCategory = {
            Name: revenueCategory ? revenueCategory.RevenueCategoryName : null,
            ID: revenueCategory ? revenueCategory.RevenueCategoryId : null
          }
          resolve(service)
        })
        .catch(err => reject(err))
    })
  }
}
