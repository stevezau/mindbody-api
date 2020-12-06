// Mindbody Test Sandbox Site
// https://developers.mindbodyonline.com/Account/Credentials

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { FileCookieStore }  from 'tough-cookie-file-store';
import { CookieJar } from 'tough-cookie';

chai.use(chaiAsPromised);
chai.should();

export default {
  //'id': -99,
  id: process.env.MB_SITE,
  sourceName: process.env.MB_SOURCE_NAME,
  apiToken: process.env.MB_API_TOKEN,
  username: process.env.MB_USERNAME,
  password: process.env.MB_PASSWORD,
  jar: new CookieJar(new FileCookieStore('./cookies.json'))
};
