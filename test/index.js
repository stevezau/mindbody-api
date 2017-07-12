// Mindbody Test Sandbox Site
// https://developers.mindbodyonline.com/Account/Credentials

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import FileCookieStore from 'tough-cookie-filestore'

chai.use(chaiAsPromised)
chai.should()

export default {
  // 'id': -99,
  'id': 269087,
  'sourceName': process.env.MB_SOURCE_NAME,
  'apiToken': process.env.MB_API_TOKEN,
 // 'username': 'Siteowner',
 // 'password': 'apitest1234',
  'username': 'doguehq',
  'password': 'network242',
  'jar': new FileCookieStore('./cookies.json')
}
