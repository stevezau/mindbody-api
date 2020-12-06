import MindbodyBase from './base';

const serviceRegex = new RegExp(/var jsonModel = JSON.parse\("(.+?)"\);/, 'i');

function findById(service, keyType, keyId, value) {
  let found = null;
  service[keyType].forEach((item) => {
    if (item[keyId] === value) {
      found = item;
    }
  });
  return found;
}

export default class Services extends MindbodyBase {
  constructor(siteId, username, password, sourceName, apiKey, cookieJar) {
    super('Sale', siteId, username, password, sourceName, apiKey, cookieJar);
  }

  async getAllServices(fields = []) {
    return await this.apiRequest('sale/services', 'Services', {
      method: 'get',
    });
  }

  async enrichService(service) {
    const rsp = await this.webGet(`https://clients.mindbodyonline.com/AddEditPricingOption/Edit?Id=${service.Id}`);
    console.log(`Enriching ${service.Name}:${service.Id}`);
    const serviceJSON = JSON.parse(serviceRegex.exec(rsp.data)[1].replace(/\\/g, ''));

    service.AppointmentType = {}; // eslint-disable-line
    if (serviceJSON.SelectedAppointmentTypes) {
      const apptType = findById(serviceJSON, 'AvailableAppointmentTypes', 'AppointmentTypeId', serviceJSON.SelectedAppointmentTypes[0]);
      service.AppointmentType.Id = apptType ? apptType.AppointmentTypeId : null; // eslint-disable-line
      service.AppointmentType.Name = apptType ? apptType.AppointmentTypeDisplayName : null; // eslint-disable-line
    }

    const serviceType = findById(serviceJSON, 'AvailableServiceTypes', 'ServiceTypeId', serviceJSON.SelectedServiceType);
    service.Type = { // eslint-disable-line
      Name: serviceType.ServiceTypeDisplayName,
      ID: serviceType.ServiceTypeId
    };

    const serviceCategory = findById(serviceJSON, 'AvailableServiceCategories', 'ServiceCategoryId', serviceJSON.SelectedServiceCategory);
    service.ServiceCategory = { // eslint-disable-line
      Name: decodeURIComponent(JSON.parse(`"${serviceCategory.ServiceCategoryDisplayName.replace('u00', '\\u00')}"`)),
      ID: serviceCategory.ServiceCategoryId
    };

    const revenueCategory = findById(serviceJSON, 'AvailableRevenueCategories', 'RevenueCategoryId', serviceJSON.SelectedRevenueCategory);
    service.RevenueCategory = { // eslint-disable-line
      Name: revenueCategory ? revenueCategory.RevenueCategoryName : null,
      ID: revenueCategory ? revenueCategory.RevenueCategoryId : null
    };

    return service;
  }
}
