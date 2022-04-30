import express, { json } from "express";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import cors from "cors";
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
    console.log("\nPost request to \"/participants\" received:", body, "\n");

    const participantsSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantsSchema.validate(body);
    if (validation.error) {
        console.log(chalk.red.bold("\nError: "), validation.error.details, "\n");
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        const participantsCollection = db.collection("participants");

        const thereIsParticipant = await participantsCollection.findOne({ name: body.name });
        if (thereIsParticipant) {
            res.status(409).send("Name is already in use! Please, try a different one.");
            console.log(chalk.red.bold("\nError: user tried to use a name that already exists.\n"));
            return;
        }

        const participant = await participantsCollection.insertOne({
            ...body,
            lastStatus: Date.now()
        });

        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            from: body.name,
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
    console.log("Post request to \"/messages\" received\nBody: ", req.body, "\nHeader: ", req.headers, "\n");

    const bodyMessagesSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message')
    })

    const validation = bodyMessagesSchema.validate(body);
    if (validation.error) {
        console.log(chalk.red.bold("\nError: "), validation.error.details, "\n");
        res.status(422).send(validation.error.details);
        return;
    }

    try {
        const participantsCollection = db.collection("participants");
        const participantsList = await participantsCollection.find().toArray();
        const thereIsParticipant = participantsList.filter(participant => participant === headers.user);
        if (thereIsParticipant.length === 0) {
            res.status(422).send("User doesn't exists or was disconnected. Please, try logging in again.");
            return;
        }

        const messagesCollection = db.collection("messages");
        const now = dayjs();
        const message = await messagesCollection.insertOne({
            ...body,
            from: headers.user,
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
    console.log(`Get request to \"/messages/${limit}\" received.\nHeader: `, headers);
    try {
        const messagesCollection = db.collection("messages");
        const messagesList = await messagesCollection.find({
            $or: [
                { from: headers.user },
                { to: { $in: [headers.user, "Todos"] } }
            ]
        }).limit(parseInt(limit)).sort({ time: -1 }).toArray();

        res.status(200).send(messagesList.reverse());
    } catch (error) {
        res.status(500).send(error);
    }
});

app.post("/status", async (req, res) => {
    const { headers } = req;
    console.log("\nPost request to \"/status\" received:", headers, "\n");

    try {
        const participantsCollection = db.collection("participants");

        const thereIsParticipant = await participantsCollection.findOne({ name: headers.user });
        if (!thereIsParticipant) {
            res.status(404).send("User doesn't exists or was disconnected. Please, try logging in again.");
            console.log(chalk.red.bold("\nError: could not update status of user that does not exist.\n"));
            return;
        }

        const participantUpdated = await participantsCollection.updateOne(
            { name: headers.user },
            {
                $set: {
                    lastStatus: new Date.now()
                }
            }
        );

        // code stops here. Find out why later.

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