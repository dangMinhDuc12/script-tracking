const dbProd = require('./db');
const redis = require('redis');
const schedule = require('node-schedule');
const _ = require('lodash');
const moment = require('moment');

schedule.scheduleJob('* * * * *', async () => {
  const currentTime = moment().format('DD/MM/YYYY HH:mm:ss');
  console.log({ currentTime });

  const redisProd = await redis
    .createClient({
      socket: {
        host: 'redis-insurance-prod-001.wlfeey.0001.apse1.cache.amazonaws.com',
        port: 6379,
      },
    })
    .connect();

  const keyLoginWrongPti = await redisProd.get('num_login_wrong:pti');
  const keyLoginWrongKenhBanPti = await redisProd.get('num_login_wrong:kenhban.pti');

  console.log({ keyLoginWrongPti, keyLoginWrongKenhBanPti });

  if (keyLoginWrongPti || keyLoginWrongKenhBanPti) {
    console.log('have lock key');
    await Promise.all([
      redisProd.del('num_login_wrong:pti'),
      redisProd.del('num_login_wrong:kenhban.pti'),
    ]);
  }

  const getUserPtiInfo = await dbProd.query(`
      SELECT status, primary_uname
      FROM sso.user
      WHERE primary_uname = 'pti' OR primary_uname = 'kenhban.pti'
  
  `);

  const userPtiInfo = _.get(getUserPtiInfo, 'rows');

  const checkLock = userPtiInfo.some((ui) => {
    return ui.status === 'locked';
  });

  console.log({ checkLock, userPtiInfo });
  if (checkLock) {
    await dbProd.query(`
      UPDATE sso.user
      SET
        status = 'active'
      WHERE primary_uname = 'pti' OR primary_uname = 'kenhban.pti'
  `);
  }
});
