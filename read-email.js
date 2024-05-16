const { google } = require('googleapis');
const fetch = require('node-fetch');
const axios = require('axios');
const base64url = require('base64url');

const fs = require('fs');
const path = require('path');

const express = require('express');

require('dotenv').config();

const app = express();

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN } = process.env;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function saveAttachment(filename, data) {
  const buffer = base64url.toBuffer(data);
  fs.writeFileSync(path.join(__dirname, filename), buffer);
  console.log(`Attachment ${filename} saved.`);
}

app.get('/test', async (req, res, next) => {
  const { token: accessTokenGmail } = await oAuth2Client.getAccessToken();

  const getListMsgMail = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/dangminhduca3@gmail.com/messages?q=from:Duc Dang&maxResults=1`,
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

  const attachmentId = detailMsg.payload.parts[1].body.attachmentId;

  console.log({ attachmentId });

  const getAttachmentFile = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}
  `,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessTokenGmail}`,
      },
    }
  );

  const attachmentFileJson = await getAttachmentFile.json();

  await saveAttachment(detailMsg.payload.parts[1].filename, attachmentFileJson.data);

  return res.status(200).send(detailMsg);
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
