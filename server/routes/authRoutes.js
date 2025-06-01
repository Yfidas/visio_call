const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { register, login } = require('../controllers/authController');

router.post('/register', register);


router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Mot de passe incorrect" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || "secret123",
            { expiresIn: "1h" }
        );

        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

module.exports = router;
