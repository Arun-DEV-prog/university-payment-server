require("dotenv").config();
const express = require("express");
const SSLCommerzPayment = require("sslcommerz-lts");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("🎓 University Payment API is running.");
});

// Environment variables
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b5csq0d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; // Set to true in production

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("university_payment");
    const paymentCollection = db.collection("student_payment_info");

    // Save local payment info (optional route)
    app.post("/payments", async (req, res) => {
      try {
        const doc = req.body;
        const result = await paymentCollection.insertOne(doc);
        res.status(200).send(result);
      } catch (err) {
        console.error("❌ /payments error:", err);
        res.status(500).send({ message: "Failed to save payment" });
      }
    });

    // Initialize payment with SSLCommerz
    app.post("/order", async (req, res) => {
      try {
        const {
          studentId,
          studentName,
          studentEmail,
          semester,
          amount,
          breakdown,
        } = req.body;

        if (!studentId || !studentName || !studentEmail || !amount) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        const transactionId = new ObjectId().toString();

        const paymentDoc = {
          transactionId,
          studentId,
          studentName,
          studentEmail,
          semester,
          amount,
          breakdown,
          status: "Pending",
          createdAt: new Date(),
        };

        await paymentCollection.insertOne(paymentDoc);

        const data = {
          total_amount: amount,
          currency: "BDT",
          tran_id: transactionId,
          success_url: `http://localhost:3000/payment/success?tran_id=${transactionId}`,
          fail_url: `http://localhost:3000/payment/fail?tran_id=${transactionId}`,
          cancel_url: `http://localhost:3000/payment/cancel?tran_id=${transactionId}`,
          ipn_url: `http://localhost:3000/payment/ipn`,
          shipping_method: "No Shipping",
          product_name: "Semester Fees",
          product_category: "Education",
          product_profile: "general",
          cus_name: studentName,
          cus_email: studentEmail,
          cus_add1: "Dhaka",
          cus_add2: "Bangladesh",
          cus_city: "Dhaka",
          cus_state: "Dhaka",
          cus_postcode: "1000",
          cus_country: "Bangladesh",
          cus_phone: "01700000000",
          cus_fax: "01700000000",
          ship_name: studentName,
          ship_add1: "Dhaka",
          ship_add2: "Bangladesh",
          ship_city: "Dhaka",
          ship_state: "Dhaka",
          ship_postcode: 1000,
          ship_country: "Bangladesh",
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        if (apiResponse?.GatewayPageURL) {
          res.send({ url: apiResponse.GatewayPageURL });
        } else {
          res.status(500).send({ message: "SSLCommerz session failed" });
        }
      } catch (err) {
        console.error("❌ /order error:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Payment Success
    app.post("/payment/success", async (req, res) => {
      const { tran_id } = req.query;
      try {
        await paymentCollection.updateOne(
          { transactionId: tran_id },
          { $set: { status: "Paid" } }
        );
        res.redirect(`http://localhost:5173/success?tran_id=${tran_id}`);
      } catch (err) {
        console.error("❌ Success update error:", err);
        res.status(500).send("Update error");
      }
    });

    // Payment Fail
    app.post("/payment/fail", async (req, res) => {
      const { tran_id } = req.query;
      try {
        await paymentCollection.updateOne(
          { transactionId: tran_id },
          { $set: { status: "Failed" } }
        );
        res.redirect(`http://localhost:5173/fail?tran_id=${tran_id}`);
      } catch (err) {
        console.error("❌ Fail update error:", err);
        res.status(500).send("Update error");
      }
    });

    // Payment Cancel
    app.post("/payment/cancel", async (req, res) => {
      const { tran_id } = req.query;
      try {
        await paymentCollection.updateOne(
          { transactionId: tran_id },
          { $set: { status: "Cancelled" } }
        );
        res.redirect(`http://localhost:5173/cancel?tran_id=${tran_id}`);
      } catch (err) {
        console.error("❌ Cancel update error:", err);
        res.status(500).send("Update error");
      }
    });

    // IPN Listener (Optional)
    app.post("/payment/ipn", async (req, res) => {
      const { tran_id, status } = req.body;
      try {
        await paymentCollection.updateOne(
          { transactionId: tran_id },
          { $set: { status: status || "IPN Received" } }
        );
        res.status(200).send("IPN handled");
      } catch (err) {
        console.error("❌ IPN error:", err);
        res.status(500).send("IPN update failed");
      }
    });

    // Optional: get all payments
    app.get("/payments", async (req, res) => {
      try {
        const payments = await paymentCollection.find().toArray();
        res.send(payments);
      } catch (err) {
        console.error("❌ Get payments error:", err);
        res.status(500).send("Failed to fetch payments");
      }
    });

    app.get("/invoice/:tran_id", async (req, res) => {
      const { tran_id } = req.params;
      try {
        const invoice = await client
          .db("university_payment")
          .collection("student_payment_info")
          .findOne({ transactionId: tran_id });

        if (!invoice) {
          return res.status(404).send({ message: "Invoice not found" });
        }

        res.send(invoice);
      } catch (err) {
        console.error("❌ Invoice fetch error:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running at: http://localhost:${port}`);
});
