import MBProducts from '../src/products';
import config from './index';
import chai from 'chai';

const assert = chai.assert;
const cli = new MBProducts(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar);

const expect = chai.expect;

describe('MindBody Products', () => {
  it('should return products categories', (done) => {
    cli.getCategories()
      .then(({ categories }) => {
        assert.lengthOf(categories, 5);
        expect(categories[0]).to.deep.equal({ id: 99999, name: 'Not Assigned' });
        done();
      })
      .catch(err => done(err));
  });

  it('should return product id 1237', (done) => {
    cli.getProduct(1237)
      .then((product) => {
        expect(product).to.deep.equal({
          id: 1237,
          name: '500ml Pop',
          cost: 2.25,
          retail: 2.25,
          supplierName: 'Dillon',
          supplierId: 105,
          revenueCategoryName: 'Food/Drinks',
          revenueCategoryId: 32,
        });
        done();
      })
      .catch(err => done(err));
  });

  it('should get all products for category 32', (done) => {
    cli.getAllProducts(32, new Date(Date.now()))
      .then(({ products }) => {
        assert.isAbove(products.length, 10);
        expect(products[0]).to.deep.equal({
          Cost: 2.25,
          ID: 1237,
          Name: '500ml Pop',
          Retail: 2.25,
          Supplier: 'Dillon',
          Location: 'Clubville'
        });
        done();
      })
      .catch(err => done(err));
  });

  it('should get all suppliers', (done) => {
    cli.getAllSuppliers()
      .then(({ suppliers }) => {
        assert.isAbove(suppliers.length, 5);
        expect(suppliers[0]).to.deep.equal({
          id: '110',
          name: 'Adidas Co. LTD'
        });
        done();
      })
      .catch(err => done(err));
  });
});
