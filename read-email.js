const { google } = require('googleapis');
const fetch = require('node-fetch');

const express = require('express');

require('dotenv').config();

const app = express();

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN } = process.env;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

app.get('/test', async (req, res, next) => {
  const { token: accessTokenGmail } = await oAuth2Client.getAccessToken();

  const getListMsgMail = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/dangminhduca3@gmail.com/messages?q=from:VCBDigibank&maxResults=1`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessTokenGmail}`,
      },
    }
  );

  const listMsgMail = await getListMsgMail.json();

  const msgId = listMsgMail.messages[0].id;

  const getDetailMsg = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/dangminhduca3@gmail.com/messages/${msgId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessTokenGmail}`,
      },
    }
  );

  const detailMsg = await getDetailMsg.json();

  const base64Res = detailMsg.payload.body.data;

  const bodyRes = Buffer.from(base64Res, 'base64').toString('utf-8');

  return res.status(200).send({ bodyRes });
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
