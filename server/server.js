const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const User = require("./models/User");
const verifyToken = require('./middleware/verifyToken');
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());


mongoose.connect("mongodb://localhost:27017/visiochat", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;
db.once("open", () => console.log("MongoDB connecté"));
db.on("error", (err) => console.error("Erreur MongoDB:", err));


app.use('/api/auth', authRoutes);

app.get('/api/messages', verifyToken, (req, res) => {
    res.json({ message: "Voici les messages du chat pour l'utilisateur", user: req.user });
});

app.post("/api/register", async (req, res) => {
    const { username } = req.body;
    try {
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: "User already exists" });

        const newUser = new User({ username });
        await newUser.save();
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user) return res.status(200).json({ success: true });
        res.status(401).json({ error: "User not found" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


let users = [];

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (username) => {
        socket.username = username;
        users.push({ id: socket.id, username });
        io.emit("user-connected", username);
    });

    socket.on("message", (data) => {
        io.emit("message", data);
    });


    socket.on("call-user", (data) => {
        io.to(data.to).emit("call-made", {
            offer: data.offer,
            from: socket.id,
        });
    });


    socket.on("make-answer", (data) => {
        io.to(data.to).emit("answer-made", {
            answer: data.answer,
            from: socket.id,
        });
    });


    socket.on("ice-candidate", (data) => {
        io.to(data.to).emit("ice-candidate", {
            candidate: data.candidate,
            from: socket.id,
        });
    });

    socket.on("disconnect", () => {
        users = users.filter(user => user.id !== socket.id);
        io.emit("user-disconnected", socket.username);
    });
});



const PORT = process.env.PORT || 3000;
server.listen(3000, '0.0.0.0', () => console.log("Backend sur toutes les interfaces"));

