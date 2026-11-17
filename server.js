
require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// Folder for uploaded PDF files
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
const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
    try {
        await client.connect();

        console.log("MongoDB connected successfully!");

        const db = client.db("employeeDB");
        const employees = db.collection("employees");

        // Receive employee registration data
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

                // Check required fields
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

                // Check PDF data format
                const match = resume.match(
                    /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/
                );

                if (!match) {
                    return res.status(400).json({
                        message: "Please upload a valid PDF file."
                    });
                }

                // Convert Base64 into a PDF Buffer
                const pdfBuffer = Buffer.from(match[1], "base64");

                // Check file size (maximum 5 MB)
                if (
                    pdfBuffer.length === 0 ||
                    pdfBuffer.length > 5 * 1024 * 1024
                ) {
                    return res.status(400).json({
                        message: "PDF must be under 5MB."
                    });
                }

                // Check PDF file signature
                if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
                    return res.status(400).json({
                        message: "The uploaded file is not a valid PDF."
                    });
                }

                // Generate unique filename
                const uniqueName = `${Date.now()}-${crypto.randomUUID()}.pdf`;

                savedFilePath = path.join(uploadFolder, uniqueName);

                // Save PDF using Node.js File System
                await fs.promises.writeFile(savedFilePath, pdfBuffer, {
                    flag: "wx"
                });

                console.log("PDF saved:", uniqueName);

                // Employee information
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

                // Save employee details in MongoDB
                const result = await employees.insertOne(employeeData);

                console.log("Employee inserted:", result.insertedId);

                res.status(201).json({
                    message: "Employee registered successfully!",
                    employeeId: result.insertedId
                });

            } catch (error) {
                console.error("Submission error:", error);

                // Delete saved PDF if database insertion fails
                if (savedFilePath) {
                    try {
                        await fs.promises.unlink(savedFilePath);
                    } catch (deleteError) {
                        console.error("PDF cleanup error:", deleteError);
                    }
                }

                res.status(500).json({
                    message: "Error saving employee details."
                });
            }
        });

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Server error:", error);
    }
}

startServer();
