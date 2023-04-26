// ** What should the app do?**

//     1. The app should check for new emails in a given Gmail ID

//         < aside >
//     💡 You need to implement the “Login with google” API for this

//     </aside >

//     2. The app should send replies to Emails that have no prior replies

//         < aside >
//     💡 The app should identify and isolate the email threads in which no prior email has been sent by you.This means that the app should only reply to first time email threads sent by others to your mailbox.
//     The email that you send as a reply can have any content you’d like, it doesn’t matter.

//     </aside >

//     3. The app should add a Label to the email and move the email to the label

//         < aside >
//     💡 After sending the reply, the email should be tagged with a label in Gmail.Feel free to name the label anything.If the label is not created already, you’ll need to create it.
//     Use Google’s APIs to accomplish this

//     </aside >

//     4. The app should repeat this sequence of steps 1 - 3 in random intervals of 45 to 120 seconds

//code is given below

const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.labels'];

app.get('/', async (req, res) => {

    const credentials = await fs.readFile('credentials.json');

    const auth = await authenticate({
        keyfilePath: path.join(__dirname, 'credentials.json'),
        scopes: SCOPES,
    });

    console.log('this is auth = ', auth);

    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.labels.list({
        userId: 'me',
    });

    const LABEL_NAME = 'VACATION';

    //LOAD credentials from file

    async function loadCredentials() {
        const filepath = path.join(process.cwd(), 'credentials.json');
        const content = await fs.readFile(filepath, { encoding: 'utf8' });
        return JSON.parse(content);
    }


    //get messages that have no prior replies
    async function getunrepliedMessages(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: '-in:chats -from:me -has:userlabels',
        });
        return res.data.messages || [];
    }

    //send reply to the message
    async function sendReply(auth, message) {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From'],

        });
        const subject = res.data.payload.headers.find((header) => header.name === 'Subject').value;
        const from = res.data.payload.headers.find((header) => header.name === 'From').value;
        const replyTo = from.match(/<(.*)>/)[1];
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        const replybody = `Hi, \n\nI am on vacation. I will get back to you soon. \n\nRegards, \n Abhinav Pratap Singh`;
        const rawMessage = [
            `From: me`,
            `To: ${replyTo}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${message.id}`,
            `References: ${message.id}`,
            '',
            replybody,

        ].join(`\n`)
        const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
    }
    async function createLabel(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        try {
            const res = await gmail.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: LABEL_NAME,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show',
                },
            });
            return res.data;
        } catch (err) {
            if (err.code === 409) {
                const res = await gmail.users.labels.list({
                    userId: 'me',
                });
                const label = res.data.labels.find((label) => label.name === LABEL_NAME);
                return label.id;
            } else {
                throw err;
            }
        }
    }

    //add label to the message and move it to the label folder
    async function addLabel(auth, message, labelId) {
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: {
                addLabelIds: [labelId],
                removeLabelIds: ['INBOX'],
            },
        });
    }

    //main function
    async function main() {
        const labelId = await createLabel(auth);
        console.log(`Craeted or found with id ${labelId}`);

        //repeat following steps in random intervals of 45 to 120 seconds
        setInterval(async () => {
            const messages = await getunrepliedMessages(auth);
            console.log(`Found ${messages.length} messages`);
            for (const message of messages) {
                await sendReply(auth, message);
                console.log(`sent reply to message with id ${message.id}`);
                await addLabel(auth, message, labelId);
                console.log(`added label to message with id ${message.id}`);
            }
        }, Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000);
    }

    main().catch(console.error);


    const labels = response.data.labels;
    res.send("you have successfully subscribed to our service")
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});







