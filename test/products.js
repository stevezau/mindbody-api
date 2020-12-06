import MBProducts from '../src/products';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const expect = chai.expect;

const cli = new MBProducts(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

describe('MindBody Products', () => {
  it('should return products categories', (done) => {
    cli.getCategories()
      .then((categories) => {
        assert.isAbove(categories.length, 3);
        expect(categories[0]).to.deep.equal({ id: 99999, name: 'Not Assigned' });
        done();
      })
      .catch(err => done(err));
  });

  it('should return product id 1237', (done) => {
    cli.getProduct(1237)
      .then((product) => {
        expect(product.ID).to.be.a('number');
        expect(product.Cost).to.be.a('number');
        expect(product.Retail).to.be.a('number');
        expect(product.SupplierId).to.be.a('number');
        expect(product.RevenueCategoryId).to.be.a('number');
        expect(product.Name).to.be.a('string');
        expect(product.Supplier).to.be.a('string');
        expect(product.RevenueCategoryName).to.be.a('string');
        done();
      })
      .catch(err => done(err));
  });

  it('should webGet all products for category 99999', (done) => {
    cli.getAllProducts({ id: 99999 }, new Date(Date.now()))
      .then((products) => {
        assert.isAbove(products.length, 10);
        const product = products[0];
        expect(product.ID).to.be.a('number');
        expect(product.Cost).to.be.a('number');
        expect(product.Retail).to.be.a('number');
        expect(product.Name).to.be.a('string');
        expect(product.Supplier).to.be.a('string');
        done();
      })
      .catch(err => done(err));
  });

  it('should webGet all suppliers', (done) => {
    cli.getAllSuppliers()
      .then((suppliers) => {
        assert.isAbove(suppliers.length, 5);
        assert.isNotEmpty(suppliers[0].id);
        assert.isNotEmpty(suppliers[0].name);
        done();
      })
      .catch(err => done(err));
  });
});
