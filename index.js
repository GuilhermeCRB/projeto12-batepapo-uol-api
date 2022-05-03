import express, { json } from "express";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import cors from "cors";
import { stripHtml } from "string-strip-html";
import dotenv from "dotenv";
import chalk from "chalk";

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

const dbName = process.env.DATABASE_NAME;
const mongoClient = new MongoClient(process.env.MONGO_URL);
mongoClient.connect();
const db = mongoClient.db(dbName);

console.log(chalk.green.bold(`\nConnection with database ${chalk.blue.bold(`${db.s.namespace}`)} stablished! \n`));

app.post("/participants", async (req, res) => {
    const { body } = req;
    const sanitizedBody = { ...body, name: stripHtml(body.name).result }

    console.log("\nPost request to \"/participants\" received:", body);
    console.log("Sanitized body request: ", sanitizedBody, "\n");

    const participantsSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantsSchema.validate(sanitizedBody);
    if (validation.error) {
        console.log(chalk.red.bold("\nError: "), validation.error.details, "\n");
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        const participantsCollection = db.collection("participants");

        const thereIsParticipant = await participantsCollection.findOne({ name: sanitizedBody.name });
        if (thereIsParticipant) {
            res.status(409).send("Name is already in use! Please, try a different one.");
            console.log(chalk.red.bold("\nError: user tried to use a name that already exists.\n"));
            return;
        }

        const participant = await participantsCollection.insertOne({
            ...sanitizedBody,
            lastStatus: Date.now()
        });

        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            from: sanitizedBody.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: now.format("HH:mm:ss")
        });

        res.status(201).send(participant);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get("/participants", async (req, res) => {
    console.log("Get request to \"/participants\" received");
    try {
        const participantsCollection = db.collection("participants");
        const participantsList = await participantsCollection.find().toArray();

        res.status(200).send(participantsList);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/messages", async (req, res) => {
    const { body } = req;
    const { headers } = req;
    const sanitizedBody = {
        ...body,
        to: stripHtml(body.to).result,
        text: stripHtml(body.text).result,
        type: stripHtml(body.type).result
    };
    const sanitizedHeaders = { ...headers, user: stripHtml(headers.user).result };

    console.log("Post request to \"/messages\" received\nBody: ", req.body, "\nHeader: ", req.headers);
    console.log("Sanitized body request: ", sanitizedBody, "\nSanitized headers request: ", sanitizedHeaders, "\n");

    const bodyMessagesSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message')
    })

    const validation = bodyMessagesSchema.validate(sanitizedBody);
    if (validation.error) {
        console.log(chalk.red.bold("\nError: "), validation.error.details, "\n");
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        const participantsCollection = db.collection("participants");
        const participantsList = await participantsCollection.find().toArray();
        const thereIsParticipant = participantsList.filter(participant => participant.name === sanitizedHeaders.user);
        if (thereIsParticipant.length === 0) {
            res.status(422).send("User doesn't exists or was disconnected. Please, try logging in again.");
            return;
        }

        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            ...sanitizedBody,
            from: sanitizedHeaders.user,
            time: now.format("HH:mm:ss")
        });

        res.status(201).send(message);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const { headers } = req;
    const sanitizedHeaders = { ...headers, user: stripHtml(headers.user).result };

    console.log(`Get request to \"/messages/${limit}\" received.\nHeader: `, headers);
    console.log("Sanitized headers request: ", sanitizedHeaders, "\n");

    try {
        const messagesCollection = db.collection("messages");
        const messagesList = await messagesCollection.find({
            $or: [
                { from: sanitizedHeaders.user },
                { to: { $in: [sanitizedHeaders.user, "Todos"] } }
            ]
        }).limit(parseInt(limit)).sort({ time: 1 }).toArray();

        res.status(200).send(messagesList);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const { ID_DA_MENSAGEM } = req.params;
    const { headers } = req;
    const sanitizedHeaders = { ...headers, user: stripHtml(headers.user).result };

    console.log(`Get request to \"/messages/${ID_DA_MENSAGEM}\" received.\nHeader: `, headers);
    console.log("Sanitized headers request: ", sanitizedHeaders, "\n");

    try {
        const messagesCollection = db.collection("messages");
        const messageToDelete = await messagesCollection.findOne({ _id: new ObjectId(ID_DA_MENSAGEM) });

        if(!messageToDelete){
            res.status(404).send("Message not found.");
            console.log(chalk.red.bold("\nError: could not find a message with the id sent by user.\n"));
            return;
        }

        if(messageToDelete.from !== headers.user){
            res.status(401).send("Message was not sent by user.");
            console.log(chalk.red.bold("\nError: user tryied to delete a message that was not sent by him.\n"));
            return;
        }

        await messagesCollection.deleteOne({ _id: new ObjectId(ID_DA_MENSAGEM) });

        res.status(200).send("Message deleted!");
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/status", async (req, res) => {
    const { headers } = req;
    const sanitizedHeaders = { ...headers, user: stripHtml(headers.user).result };

    console.log("\nPost request to \"/status\" received:", headers, "\n");
    console.log("Sanitized headers request: ", sanitizedHeaders, "\n");

    try {
        const participantsCollection = db.collection("participants");

        const thereIsParticipant = await participantsCollection.findOne({ name: sanitizedHeaders.user });
        if (!thereIsParticipant) {
            res.status(404).send("User doesn't exists or was disconnected. Please, try logging in again.");
            console.log(chalk.red.bold("\nError: could not update status of user that does not exist.\n"));
            return;
        }

        const participantUpdated = await participantsCollection.updateOne(
            { name: sanitizedHeaders.user },
            {
                $set: {
                    lastStatus: new Date.now()
                }
            }
        );

        // FIXME: code stops here. Find out why later.

        res.status(200).send(participantUpdated);
    } catch (error) {
        res.status(500).send(error);
    }
});

setInterval(udateUsersStatus, 15000);

function udateUsersStatus() {
    const now = Date.now();

    const messagesCollection = db.collection("messages");
    const participantsCollection = db.collection("participants");
    const promise = participantsCollection.find({ lastStatus: { $lt: now - 10000 } }).toArray();

    promise.then((removedParticipants) => {
        removedParticipants.forEach((removedParticipant) => {
            const id = removedParticipant._id;

            participantsCollection.deleteOne({ _id: new ObjectId(id) });
            const now = dayjs();
            messagesCollection.insertOne({
                from: removedParticipant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: now.format("HH:mm:ss")
            });
        });

        console.log("\nRemoved paticipants: ", removedParticipants, "\n")
    });
}

const port = process.env.PORT;
app.listen(port, () => console.log(chalk.white.bold.bgGreenBright(`\n Application is online, using port ${port}... \n`)));