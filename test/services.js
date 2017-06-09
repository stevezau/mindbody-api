import MBService from '../src/services'
import config from './index'
import chai from 'chai'

const assert = chai.assert
const cli = new MBService(config.id, config.username, config.password, config.sourceName, config.apiToken, config.jar)

let expect = chai.expect

describe('MindBody Services', function () {
  it('should return services', function (done) {
    cli.login()
      .then(() => cli.getAllServices())
      .then(({services}) => {
        assert.lengthOf(services, 5)
        done()
      })
      .catch(err => done(err))
  })

  it('should enrich services', function (done) {
    cli.login()
      .then(() => cli.getAllServices())
      .then(({services}) => {
        return cli.enrichService(services[0])
      })
      .then(service => {
        done()
      })
      .catch(err => done(err))
  })
})
