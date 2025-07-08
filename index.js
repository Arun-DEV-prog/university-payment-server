require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b5csq0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //       app.post("/artifacts", async (req, res) => {
    //   try {
    //     const artifact = req.body;
    //     const result = await artifactCollection.insertOne(artifact);
    //     res.status(200).send(result);
    //   } catch {
    //     res.status(500).send({ message: "Failed to create artifact" });
    //   }
    // });
    // const database = client.db("sample_mflix");
    // const movies = database.collection("movies");
    const studentsPaymentCollection = client
      .db("university_payment")
      .collection("student_payment_info");

    app.post("/payments", async (req, res) => {
      try {
        const doc = req.body;
        const result = await studentsPaymentCollection.insertOne(doc);
        res.status(200).send(result);
      } catch {
        res.status(500).send({ message: "Failed to payment" });
      }
    });

    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
