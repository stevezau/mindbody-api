import MindbodyBase from './base';

const serviceRegex = new RegExp(/var jsonModel = JSON.parse\("(.+?)"\);/, 'i');

function findById(service, keyType, keyId, value) {
  service[keyType].forEach((item) => {
    if (item[keyId] === value) {
      return item;
    }
  });
}

export default class Services extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiToken, cookieJar) {
    super('Sale', siteId, username, password, sourceName, apiToken, cookieJar);
  }

  getAllServices(fields) {
    const req = this.initSoapRequest();
    req.XMLDetail = fields ? 'Basic' : 'Full';
    req.Fields = fields.map(value => ({ string: value }));

    return new Promise((resolve, reject) => {
      this.soapReq('GetServices', 'GetServicesResult', req)
        .then((result) => {
          if (result.Services) {
            resolve({
              services: result.Services.Service,
              countTotal: result.ResultCount,
              pagesTotal: result.TotalPageCount
            });
          } else {
            resolve([]);
          }
        })
        .catch(err => reject(err));
    });
  }

  enrichService(service) {
    return new Promise((resolve, reject) => {
      this.get(`https://clients.mindbodyonline.com/AddEditPricingOption/Edit?Id=${service.ID}`)
        .then((rsp) => {
          console.log(`Enriching ${service.Name}:${service.ID}`);
          const serviceJSON = JSON.parse(serviceRegex.exec(rsp.body)[1].replace(/\\/g, ''));

          service.AppointmentType = {}; // eslint-disable-line
          if (serviceJSON.SelectedAppointmentTypes) {
            const apptType = findById(serviceJSON, 'AvailableAppointmentTypes', 'AppointmentTypeId', serviceJSON.SelectedAppointmentTypes[0]);
            service.AppointmentType.ID = apptType ? apptType.AppointmentTypeId : null; // eslint-disable-line
            service.AppointmentType.Name = apptType ? apptType.AppointmentTypeDisplayName : null; // eslint-disable-line
          }

          const serviceType = findById(serviceJSON, 'AvailableServiceTypes', 'ServiceTypeId', serviceJSON.SelectedServiceType);
          service.Type = { // eslint-disable-line
            Name: serviceType.ServiceTypeDisplayName,
            ID: serviceType.ServiceTypeId
          };

          const serviceCategory = findById(serviceJSON, 'AvailableServiceCategories', 'ServiceCategoryId', serviceJSON.SelectedServiceCategory);
          service.ServiceCategory = { // eslint-disable-line
            Name: serviceCategory.ServiceCategoryDisplayName,
            ID: serviceCategory.ServiceCategoryId
          };

          const revenueCategory = findById(serviceJSON, 'AvailableRevenueCategories', 'RevenueCategoryId', serviceJSON.SelectedRevenueCategory);
          service.RevenueCategory = { // eslint-disable-line
            Name: revenueCategory ? revenueCategory.RevenueCategoryName : null,
            ID: revenueCategory ? revenueCategory.RevenueCategoryId : null
          };
          resolve(service);
        })
        .catch(err => reject(err));
    });
  }
}
