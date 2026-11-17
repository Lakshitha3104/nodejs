
require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Folder for uploaded PDF files
//const uploadFolder = path.join(__dirname, "uploads");
const uploadFolder = path.join("/tmp", "uploads");

// Create uploads folder if it does not exist
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

// Receive JSON data (Base64 PDF is larger than the original file)
app.use(express.json({ limit: "7mb" }));

// Display frontend files stored beside server.js
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "script.js"));
});

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
const client = mongoUri ? new MongoClient(mongoUri) : null;

let dbPromise;

async function getEmployeesCollection() {
    if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is missing");
    }

    if (!dbPromise) {
        dbPromise = client.connect().then(() => {
            console.log("MongoDB connected successfully!");
            return client.db("employeeDB").collection("employees");
        });
    }

    return dbPromise;
}

// Employee registration
app.post("/submit", async (req, res) => {
    let savedFilePath;

    try {
        const {
            name,
            dob,
            email,
            address,
            gender,
            qualification,
            languages,
            phone,
            resume
        } = req.body;

        if (
            !name || !dob || !email || !address ||
            !gender || !qualification || !phone ||
            !Array.isArray(languages) || languages.length === 0 ||
            typeof resume !== "string"
        ) {
            return res.status(400).json({
                message: "Please fill all required fields."
            });
        }

        const match = resume.match(
            /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/
        );

        if (!match) {
            return res.status(400).json({
                message: "Please upload a valid PDF file."
            });
        }

        const pdfBuffer = Buffer.from(match[1], "base64");

        if (
            pdfBuffer.length === 0 ||
            pdfBuffer.length > 5 * 1024 * 1024
        ) {
            return res.status(400).json({
                message: "PDF must be under 5MB."
            });
        }

        if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
            return res.status(400).json({
                message: "The uploaded file is not a valid PDF."
            });
        }

        const uniqueName =
            `${Date.now()}-${crypto.randomUUID()}.pdf`;

        savedFilePath = path.join(uploadFolder, uniqueName);

        await fs.promises.writeFile(savedFilePath, pdfBuffer, {
            flag: "wx"
        });

        const employees = await getEmployeesCollection();

        const employeeData = {
            name,
            dob,
            email,
            address,
            gender,
            qualification,
            languages,
            phone,
            resume: uniqueName,
            createdAt: new Date()
        };

        const result = await employees.insertOne(employeeData);

        console.log("Employee inserted:", result.insertedId);

        return res.status(201).json({
            message: "Employee registered successfully!",
            employeeId: result.insertedId
        });

    } catch (error) {
        console.error("Submission error:", error);

        if (savedFilePath) {
            try {
                await fs.promises.unlink(savedFilePath);
            } catch (deleteError) {
                console.error("PDF cleanup error:", deleteError);
            }
        }

        return res.status(500).json({
            message: "Error saving employee details."
        });
    }
});

// Export Express app for Vercel
module.exports = app;
